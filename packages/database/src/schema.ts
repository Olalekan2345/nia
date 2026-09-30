/**
 * Nia operational database schema (PostgreSQL via Drizzle).
 *
 * PostgreSQL is the source of truth for operational state: merchants,
 * catalog, prices, inventory, orders, bookings, identities, sessions, and the
 * *metadata* of memories (type, provenance, Walrus job/blob ids, lifecycle).
 *
 * The long-term conversational memory itself lives on Walrus Memory. The AI
 * context only ever receives memory text that came back from a Walrus recall.
 * `memory_records.label` is a short receipt label for the UI (e.g.
 * "Preferred size: XL") — it is never fed to the model.
 */
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import type {
  BookingStatus,
  Channel,
  DeliveryArea,
  IdentityProvider,
  InventoryStatus,
  MemberRole,
  MemoryConfirmation,
  MemoryDurability,
  MemoryLifecycle,
  MemoryPersistStatus,
  MemoryScope,
  MemoryType,
  OfferingKind,
  OrderStatus,
  PaymentMode,
  PaymentStatus,
  FulfillmentMethod,
  ServiceAvailability,
  ShoppingSession,
  WeeklyHours,
} from "@nia/shared";

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());
const money = (name: string) => bigint(name, { mode: "number" });
const bytea = customType<{ data: Buffer; driverData: Buffer | Uint8Array }>({
  dataType: () => "bytea",
  fromDriver: (value) => Buffer.from(value),
});

/* ─────────────────────────────── Identity & auth ─────────────────────────────── */

/**
 * A person's Nia account. Signs in with Telegram (verified by the bot) and/or an
 * email code; at least one of `email` / `telegramUserId` is always set.
 */
export const users = pgTable(
  "users",
  {
    id: id(),
    email: text("email").unique(),
    name: text("name"),
    telegramUserId: bigint("telegram_user_id", { mode: "number" }).unique(),
    telegramUsername: text("telegram_username"),
    createdAt: createdAt(),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  },
  (t) => [check("users_has_identity", sql`${t.email} is not null or ${t.telegramUserId} is not null`)],
);

/** Email one-time sign-in codes. Only a hash of the code is stored. */
export const authCodes = pgTable(
  "auth_codes",
  {
    id: id(),
    email: text("email").notNull(),
    codeHash: text("code_hash").notNull(),
    attempts: integer("attempts").notNull().default(0),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("auth_codes_email_idx").on(t.email, t.createdAt)],
);

