/**
 * Nia's strongly typed customer / merchant memory model.
 *
 * Every durable memory written to Walrus carries one of these types. The type
 * drives how the memory is scored, how it is grouped in the Memory Passport,
 * and whether a newer memory supersedes an older one.
 */
export const MEMORY_TYPES = [
  "CUSTOMER_PREFERENCE",
  "PAST_ORDER",
  "PAST_SERVICE",
  "PRODUCT_INTEREST",
  "SIZE_OR_VARIANT",
  "DELIVERY_PREFERENCE",
  "LOCATION_PREFERENCE",
  "BUDGET",
  "OCCASION",
  "RELATIONSHIP_CONTEXT",
  "COMPLAINT",
  "CORRECTION",
  "MERCHANT_COMMITMENT",
  "CUSTOMER_COMMITMENT",
  "UNRESOLVED_REQUEST",
  "OUTCOME",
  "NOTE",
  "RETURN_OR_REFUND_CONTEXT",
  "RECOMMENDATION_RESPONSE",
] as const;

export type MemoryType = (typeof MEMORY_TYPES)[number];

/** Merchant-side memory kinds (stored in the merchant namespaces). */
export const MERCHANT_MEMORY_KINDS = ["knowledge", "operations"] as const;
export type MerchantMemoryKind = (typeof MERCHANT_MEMORY_KINDS)[number];

export const MEMORY_SCOPES = ["customer", "merchant_knowledge", "merchant_operations"] as const;
export type MemoryScope = (typeof MEMORY_SCOPES)[number];

/**
 * How a memory came to be believed. Surfaced in the Memory Passport as
 * "Confirmed by you", "Observed from orders", "Likely preference".
 */
export const MEMORY_CONFIRMATIONS = [
  "customer_stated",
  "customer_confirmed",
  "customer_corrected",
  "observed_from_orders",
  "inferred",
  "merchant_entered",
] as const;
export type MemoryConfirmation = (typeof MEMORY_CONFIRMATIONS)[number];

/** Real persistence state of a memory on Walrus (tracked from relayer job status). */
export const MEMORY_PERSIST_STATUSES = [
  "pending", // submitted to the Walrus relayer, job not terminal yet
  "stored", // relayer job reached `done`, blob id known
  "failed", // relayer job failed; eligible for retry
] as const;
export type MemoryPersistStatus = (typeof MEMORY_PERSIST_STATUSES)[number];

/** Application-level lifecycle of a memory (independent of persistence). */
export const MEMORY_LIFECYCLES = [
  "active", // current belief
  "superseded", // a newer memory about the same subject replaced it (history kept)
  "forgotten", // customer asked Nia to forget it — excluded from recall
] as const;
export type MemoryLifecycle = (typeof MEMORY_LIFECYCLES)[number];

/** What the application decided to do with an extracted candidate. */
export const MEMORY_DECISIONS = ["ignore", "ephemeral", "confirmation_required", "durable"] as const;
export type MemoryDecision = (typeof MEMORY_DECISIONS)[number];

export const MEMORY_DURABILITIES = ["one_time", "short_term", "long_term"] as const;
export type MemoryDurability = (typeof MEMORY_DURABILITIES)[number];

/** Passport sections. */
export const PASSPORT_SECTIONS = [
  "preferences",
  "typical_orders",
  "delivery",
  "sizes",
  "occasions",
  "service",
  "history",
  "corrections",
] as const;
export type PassportSection = (typeof PASSPORT_SECTIONS)[number];

export const MEMORY_TYPE_META: Record<
  MemoryType,
  { label: string; section: PassportSection; /** true when only the latest value per subject is "current" */ singleValued: boolean }
> = {
  CUSTOMER_PREFERENCE: { label: "Preference", section: "preferences", singleValued: true },
  PAST_ORDER: { label: "Past order", section: "typical_orders", singleValued: false },
  PAST_SERVICE: { label: "Past service", section: "service", singleValued: false },
  PRODUCT_INTEREST: { label: "Product interest", section: "preferences", singleValued: false },
  SIZE_OR_VARIANT: { label: "Size / variant", section: "sizes", singleValued: true },
  DELIVERY_PREFERENCE: { label: "Delivery preference", section: "delivery", singleValued: true },
  LOCATION_PREFERENCE: { label: "Location", section: "delivery", singleValued: true },
  BUDGET: { label: "Budget", section: "preferences", singleValued: true },
  OCCASION: { label: "Occasion", section: "occasions", singleValued: false },
  RELATIONSHIP_CONTEXT: { label: "Shops for", section: "occasions", singleValued: false },
  COMPLAINT: { label: "Past issue", section: "history", singleValued: false },
  CORRECTION: { label: "Correction", section: "corrections", singleValued: false },
  MERCHANT_COMMITMENT: { label: "Merchant promise", section: "history", singleValued: false },
  CUSTOMER_COMMITMENT: { label: "Customer commitment", section: "history", singleValued: false },
  UNRESOLVED_REQUEST: { label: "Open request", section: "history", singleValued: false },
  OUTCOME: { label: "Outcome", section: "history", singleValued: false },
  NOTE: { label: "Note", section: "preferences", singleValued: false },
  RETURN_OR_REFUND_CONTEXT: { label: "Return / refund", section: "history", singleValued: false },
  RECOMMENDATION_RESPONSE: { label: "Recommendation feedback", section: "preferences", singleValued: false },
};

export const PASSPORT_SECTION_LABELS: Record<PassportSection, string> = {
  preferences: "Preferences",
  typical_orders: "Typical orders",
  delivery: "Delivery",
  sizes: "Sizes & variants",
  occasions: "Occasions & people",
  service: "Services",
  history: "Service history",
  corrections: "Recent corrections",
};

export const CONFIRMATION_LABELS: Record<MemoryConfirmation, string> = {
  customer_stated: "Confirmed by you",
  customer_confirmed: "Confirmed by you",
  customer_corrected: "Corrected by you",
  observed_from_orders: "Observed from orders",
  inferred: "Likely preference",
  merchant_entered: "Added by the business",
};
