/** Generalised sellable entity kinds. Nia converses differently per kind. */
export const OFFERING_KINDS = ["PRODUCT", "SERVICE", "APPOINTMENT", "CUSTOM_ORDER", "PACKAGE"] as const;
export type OfferingKind = (typeof OFFERING_KINDS)[number];

/** Kinds that live in the `products` table (carted and ordered). */
export const PRODUCT_KINDS = ["PRODUCT", "CUSTOM_ORDER", "PACKAGE"] as const;
export type ProductKind = (typeof PRODUCT_KINDS)[number];

/** Kinds that live in the `services` table (booked). */
export const SERVICE_KINDS = ["SERVICE", "APPOINTMENT"] as const;
export type ServiceKind = (typeof SERVICE_KINDS)[number];

export const INVENTORY_STATUSES = ["in_stock", "low_stock", "out_of_stock", "made_to_order", "unknown"] as const;
export type InventoryStatus = (typeof INVENTORY_STATUSES)[number];

export const INVENTORY_LABELS: Record<InventoryStatus, string> = {
  in_stock: "In stock",
  low_stock: "Low stock",
  out_of_stock: "Out of stock",
  made_to_order: "Made to order",
  unknown: "Availability not confirmed",
};

export const ORDER_STATUSES = [
  "draft",
  "awaiting_confirmation",
  "confirmed",
  "paid",
  "processing",
  "ready",
  "dispatched",
  "delivered",
  "cancelled",
  "refunded",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  draft: "Cart",
  awaiting_confirmation: "Awaiting confirmation",
  confirmed: "Confirmed",
  paid: "Paid",
  processing: "Processing",
  ready: "Ready",
  dispatched: "Dispatched",
  delivered: "Delivered",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

/**
 * Allowed order transitions. The happy path is linear; cancellation is
 * possible until dispatch; refunds only after payment.
 */
export const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  draft: ["awaiting_confirmation", "cancelled"],
  awaiting_confirmation: ["confirmed", "cancelled"],
  confirmed: ["paid", "processing", "cancelled"],
  paid: ["processing", "refunded", "cancelled"],
  processing: ["ready", "cancelled", "refunded"],
  ready: ["dispatched", "delivered", "cancelled", "refunded"],
  dispatched: ["delivered", "refunded"],
  delivered: ["refunded"],
  cancelled: [],
  refunded: [],
};

/** "draft" is a proposal shown to the customer before they explicitly confirm it. */
export const BOOKING_STATUSES = ["draft", "pending", "confirmed", "completed", "cancelled", "no_show"] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  draft: "Draft",
  pending: "Pending",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No-show",
};

export const BOOKING_TRANSITIONS: Record<BookingStatus, readonly BookingStatus[]> = {
  draft: ["pending", "cancelled"],
  pending: ["confirmed", "cancelled"],
  confirmed: ["completed", "cancelled", "no_show"],
  completed: [],
  cancelled: [],
  no_show: [],
};

export const FULFILLMENT_METHODS = ["delivery", "pickup"] as const;
export type FulfillmentMethod = (typeof FULFILLMENT_METHODS)[number];

export const PAYMENT_STATUSES = ["unpaid", "pending", "paid", "refunded"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const PAYMENT_MODES = ["merchant_confirmed", "payment_link", "paystack"] as const;
export type PaymentMode = (typeof PAYMENT_MODES)[number];
/** How an order was paid. "demo" = the simulated payment of a demo shop (never a merchant setting). */
export type OrderPaymentMode = PaymentMode | "demo";

/**
 * Demo shops (merchants.isDemo) are fictional businesses for trying Nia. Their
 * checkout is simulated so anyone can finish an order without waiting for an
 * owner: payment is confirmed in a few seconds and no real money moves. Real
 * shops keep their own payment and confirmation.
 */
export const DEMO_PAYMENT_NOTE = "Demo shop: payment is simulated — no real money moves.";
export const DEMO_SHOP_POLICIES = [
  {
    category: "faq",
    title: "Demo payment",
    body: "This is a demo shop. When you press Pay on your order, a simulated payment is confirmed in a few seconds (no real money moves). Pickup orders are then ready to collect; delivery orders go out straight away.",
  },
  {
    category: "shipping",
    title: "Late or missing delivery",
    body: "If your delivery hasn't arrived within 24 hours of the estimated time, tell Nia or the shop and we send a replacement at no extra cost. Pickup orders are held for 3 days.",
  },
] as const;

export const MEMBER_ROLES = ["OWNER", "ADMIN", "STAFF"] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

const ROLE_RANK: Record<MemberRole, number> = { STAFF: 1, ADMIN: 2, OWNER: 3 };
export function roleAtLeast(role: MemberRole, min: MemberRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

export const IDENTITY_PROVIDERS = ["WEB_AUTH", "TELEGRAM", "GUEST"] as const;
export type IdentityProvider = (typeof IDENTITY_PROVIDERS)[number];

export const CHANNELS = ["web", "telegram"] as const;
export type Channel = (typeof CHANNELS)[number];

export const BUSINESS_TYPES = [
  { value: "fashion", label: "Fashion & clothing" },
  { value: "fabric", label: "Fabric & textiles" },
  { value: "beauty", label: "Beauty & cosmetics" },
  { value: "electronics", label: "Electronics" },
  { value: "restaurant", label: "Restaurant & food" },
  { value: "drinks", label: "Drinks & beverages" },
  { value: "bakery", label: "Bakery & desserts" },
  { value: "homeware", label: "Homeware & furniture" },
  { value: "creative", label: "Creative materials & printing" },
  { value: "salon", label: "Salon & barbering" },
  { value: "repair", label: "Repair services" },
  { value: "events", label: "Event services" },
  { value: "professional", label: "Professional services" },
  { value: "automotive", label: "Automotive accessories" },
  { value: "specialty", label: "Specialty merchant" },
  { value: "other", label: "Something else" },
] as const;
export type BusinessType = (typeof BUSINESS_TYPES)[number]["value"];

export type WeekdayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export const WEEKDAYS: readonly WeekdayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

/** Opening hours / service availability: weekday → list of [open, close] "HH:MM" windows. */
export type WeeklyHours = Partial<Record<WeekdayKey, Array<[string, string]>>>;

export interface DeliveryArea {
  name: string;
  /** minor units; null = fee not configured (Nia must not invent one) */
  fee: number | null;
  etaDays?: number | null;
  sameDay?: boolean;
}

export interface ServiceAvailability {
  weekly: WeeklyHours;
  slotIntervalMinutes: number;
  capacityPerSlot: number;
  leadTimeHours: number;
  advanceDays: number;
}
