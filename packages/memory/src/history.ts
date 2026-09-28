/**
 * Order / booking history memories. Written by the application when a
 * customer actually places an order or books — never from chat claims — so
 * "same as last time" can be answered from Walrus recall in any channel.
 */
import { formatMoney, type Channel } from "@nia/shared";
import type { Db } from "@nia/database";
import { persistMemory, type MemoryReceipt } from "./service";
import type { MemoryStore } from "./store";

export interface OrderMemoryInput {
  merchantId: string;
  customerId: string;
  orderId: string;
  orderNumber: number;
  placedAt: Date;
  channel: Channel;
  currency: string;
  locale?: string;
  items: { name: string; variantLabel?: string | null; quantity: number; unit?: string | null; unitPrice: number | null }[];
  fulfillmentMethod: "delivery" | "pickup" | null;
  deliveryArea?: string | null;
  total: number;
  hasUnpricedItems: boolean;
  occasion?: string | null;
  notes?: string | null;
}

function describeItem(i: OrderMemoryInput["items"][number], currency: string, locale?: string): string {
  const unit = i.unit && !["piece", "item"].includes(i.unit) ? ` ${i.unit}${i.quantity === 1 ? "" : "s"} of` : " ×";
  const qty = unit.endsWith("of") ? `${i.quantity}${unit}` : `${i.quantity}${unit}`;
  const variant = i.variantLabel ? ` (${i.variantLabel})` : "";
  const price = i.unitPrice != null ? ` at ${formatMoney(i.unitPrice, currency, { locale })} each` : " (price to be quoted)";
  return `${qty} ${i.name}${variant}${price}`;
}

export function orderStatement(o: OrderMemoryInput): string {
  const date = o.placedAt.toISOString().slice(0, 10);
  const items = o.items.map((i) => describeItem(i, o.currency, o.locale)).join("; ");
  const fulfil =
    o.fulfillmentMethod === "pickup"
      ? "Collected by pickup."
      : o.deliveryArea
        ? `Delivery to ${o.deliveryArea}.`
        : "";
  const total = o.hasUnpricedItems ? "Total to be confirmed after quote." : `Order total ${formatMoney(o.total, o.currency, { locale: o.locale })}.`;
  const occasion = o.occasion ? ` Occasion: ${o.occasion}.` : "";
  return `Customer placed order #${o.orderNumber} on ${date}: ${items}. ${fulfil} ${total}${occasion}`.replace(/\s+/g, " ").trim();
}

export function orderLabel(o: OrderMemoryInput): string {
  const first = o.items[0];
  if (!first) return `Order #${o.orderNumber}`;
  const more = o.items.length > 1 ? ` + ${o.items.length - 1} more` : "";
  const variant = first.variantLabel ? ` (${first.variantLabel})` : "";
  return `Order #${o.orderNumber}: ${first.quantity} × ${first.name}${variant}${more}`.slice(0, 120);
}

export async function rememberPastOrder(db: Db, store: MemoryStore | null, o: OrderMemoryInput): Promise<MemoryReceipt> {
  return persistMemory(db, store, {
    merchantId: o.merchantId,
    customerId: o.customerId,
    scope: "customer",
    type: "PAST_ORDER",
    subject: `order_${o.orderNumber}`,
    value: o.orderId,
    statement: orderStatement(o),
    label: orderLabel(o),
    confirmation: "observed_from_orders",
    explicit: true,
    confidence: 1,
    importance: 0.9,
    durability: "long_term",
    score: 0.95,
    significant: true,
    sourceKind: "order",
    channel: o.channel,
    orderId: o.orderId,
    supersede: false,
  });
}

/**
 * Repeated behaviour raises confidence — but only to what the evidence says.
 * "Customer has chosen Black in 3 previous orders", never "loves black".
 */
export function observedPatterns(
  orders: { status: string; items: { options: Record<string, string> }[] }[],
  minCount = 2,
): { key: "colour" | "size"; value: string; count: number }[] {
  const counted = new Map<string, { key: "colour" | "size"; value: string; count: number }>();
  for (const o of orders) {
    if (o.status === "cancelled" || o.status === "draft") continue;
    const seenInOrder = new Set<string>();
    for (const item of o.items) {
      for (const [rawKey, value] of Object.entries(item.options)) {
        const key = /^colou?r$/i.test(rawKey) ? "colour" : /^size$/i.test(rawKey) ? "size" : null;
        if (!key || !value) continue;
        const id = `${key}:${value.toLowerCase()}`;
        if (seenInOrder.has(id)) continue; // count orders, not line items
        seenInOrder.add(id);
        const cur = counted.get(id) ?? { key, value, count: 0 };
        cur.count++;
        counted.set(id, cur);
      }
    }
  }
  return [...counted.values()].filter((p) => p.count >= minCount).sort((a, b) => b.count - a.count);
}

export async function rememberOrderPatterns(
  db: Db,
  store: MemoryStore | null,
  input: { merchantId: string; customerId: string; channel: Channel; orders: { status: string; items: { options: Record<string, string> }[] }[] },
): Promise<MemoryReceipt[]> {
  const receipts: MemoryReceipt[] = [];
  for (const p of observedPatterns(input.orders).slice(0, 3)) {
    const what = p.key === "colour" ? p.value : `size ${p.value}`;
    receipts.push(
      await persistMemory(db, store, {
        merchantId: input.merchantId,
        customerId: input.customerId,
        scope: "customer",
        type: p.key === "size" ? "SIZE_OR_VARIANT" : "CUSTOMER_PREFERENCE",
        subject: `observed_${p.key}_${p.value}`,
        value: `${p.value} x${p.count}`,
        statement: `Customer has chosen ${what} in ${p.count} previous orders (observed from order history, not stated by the customer).`,
        label: `Chose ${what} in ${p.count} orders`,
        confirmation: "observed_from_orders",
        explicit: false,
        confidence: Math.min(0.95, 0.5 + p.count * 0.15),
        importance: 0.6,
        durability: "long_term",
        score: 0.7,
        significant: false,
        sourceKind: "order",
        channel: input.channel,
        supersede: true,
      }),
    );
  }
  return receipts;
}

export interface BookingMemoryInput {
  merchantId: string;
  customerId: string;
  bookingId: string;
  serviceName: string;
  startAt: Date;
  timeZone: string;
  options: string[];
  notes?: string | null;
  channel: Channel;
}

export async function rememberPastService(db: Db, store: MemoryStore | null, b: BookingMemoryInput): Promise<MemoryReceipt> {
  const when = new Intl.DateTimeFormat("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: b.timeZone,
  }).format(b.startAt);
  const opts = b.options.length ? ` with ${b.options.join(", ")}` : "";
  return persistMemory(db, store, {
    merchantId: b.merchantId,
    customerId: b.customerId,
    scope: "customer",
    type: "PAST_SERVICE",
    subject: `booking_${b.bookingId.slice(0, 8)}`,
    value: b.bookingId,
    statement: `Customer booked ${b.serviceName}${opts} for ${when}.${b.notes ? ` Their note: ${b.notes.slice(0, 160)}` : ""}`,
    label: `Booked: ${b.serviceName}`,
    confirmation: "observed_from_orders",
    explicit: true,
    confidence: 1,
    importance: 0.8,
    durability: "long_term",
    score: 0.9,
    significant: true,
    sourceKind: "booking",
    channel: b.channel,
    bookingId: b.bookingId,
    supersede: false,
  });
}
