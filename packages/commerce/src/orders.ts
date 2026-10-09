/**
 * Cart (draft order) and order lifecycle. Every function is scoped by
 * merchantId (+ customerId for customer actions) so one tenant can never
 * touch another tenant's orders. Prices always come from the database.
 */
import { and, desc, eq, inArray, ne, sql } from "drizzle-orm";
import {
  merchants,
  orderEvents,
  orderItems,
  orders,
  products,
  productVariants,
  type Db,
  type Merchant,
  type Order,
  type OrderItem,
} from "@nia/database";
import {
  AppError,
  INVENTORY_LABELS,
  ORDER_STATUS_LABELS,
  ORDER_TRANSITIONS,
  type Channel,
  type FulfillmentMethod,
  type OrderStatus,
} from "@nia/shared";
import { deliveryEstimate, isOverdue } from "./delivery";
import type { OrderLineData, OrderSummaryData } from "./types";

const MAX_QTY = 999;

async function loadMerchant(db: Db, merchantId: string): Promise<Merchant> {
  const [m] = await db.select().from(merchants).where(eq(merchants.id, merchantId));
  if (!m) throw new AppError("NOT_FOUND", "Merchant not found");
  return m;
}

function lineData(i: OrderItem): OrderLineData {
  return {
    id: i.id,
    productId: i.productId,
    variantId: i.variantId,
    name: i.name,
    variantLabel: i.variantLabel,
    options: i.options,
    unit: i.unit,
    unitPrice: i.unitPrice,
    quantity: i.quantity,
    lineTotal: i.lineTotal,
    notes: i.notes,
  };
}

export function blockersFor(order: Order, items: OrderItem[], merchant: Merchant): string[] {
  const blockers: string[] = [];
  if (items.length === 0) blockers.push("Add at least one item");
  if (!order.fulfillmentMethod) {
    const opts = [merchant.fulfillment.delivery && "delivery", merchant.fulfillment.pickup && "pickup"].filter(Boolean).join(" or ");
    blockers.push(`Choose ${opts || "a fulfilment method"}`);
  } else if (order.fulfillmentMethod === "delivery" && !order.deliveryArea) {
    blockers.push("Choose a delivery area");
  }
  return blockers;
}

export async function orderSummary(db: Db, merchantId: string, orderId: string): Promise<OrderSummaryData> {
  const [order] = await db.select().from(orders).where(and(eq(orders.id, orderId), eq(orders.merchantId, merchantId)));
  if (!order) throw new AppError("NOT_FOUND", "Order not found");
  const [items, merchant] = await Promise.all([
    db.select().from(orderItems).where(eq(orderItems.orderId, order.id)).orderBy(orderItems.createdAt),
    loadMerchant(db, merchantId),
  ]);
  // Counted from payment (or, before that, from when the customer confirmed).
  const estimate =
    order.fulfillmentMethod === "delivery" && ESTIMATED.includes(order.status) ? deliveryEstimate(merchant, order.deliveryArea, order.paidAt ?? order.submittedAt ?? order.createdAt) : null;
  return {
    kind: "order",
    id: order.id,
    number: order.number,
    status: order.status,
    statusLabel: ORDER_STATUS_LABELS[order.status],
    channel: order.channel,
    items: items.map(lineData),
    fulfillmentMethod: order.fulfillmentMethod,
    deliveryArea: order.deliveryArea,
    deliveryAddress: order.deliveryAddress,
    deliveryFee: order.deliveryFee,
    subtotal: order.subtotal,
    total: order.total,
    hasUnpricedItems: order.hasUnpricedItems,
    currency: order.currency,
    notes: order.notes,
    paymentMode: order.paymentMode,
    paymentStatus: order.paymentStatus,
    paymentUrl: order.paymentUrl,
    checkout: merchant.isDemo && !order.hasUnpricedItems ? "demo" : "shop",
    pickupAddress: order.fulfillmentMethod === "pickup" ? (merchant.fulfillment.pickupAddress ?? null) : null,
    memoryAssisted: order.memoryAssisted,
    createdAt: order.createdAt.toISOString(),
    submittedAt: order.submittedAt?.toISOString() ?? null,
    paidAt: order.paidAt?.toISOString() ?? null,
    estimate,
    overdue: isOverdue(order.status, estimate),
    blockers: order.status === "draft" ? blockersFor(order, items, merchant) : [],
  };
}

