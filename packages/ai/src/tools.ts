/**
 * Server-side typed tools. Every tool:
 *   • validates input with Zod
 *   • is bound to a server-resolved scope (merchant, customer, channel) — the
 *     model can never pass a merchant or customer id
 *   • returns structured data (rendered as cards), never raw SQL access
 */
import { tool } from "ai";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { merchantKnowledge, type Db, type Merchant } from "@nia/database";
import {
  addItemToDraft,
  createBookingDraft,
  getAvailableBookingSlots,
  getCustomerOrder,
  getCustomerRecentOrders,
  getDraft,
  getOrCreateDraft,
  getProduct,
  getService,
  orderSummary,
  removeDraftItem,
  reorderToDraft,
  resolveRepeatOrder,
  searchProducts,
  searchServices,
  setDraftFulfillment,
  updateDraftItem,
} from "@nia/commerce";
import { forgetMemory, forgetRecalledBlob, recallCustomerMemory, recallMerchantMemory, type MemoryStore, type RecalledMemory } from "@nia/memory";
import { isAppError, toMinorUnits, type Channel } from "@nia/shared";

export interface NiaToolScope {
  db: Db;
  store: MemoryStore | null;
  merchant: Merchant;
  customerId: string | null;
  customerMemoryEnabled: boolean;
  channel: Channel;
  conversationId: string;
  memoryMode: "on" | "off";
  /** Memories shown to the model this turn (refs M1.., B1..). Tools may append. */
  recalled: { customer: RecalledMemory[]; merchant: RecalledMemory[] };
  /** Side-channel flags for the orchestrator. */
  flags: { memoryAssisted: boolean; forgotten: string[] };
}

type Fail = { ok: false; error: string; code?: "SIGN_IN_REQUIRED" | "MEMORY_OFF" | "NOT_FOUND" | "INVALID" };

function fail(error: string, code?: Fail["code"]): Fail {
  return { ok: false, error, ...(code ? { code } : {}) };
}

async function guard<T>(fn: () => Promise<T>): Promise<T | Fail> {
  try {
    return await fn();
  } catch (err) {
    if (isAppError(err)) return fail(err.message, err.code === "NOT_FOUND" ? "NOT_FOUND" : "INVALID");
    console.error("[nia tool] unexpected error", err);
    return fail("Something went wrong on our side. Please try again.");
  }
}

const SIGN_IN = fail("The customer needs to sign in to use their cart, orders or bookings.", "SIGN_IN_REQUIRED");

/** Plain string ids (no JSON-Schema "format") for maximum provider compatibility; validated in each tool. */
const id = z.string().min(8).max(64).describe("Exact id from a previous tool result");
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const badId = (...ids: (string | undefined | null)[]) => ids.some((v) => v != null && !UUID_RE.test(v));

