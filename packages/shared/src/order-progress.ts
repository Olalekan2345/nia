/**
 * Where an order is, in words — shared by the web cards, Telegram, the order
 * history and the compact view Nia reads. Pure, so client components can use it.
 */
import type { FulfillmentMethod, OrderStatus } from "./commerce-types";

export interface OrderProgressInput {
  status: OrderStatus;
  fulfillmentMethod: FulfillmentMethod | null;
  deliveryArea: string | null;
  pickupAddress: string | null;
  estimate: { label: string; expectedBy: string } | null;
  overdue: boolean;
}

export function orderProgress(o: OrderProgressInput): { headline: string; detail: string | null } {
  switch (o.status) {
    case "draft":
      return { headline: "In your cart", detail: null };
    case "awaiting_confirmation":
      return { headline: "Waiting for the shop to confirm", detail: "They confirm availability and how to pay." };
    case "confirmed":
      return { headline: "Confirmed by the shop", detail: "Waiting for payment." };
    case "paid":
    case "processing":
      return { headline: "Paid — being prepared", detail: o.fulfillmentMethod === "pickup" ? "We'll tell you when it's ready to collect." : null };
    case "ready":
      return o.fulfillmentMethod === "pickup"
        ? { headline: "Ready for pickup", detail: o.pickupAddress ? `Collect it at ${o.pickupAddress}.` : "Collect it at the shop." }
        : { headline: "Packed and ready to go out", detail: null };
    case "dispatched":
      return {
        headline: `On its way${o.deliveryArea ? ` to ${o.deliveryArea}` : ""}`,
        detail: o.overdue ? "Running late — it's past the shop's delivery estimate." : o.estimate ? `Expected ${o.estimate.label}.` : "The shop will share the delivery time.",
      };
    case "delivered":
      return { headline: "Delivered", detail: null };
    case "cancelled":
      return { headline: "Cancelled", detail: null };
    case "refunded":
      return { headline: "Refunded", detail: null };
  }
}