const ESTIMATED: OrderStatus[] = ["paid", "processing", "ready", "dispatched"];

async function recalc(db: Db, order: Order): Promise<void> {
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
  const subtotal = items.reduce((acc, i) => acc + (i.lineTotal ?? 0), 0);
  const hasUnpriced = items.some((i) => i.unitPrice == null);
  const fee = order.fulfillmentMethod === "delivery" ? (order.deliveryFee ?? 0) : 0;
  await db
    .update(orders)
    .set({ subtotal, total: subtotal + fee, hasUnpricedItems: hasUnpriced || (order.fulfillmentMethod === "delivery" && order.deliveryArea != null && order.deliveryFee == null) })
    .where(eq(orders.id, order.id));
}

export async function getDraft(db: Db, merchantId: string, customerId: string): Promise<Order | null> {
  const [draft] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.merchantId, merchantId), eq(orders.customerId, customerId), eq(orders.status, "draft")))
    .orderBy(desc(orders.updatedAt))
    .limit(1);
  return draft ?? null;
}

export async function getOrCreateDraft(
  db: Db,
  { merchantId, customerId, channel, conversationId }: { merchantId: string; customerId: string; channel: Channel; conversationId?: string | null },
): Promise<Order> {
  const existing = await getDraft(db, merchantId, customerId);
  if (existing) return existing;
  const merchant = await loadMerchant(db, merchantId);
  const [created] = await db
    .insert(orders)
    .values({ merchantId, customerId, channel, currency: merchant.currency, paymentMode: merchant.paymentMode, conversationId: conversationId ?? null })
    .returning();
  return created!;
}

export interface AddItemInput {
  merchantId: string;
  customerId: string;
  productId: string;
  variantId?: string | null;
  quantity: number;
  notes?: string | null;
  channel: Channel;
  conversationId?: string | null;
  memoryAssisted?: boolean;
  repeatOfOrderId?: string | null;
}

export async function addItemToDraft(db: Db, input: AddItemInput): Promise<OrderSummaryData> {
  const quantity = Math.floor(input.quantity);
  if (!Number.isFinite(quantity) || quantity < 1 || quantity > MAX_QTY) throw new AppError("VALIDATION", "Quantity must be between 1 and 999");

  const [product] = await db.select().from(products).where(and(eq(products.id, input.productId), eq(products.merchantId, input.merchantId)));
  if (!product || !product.active) throw new AppError("NOT_FOUND", "That item is not in this shop's catalog");
  const variants = await db
    .select()
    .from(productVariants)
    .where(and(eq(productVariants.productId, product.id), eq(productVariants.merchantId, input.merchantId), eq(productVariants.active, true)));

  let variant = null as (typeof variants)[number] | null;
  if (variants.length > 0) {
    if (!input.variantId) {
      throw new AppError("VALIDATION", `Please choose an option for ${product.name}: ${variants.map((v) => v.name).join(", ")}`);
    }
    variant = variants.find((v) => v.id === input.variantId) ?? null;
    if (!variant) throw new AppError("VALIDATION", `That option is not available for ${product.name}`);
  } else if (input.variantId) {
    throw new AppError("VALIDATION", `${product.name} has no options to choose`);
  }

  const status = variant?.inventoryStatus ?? product.inventoryStatus;
  const stock = variant ? variant.stockQuantity : product.stockQuantity;
  if (status === "out_of_stock") {
    throw new AppError("CONFLICT", `${product.name}${variant ? ` (${variant.name})` : ""} is out of stock`);
  }

  const draft = await getOrCreateDraft(db, input);
  const [sameLine] = await db
    .select()
    .from(orderItems)
    .where(
      and(
        eq(orderItems.orderId, draft.id),
        eq(orderItems.productId, product.id),
        variant ? eq(orderItems.variantId, variant.id) : sql`${orderItems.variantId} is null`,
      ),
    );
  const newQty = (sameLine?.quantity ?? 0) + quantity;
  if (stock != null && status !== "made_to_order" && newQty > stock) {
    throw new AppError("CONFLICT", `Only ${stock} ${product.unit ?? "unit"}${stock === 1 ? "" : "s"} of ${product.name}${variant ? ` (${variant.name})` : ""} available`);
  }
  const unitPrice = variant?.price ?? product.price;
  if (sameLine) {
    await db
      .update(orderItems)
      .set({ quantity: newQty, lineTotal: unitPrice != null ? unitPrice * newQty : null, notes: input.notes ?? sameLine.notes })
      .where(eq(orderItems.id, sameLine.id));
  } else {
    await db.insert(orderItems).values({
      orderId: draft.id,
      merchantId: input.merchantId,
      productId: product.id,
      variantId: variant?.id ?? null,
      kind: product.kind,
      name: product.name,
      variantLabel: variant?.name ?? null,
      options: variant?.options ?? {},
      unit: product.unit,
      unitPrice,
      quantity,
      lineTotal: unitPrice != null ? unitPrice * quantity : null,
      notes: input.notes ?? null,
    });
  }
  if (input.memoryAssisted || input.repeatOfOrderId) {
    await db
      .update(orders)
      .set({ memoryAssisted: draft.memoryAssisted || Boolean(input.memoryAssisted), repeatOfOrderId: input.repeatOfOrderId ?? draft.repeatOfOrderId })
      .where(eq(orders.id, draft.id));
  }
  await recalc(db, (await getDraft(db, input.merchantId, input.customerId))!);
  return orderSummary(db, input.merchantId, draft.id);
}

