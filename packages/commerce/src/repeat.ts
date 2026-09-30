/**
 * "Same as last time" resolution over real order history. Deterministic:
 * the model is told whether history is clear or ambiguous rather than
 * guessing.
 */
import type { BookingSummaryData, OrderSummaryData } from "./types";

export type RepeatResolution =
  | { status: "none"; reason: string }
  | { status: "single"; orderId: string; orderNumber: number | null; reason: string }
  | { status: "ambiguous"; orderIds: string[]; reason: string };

const REPEATABLE = new Set(["awaiting_confirmation", "confirmed", "paid", "processing", "ready", "dispatched", "delivered"]);

function signature(o: OrderSummaryData): string {
  return o.items
    .map((i) => `${i.productId ?? i.name}:${i.variantId ?? ""}`)
    .sort()
    .join("|");
}

/**
 * @param orders most recent first
 * @param windowDays two different orders placed within this many days of each other are ambiguous
 */
export function resolveRepeatOrder(orders: OrderSummaryData[], windowDays = 30): RepeatResolution {
  const eligible = orders.filter((o) => REPEATABLE.has(o.status) && o.items.length > 0);
  if (eligible.length === 0) return { status: "none", reason: "No previous orders at this shop." };
  const [latest, previous] = eligible;
  if (!previous) return { status: "single", orderId: latest!.id, orderNumber: latest!.number, reason: "Only one previous order." };

  const latestAt = new Date(latest!.submittedAt ?? latest!.createdAt).getTime();
  const previousAt = new Date(previous.submittedAt ?? previous.createdAt).getTime();
  const close = latestAt - previousAt < windowDays * 86400_000;
  if (signature(latest!) === signature(previous)) {
    return { status: "single", orderId: latest!.id, orderNumber: latest!.number, reason: "The last orders were the same items." };
  }
  if (close) {
    return {
      status: "ambiguous",
      orderIds: eligible.slice(0, 3).map((o) => o.id),
      reason: `The last ${Math.min(eligible.length, 3)} orders contained different items within ${windowDays} days — ask which one.`,
    };
  }
  return { status: "single", orderId: latest!.id, orderNumber: latest!.number, reason: "Most recent order is clearly the latest." };
}

export type RepeatBookingResolution =
  | { status: "none"; reason: string }
  | { status: "single"; bookingId: string; serviceId: string | null; serviceName: string; options: string[]; reason: string }
  | { status: "ambiguous"; bookingIds: string[]; reason: string };

const REPEATABLE_BOOKING = new Set(["pending", "confirmed", "completed"]);

/**
 * "Book the same haircut as last time" over real booking history — the same
 * rules as orders: one clear candidate, or ask which one.
 * @param bookings most recent first
 */
export function resolveRepeatBooking(bookings: BookingSummaryData[], windowDays = 30): RepeatBookingResolution {
  const eligible = bookings.filter((b) => REPEATABLE_BOOKING.has(b.status));
  if (eligible.length === 0) return { status: "none", reason: "No previous bookings at this shop." };
  const [latest, previous] = eligible;
  const single = (b: BookingSummaryData, reason: string): RepeatBookingResolution => ({ status: "single", bookingId: b.id, serviceId: b.serviceId, serviceName: b.serviceName, options: b.selectedOptions, reason });
  if (!previous) return single(latest!, "Only one previous booking.");
  const same = (a: BookingSummaryData, b: BookingSummaryData) => a.serviceId === b.serviceId && [...a.selectedOptions].sort().join("|") === [...b.selectedOptions].sort().join("|");
  if (same(latest!, previous)) return single(latest!, "The last bookings were the same service.");
  const close = new Date(latest!.startAt).getTime() - new Date(previous.startAt).getTime() < windowDays * 86400_000;
  if (close) {
    return { status: "ambiguous", bookingIds: eligible.slice(0, 3).map((b) => b.id), reason: `The last ${Math.min(eligible.length, 3)} bookings were for different services within ${windowDays} days — ask which one.` };
  }
  return single(latest!, "Most recent booking is clearly the latest.");
}
