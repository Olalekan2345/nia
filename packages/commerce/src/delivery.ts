/** Delivery estimates from the shop's own listed areas (never invented). */
import type { Merchant } from "@nia/database";
import type { OrderStatus } from "@nia/shared";

const HOUR = 3_600_000;

/**
 * The shop's estimate for a listed delivery area, counted from payment:
 * same-day areas within 6 hours, otherwise the area's days × 24 hours.
 * No listed area or days → no estimate (Nia never invents one).
 */
export function deliveryEstimate(
  merchant: Pick<Merchant, "deliveryAreas" | "timezone">,
  area: string | null,
  from: Date,
): { label: string; expectedBy: string } | null {
  if (!area) return null;
  const listed = merchant.deliveryAreas.find((d) => d.name.toLowerCase() === area.toLowerCase());
  const days = listed?.sameDay ? 0 : listed?.etaDays;
  if (days == null) return null;
  const expectedBy = new Date(from.getTime() + (days === 0 ? 6 : days * 24) * HOUR);
  const day = (d: Date) => new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: merchant.timezone }).format(d);
  const label = day(expectedBy) === day(from) ? "today" : `by ${day(expectedBy)}`;
  return { label, expectedBy: expectedBy.toISOString() };
}

/** The late-delivery policy applies once a delivery is 24 hours past its estimate. */
export function isOverdue(status: OrderStatus, estimate: { expectedBy: string } | null, now = new Date()): boolean {
  return status === "dispatched" && estimate != null && now.getTime() > new Date(estimate.expectedBy).getTime() + 24 * HOUR;
}
