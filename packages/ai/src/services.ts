/**
 * Customer-confirmed commerce actions. These run only on an explicit
 * customer action (web Confirm button, Telegram inline button) — never from
 * a model tool call. Placing an order records it as Walrus memory right away.
 * In a demo shop the payment is simulated and confirmed in the same step.
 */
import { and, desc, eq, gt, inArray } from "drizzle-orm";
import { audit, conversations, merchants, orders, type Customer, type Db, type Merchant } from "@nia/database";
import {
  accountCustomerIds,
  accountForCustomer,
  bookingSummary,
  confirmBookingRequest,
  demoPayment,
  orderSummary,
  getCustomerRecentOrders,
  settleDemoBooking,
  settleDemoOrder,
  startPayment,
  submitDraft,
  transitionBooking,
  transitionOrder,
  type BookingSummaryData,
  type OrderSummaryData,
  type PaymentStart,
} from "@nia/commerce";
import { rememberOrderPatterns, rememberPastOrder, rememberPastService, type MemoryReceipt, type MemoryStore } from "@nia/memory";
import { AppError, formatMoney, toMinorUnits, type Channel, type ShoppingSession } from "@nia/shared";
import { bookings } from "@nia/database";

export interface ActionContext {
  db: Db;
  store: MemoryStore | null;
  merchant: Merchant;
  customer: Customer;
  channel: Channel;
}

function memoryAllowed(ctx: ActionContext): boolean {
  return Boolean(ctx.store) && ctx.merchant.niaSettings.memoryEnabled && ctx.customer.memoryEnabled;
}

/** What happened at a demo checkout, for the order memory (third person, from the order itself). */
export function checkoutOutcome(o: OrderSummaryData): string | null {
  if (o.paymentMode !== "demo" || o.paymentStatus !== "paid") return null;
  const where =
    o.status === "ready" && o.fulfillmentMethod === "pickup"
      ? `ready for pickup${o.pickupAddress ? ` at ${o.pickupAddress}` : ""}`
      : o.status === "dispatched"
        ? `sent out for delivery to ${o.deliveryArea ?? "their area"}${o.estimate ? `, expected ${o.estimate.label}` : ""}`
        : o.status === "delivered"
          ? "delivered"
          : o.status === "ready"
            ? "packed and ready to go out"
            : "being prepared";
  return `Paid with a simulated demo payment; ${where}.`;
}

function describeSession(s: ShoppingSession | undefined, currency: string, locale: string): string | null {
  if (!s) return null;
  const i = s.intent ?? {};
  const b = s.basket;
  const money = (major: number) => formatMoney(toMinorUnits(major, currency), currency, { locale });
  const budget = b?.budget ?? i.budgetMax;
  const parts = [
    (b?.goal ?? i.goal) && `goal "${(b?.goal ?? i.goal)!.slice(0, 60)}"`,
    i.recipient && `for ${i.recipient.slice(0, 40)}`,
    i.occasion && `occasion: ${i.occasion.slice(0, 40)}`,
    b?.people && `${b.people} people`,
    budget != null && `budget up to ${money(budget)}`,
    i.excluded?.length && `avoided ${i.excluded.slice(0, 4).join(", ")}`,
    i.preferred?.length && `preferred ${i.preferred.slice(0, 4).join(", ")}`,
  ].filter(Boolean);
  return parts.length ? `${parts.join("; ")}.` : null;
}

/**
 * The shopping decisions behind an order: the conversation it was built in, or
 * a Walrus Market conversation (last 24 hours) that showed or planned one of its items.
 */
export async function shoppingContext(db: Db, merchant: Merchant, customer: Customer, order: OrderSummaryData): Promise<string | null> {
  const [row] = await db.select({ conversationId: orders.conversationId }).from(orders).where(eq(orders.id, order.id));
  if (row?.conversationId) {
    const [c] = await db.select({ session: conversations.session }).from(conversations).where(eq(conversations.id, row.conversationId));
    const own = describeSession(c?.session, order.currency, merchant.locale);
    if (own) return own;
  }
  const productIds = new Set(order.items.map((i) => i.productId).filter(Boolean));
  if (!productIds.size) return null;
  const ids = await accountCustomerIds(db, await accountForCustomer(db, customer.id));
  if (!ids.length) return null;
  const recent = await db
    .select({ session: conversations.session })
    .from(conversations)
    .innerJoin(merchants, eq(merchants.id, conversations.merchantId))
    .where(and(inArray(conversations.customerId, ids), eq(merchants.kind, "market"), gt(conversations.lastMessageAt, new Date(Date.now() - 24 * 3_600_000))))
    .orderBy(desc(conversations.lastMessageAt))
    .limit(3);
  const shown = (s: ShoppingSession) => [...(s.basket?.lines ?? []).map((l) => l.productId), ...(s.lastResults ?? []).map((r) => r.id), ...(s.shortlist ?? []).map((r) => r.id)];
  const match = recent.find((r) => shown(r.session).some((id) => productIds.has(id)));
  return match ? describeSession(match.session, order.currency, merchant.locale) : null;
}