async function requireDraftItem(db: Db, merchantId: string, customerId: string, itemId: string) {
  const draft = await getDraft(db, merchantId, customerId);
  if (!draft) throw new AppError("NOT_FOUND", "Your cart is empty");
  const [item] = await db.select().from(orderItems).where(and(eq(orderItems.id, itemId), eq(orderItems.orderId, draft.id)));
  if (!item) throw new AppError("NOT_FOUND", "That item is not in your cart");
  return { draft, item };
}

export async function updateDraftItem(
  db: Db,
  { merchantId, customerId, itemId, quantity, variantId, notes }: { merchantId: string; customerId: string; itemId: string; quantity?: number; variantId?: string | null; notes?: string | null },
): Promise<OrderSummaryData> {
  const { draft, item } = await requireDraftItem(db, merchantId, customerId, itemId);
  if (variantId && variantId !== item.variantId && item.productId) {
    // Changing option = replace the line with the new variant at its current price.
    await db.delete(orderItems).where(eq(orderItems.id, item.id));
    await recalc(db, draft);
    return addItemToDraft(db, { merchantId, customerId, productId: item.productId, variantId, quantity: quantity ?? item.quantity, notes: notes ?? item.notes, channel: draft.channel });
  }
  const qty = quantity ?? item.quantity;
  if (qty < 1 || qty > MAX_QTY) throw new AppError("VALIDATION", "Quantity must be between 1 and 999");
  if (item.productId) {
    const [stockRow] = item.variantId
      ? await db.select({ stock: productVariants.stockQuantity, status: productVariants.inventoryStatus }).from(productVariants).where(eq(productVariants.id, item.variantId))
      : await db.select({ stock: products.stockQuantity, status: products.inventoryStatus }).from(products).where(eq(products.id, item.productId));
    if (stockRow?.stock != null && stockRow.status !== "made_to_order" && qty > stockRow.stock) {
      throw new AppError("CONFLICT", `Only ${stockRow.stock} available`);
    }
  }
  await db
    .update(orderItems)
    .set({ quantity: qty, lineTotal: item.unitPrice != null ? item.unitPrice * qty : null, notes: notes === undefined ? item.notes : notes })
    .where(eq(orderItems.id, item.id));
  await recalc(db, draft);
  return orderSummary(db, merchantId, draft.id);
}

export async function removeDraftItem(db: Db, { merchantId, customerId, itemId }: { merchantId: string; customerId: string; itemId: string }): Promise<OrderSummaryData> {
  const { draft, item } = await requireDraftItem(db, merchantId, customerId, itemId);
  await db.delete(orderItems).where(eq(orderItems.id, item.id));
  await recalc(db, draft);
  return orderSummary(db, merchantId, draft.id);
}

