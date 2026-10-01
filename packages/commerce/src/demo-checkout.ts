/**
 * Demo checkout. Demo shops (merchants.isDemo) are fictional, so nobody should
 * wait for an owner who may be offline: pressing Pay confirms a simulated
 * payment (no real money moves) and the order moves straight on — ready for
 * pickup, or on its way with the shop's own delivery estimate. Real shops never
 * come through here: they confirm and take payment themselves.
 */
import { and, eq } from "drizzle-orm";
import { bookings, merchants, orderEvents, orders, type Db, type Merchant, type Order } from "@nia/database";
import { AppError, DEMO_PAYMENT_NOTE, ORDER_TRANSITIONS, type OrderStatus } from "@nia/shared";
import { transitionBooking } from "./bookings";
import { orderSummary } from "./orders";
import type { PaymentStart } from "./payments";
import type { BookingSummaryData, OrderSummaryData } from "./types";

/** Demo shops pay instantly — unless something still needs a quote from the shop. */
export function isDemoCheckout(merchant: Pick<Merchant, "isDemo">, order: Pick<Order, "hasUnpricedItems">): boolean {
  return merchant.isDemo && !order.hasUnpricedItems;
}

const PATH: Record<"pickup" | "delivery", OrderStatus[]> = {
  pickup: ["confirmed", "paid", "processing", "ready"],
  delivery: ["confirmed", "paid", "processing", "ready", "dispatched"],
};

const NOTE: Partial<Record<OrderStatus, string>> = {
  confirmed: "Demo shop: confirmed automatically",
  paid: "Demo payment confirmed — no real money moved",
  processing: "Being prepared",
  dispatched: "On its way",
};

/**
 * Settle a demo-shop order the customer has just confirmed: awaiting
 * confirmation → confirmed → paid (demo) → processing → ready (pickup) or
 * dispatched (delivery), with one order event per step. Anything else — a real
 * shop, an order needing a quote, an order already past this point — is left
 * exactly as it is.
 */
export async function settleDemoOrder(db: Db, { merchantId, orderId }: { merchantId: string; orderId: string }): Promise<OrderSummaryData> {
  const [order] = await db.select().from(orders).where(and(eq(orders.id, orderId), eq(orders.merchantId, merchantId)));
  if (!order) throw new AppError("NOT_FOUND", "Order not found");
  const [merchant] = await db.select().from(merchants).where(eq(merchants.id, merchantId));
  if (!merchant || order.status !== "awaiting_confirmation" || !isDemoCheckout(merchant, order)) return orderSummary(db, merchantId, order.id);

  const path = PATH[order.fulfillmentMethod === "pickup" ? "pickup" : "delivery"];
  let from: OrderStatus = order.status;
  for (const to of path) {
    if (!ORDER_TRANSITIONS[from].includes(to)) throw new AppError("CONFLICT", `Cannot move an order from ${from} to ${to}`);
    from = to;
  }

  const now = new Date();
  await db.transaction(async (tx) => {
    const moved = await tx
      .update(orders)
      .set({ status: path.at(-1)!, confirmedAt: now, paidAt: now, paymentStatus: "paid", paymentMode: "demo", paymentUrl: null, paymentReference: `DEMO-${order.number}` })
      .where(and(eq(orders.id, order.id), eq(orders.status, "awaiting_confirmation")))
      .returning({ id: orders.id });
    if (!moved.length) return; // settled by a concurrent request
    let prev: OrderStatus = order.status;
    for (const [i, to] of path.entries()) {
      const note = to === "ready" ? (order.fulfillmentMethod === "pickup" ? "Ready for pickup" : "Packed") : NOTE[to];
      // One millisecond apart so the timeline keeps its order.
      await tx.insert(orderEvents).values({ orderId: order.id, merchantId, fromStatus: prev, toStatus: to, actorType: "system", note, createdAt: new Date(now.getTime() + i) });
      prev = to;
    }
  });
  return orderSummary(db, merchantId, order.id);
}

/** What the customer sees about payment for a settled demo order. */
export function demoPayment(order: Pick<OrderSummaryData, "number">): PaymentStart {
  return { mode: "demo", instructions: `Payment confirmed. ${DEMO_PAYMENT_NOTE}`, url: null, reference: order.number ? `DEMO-${order.number}` : null };
}

/** A demo shop confirms a requested booking at once (real shops confirm it themselves). */
export async function settleDemoBooking(db: Db, { merchantId, bookingId }: { merchantId: string; bookingId: string }): Promise<BookingSummaryData | null> {
  const [merchant] = await db.select({ isDemo: merchants.isDemo }).from(merchants).where(eq(merchants.id, merchantId));
  const [b] = await db.select({ status: bookings.status }).from(bookings).where(and(eq(bookings.id, bookingId), eq(bookings.merchantId, merchantId)));
  if (!merchant?.isDemo || b?.status !== "pending") return null;
  return transitionBooking(db, { merchantId, bookingId, to: "confirmed", actor: { type: "system" } });
}
