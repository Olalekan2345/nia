/**
 * One cart view across every shop. Each shop still keeps its own cart,
 * delivery, payment and confirmation (they are separate businesses); this
 * gathers the signed-in account's carts so they can be seen, edited and
 * confirmed from one place. Only ever reads that account's own customers.
 */
import { and, desc, eq, inArray, isNull, ne, sql } from "drizzle-orm";
import { customerIdentities, customers, merchants, orderItems, orders, type Db, type Merchant } from "@nia/database";
import type { DeliveryArea } from "@nia/shared";
import { orderSummary } from "./orders";
import type { OrderSummaryData } from "./types";

export interface ShopCart {
  shop: {
    id: string;
    slug: string;
    name: string;
    logoUrl: string | null;
    accentColor: string;
    locale: string;
    currency: string;
    delivery: boolean;
    pickup: boolean;
    pickupAddress: string | null;
    deliveryAreas: DeliveryArea[];
    paymentInstructions: string | null;
    telegramEnabled: boolean;
  };
  cart: OrderSummaryData;
}

function shopOf(m: Merchant): ShopCart["shop"] {
  return {
    id: m.id,
    slug: m.slug,
    name: m.name,
    logoUrl: m.logoUrl,
    accentColor: m.accentColor,
    locale: m.locale,
    currency: m.currency,
    delivery: m.fulfillment.delivery,
    pickup: m.fulfillment.pickup,
    pickupAddress: m.fulfillment.pickupAddress ?? null,
    deliveryAreas: m.deliveryAreas,
    paymentInstructions: m.paymentInstructions,
    telegramEnabled: m.telegramEnabled,
  };
}

async function cartsForCustomers(db: Db, customerIds: string[]): Promise<ShopCart[]> {
  if (customerIds.length === 0) return [];
  const drafts = await db
    .select({ id: orders.id, merchantId: orders.merchantId })
    .from(orders)
    .where(and(inArray(orders.customerId, customerIds), eq(orders.status, "draft")))
    .orderBy(desc(orders.createdAt));
  if (drafts.length === 0) return [];
  const shops = await db
    .select()
    .from(merchants)
    .where(and(inArray(merchants.id, [...new Set(drafts.map((d) => d.merchantId))]), eq(merchants.kind, "shop"), ne(merchants.status, "paused")));
  const out: ShopCart[] = [];
  for (const d of drafts) {
    const shop = shops.find((s) => s.id === d.merchantId);
    if (!shop || out.some((c) => c.shop.id === shop.id)) continue;
    const cart = await orderSummary(db, shop.id, d.id);
    if (cart.items.length) out.push({ shop: shopOf(shop), cart });
  }
  return out;
}

/** Who the shopper is: a web account and/or a Telegram user. */
export interface Account {
  userId?: string | null;
  telegramUserId?: number | null;
}

/**
 * Every customer record (one per shop) that belongs to this account: linked by
 * user id, by a verified web identity, or by the Telegram identity. Never by name.
 */
export async function accountCustomerIds(db: Db, { userId, telegramUserId }: Account): Promise<string[]> {
  const ids = new Set<string>();
  if (userId) {
    for (const c of await db.select({ id: customers.id }).from(customers).where(and(eq(customers.userId, userId), isNull(customers.mergedIntoId)))) ids.add(c.id);
    for (const c of await db.select({ id: customerIdentities.customerId }).from(customerIdentities).where(and(eq(customerIdentities.provider, "WEB_AUTH"), eq(customerIdentities.subject, userId)))) ids.add(c.id);
  }
  if (telegramUserId) {
    for (const c of await db.select({ id: customerIdentities.customerId }).from(customerIdentities).where(and(eq(customerIdentities.provider, "TELEGRAM"), eq(customerIdentities.subject, String(telegramUserId))))) ids.add(c.id);
  }
  if (!ids.size) return [];
  // Merged duplicates hand their carts to the surviving record.
  const live = await db.select({ id: customers.id }).from(customers).where(and(inArray(customers.id, [...ids]), isNull(customers.mergedIntoId)));
  return live.map((c) => c.id);
}

/** The account's non-empty carts, one per shop, most recent first. */
export async function cartsForAccount(db: Db, account: Account): Promise<ShopCart[]> {
  return cartsForCustomers(db, await accountCustomerIds(db, account));
}

/** Orders this account just placed (for the confirmation panel) — never another customer's. */
export async function placedOrdersForAccount(db: Db, account: Account, orderIds: string[]): Promise<(OrderSummaryData & { shop: ShopCart["shop"] })[]> {
  const ids = orderIds.filter((id) => /^[0-9a-f-]{36}$/i.test(id)).slice(0, 12);
  if (ids.length === 0) return [];
  const own = await accountCustomerIds(db, account);
  if (own.length === 0) return [];
  const rows = await db
    .select({ id: orders.id, merchantId: orders.merchantId })
    .from(orders)
    .where(and(inArray(orders.id, ids), inArray(orders.customerId, own), ne(orders.status, "draft")));
  const shops = rows.length ? await db.select().from(merchants).where(inArray(merchants.id, [...new Set(rows.map((r) => r.merchantId))])) : [];
  return Promise.all(rows.map(async (r) => ({ ...(await orderSummary(db, r.merchantId, r.id)), shop: shopOf(shops.find((s) => s.id === r.merchantId)!) })));
}

/** Items (lines) across all carts, for the header badge. */
export function cartLineCount(carts: ShopCart[]): number {
  return carts.reduce((n, c) => n + c.cart.items.length, 0);
}

/** The header badge: cart lines across every shop for this account. */
export async function cartLineCountForAccount(db: Db, account: Account): Promise<number> {
  const own = await accountCustomerIds(db, account);
  if (own.length === 0) return 0;
  const [row] = await db
    .select({ n: sql<number>`count(${orderItems.id})::int` })
    .from(orderItems)
    .innerJoin(orders, eq(orders.id, orderItems.orderId))
    .innerJoin(merchants, eq(merchants.id, orders.merchantId))
    .where(and(inArray(orders.customerId, own), eq(orders.status, "draft"), eq(merchants.kind, "shop"), ne(merchants.status, "paused")));
  return row?.n ?? 0;
}