export async function setDraftFulfillment(
  db: Db,
  input: {
    merchantId: string;
    customerId: string;
    method: FulfillmentMethod;
    deliveryArea?: string | null;
    deliveryAddress?: string | null;
    notes?: string | null;
    channel: Channel;
  },
): Promise<OrderSummaryData> {
  const merchant = await loadMerchant(db, input.merchantId);
  const draft = await getOrCreateDraft(db, input);
  if (input.method === "pickup") {
    if (!merchant.fulfillment.pickup) throw new AppError("VALIDATION", `${merchant.name} does not offer pickup`);
    await db
      .update(orders)
      .set({ fulfillmentMethod: "pickup", deliveryArea: null, deliveryFee: null, deliveryAddress: null, ...(input.notes !== undefined ? { notes: input.notes } : {}) })
      .where(eq(orders.id, draft.id));
  } else {
    if (!merchant.fulfillment.delivery) throw new AppError("VALIDATION", `${merchant.name} does not offer delivery`);
    let areaName: string | null = null;
    let fee: number | null = null;
    if (input.deliveryArea) {
      const wanted = input.deliveryArea.trim().toLowerCase();
      const area =
        merchant.deliveryAreas.find((a) => a.name.toLowerCase() === wanted) ??
        merchant.deliveryAreas.find((a) => wanted.includes(a.name.toLowerCase()) || a.name.toLowerCase().includes(wanted));
      if (!area) {
        const list = merchant.deliveryAreas.map((a) => a.name).join(", ");
        throw new AppError("VALIDATION", `${merchant.name} doesn't list "${input.deliveryArea}" as a delivery area${list ? `. Available: ${list}` : ""}`);
      }
      areaName = area.name;
      fee = area.fee;
    }
    await db
      .update(orders)
      .set({
        fulfillmentMethod: "delivery",
        deliveryArea: areaName,
        deliveryFee: fee,
        deliveryAddress: input.deliveryAddress ?? draft.deliveryAddress,
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
      })
      .where(eq(orders.id, draft.id));
  }
  await recalc(db, (await getDraft(db, input.merchantId, input.customerId))!);
  return orderSummary(db, input.merchantId, draft.id);
}

export async function setDraftNotes(db: Db, { merchantId, customerId, notes }: { merchantId: string; customerId: string; notes: string | null }): Promise<OrderSummaryData> {
  const draft = await getDraft(db, merchantId, customerId);
  if (!draft) throw new AppError("NOT_FOUND", "Your cart is empty");
  await db.update(orders).set({ notes: notes?.slice(0, 1000) ?? null }).where(eq(orders.id, draft.id));
  return orderSummary(db, merchantId, draft.id);
}

/**
 * Customer explicitly confirmed the summary: draft → awaiting_confirmation.
 * Assigns the order number and reserves stock atomically.
 */
export async function submitDraft(
  db: Db,
  { merchantId, customerId, orderId }: { merchantId: string; customerId: string; orderId?: string },
): Promise<OrderSummaryData> {
  const draft = orderId
    ? (await db.select().from(orders).where(and(eq(orders.id, orderId), eq(orders.merchantId, merchantId), eq(orders.customerId, customerId), eq(orders.status, "draft"))))[0]
    : await getDraft(db, merchantId, customerId);
  if (!draft) throw new AppError("NOT_FOUND", "There is no cart to confirm");
  const merchant = await loadMerchant(db, merchantId);
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, draft.id));
  const blockers = blockersFor(draft, items, merchant);
  if (blockers.length) throw new AppError("VALIDATION", blockers.join(". "));

  await db.transaction(async (tx) => {
    // Re-validate stock and reserve it.
    for (const item of items) {
      if (!item.productId) continue;
      if (item.variantId) {
        const [v] = await tx.select().from(productVariants).where(eq(productVariants.id, item.variantId));
        if (!v || !v.active || v.inventoryStatus === "out_of_stock") throw new AppError("CONFLICT", `${item.name} (${item.variantLabel}) is no longer available`);
        if (v.stockQuantity != null && v.inventoryStatus !== "made_to_order") {
          if (v.stockQuantity < item.quantity) throw new AppError("CONFLICT", `Only ${v.stockQuantity} of ${item.name} (${item.variantLabel}) left`);
          const left = v.stockQuantity - item.quantity;
          await tx
            .update(productVariants)
            .set({ stockQuantity: left, inventoryStatus: left === 0 ? "out_of_stock" : left <= 3 ? "low_stock" : v.inventoryStatus })
            .where(eq(productVariants.id, v.id));
        }
      } else {
        const [p] = await tx.select().from(products).where(eq(products.id, item.productId));
        if (!p || !p.active || p.inventoryStatus === "out_of_stock") throw new AppError("CONFLICT", `${item.name} is no longer available`);
        if (p.stockQuantity != null && p.inventoryStatus !== "made_to_order") {
          if (p.stockQuantity < item.quantity) throw new AppError("CONFLICT", `Only ${p.stockQuantity} of ${item.name} left`);
          const left = p.stockQuantity - item.quantity;
          await tx
            .update(products)
            .set({ stockQuantity: left, inventoryStatus: left === 0 ? "out_of_stock" : left <= 3 ? "low_stock" : p.inventoryStatus })
            .where(eq(products.id, p.id));
        }
      }
    }
    const [seq] = await tx
      .update(merchants)
      .set({ nextOrderNumber: sql`${merchants.nextOrderNumber} + 1` })
      .where(eq(merchants.id, merchantId))
      .returning({ next: merchants.nextOrderNumber });
    const now = new Date();
    await tx
      .update(orders)
      .set({ status: "awaiting_confirmation", number: seq!.next - 1, submittedAt: now, paymentStatus: "unpaid" })
      .where(eq(orders.id, draft.id));
    await tx.insert(orderEvents).values({ orderId: draft.id, merchantId, fromStatus: "draft", toStatus: "awaiting_confirmation", actorType: "customer", actorId: customerId, note: "Customer confirmed the order summary" });
  });
  return orderSummary(db, merchantId, draft.id);
}