export function createNiaTools(scope: NiaToolScope) {
  const { db, merchant } = scope;
  const m = merchant.id;
  const needCustomer = () => scope.customerId;

  return {
    searchProducts: tool({
      description:
        "Search this shop's product catalog (products, custom orders, packages). Use for any product question or recommendation. Budget is in major units of the shop currency.",
      inputSchema: z.object({
        query: z.string().max(200).optional().describe("Keywords, e.g. 'ankara', 'linen kaftan', 'body butter'"),
        category: z.string().max(80).optional(),
        maxBudget: z.number().positive().optional().describe("Maximum price per unit in major currency units"),
        colour: z.string().max(40).optional().describe("Colour or colour family, e.g. 'blue', 'darker', 'emerald'"),
        size: z.string().max(20).optional().describe("Size option, e.g. 'M', 'XL', '500 ml'"),
        inStockOnly: z.boolean().optional(),
        limit: z.number().int().min(1).max(8).optional(),
      }),
      execute: async (input) =>
        guard(async () => {
          const products = await searchProducts(db, m, {
            query: input.query,
            category: input.category,
            maxPrice: input.maxBudget != null ? toMinorUnits(input.maxBudget, merchant.currency) : undefined,
            colour: input.colour,
            size: input.size,
            inStockOnly: input.inStockOnly,
            limit: input.limit ?? 4,
          });
          return { ok: true as const, count: products.length, products };
        }),
    }),

    getProduct: tool({
      description: "Get one product with all its variants, prices and availability.",
      inputSchema: z.object({ productId: id }),
      execute: async ({ productId }) =>
        guard(async () => {
          if (badId(productId)) return fail("Unknown product id — search the catalog first.", "INVALID");
          const product = await getProduct(db, m, productId);
          return product ? { ok: true as const, product } : fail("Product not found in this shop", "NOT_FOUND");
        }),
    }),

    searchServices: tool({
      description: "Search this shop's services and appointments (with next available time when known).",
      inputSchema: z.object({
        query: z.string().max(200).optional(),
        maxBudget: z.number().positive().optional().describe("Major currency units"),
      }),
      execute: async (input) =>
        guard(async () => {
          const services = await searchServices(db, m, merchant.timezone, {
            query: input.query,
            maxPrice: input.maxBudget != null ? toMinorUnits(input.maxBudget, merchant.currency) : undefined,
          });
          return { ok: true as const, count: services.length, services };
        }),
    }),

    getService: tool({
      description: "Get one service's details, options, price and next availability.",
      inputSchema: z.object({ serviceId: id }),
      execute: async ({ serviceId }) =>
        guard(async () => {
          if (badId(serviceId)) return fail("Unknown service id — search services first.", "INVALID");
          const service = await getService(db, m, serviceId, merchant.timezone);
          return service ? { ok: true as const, service } : fail("Service not found in this shop", "NOT_FOUND");
        }),
    }),

    getCustomerRecentOrders: tool({
      description: "The signed-in customer's recent orders at this shop (operational truth). Use for 'same as last time', 'my usual', order status.",
      inputSchema: z.object({ limit: z.number().int().min(1).max(10).optional() }),
      execute: async ({ limit }) =>
        guard(async () => {
          const customerId = needCustomer();
          if (!customerId) return SIGN_IN;
          if (scope.memoryMode === "off") return fail("Customer history is unavailable in memory-off mode.", "MEMORY_OFF");
          const orders = await getCustomerRecentOrders(db, m, customerId, limit ?? 5);
          return { ok: true as const, count: orders.length, orders, repeat: resolveRepeatOrder(orders) };
        }),
    }),

    getOrder: tool({
      description: "Look up one of the customer's orders by its number (e.g. 1042).",
      inputSchema: z.object({ orderNumber: z.number().int().positive() }),
      execute: async ({ orderNumber }) =>
        guard(async () => {
          const customerId = needCustomer();
          if (!customerId) return SIGN_IN;
          const order = await getCustomerOrder(db, m, customerId, orderNumber);
          return order ? { ok: true as const, order } : fail(`No order #${orderNumber} for this customer`, "NOT_FOUND");
        }),
    }),

    createDraftOrder: tool({
      description:
        "Start the customer's cart. Pass fromOrderId to repeat a previous order ('same as last time') — items are re-added at today's prices and stock.",
      inputSchema: z.object({ fromOrderId: id.optional() }),
      execute: async ({ fromOrderId }) =>
        guard(async () => {
          if (badId(fromOrderId)) return fail("Unknown order id — look up recent orders first.", "INVALID");
          const customerId = needCustomer();
          if (!customerId) return SIGN_IN;
          if (fromOrderId) {
            if (scope.memoryMode === "off") return fail("Customer history is unavailable in memory-off mode.", "MEMORY_OFF");
            const result = await reorderToDraft(db, { merchantId: m, customerId, orderId: fromOrderId, channel: scope.channel, conversationId: scope.conversationId });
            scope.flags.memoryAssisted = true;
            return { ok: true as const, cart: result.summary, added: result.added, unavailable: result.unavailable };
          }
          const draft = await getOrCreateDraft(db, { merchantId: m, customerId, channel: scope.channel, conversationId: scope.conversationId });
          return { ok: true as const, cart: await orderSummary(db, m, draft.id) };
        }),
    }),

    addItemToDraft: tool({
      description: "Add a product (with its variant when it has options) to the cart. Quantity is in the product's unit (e.g. yards).",
      inputSchema: z.object({
        productId: id,
        variantId: id.optional(),
        quantity: z.number().int().min(1).max(999),
        notes: z.string().max(300).optional(),
        basedOnMemory: z.boolean().optional().describe("true when the choice came from the customer's remembered preferences or history"),
      }),
      execute: async (input) =>
        guard(async () => {
          if (badId(input.productId, input.variantId)) return fail("Unknown product or option id — use ids from search results.", "INVALID");
          const customerId = needCustomer();
          if (!customerId) return SIGN_IN;
          if (input.basedOnMemory && scope.memoryMode === "on") scope.flags.memoryAssisted = true;
          const cart = await addItemToDraft(db, {
            merchantId: m,
            customerId,
            productId: input.productId,
            variantId: input.variantId ?? null,
            quantity: input.quantity,
            notes: input.notes ?? null,
            channel: scope.channel,
            conversationId: scope.conversationId,
            memoryAssisted: scope.flags.memoryAssisted,
          });
          return { ok: true as const, cart };
        }),
    }),

    updateDraftItem: tool({
      description: "Change quantity, variant or note of a cart line (item id from the cart).",
      inputSchema: z.object({
        itemId: id,
        quantity: z.number().int().min(1).max(999).optional(),
        variantId: id.optional(),
        notes: z.string().max(300).optional(),
      }),
      execute: async (input) =>
        guard(async () => {
          if (badId(input.itemId, input.variantId)) return fail("Unknown cart item id.", "INVALID");
          const customerId = needCustomer();
          if (!customerId) return SIGN_IN;
          return { ok: true as const, cart: await updateDraftItem(db, { merchantId: m, customerId, ...input }) };
        }),
    }),

    removeDraftItem: tool({
      description: "Remove a line from the cart.",
      inputSchema: z.object({ itemId: id }),
      execute: async ({ itemId }) =>
        guard(async () => {
          if (badId(itemId)) return fail("Unknown cart item id.", "INVALID");
          const customerId = needCustomer();
          if (!customerId) return SIGN_IN;
          return { ok: true as const, cart: await removeDraftItem(db, { merchantId: m, customerId, itemId }) };
        }),
    }),

    setFulfillment: tool({
      description: "Choose delivery (with one of the shop's listed areas) or pickup for the cart. For a one-off destination, this does NOT change the customer's usual delivery area.",
      inputSchema: z.object({
        method: z.enum(["delivery", "pickup"]),
        deliveryArea: z.string().max(80).optional(),
        deliveryAddress: z.string().max(300).optional(),
      }),
      execute: async (input) =>
        guard(async () => {
          const customerId = needCustomer();
          if (!customerId) return SIGN_IN;
          const cart = await setDraftFulfillment(db, { merchantId: m, customerId, method: input.method, deliveryArea: input.deliveryArea, deliveryAddress: input.deliveryAddress, channel: scope.channel });
          return { ok: true as const, cart };
        }),
    }),

    showOrderSummary: tool({
      description: "Show the cart as a structured order summary with Confirm / Edit buttons. The customer must press Confirm themselves.",
      inputSchema: z.object({}),
      execute: async () =>
        guard(async () => {
          const customerId = needCustomer();
          if (!customerId) return SIGN_IN;
          const draft = await getDraft(db, m, customerId);
          if (!draft) return fail("The cart is empty.");
          const summary = await orderSummary(db, m, draft.id);
          return { ok: true as const, summary, needsConfirmation: summary.blockers.length === 0 };
        }),
    }),

    getAvailableBookingSlots: tool({
      description: "Open booking slots for a service. Optional date (YYYY-MM-DD, shop local) and a time window (HH:MM).",
      inputSchema: z.object({
        serviceId: id,
        date: z.string().max(10).optional().describe("YYYY-MM-DD in the shop's time zone"),
        after: z.string().max(5).optional().describe("Earliest start time, HH:MM"),
        before: z.string().max(5).optional().describe("Latest end time, HH:MM"),
      }),
      execute: async (input) =>
        guard(async () => {
          if (badId(input.serviceId)) return fail("Unknown service id — search services first.", "INVALID");
          const date = input.date && /^\d{4}-\d{2}-\d{2}$/.test(input.date) ? input.date : undefined;
          const hhmm = (v?: string) => (v && /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? v : undefined);
          const res = await getAvailableBookingSlots(db, { merchantId: m, serviceId: input.serviceId, query: { date, after: hhmm(input.after), before: hhmm(input.before), limit: 8 } });
          return { ok: true as const, ...res, note: res.slots.length ? undefined : "No open slots found for that window." };
        }),
    }),

    createBookingDraft: tool({
      description: "Propose a booking for an open slot (startAt must be one of the returned slot ISO times). The customer confirms it on the card.",
      inputSchema: z.object({
        serviceId: id,
        startAt: z.string().max(40).describe("Exact startAt ISO time from getAvailableBookingSlots"),
        options: z.array(z.string().max(80)).max(5).optional(),
        notes: z.string().max(500).optional(),
        basedOnMemory: z.boolean().optional(),
      }),
      execute: async (input) =>
        guard(async () => {
          if (badId(input.serviceId)) return fail("Unknown service id — search services first.", "INVALID");
          const customerId = needCustomer();
          if (!customerId) return SIGN_IN;
          const booking = await createBookingDraft(db, {
            merchantId: m,
            customerId,
            serviceId: input.serviceId,
            startAt: input.startAt,
            options: input.options,
            notes: input.notes,
            channel: scope.channel,
            conversationId: scope.conversationId,
            memoryAssisted: Boolean(input.basedOnMemory && scope.memoryMode === "on"),
          });
          return { ok: true as const, booking, needsConfirmation: true };
        }),
    }),

    getMerchantPolicy: tool({
      description: "Shop policies and FAQs: shipping, returns, hours, service policies, product guidance.",
      inputSchema: z.object({ topic: z.string().max(80).optional().describe("e.g. 'returns', 'same-day delivery', 'deposit'") }),
      execute: async ({ topic }) =>
        guard(async () => {
          const rows = await db.select().from(merchantKnowledge).where(and(eq(merchantKnowledge.merchantId, m), eq(merchantKnowledge.active, true)));
          const words = (topic ?? "").toLowerCase().split(/\W+/).filter((w) => w.length > 2);
          const scored = rows
            .map((k) => ({ k, score: words.reduce((a, w) => a + (`${k.category} ${k.title} ${k.body}`.toLowerCase().includes(w) ? 1 : 0), 0) }))
            .sort((a, b) => b.score - a.score);
          const picked = (words.length ? scored.filter((s) => s.score > 0) : scored).slice(0, 5).map(({ k }) => ({ category: k.category, title: k.title, body: k.body }));
          return { ok: true as const, policies: picked, note: picked.length ? undefined : "No written policy on that topic — say you'll check with the shop." };
        }),
    }),

    recallCustomerMemory: tool({
      description: "Search this customer's long-term memory (Walrus) for something specific not already in <nia_customer_memory>.",
      inputSchema: z.object({ query: z.string().min(3).max(300) }),
      execute: async ({ query }) =>
        guard(async () => {
          const customerId = needCustomer();
          if (!customerId) return SIGN_IN;
          if (scope.memoryMode === "off" || !scope.customerMemoryEnabled) return fail("Memory is off for this conversation.", "MEMORY_OFF");
          if (!scope.store) return fail("Long-term memory is not configured.");
          const found = await recallCustomerMemory(db, scope.store, { merchantId: m, customerId, query, limit: 5 });
          const known = new Set(scope.recalled.customer.map((r) => r.blobId));
          const offset = scope.recalled.customer.length;
          const fresh = found.filter((f) => !known.has(f.blobId)).map((f, i) => ({ ...f, ref: `M${offset + i + 1}` }));
          scope.recalled.customer.push(...fresh);
          return {
            ok: true as const,
            memories: [...scope.recalled.customer.filter((r) => found.some((f) => f.blobId === r.blobId))].map((r) => ({ ref: r.ref, text: r.text, historical: r.historical })),
          };
        }),
    }),

    recallMerchantMemory: tool({
      description: "Search the shop's own operational notes and knowledge memory (e.g. restock dates, temporary rules).",
      inputSchema: z.object({ query: z.string().min(3).max(300) }),
      execute: async ({ query }) =>
        guard(async () => {
          if (!scope.store) return fail("Long-term memory is not configured.");
          const found = await recallMerchantMemory(db, scope.store, { merchantId: m, query, limit: 4 });
          const offset = scope.recalled.merchant.length;
          const known = new Set(scope.recalled.merchant.map((r) => r.blobId));
          const fresh = found.filter((f) => !known.has(f.blobId)).map((f, i) => ({ ...f, ref: `B${offset + i + 1}` }));
          scope.recalled.merchant.push(...fresh);
          return { ok: true as const, notes: found.map((f) => ({ text: f.text })) };
        }),
    }),

    forgetCustomerMemory: tool({
      description:
        "Forget one of the customer's memories (reference like 'M2') — only when they ask you to forget/delete it or say it is wrong. Never for updates like 'I've moved' or 'my size is XL now': those are stored automatically and keep history.",
      inputSchema: z.object({ ref: z.string().max(4).describe("Memory reference like M2") }),
      execute: async ({ ref }) =>
        guard(async () => {
          const customerId = needCustomer();
          if (!customerId) return SIGN_IN;
          const target = scope.recalled.customer.find((r) => r.ref === ref);
          if (!target) return fail(`No memory ${ref} in this conversation.`, "NOT_FOUND");
          const ok = target.record
            ? await forgetMemory(db, { merchantId: m, customerId, recordId: target.record.id, actor: { type: "customer", id: customerId } })
            : await forgetRecalledBlob(db, { merchantId: m, customerId, blobId: target.blobId, namespace: target.namespace, actor: { type: "customer", id: customerId } });
          if (ok) scope.flags.forgotten.push(target.blobId);
          return ok
            ? { ok: true as const, forgotten: ref, note: "Nia will no longer use this memory. The encrypted copy stays on Walrus until its storage period ends, but it is excluded from all recall." }
            : fail("Could not forget that memory.");
        }),
    }),
  };
}

export type NiaTools = ReturnType<typeof createNiaTools>;