/** Server-side sessions. The cookie holds a random token; only its hash is stored. */
export const sessions = pgTable(
  "sessions",
  {
    id: id(),
    tokenHash: text("token_hash").notNull().unique(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    userAgent: text("user_agent"),
    method: text("method").$type<"email" | "telegram">().notNull().default("email"),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user_idx").on(t.userId)],
);

/* ─────────────────────────────── Merchants ─────────────────────────────── */

export interface MerchantFulfillment {
  delivery: boolean;
  pickup: boolean;
  pickupAddress?: string | null;
}

export interface NiaSettings {
  /** Master switch for customer memory at this merchant. */
  memoryEnabled: boolean;
  recommendationsEnabled: boolean;
  /** Tone guidance: "warm" | "polished" | "playful" | "concise". */
  tone: string;
  /** Extra behaviour instructions from the merchant (treated as merchant policy, not system rules). */
  instructions?: string | null;
}

export const merchants = pgTable("merchants", {
  id: id(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  businessType: text("business_type").notNull().default("other"),
  tagline: text("tagline"),
  description: text("description"),
  logoUrl: text("logo_url"),
  accentColor: text("accent_color").notNull().default("#0F9FB0"),
  welcomeMessage: text("welcome_message"),
  currency: text("currency").notNull().default("NGN"),
  locale: text("locale").notNull().default("en-NG"),
  timezone: text("timezone").notNull().default("Africa/Lagos"),
  country: text("country"),
  city: text("city"),
  fulfillment: jsonb("fulfillment").$type<MerchantFulfillment>().notNull().default({ delivery: true, pickup: false }),
  deliveryAreas: jsonb("delivery_areas").$type<DeliveryArea[]>().notNull().default([]),
  openingHours: jsonb("opening_hours").$type<WeeklyHours>().notNull().default({}),
  paymentMode: text("payment_mode").$type<PaymentMode>().notNull().default("merchant_confirmed"),
  paymentInstructions: text("payment_instructions"),
  paymentLinkUrl: text("payment_link_url"),
  telegramEnabled: boolean("telegram_enabled").notNull().default(true),
  niaSettings: jsonb("nia_settings")
    .$type<NiaSettings>()
    .notNull()
    .default({ memoryEnabled: true, recommendationsEnabled: true, tone: "warm" }),
  status: text("status").$type<"onboarding" | "live" | "paused">().notNull().default("onboarding"),
  onboardingStep: integer("onboarding_step").notNull().default(0),
  isDemo: boolean("is_demo").notNull().default(false),
  /**
   * "shop" for every real storefront. "market" is the single Walrus Market record:
   * it sells nothing itself, but gives each shopper a market-level customer, so
   * Nia's market guide has its own per-user Walrus memory (separate from shops).
   */
  kind: text("kind").$type<"shop" | "market">().notNull().default("shop"),
  nextOrderNumber: integer("next_order_number").notNull().default(1001),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const merchantMembers = pgTable(
  "merchant_members",
  {
    id: id(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").$type<MemberRole>().notNull().default("STAFF"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("merchant_members_unique").on(t.merchantId, t.userId), index("merchant_members_user_idx").on(t.userId)],
);

export const merchantInvites = pgTable(
  "merchant_invites",
  {
    id: id(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role").$type<MemberRole>().notNull().default("STAFF"),
    invitedByUserId: uuid("invited_by_user_id").references(() => users.id, { onDelete: "set null" }),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("merchant_invites_unique").on(t.merchantId, t.email)],
);

export const merchantKnowledge = pgTable(
  "merchant_knowledge",
  {
    id: id(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    category: text("category").notNull(), // shipping | returns | hours | service_policy | stock_note | product_guidance | faq | special_instructions
    title: text("title").notNull(),
    body: text("body").notNull(),
    active: boolean("active").notNull().default(true),
    /** Also persist to the merchant's Walrus knowledge namespace for semantic recall. */
    rememberInWalrus: boolean("remember_in_walrus").notNull().default(false),
    memoryRecordId: uuid("memory_record_id"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("merchant_knowledge_merchant_idx").on(t.merchantId)],
);

/** Generic per-merchant / platform settings (feature flags, integration status caches, storefront domains). */
export const domainSettings = pgTable(
  "domain_settings",
  {
    id: id(),
    merchantId: uuid("merchant_id").references(() => merchants.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    value: jsonb("value").$type<unknown>().notNull(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("domain_settings_unique").on(t.merchantId, t.key)],
);

/* ─────────────────────────────── Customers ─────────────────────────────── */

export const customers = pgTable(
  "customers",
  {
    id: id(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    displayName: text("display_name"),
    email: text("email"),
    /** When two customer records turn out to be the same person, the secondary points here. */
    mergedIntoId: uuid("merged_into_id"),
    memoryEnabled: boolean("memory_enabled").notNull().default(true),
    createdAt: createdAt(),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("customers_merchant_idx").on(t.merchantId),
    uniqueIndex("customers_merchant_user_unique").on(t.merchantId, t.userId).where(sql`${t.userId} is not null`),
  ],
);

/** One customer, many channels: WEB_AUTH (user id), TELEGRAM (telegram user id), later WHATSAPP etc. */
export const customerIdentities = pgTable(
  "customer_identities",
  {
    id: id(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    provider: text("provider").$type<IdentityProvider>().notNull(),
    subject: text("subject").notNull(),
    displayHandle: text("display_handle"),
    verifiedAt: timestamp("verified_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("customer_identities_unique").on(t.merchantId, t.provider, t.subject),
    index("customer_identities_customer_idx").on(t.customerId),
  ],
);

/* ─────────────────────────────── Telegram ─────────────────────────────── */

export const telegramIdentities = pgTable("telegram_identities", {
  id: id(),
  telegramUserId: bigint("telegram_user_id", { mode: "number" }).notNull().unique(),
  chatId: bigint("chat_id", { mode: "number" }).notNull(),
  username: text("username"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  languageCode: text("language_code"),
  /** Which merchant this Telegram chat is currently talking to. */
  activeMerchantId: uuid("active_merchant_id").references(() => merchants.id, { onDelete: "set null" }),
  /** Conversation currently open in this chat (per active merchant). */
  activeConversationId: uuid("active_conversation_id"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** Short-lived one-time tokens for web → Telegram account linking. Only the hash is stored. */
export const telegramLinkTokens = pgTable(
  "telegram_link_tokens",
  {
    id: id(),
    tokenHash: text("token_hash").notNull().unique(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    consumedByTelegramUserId: bigint("consumed_by_telegram_user_id", { mode: "number" }),
    createdAt: createdAt(),
  },
  (t) => [index("telegram_link_tokens_customer_idx").on(t.customerId)],
);

/**
 * "Continue with Telegram" requests. The browser that starts one holds a secret
 * (httpOnly cookie); the bot approves it only when the Telegram user taps the
 * number shown in that browser. Single use, short-lived; only hashes are stored.
 */
export const telegramLoginRequests = pgTable(
  "telegram_login_requests",
  {
    id: id(),
    /** sha256 of the /start deep-link parameter. */
    tokenHash: text("token_hash").notNull().unique(),
    /** sha256 of the secret held by the requesting browser. */
    browserSecretHash: text("browser_secret_hash").notNull(),
    purpose: text("purpose").$type<"signin" | "connect">().notNull(),
    /** For "connect": the signed-in account the Telegram user is attached to. */
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    merchantId: uuid("merchant_id").references(() => merchants.id, { onDelete: "set null" }),
    nextPath: text("next_path"),
    device: text("device"),
    matchNumber: integer("match_number").notNull(),
    status: text("status").$type<"pending" | "approved" | "denied" | "consumed">().notNull().default("pending"),
    telegramUserId: bigint("telegram_user_id", { mode: "number" }),
    telegramUsername: text("telegram_username"),
    telegramName: text("telegram_name"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("telegram_login_requests_created_idx").on(t.createdAt)],
);

/**
 * Images merchants upload (product photos). Normalised on upload (EXIF-rotated,
 * metadata stripped, JPEG ≤ 1600 px) and served immutably by /api/media/[id].
 */
export const media = pgTable(
  "media",
  {
    id: id(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    contentType: text("content_type").notNull(),
    bytes: bytea("bytes").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    sizeBytes: integer("size_bytes").notNull(),
    uploadedByUserId: uuid("uploaded_by_user_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdAt(),
  },
  (t) => [index("media_merchant_idx").on(t.merchantId)],
);

/** Processed Telegram update ids (dedup — Telegram retries deliveries). */
export const telegramUpdates = pgTable("telegram_updates", {
  updateId: bigint("update_id", { mode: "number" }).primaryKey(),
  status: text("status").$type<"processing" | "done" | "failed">().notNull().default("processing"),
  error: text("error"),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ─────────────────────────────── Catalog ─────────────────────────────── */

export const products = pgTable(
  "products",
  {
    id: id(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    kind: text("kind").$type<Extract<OfferingKind, "PRODUCT" | "CUSTOM_ORDER" | "PACKAGE">>().notNull().default("PRODUCT"),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    category: text("category"),
    sku: text("sku"),
    images: jsonb("images").$type<string[]>().notNull().default([]),
    /** Minor units. null = price on request (Nia must not invent one). */
    price: money("price"),
    currency: text("currency").notNull(),
    /** Selling unit, e.g. "yard", "piece", "set", "500 ml". */
    unit: text("unit"),
    attributes: jsonb("attributes").$type<Record<string, string | string[]>>().notNull().default({}),
    inventoryStatus: text("inventory_status").$type<InventoryStatus>().notNull().default("unknown"),
    stockQuantity: integer("stock_quantity"),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("products_merchant_slug_unique").on(t.merchantId, t.slug), index("products_merchant_idx").on(t.merchantId, t.active)],
);

export const productVariants = pgTable(
  "product_variants",
  {
    id: id(),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sku: text("sku"),
    options: jsonb("options").$type<Record<string, string>>().notNull().default({}),
    /** Overrides product price when set. */
    price: money("price"),
    inventoryStatus: text("inventory_status").$type<InventoryStatus>().notNull().default("unknown"),
    stockQuantity: integer("stock_quantity"),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [index("product_variants_product_idx").on(t.productId)],
);

/**
 * Recorded price changes (minor units). Nia may only say an item got cheaper
 * or was a different price when a row here shows it — never from guesswork.
 * Tracking starts when a product is created or its price first changes.
 */
export const productPriceHistory = pgTable(
  "product_price_history",
  {
    id: id(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),
    variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "cascade" }),
    price: money("price"),
    recordedAt: timestamp("recorded_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("product_price_history_product_idx").on(t.productId, t.recordedAt)],
);

export interface ServiceOption {
  name: string;
  priceDelta?: number | null;
  durationDelta?: number | null;
}

export const services = pgTable(
  "services",
  {
    id: id(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    kind: text("kind").$type<Extract<OfferingKind, "SERVICE" | "APPOINTMENT">>().notNull().default("SERVICE"),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    description: text("description"),
    category: text("category"),
    priceMin: money("price_min"),
    priceMax: money("price_max"),
    currency: text("currency").notNull(),
    durationMinutes: integer("duration_minutes"),
    locationType: text("location_type").$type<"in_store" | "at_customer" | "online">().notNull().default("in_store"),
    depositAmount: money("deposit_amount"),
    bookingRequirements: text("booking_requirements"),
    options: jsonb("options").$type<ServiceOption[]>().notNull().default([]),
    availability: jsonb("availability").$type<ServiceAvailability | null>(),
    images: jsonb("images").$type<string[]>().notNull().default([]),
    tags: jsonb("tags").$type<string[]>().notNull().default([]),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [uniqueIndex("services_merchant_slug_unique").on(t.merchantId, t.slug), index("services_merchant_idx").on(t.merchantId, t.active)],
);

/* ─────────────────────────────── Orders & bookings ─────────────────────────────── */

export const orders = pgTable(
  "orders",
  {
    id: id(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    number: integer("number"),
    status: text("status").$type<OrderStatus>().notNull().default("draft"),
    channel: text("channel").$type<Channel>().notNull().default("web"),
    fulfillmentMethod: text("fulfillment_method").$type<FulfillmentMethod>(),
    deliveryArea: text("delivery_area"),
    deliveryAddress: text("delivery_address"),
    deliveryFee: money("delivery_fee"),
    subtotal: money("subtotal").notNull().default(0),
    total: money("total").notNull().default(0),
    /** True when any line has no price yet (custom order awaiting a quote). */
    hasUnpricedItems: boolean("has_unpriced_items").notNull().default(false),
    currency: text("currency").notNull(),
    notes: text("notes"),
    paymentStatus: text("payment_status").$type<PaymentStatus>().notNull().default("unpaid"),
    paymentMode: text("payment_mode").$type<PaymentMode>().notNull().default("merchant_confirmed"),
    paymentReference: text("payment_reference"),
    paymentUrl: text("payment_url"),
    /** Order was built with help from recalled customer memory ("same as last time"). */
    memoryAssisted: boolean("memory_assisted").notNull().default(false),
    repeatOfOrderId: uuid("repeat_of_order_id"),
    conversationId: uuid("conversation_id"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    deliveredAt: timestamp("delivered_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("orders_merchant_idx").on(t.merchantId, t.status),
    index("orders_customer_idx").on(t.customerId, t.createdAt),
    uniqueIndex("orders_merchant_number_unique").on(t.merchantId, t.number).where(sql`${t.number} is not null`),
  ],
);

export const orderItems = pgTable(
  "order_items",
  {
    id: id(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    productId: uuid("product_id").references(() => products.id, { onDelete: "set null" }),
    variantId: uuid("variant_id").references(() => productVariants.id, { onDelete: "set null" }),
    kind: text("kind").$type<OfferingKind>().notNull().default("PRODUCT"),
    name: text("name").notNull(),
    variantLabel: text("variant_label"),
    options: jsonb("options").$type<Record<string, string>>().notNull().default({}),
    unit: text("unit"),
    unitPrice: money("unit_price"),
    quantity: integer("quantity").notNull().default(1),
    lineTotal: money("line_total"),
    notes: text("notes"),
    createdAt: createdAt(),
  },
  (t) => [index("order_items_order_idx").on(t.orderId)],
);

export const orderEvents = pgTable(
  "order_events",
  {
    id: id(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    merchantId: uuid("merchant_id").notNull(),
    fromStatus: text("from_status").$type<OrderStatus>(),
    toStatus: text("to_status").$type<OrderStatus>().notNull(),
    actorType: text("actor_type").$type<"customer" | "merchant" | "system">().notNull(),
    actorId: text("actor_id"),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [index("order_events_order_idx").on(t.orderId)],
);

export const bookings = pgTable(
  "bookings",
  {
    id: id(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id").references(() => services.id, { onDelete: "set null" }),
    serviceName: text("service_name").notNull(),
    status: text("status").$type<BookingStatus>().notNull().default("draft"),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }).notNull(),
    notes: text("notes"),
    selectedOptions: jsonb("selected_options").$type<string[]>().notNull().default([]),
    price: money("price"),
    depositAmount: money("deposit_amount"),
    currency: text("currency").notNull(),
    channel: text("channel").$type<Channel>().notNull().default("web"),
    memoryAssisted: boolean("memory_assisted").notNull().default(false),
    conversationId: uuid("conversation_id"),
    requestedAt: timestamp("requested_at", { withTimezone: true }),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index("bookings_merchant_idx").on(t.merchantId, t.startAt), index("bookings_customer_idx").on(t.customerId)],
);

/* ─────────────────────────────── Conversations ─────────────────────────────── */

export const conversations = pgTable(
  "conversations",
  {
    id: id(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    /** null for anonymous guests (session-only identity). */
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "cascade" }),
    /** Random id from the guest's httpOnly cookie, so a guest conversation can be claimed on sign-in. */
    guestSessionId: text("guest_session_id"),
    channel: text("channel").$type<Channel>().notNull().default("web"),
    /** "off" = before/after demo mode: no Walrus recall and no customer history. */
    memoryMode: text("memory_mode").$type<"on" | "off">().notNull().default("on"),
    title: text("title"),
    /**
     * Current shopping context for THIS conversation (goal, constraints, results
     * shown, shortlist, list, proposed basket). Not long-term memory: durable
     * facts reach Walrus only through extraction and the memory policy.
     */
    session: jsonb("session").$type<ShoppingSession>().notNull().default({}),
    lastMessageAt: timestamp("last_message_at", { withTimezone: true }).notNull().defaultNow(),
    createdAt: createdAt(),
  },
  (t) => [index("conversations_merchant_idx").on(t.merchantId, t.lastMessageAt), index("conversations_customer_idx").on(t.customerId)],
);

export interface MemoryUsage {
  blobId: string;
  recordId?: string | null;
  type?: MemoryType | null;
  label?: string | null;
  scope: MemoryScope;
  distance: number;
  lifecycle?: MemoryLifecycle | null;
  storedAt?: string | null;
}

export const messages = pgTable(
  "messages",
  {
    id: id(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    merchantId: uuid("merchant_id").notNull(),
    role: text("role").$type<"user" | "assistant">().notNull(),
    content: text("content").notNull().default(""),
    /** Structured UI parts (product cards, order summaries, memory receipts). */
    parts: jsonb("parts").$type<unknown[]>().notNull().default([]),
    /** Which Walrus memories informed this assistant message (memory passport "why"). */
    memoryUsed: jsonb("memory_used").$type<MemoryUsage[]>().notNull().default([]),
    channel: text("channel").$type<Channel>().notNull().default("web"),
    externalId: text("external_id"),
    createdAt: createdAt(),
  },
  (t) => [index("messages_conversation_idx").on(t.conversationId, t.createdAt)],
);

/* ─────────────────────────────── Memory metadata ─────────────────────────────── */

/**
 * Metadata for every durable memory Nia writes to Walrus. The memory content
 * lives on Walrus; this row tracks what kind of memory it is, where it came
 * from, whether it is current, and its real persistence state.
 */
export const memoryRecords = pgTable(
  "memory_records",
  {
    id: id(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id").references(() => customers.id, { onDelete: "cascade" }),
    scope: text("scope").$type<MemoryScope>().notNull(),
    namespace: text("namespace").notNull(),
    type: text("type").$type<MemoryType>().notNull(),
    /** Normalised subject key, e.g. "clothing_size", "usual_delivery_area". */
    subjectKey: text("subject_key").notNull(),
    /** sha256 of the normalised value — dedup without keeping the value in SQL. */
    valueHash: text("value_hash").notNull(),
    /** Short receipt label for the UI only ("Preferred size: XL"). Never sent to the model. */
    label: text("label").notNull(),
    confirmation: text("confirmation").$type<MemoryConfirmation>().notNull(),
    explicit: boolean("explicit").notNull().default(false),
    confidence: real("confidence").notNull().default(0),
    importance: real("importance").notNull().default(0),
    durability: text("durability").$type<MemoryDurability>().notNull().default("long_term"),
    score: real("score").notNull().default(0),
    lifecycle: text("lifecycle").$type<MemoryLifecycle>().notNull().default("active"),
    persistStatus: text("persist_status").$type<MemoryPersistStatus>().notNull().default("pending"),
    /** Wait for durable confirmation before telling the customer it is remembered. */
    significant: boolean("significant").notNull().default(true),
    validFrom: timestamp("valid_from", { withTimezone: true }).notNull().defaultNow(),
    validTo: timestamp("valid_to", { withTimezone: true }),
    supersedesId: uuid("supersedes_id"),
    supersededById: uuid("superseded_by_id"),
    forgottenAt: timestamp("forgotten_at", { withTimezone: true }),
    /** Walrus persistence metadata. */
    walrusJobId: text("walrus_job_id"),
    blobId: text("blob_id"),
    walrusOwner: text("walrus_owner"),
    storedAt: timestamp("stored_at", { withTimezone: true }),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
    /**
     * Outbox: the memory text awaiting durable confirmation from the relayer,
     * kept only so a failed write can be retried. Cleared the moment Walrus
     * confirms storage (or the memory is forgotten).
     */
    pendingText: text("pending_text"),
    /** Provenance — "Why does Nia think this?" */
    sourceKind: text("source_kind")
      .$type<"conversation" | "order" | "booking" | "merchant_entry" | "customer_correction" | "passport" | "confirmation">()
      .notNull(),
    channel: text("channel").$type<Channel>(),
    conversationId: uuid("conversation_id"),
    messageId: uuid("message_id"),
    orderId: uuid("order_id"),
    bookingId: uuid("booking_id"),
    evidence: text("evidence"),
    idempotencyKey: text("idempotency_key").notNull().unique(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("memory_records_customer_idx").on(t.customerId, t.lifecycle),
    index("memory_records_merchant_idx").on(t.merchantId, t.scope),
    index("memory_records_subject_idx").on(t.namespace, t.subjectKey, t.lifecycle),
    index("memory_records_blob_idx").on(t.blobId),
    index("memory_records_persist_idx").on(t.persistStatus),
    // One active copy of the same fact per namespace — dedup enforced by the database.
    uniqueIndex("memory_records_active_fact_unique")
      .on(t.namespace, t.subjectKey, t.valueHash)
      .where(sql`${t.lifecycle} = 'active'`),
  ],
);

/** Every relayer job attempt for a memory record (retries create new rows). */
export const walrusJobs = pgTable(
  "walrus_jobs",
  {
    id: id(),
    memoryRecordId: uuid("memory_record_id")
      .notNull()
      .references(() => memoryRecords.id, { onDelete: "cascade" }),
    merchantId: uuid("merchant_id").notNull(),
    jobId: text("job_id"),
    namespace: text("namespace").notNull(),
    status: text("status").$type<"submitting" | "pending" | "running" | "uploaded" | "done" | "failed" | "not_found">().notNull(),
    blobId: text("blob_id"),
    error: text("error"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }).notNull().defaultNow(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }),
  },
  (t) => [index("walrus_jobs_record_idx").on(t.memoryRecordId), index("walrus_jobs_merchant_idx").on(t.merchantId, t.submittedAt)],
);

/**
 * Candidate memories awaiting the customer's consent ("Should I remember that
 * you prefer earth tones?"). Transient: the payload is cleared on decline or expiry.
 */
export const memoryCandidates = pgTable(
  "memory_candidates",
  {
    id: id(),
    merchantId: uuid("merchant_id")
      .notNull()
      .references(() => merchants.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),
    conversationId: uuid("conversation_id"),
    messageId: uuid("message_id"),
    payload: jsonb("payload").$type<Record<string, unknown> | null>(),
    status: text("status").$type<"awaiting" | "accepted" | "declined" | "expired">().notNull().default("awaiting"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("memory_candidates_customer_idx").on(t.customerId, t.status)],
);

/* ─────────────────────────────── Platform ─────────────────────────────── */

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: id(),
    merchantId: uuid("merchant_id"),
    actorType: text("actor_type").$type<"user" | "customer" | "system" | "telegram">().notNull(),
    actorId: text("actor_id"),
    action: text("action").notNull(),
    targetType: text("target_type"),
    targetId: text("target_id"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
    createdAt: createdAt(),
  },
  (t) => [index("audit_logs_merchant_idx").on(t.merchantId, t.createdAt)],
);

/** Fixed-window rate-limit counters (shared across serverless instances). */
export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  count: integer("count").notNull().default(0),
});

export type User = typeof users.$inferSelect;
export type Merchant = typeof merchants.$inferSelect;
export type MerchantMember = typeof merchantMembers.$inferSelect;
export type Customer = typeof customers.$inferSelect;
export type CustomerIdentity = typeof customerIdentities.$inferSelect;
export type Product = typeof products.$inferSelect;
export type ProductVariant = typeof productVariants.$inferSelect;
export type Service = typeof services.$inferSelect;
export type Order = typeof orders.$inferSelect;
export type OrderItem = typeof orderItems.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type MemoryRecord = typeof memoryRecords.$inferSelect;
export type WalrusJob = typeof walrusJobs.$inferSelect;
export type MerchantKnowledge = typeof merchantKnowledge.$inferSelect;
export type TelegramIdentity = typeof telegramIdentities.$inferSelect;
export type TelegramLoginRequest = typeof telegramLoginRequests.$inferSelect;
export type Media = typeof media.$inferSelect;