const TIMESTAMP_FOR: Partial<Record<OrderStatus, keyof Order>> = {
  confirmed: "confirmedAt",
  paid: "paidAt",
  delivered: "deliveredAt",
  cancelled: "cancelledAt",
};

export async function transitionOrder(
  db: Db,
  { merchantId, orderId, to, actor, note }: { merchantId: string; orderId: string; to: OrderStatus; actor: { type: "customer" | "merchant" | "system"; id?: string }; note?: string },
): Promise<OrderSummaryData> {
  const [order] = await db.select().from(orders).where(and(eq(orders.id, orderId), eq(orders.merchantId, merchantId)));
  if (!order) throw new AppError("NOT_FOUND", "Order not found");
  if (!ORDER_TRANSITIONS[order.status].includes(to)) {
    throw new AppError("CONFLICT", `Cannot move an order from ${ORDER_STATUS_LABELS[order.status]} to ${ORDER_STATUS_LABELS[to]}`);
  }
  if (actor.type === "customer" && to !== "cancelled") throw new AppError("FORBIDDEN", "Customers can only cancel orders");
  if (actor.type === "customer" && !["draft", "awaiting_confirmation"].includes(order.status)) {
    throw new AppError("FORBIDDEN", "This order is already being processed — please contact the shop to cancel");
  }
  const now = new Date();
  const tsKey = TIMESTAMP_FOR[to];
  await db.transaction(async (tx) => {
    await tx
      .update(orders)
      .set({
        status: to,
        ...(tsKey ? { [tsKey]: now } : {}),
        ...(to === "paid" ? { paymentStatus: "paid" as const } : {}),
        ...(to === "refunded" ? { paymentStatus: "refunded" as const } : {}),
      })
      .where(eq(orders.id, order.id));
    // Release reserved stock when a submitted order is cancelled before dispatch.
    if (to === "cancelled" && order.status !== "draft") {
      const items = await tx.select().from(orderItems).where(eq(orderItems.orderId, order.id));
      for (const item of items) {
        if (item.variantId) {
          await tx
            .update(productVariants)
            .set({
              stockQuantity: sql`case when ${productVariants.stockQuantity} is null then null else ${productVariants.stockQuantity} + ${item.quantity} end`,
              inventoryStatus: sql`case when ${productVariants.inventoryStatus} = 'out_of_stock' and ${productVariants.stockQuantity} is not null then 'low_stock' else ${productVariants.inventoryStatus} end`,
            })
            .where(eq(productVariants.id, item.variantId));
        } else if (item.productId) {
          await tx
            .update(products)
            .set({
              stockQuantity: sql`case when ${products.stockQuantity} is null then null else ${products.stockQuantity} + ${item.quantity} end`,
              inventoryStatus: sql`case when ${products.inventoryStatus} = 'out_of_stock' and ${products.stockQuantity} is not null then 'low_stock' else ${products.inventoryStatus} end`,
            })
            .where(eq(products.id, item.productId));
        }
      }
    }
    await tx.insert(orderEvents).values({ orderId: order.id, merchantId, fromStatus: order.status, toStatus: to, actorType: actor.type, actorId: actor.id ?? null, note: note ?? null });
  });
  return orderSummary(db, merchantId, order.id);
}

