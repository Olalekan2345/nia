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
import { merchantKnowledge } from "@nia/database";
import {
  addItemToDraft,
  compareFacts,
  createBookingDraft,
  getAvailableBookingSlots,
  getCustomerBookings,
  getCustomerOrder,
  getCustomerRecentOrders,
  getDraft,
  getOrCreateDraft,
  getProduct,
  getService,
  orderSummary,
  productPriceHistoryFor,
  removeDraftItem,
  reorderToDraft,
  resolveRepeatBooking,
  resolveRepeatOrder,
  searchProducts,
  searchServices,
  setDraftFulfillment,
  updateDraftItem,
} from "@nia/commerce";
import { forgetMemory, forgetRecalledBlob, recallCustomerMemory, recallMerchantMemory } from "@nia/memory";
import { isAppError, toMinorUnits } from "@nia/shared";
import { alternativesFor, createAgentTools, rememberShown, sessionItem, specsText, whyReasons } from "./agent-tools";
import { fail, toolGuard, type NiaToolScope } from "./tool-kit";

export { fail, toolGuard, withMoneyLabels, type NiaToolScope } from "./tool-kit";

/** Optional search constraints shared by the shop and market search tools. */
export const searchExtras = {
  minBudget: z.number().positive().optional(),
  exclude: z.array(z.string().min(2).max(30)).max(6).optional().describe("never show"),
  prefer: z.array(z.string().min(2).max(30)).max(6).optional().describe("rank higher"),
  forWhom: z.string().max(40).optional(),
  occasion: z.string().max(40).optional(),
};

const SIGN_IN = fail("The customer needs to sign in to use their cart, orders or bookings.", "SIGN_IN_REQUIRED");

/** Plain string ids (no JSON-Schema "format") for maximum provider compatibility; validated in each tool. */
const id = z.string().min(8).max(64).describe("exact id from a tool result");
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const badId = (...ids: (string | undefined | null)[]) => ids.some((v) => v != null && !UUID_RE.test(v));