export async function confirmCustomerOrder(
  ctx: ActionContext,
  orderId?: string,
): Promise<{ summary: OrderSummaryData; payment: PaymentStart | null; receipt: MemoryReceipt | null }> {
  const { db, merchant, customer } = ctx;
  let summary = await submitDraft(db, { merchantId: merchant.id, customerId: customer.id, orderId });

  let payment: PaymentStart | null = null;
  if (summary.checkout === "demo") {
    // Demo shop: a simulated payment confirmed at once — nobody waits for an owner.
    summary = await settleDemoOrder(db, { merchantId: merchant.id, orderId: summary.id });
    payment = demoPayment(summary);
  } else {
    const [order] = await db.select().from(orders).where(and(eq(orders.id, summary.id), eq(orders.merchantId, merchant.id)));
    try {
      payment = await startPayment(db, order!, merchant, customer.email);
    } catch (err) {
      console.error("[payments] could not start payment", (err as Error).message);
    }
  }
  const submitted = summary;

  // Saved now, at checkout — not when the order is collected or delivered.
  let receipt: MemoryReceipt | null = null;
  if (memoryAllowed(ctx)) {
    try {
      receipt = await rememberPastOrder(db, ctx.store, {
        merchantId: merchant.id,
        customerId: customer.id,
        orderId: submitted.id,
        orderNumber: submitted.number!,
        placedAt: new Date(submitted.submittedAt ?? Date.now()),
        channel: ctx.channel,
        currency: submitted.currency,
        locale: merchant.locale,
        items: submitted.items.map((i) => ({ name: i.name, variantLabel: i.variantLabel, quantity: i.quantity, unit: i.unit, unitPrice: i.unitPrice })),
        fulfillmentMethod: submitted.fulfillmentMethod,
        deliveryArea: submitted.deliveryArea,
        total: submitted.total,
        hasUnpricedItems: submitted.hasUnpricedItems,
        outcome: checkoutOutcome(submitted),
        context: await shoppingContext(db, merchant, customer, submitted).catch(() => null),
      });
      // Repeated choices across real orders become evidence-sized observations.
      const history = await getCustomerRecentOrders(db, merchant.id, customer.id, 20);
      await rememberOrderPatterns(db, ctx.store, { merchantId: merchant.id, customerId: customer.id, channel: ctx.channel, orders: history });
    } catch (err) {
      console.error("[memory] could not record order memory", (err as Error).message);
    }
  }
  await audit(db, { merchantId: merchant.id, actorType: "customer", actorId: customer.id, action: "order.submitted", targetType: "order", targetId: submitted.id, metadata: { channel: ctx.channel } });
  return { summary: await orderSummary(db, merchant.id, submitted.id), payment, receipt };
}

export async function cancelCustomerOrder(ctx: ActionContext, orderId: string): Promise<OrderSummaryData> {
  const [order] = await ctx.db.select().from(orders).where(and(eq(orders.id, orderId), eq(orders.merchantId, ctx.merchant.id), eq(orders.customerId, ctx.customer.id)));
  if (!order) throw new AppError("NOT_FOUND", "Order not found");
  return transitionOrder(ctx.db, { merchantId: ctx.merchant.id, orderId, to: "cancelled", actor: { type: "customer", id: ctx.customer.id } });
}

export async function confirmCustomerBooking(
  ctx: ActionContext,
  bookingId: string,
): Promise<{ booking: BookingSummaryData; receipt: MemoryReceipt | null }> {
  const { db, merchant, customer } = ctx;
  const requested = await confirmBookingRequest(db, { merchantId: merchant.id, customerId: customer.id, bookingId });
  // Demo shops confirm at once; real shops confirm the request themselves.
  const booking = (await settleDemoBooking(db, { merchantId: merchant.id, bookingId: requested.id })) ?? requested;
  let receipt: MemoryReceipt | null = null;
  if (memoryAllowed(ctx)) {
    try {
      receipt = await rememberPastService(db, ctx.store, {
        merchantId: merchant.id,
        customerId: customer.id,
        bookingId: booking.id,
        serviceName: booking.serviceName,
        startAt: new Date(booking.startAt),
        timeZone: merchant.timezone,
        options: booking.selectedOptions,
        notes: booking.notes,
        channel: ctx.channel,
        outcome: booking.status === "confirmed" ? "The shop confirmed it straight away." : "Waiting for the shop to confirm.",
      });
    } catch (err) {
      console.error("[memory] could not record booking memory", (err as Error).message);
    }
  }
  await audit(db, { merchantId: merchant.id, actorType: "customer", actorId: customer.id, action: "booking.requested", targetType: "booking", targetId: booking.id });
  return { booking, receipt };
}

export async function cancelCustomerBooking(ctx: ActionContext, bookingId: string): Promise<BookingSummaryData> {
  const [b] = await ctx.db.select().from(bookings).where(and(eq(bookings.id, bookingId), eq(bookings.merchantId, ctx.merchant.id), eq(bookings.customerId, ctx.customer.id)));
  if (!b) throw new AppError("NOT_FOUND", "Booking not found");
  if (b.status === "draft") {
    await ctx.db.delete(bookings).where(eq(bookings.id, b.id));
    return bookingSummary({ ...b, status: "cancelled" }, ctx.merchant.timezone);
  }
  return transitionBooking(ctx.db, { merchantId: ctx.merchant.id, bookingId, to: "cancelled", actor: { type: "customer" } });
}