export async function getCustomerRecentOrders(db: Db, merchantId: string, customerId: string, limit = 5): Promise<OrderSummaryData[]> {
  const rows = await db
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.merchantId, merchantId), eq(orders.customerId, customerId), ne(orders.status, "draft")))
    .orderBy(desc(orders.submittedAt), desc(orders.createdAt))
    .limit(Math.min(limit, 20));
  return Promise.all(rows.map((r) => orderSummary(db, merchantId, r.id)));
}

export async function getCustomerOrder(db: Db, merchantId: string, customerId: string, orderIdOrNumber: string | number): Promise<OrderSummaryData | null> {
  const byNumber = typeof orderIdOrNumber === "number" || /^\d+$/.test(String(orderIdOrNumber));
  const [row] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(
      and(
        eq(orders.merchantId, merchantId),
        eq(orders.customerId, customerId),
        byNumber ? eq(orders.number, Number(orderIdOrNumber)) : eq(orders.id, String(orderIdOrNumber)),
      ),
    );
  return row ? orderSummary(db, merchantId, row.id) : null;
}

export interface ReorderResult {
  summary: OrderSummaryData;
  added: string[];
  unavailable: string[];
  /** The same lines, structured — for finding alternatives. */
  unavailableItems: { name: string; productId: string | null; variantId: string | null; quantity: number }[];
  /** The open cart was already started from this order — nothing was added again. */
  alreadyInCart?: boolean;
}

/** "Same as last time": copy a previous order's lines into the cart at today's prices and stock. */
export async function reorderToDraft(
  db: Db,
  { merchantId, customerId, orderId, channel, conversationId }: { merchantId: string; customerId: string; orderId: string; channel: Channel; conversationId?: string | null },
): Promise<ReorderResult> {
  const [source] = await db.select().from(orders).where(and(eq(orders.id, orderId), eq(orders.merchantId, merchantId), eq(orders.customerId, customerId)));
  if (!source) throw new AppError("NOT_FOUND", "Previous order not found");
  const items = await db.select().from(orderItems).where(eq(orderItems.orderId, source.id));
  // Repeating the same order twice ("Same quantity" after the cart was already started) must not double it.
  const open = await getDraft(db, merchantId, customerId);
  if (open?.repeatOfOrderId === source.id) {
    const inCart = await db.select().from(orderItems).where(eq(orderItems.orderId, open.id));
    const has = (i: (typeof items)[number]) => !i.productId || inCart.some((c) => c.productId === i.productId && c.variantId === i.variantId);
    if (items.every(has)) return { summary: await orderSummary(db, merchantId, open.id), added: [], unavailable: [], unavailableItems: [], alreadyInCart: true };
  }
  const added: string[] = [];
  const unavailable: string[] = [];
  const unavailableItems: ReorderResult["unavailableItems"] = [];
  for (const item of items) {
    const label = `${item.name}${item.variantLabel ? ` (${item.variantLabel})` : ""}`;
    if (!item.productId) {
      unavailable.push(item.name);
      unavailableItems.push({ name: label, productId: null, variantId: null, quantity: item.quantity });
      continue;
    }
    try {
      await addItemToDraft(db, {
        merchantId,
        customerId,
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
        notes: item.notes,
        channel,
        conversationId,
        memoryAssisted: true,
        repeatOfOrderId: source.id,
      });
      added.push(`${item.quantity} × ${item.name}${item.variantLabel ? ` (${item.variantLabel})` : ""}`);
    } catch (err) {
      unavailable.push(`${label}: ${(err as Error).message}`);
      unavailableItems.push({ name: label, productId: item.productId, variantId: item.variantId, quantity: item.quantity });
    }
  }
  const draft = await getOrCreateDraft(db, { merchantId, customerId, channel, conversationId });
  return { summary: await orderSummary(db, merchantId, draft.id), added, unavailable, unavailableItems };
}

export function describeAvailability(status: keyof typeof INVENTORY_LABELS): string {
  return INVENTORY_LABELS[status];
}

export async function ordersForMerchant(db: Db, merchantId: string, { statuses, limit = 50 }: { statuses?: OrderStatus[]; limit?: number } = {}) {
  const conditions = [eq(orders.merchantId, merchantId), ne(orders.status, "draft")];
  if (statuses?.length) conditions.push(inArray(orders.status, statuses));
  return db.select().from(orders).where(and(...conditions)).orderBy(desc(orders.submittedAt), desc(orders.createdAt)).limit(limit);
}