export function createNiaTools(scope: NiaToolScope) {
  const { db, merchant } = scope;
  const m = merchant.id;
  const guard = toolGuard(merchant);
  const needCustomer = () => scope.customerId;

  return {
    // Memory card, basket planner (this shop only), shortlist and shopping list.
    ...createAgentTools(scope, { shops: [merchant.slug] }),

    searchProducts: tool({
      description: "Search this shop's products. Budgets in major currency units.",
      inputSchema: z.object({
        query: z.string().max(200).optional().describe("keywords"),
        category: z.string().max(80).optional(),
        maxBudget: z.number().positive().optional().describe("per unit"),
        colour: z.string().max(40).optional(),
        size: z.string().max(20).optional().describe("option size, e.g. M, XL, 500 ml"),
        inStockOnly: z.boolean().optional(),
        limit: z.number().int().min(1).max(8).optional(),
        ...searchExtras,
      }),
      execute: async (input) =>
        guard(async () => {
          const found = await searchProducts(db, m, {
            query: input.query,
            category: input.category,
            maxPrice: input.maxBudget != null ? toMinorUnits(input.maxBudget, merchant.currency) : undefined,
            minPrice: input.minBudget != null ? toMinorUnits(input.minBudget, merchant.currency) : undefined,
            colour: input.colour,
            size: input.size,
            inStockOnly: input.inStockOnly,
            exclude: input.exclude,
            prefer: input.prefer,
            limit: input.limit ?? 4,
          });
          const products = found.map((p) => ({ ...p, why: whyReasons(p, input, merchant.locale), specs: specsText(p) }));
          await rememberShown(scope, products.map((p) => sessionItem(p, merchant.locale)), {
            query: input.query,
            category: input.category,
            budgetMax: input.maxBudget,
            budgetMin: input.minBudget,
            colour: input.colour,
            size: input.size,
            excluded: input.exclude,
            preferred: input.prefer,
            recipient: input.forWhom,
            occasion: input.occasion,
          });
          return { ok: true as const, count: products.length, products };
        }),
    }),

    getProduct: tool({
      description: "One product: variants, prices, stock, recorded price changes, alternatives.",
      inputSchema: z.object({ productId: id }),
      execute: async ({ productId }) =>
        guard(async () => {
          if (badId(productId)) return fail("Unknown product id — search the catalog first.", "INVALID");
          const product = await getProduct(db, m, productId);
          if (!product) return fail("Product not found in this shop", "NOT_FOUND");
          const [history, alternatives] = await Promise.all([
            productPriceHistoryFor(db, { merchantId: m, productId: product.id }),
            product.available ? Promise.resolve([]) : alternativesFor(scope, [m], product.id, null),
          ]);
          return {
            ok: true as const,
            product,
            // Only recorded changes: with none, never claim a discount or a previous price.
            priceHistory: { trackedSince: history.trackedSince, changes: history.changes.slice(-5) },
            ...(alternatives.length ? { alternatives } : {}),
          };
        }),
    }),

    compareProducts: tool({
      description: "Compare 2–4 products from real specs. focus = specs to compare.",
      inputSchema: z.object({ productIds: z.array(id).min(2).max(4), focus: z.array(z.string().max(30)).max(6).optional() }),
      execute: async ({ productIds, focus }) =>
        guard(async () => {
          if (badId(...productIds)) return fail("Use exact product ids from search results.", "INVALID");
          const list = (await Promise.all(productIds.map((pid) => getProduct(db, m, pid)))).filter((p): p is NonNullable<typeof p> => Boolean(p));
          if (list.length < 2) return fail("I need at least two of this shop's products to compare.", "NOT_FOUND");
          return { ok: true as const, products: list, ...compareFacts(list, focus) };
        }),
    }),

    searchServices: tool({
      description: "Search this shop's services.",
      inputSchema: z.object({
        query: z.string().max(200).optional(),
        maxBudget: z.number().positive().optional(),
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
      description: "One service: options, price, next availability.",
      inputSchema: z.object({ serviceId: id }),
      execute: async ({ serviceId }) =>
        guard(async () => {
          if (badId(serviceId)) return fail("Unknown service id — search services first.", "INVALID");
          const service = await getService(db, m, serviceId, merchant.timezone);
          return service ? { ok: true as const, service } : fail("Service not found in this shop", "NOT_FOUND");
        }),
    }),

    getCustomerRecentOrders: tool({
      description: "Customer's recent orders and bookings here, for 'same as last time', 'my usual' or status. repeat/repeatBooking say if history is clear.",
      inputSchema: z.object({ limit: z.number().int().min(1).max(10).optional() }),
      execute: async ({ limit }) =>
        guard(async () => {
          const customerId = needCustomer();
          if (!customerId) return SIGN_IN;
          if (scope.memoryMode === "off") return fail("Customer history is unavailable in memory-off mode.", "MEMORY_OFF");
          const [orders, bookings] = await Promise.all([getCustomerRecentOrders(db, m, customerId, limit ?? 5), getCustomerBookings(db, m, customerId, 5)]);
          const past = bookings.filter((b) => b.status !== "draft");
          // Moved since the last order? Repeat it to where they live now (the recalled Walrus memory says where).
          const isArea = (r: { historical: boolean; record: { subjectKey: string } | null }) => !r.historical && r.record?.subjectKey === "usual_delivery_area";
          const lastArea = orders[0]?.deliveryArea;
          let area = scope.recalled.customer.find(isArea);
          if (!area && lastArea && scope.store && scope.customerMemoryEnabled) {
            // Pre-turn recall ranks the order itself first; ask Walrus for the current area directly.
            const found = await recallCustomerMemory(db, scope.store, { merchantId: m, customerId, query: "Customer's usual delivery area", limit: 3 }).catch(() => []);
            const hit = found.find(isArea);
            if (hit) {
              area = { ...hit, ref: `M${scope.recalled.customer.length + 1}` };
              scope.recalled.customer.push(area);
            }
          }
          // Compare with the record's current value (server-side only); the model gets the Walrus sentence.
          const areaNow = area?.record?.label.split(":").slice(1).join(":").trim().toLowerCase();
          const deliveryNow = area && areaNow && lastArea && !areaNow.includes(lastArea.toLowerCase()) ? `${area.text} The last order went to ${lastArea}; repeat it to the current area unless they say otherwise.` : undefined;
          return {
            ok: true as const,
            count: orders.length,
            orders,
            repeat: resolveRepeatOrder(orders),
            ...(deliveryNow ? { deliveryNow } : {}),
            ...(past.length
              ? {
                  bookings: past.map((b) => ({ id: b.id, service: b.serviceName, serviceId: b.serviceId, options: b.selectedOptions, startAt: b.startAt, status: b.status })),
                  repeatBooking: resolveRepeatBooking(past),
                }
              : {}),
          };
        }),
    }),

    getOrder: tool({
      description: "One of the customer's orders by number.",
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
      description: "Start the cart. fromOrderId repeats that order at today's prices and stock.",
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
            // For anything no longer available: real alternatives, never a silent swap.
            const alternatives = (
              await Promise.all(
                result.unavailableItems.filter((u) => u.productId).map(async (u) => ({ for: u.name, quantity: u.quantity, options: await alternativesFor(scope, [m], u.productId!, u.variantId) })),
              )
            ).filter((a) => a.options.length);
            return { ok: true as const, cart: result.summary, added: result.added, unavailable: result.unavailable, ...(result.alreadyInCart ? { note: "This order is already in the cart, same quantities — nothing added again." } : {}), ...(alternatives.length ? { alternatives } : {}) };
          }
          const draft = await getOrCreateDraft(db, { merchantId: m, customerId, channel: scope.channel, conversationId: scope.conversationId });
          return { ok: true as const, cart: await orderSummary(db, m, draft.id) };
        }),
    }),

    addItemToDraft: tool({
      description: "Add a product (and variant if it has options) to the cart. Quantity in the product's unit.",
      inputSchema: z.object({
        productId: id,
        variantId: id.optional(),
        quantity: z.number().int().min(1).max(999),
        notes: z.string().max(300).optional(),
        basedOnMemory: z.boolean().optional().describe("choice came from memory"),
      }),
      execute: async (input) =>
        guard(async () => {
          if (badId(input.productId, input.variantId)) return fail("Unknown product or option id — use ids from search results.", "INVALID");
          const customerId = needCustomer();
          if (!customerId) return SIGN_IN;
          if (input.basedOnMemory && scope.memoryMode === "on") scope.flags.memoryAssisted = true;
          try {
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
          } catch (err) {
            // Out of stock / not enough: say so, with real alternatives instead of a dead end.
            if (!isAppError(err) || err.code !== "CONFLICT") throw err;
            const alternatives = await alternativesFor(scope, [m], input.productId, input.variantId);
            return { ...fail(err.message), ...(alternatives.length ? { alternatives } : {}) };
          }
        }),
    }),

    updateDraftItem: tool({
      description: "Change a cart line.",
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
      description: "Delivery (a listed area) or pickup. A one-off destination doesn't change the usual area.",
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
      description: "Show the order summary with Confirm/Edit buttons (the customer confirms).",
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
      description: "Open slots for a service.",
      inputSchema: z.object({
        serviceId: id,
        date: z.string().max(10).optional().describe("YYYY-MM-DD"),
        after: z.string().max(5).optional().describe("HH:MM"),
        before: z.string().max(5).optional().describe("HH:MM"),
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
      description: "Propose a booking for an open slot; the customer confirms on the card.",
      inputSchema: z.object({
        serviceId: id,
        startAt: z.string().max(40).describe("a returned slot startAt"),
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
      description: "Shop policies and FAQs.",
      inputSchema: z.object({ topic: z.string().max(80).optional() }),
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
      description: "Search the customer's Walrus memory for something not in <nia_customer_memory>.",
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
      description: "Search the shop's own notes memory.",
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
      description: "Forget a memory (ref like M2) only when asked to forget it or it is wrong — never for updates like 'I moved' (kept automatically).",
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
