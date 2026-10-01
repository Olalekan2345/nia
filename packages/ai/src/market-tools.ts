/**
 * Tools for Nia as the Walrus Market guide: search and compare across every
 * live shop, ask the shopper one decision question at a time (shown as
 * tap-to-answer buttons), and propose baskets across shops. Buying still
 * happens in each shop: the shopper adds items to that shop's cart.
 */
import { tool } from "ai";
import { z } from "zod";
import { compareFacts, marketProducts, searchMarket, searchMarketServices, type MarketProduct, type MarketService } from "@nia/commerce";
import { toMinorUnits } from "@nia/shared";
import { createAgentTools, rememberShown, sessionItem, specsText, whyReasons, type SearchConstraints } from "./agent-tools";
import { createNiaTools, fail, searchExtras, toolGuard, type NiaToolScope } from "./tools";

const productId = z.string().min(8).max(64).describe("exact product id");

/**
 * What the model (and the market card UI) needs. Kept deliberately small: every
 * search result is re-sent to the model in the next step, and rate-limited
 * providers cap tokens per request (Groq's free tier: 7,000 per minute).
 */
function productView(p: MarketProduct, constraints: SearchConstraints = {}) {
  const matched = p.matchedVariantIds?.length ? p.variants.filter((v) => p.matchedVariantIds!.includes(v.id)).map((v) => v.name) : null;
  const specs = specsText(p);
  return {
    id: p.id,
    name: p.name,
    category: p.category,
    about: p.description ? p.description.slice(0, 90) : null,
    ...(specs ? { specs } : {}),
    why: whyReasons(p, constraints, p.shop.locale),
    price: p.price,
    priceMax: p.priceMax,
    currency: p.currency,
    unit: p.unit,
    inventoryStatus: p.inventoryStatus,
    image: p.image,
    url: p.url,
    options: p.variants.filter((v) => v.available).slice(0, 6).map((v) => v.name),
    ...(matched ? { matching: matched } : {}),
    shop: {
      name: p.shop.name,
      slug: p.shop.slug,
      type: p.shop.businessLabel,
      city: p.shop.city,
      demo: p.shop.isDemo,
      delivery: p.shop.delivery,
      pickup: p.shop.pickup,
      deliveryAreas: p.shop.deliveryAreas.slice(0, 4).map((a) => a.name),
    },
  };
}

function serviceView(s: MarketService) {
  return {
    id: s.id,
    name: s.name,
    category: s.category,
    about: s.description ? s.description.slice(0, 90) : null,
    priceMin: s.priceMin,
    priceMax: s.priceMax,
    currency: s.currency,
    durationMinutes: s.durationMinutes,
    depositAmount: s.depositAmount,
    nextAvailable: s.nextAvailable,
    url: s.url,
    shop: { name: s.shop.name, type: s.shop.businessLabel, city: s.shop.city, demo: s.shop.isDemo },
  };
}

/** Searches allowed in one reply; models on tight token budgets sometimes loop on near-identical queries. */
const SEARCHES_PER_REPLY = 3;

export function createMarketTools(scope: NiaToolScope) {
  const { db, merchant } = scope;
  const guard = toolGuard(merchant);
  const memory = createNiaTools(scope);
  // Memory card, cross-shop basket planner, shortlist and shopping list.
  const agent = createAgentTools(scope);
  // Tools are built per turn, so this counts searches within one reply.
  const searches = new Set<string>();
  const searchBudget = (kind: string, input: object) => {
    const key = `${kind}:${JSON.stringify(input).toLowerCase()}`;
    if (searches.has(key)) return fail("You already ran this exact search in this reply. Recommend from those results, or ask the shopper one question.", "INVALID");
    if (searches.size >= SEARCHES_PER_REPLY) return fail("That's enough searching for one reply. Recommend from the results you have, or say honestly that nothing fits.", "INVALID");
    searches.add(key);
    return null;
  };

  return {
    searchMarket: tool({
      description: "Search products across all shops. Budgets in major currency units.",
      inputSchema: z.object({
        query: z.string().max(200).optional().describe("keywords"),
        category: z.string().max(80).optional(),
        maxBudget: z.number().positive().optional().describe("per unit"),
        colour: z.string().max(40).optional(),
        size: z.string().max(20).optional().describe("option size, e.g. M, XL, 500 ml"),
        inStockOnly: z.boolean().optional(),
        shop: z.string().max(64).optional().describe("shop slug"),
        limit: z.number().int().min(1).max(6).optional(),
        ...searchExtras,
      }),
      execute: (input) =>
        guard(async () => {
          const over = searchBudget("products", input);
          if (over) return over;
          const products = await searchMarket(db, {
            query: input.query,
            category: input.category,
            maxPrice: input.maxBudget != null ? toMinorUnits(input.maxBudget, merchant.currency) : undefined,
            minPrice: input.minBudget != null ? toMinorUnits(input.minBudget, merchant.currency) : undefined,
            colour: input.colour,
            size: input.size,
            inStockOnly: input.inStockOnly,
            exclude: input.exclude,
            prefer: input.prefer,
            shops: input.shop ? [input.shop] : undefined,
            limit: input.limit ?? 4,
          });
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
          return { ok: true as const, count: products.length, products: products.map((p) => productView(p, input)) };
        }),
    }),

    searchMarketServices: tool({
      description: "Search bookable services across shops.",
      inputSchema: z.object({
        query: z.string().max(200).optional(),
        maxBudget: z.number().positive().optional(),
        limit: z.number().int().min(1).max(6).optional(),
      }),
      execute: (input) =>
        guard(async () => {
          const over = searchBudget("services", input);
          if (over) return over;
          const services = await searchMarketServices(db, {
            query: input.query,
            maxPrice: input.maxBudget != null ? toMinorUnits(input.maxBudget, merchant.currency) : undefined,
            limit: input.limit ?? 4,
          });
          return { ok: true as const, count: services.length, services: services.map(serviceView) };
        }),
    }),

    compareProducts: tool({
      description: "Compare 2–4 products (ids from results or <nia_session>) from real specs; never guess unlisted specs. focus = specs to compare.",
      inputSchema: z.object({ productIds: z.array(productId).min(2).max(4), focus: z.array(z.string().max(30)).max(6).optional() }),
      execute: ({ productIds, focus }) =>
        guard(async () => {
          const products = await marketProducts(db, productIds);
          if (products.length < 2) return fail("I need at least two of those products to compare — search again and use their exact ids.", "NOT_FOUND");
          await rememberShown(scope, products.map((p) => sessionItem(p, merchant.locale)));
          return { ok: true as const, products: products.map((p) => productView(p)), ...compareFacts(products, focus) };
        }),
    }),

    askDecision: tool({
      description: "Ask ONE multiple-choice question that changes the recommendation; options show as buttons. Max one per reply; never ask what memory already says.",
      inputSchema: z.object({
        question: z.string().min(5).max(140),
        options: z.array(z.string().min(1).max(40)).min(2).max(5),
        topic: z.string().min(2).max(30).optional().describe("2–3 word label, e.g. 'Budget'"),
      }),
      execute: async ({ question, options, topic }) => ({ ok: true as const, question, options, ...(topic ? { topic } : {}) }),
    }),

    planBasket: agent.planBasket,
    showMyMemory: agent.showMyMemory,
    saveForLater: agent.saveForLater,
    updateShoppingList: agent.updateShoppingList,
    recallCustomerMemory: memory.recallCustomerMemory,
    forgetCustomerMemory: memory.forgetCustomerMemory,
  };
}

export type MarketTools = ReturnType<typeof createMarketTools>;
