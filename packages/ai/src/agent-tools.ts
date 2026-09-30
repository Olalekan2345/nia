/**
 * Commerce-agent tools shared by a shop's Nia and the Walrus Market guide.
 * All deterministic server code over real data; the model only chooses what
 * to ask for. Every tool is bound to the server-built scope (merchant,
 * customer, conversation) — ids from the model are validated, never trusted.
 */
import { tool } from "ai";
import { z } from "zod";
import { findAlternatives, planBasket, type Alternative, type BasketPlan, type ProductCardData } from "@nia/commerce";
import { customerPassport, groupMemoryProfile, recallCustomerMemory } from "@nia/memory";
import { formatMoney, toMinorUnits, type SessionItem, type ShoppingIntent } from "@nia/shared";
import { fail, toolGuard, type NiaToolScope } from "./tool-kit";
import { mergeIntent } from "./session";

/* ─────────────────────────────── Reasons ─────────────────────────────── */

export interface SearchConstraints {
  maxBudget?: number;
  minBudget?: number;
  colour?: string;
  size?: string;
  prefer?: string[];
}

/**
 * Why a result fits — only from the request and the product's real data
 * (budget, matched option, stock, preference words it actually contains).
 * Memory-based reasons are the model's to add, citing the memory.
 */
export function whyReasons(p: ProductCardData, c: SearchConstraints, locale: string): string[] {
  const out: string[] = [];
  if (c.maxBudget != null && p.price != null && p.price <= toMinorUnits(c.maxBudget, p.currency)) out.push(`Within ${formatMoney(toMinorUnits(c.maxBudget, p.currency), p.currency, { locale })}`);
  const matched = p.matchedVariantIds?.length ? p.variants.filter((v) => p.matchedVariantIds!.includes(v.id) && v.available) : [];
  if (matched.length && (c.colour || c.size)) out.push(`Available in ${matched[0]!.name}`);
  const text = `${p.name} ${p.description ?? ""} ${p.tags.join(" ")} ${Object.values(p.attributes).flat().join(" ")}`.toLowerCase();
  for (const w of c.prefer ?? []) if (w.trim().length > 2 && text.includes(w.toLowerCase().trim())) out.push(`Matches “${w.trim()}”`);
  if (p.inventoryStatus === "made_to_order") out.push("Made to order");
  else if (p.available && p.inventoryStatus === "in_stock") out.push("In stock");
  return out.slice(0, 3);
}

/** Compact specs for the model (weight, battery, RAM…) — so it can reason from real attributes. */
export function specsText(p: Pick<ProductCardData, "attributes">, max = 140): string | undefined {
  const s = Object.entries(p.attributes)
    .map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join("/") : v}`)
    .join("; ");
  return s ? s.slice(0, max) : undefined;
}

/** Record what was shown (for "the second one", "compare these") and the stated constraints. */
export async function rememberShown(scope: NiaToolScope, items: SessionItem[], intent?: ShoppingIntent): Promise<void> {
  if (!items.length && !intent) return;
  await scope.session.update((s) => ({ ...s, ...(items.length ? { lastResults: items } : {}), ...(intent ? { intent: mergeIntent(s.intent, intent) } : {}) }));
}

export function sessionItem(p: { id: string; name: string; price: number | null; currency: string; shop?: { name: string } }, locale: string): SessionItem {
  return { id: p.id, name: p.name, ...(p.shop ? { shop: p.shop.name } : {}), ...(p.price != null ? { price: formatMoney(p.price, p.currency, { locale }) } : {}) };
}

/** Alternatives, formatted for the model and the cards. */
export async function alternativesFor(scope: NiaToolScope, merchantIds: string[], productId: string, variantId: string | null | undefined): Promise<Alternative[]> {
  return findAlternatives(scope.db, { merchantIds, productId, variantId, limit: 3, locale: scope.merchant.locale }).catch(() => []);
}

/* ─────────────────────────────── Shared schema bits ─────────────────────────────── */

const words = z.array(z.string().min(2).max(30)).max(6);
const productId = z.string().min(8).max(64);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/* ─────────────────────────────── Tools ─────────────────────────────── */

/**
 * @param shops limit baskets to these shop slugs (a shop's own Nia), or every live shop (the market).
 */
export function createAgentTools(scope: NiaToolScope, { shops }: { shops?: string[] } = {}) {
  const guard = toolGuard(scope.merchant);
  // Tools are built per turn: this counts basket builds within one reply.
  let basketsThisReply = 0;

  return {
    showMyMemory: tool({
      description:
        "Show what Nia remembers about the customer (sizes, colours, delivery, people, budget…) as a card with how sure Nia is. Use for 'what do you remember about me', 'what size do I normally buy', 'where do I usually deliver'. Optional topic narrows it.",
      inputSchema: z.object({ topic: z.string().max(40).optional().describe("e.g. 'size', 'delivery', 'brands'") }),
      execute: ({ topic }) =>
        guard(async () => {
          if (!scope.customerId) return fail("The customer needs to sign in so Nia can remember them.", "SIGN_IN_REQUIRED");
          if (scope.memoryMode === "off" || !scope.customerMemoryEnabled) return fail("Memory is off for this conversation.", "MEMORY_OFF");
          if (!scope.store) return fail("Memory is temporarily unavailable, so I can't look that up right now.");
          const entries = await customerPassport(scope.db, { merchantId: scope.merchant.id, customerId: scope.customerId });
          const sections = groupMemoryProfile(entries, topic);
          // The model answers from Walrus-recalled text (never from the UI labels).
          const queries = topic ? [`Customer ${topic}`] : ["Customer preferences: sizes, colours, styles, brands", "Customer delivery area and delivery preferences", "People the customer shops for, occasions, budget"];
          const found = await recallCustomerMemory(scope.db, scope.store, { merchantId: scope.merchant.id, customerId: scope.customerId, query: queries, limit: 8 }).catch(() => null);
          if (found === null) return fail("Memory is temporarily unavailable, so I can't look that up right now.");
          const known = new Set(scope.recalled.customer.map((r) => r.blobId));
          const offset = scope.recalled.customer.length;
          scope.recalled.customer.push(...found.filter((f) => !known.has(f.blobId)).map((f, i) => ({ ...f, ref: `M${offset + i + 1}` })));
          scope.flags.memoryAssisted = true;
          const byBlob = new Map(scope.recalled.customer.map((r) => [r.blobId, r]));
          return {
            ok: true as const,
            sections,
            count: sections.reduce((n, s) => n + s.items.length, 0),
            memories: found.map((f) => {
              const r = byBlob.get(f.blobId)!;
              return { ref: r.ref, text: r.text, historical: r.historical, certainty: r.record?.confirmation ?? null };
            }),
            note: "Present these grouped, with how sure you are (Confirmed / Observed / Likely). Invite corrections: they can say it's wrong, or give the new value.",
          };
        }),
    }),

    planBasket: tool({
      description:
        "Build a proposed basket from real products for a goal with several parts (party, event, outfit, home office, dinner plan, gift set, shopping list). You give the slots, quantities and people; the server finds real items, keeps it within the budget and totals it exactly. Set quantity for the headcount (8 friends → drinks quantity 8); if you leave it out and give people, single servings default to one each. Call it ONCE per reply; re-call only in a later reply with changes ('make it cheaper', 'remove the monitor', 'shoes cheaper', 'everything in black'). Nothing is bought — the customer reviews and adds it.",
      inputSchema: z.object({
        goal: z.string().min(3).max(80),
        budget: z.number().positive().optional().describe("Whole-basket budget, major currency units"),
        people: z.number().int().min(1).max(200).optional(),
        slots: z
          .array(
            z.object({
              label: z.string().min(2).max(30).describe("e.g. 'Drinks', 'Cake', 'Laptop'"),
              query: z.string().min(2).max(60).describe("1–3 simple search words"),
              quantity: z.number().int().min(1).max(50).optional(),
              maxPrice: z.number().positive().optional().describe("Per unit, major units"),
            }),
          )
          .min(1)
          .max(8),
        prefer: words.optional().describe("Soft preferences, e.g. ['black']"),
        exclude: words.optional().describe("Never include, e.g. ['alcohol','red']"),
        colour: z.string().max(30).optional().describe("Apply to every item that comes in it"),
        cheaper: z.array(z.string().max(30)).max(8).optional().describe("Slot labels to make cheaper than last time"),
      }),
      execute: (input) =>
        guard(async () => {
          if (++basketsThisReply > 2) return fail("You already built a basket in this reply — present it and ask what to change.", "INVALID");
          const currency = scope.merchant.currency;
          const prev = scope.session.current.basket;
          const plan: BasketPlan = await planBasket(scope.db, {
            goal: input.goal,
            budget: input.budget != null ? toMinorUnits(input.budget, currency) : null,
            people: input.people,
            slots: input.slots.map((s) => ({ ...s, maxPrice: s.maxPrice != null ? toMinorUnits(s.maxPrice, currency) : undefined })),
            prefer: input.prefer,
            exclude: input.exclude,
            colour: input.colour,
            cheaper: input.cheaper,
            previous: prev?.lines,
            shops,
          });
          await scope.session.update((s) => ({
            ...s,
            basket: {
              goal: input.goal,
              budget: input.budget,
              people: input.people,
              slots: input.slots,
              lines: plan.lines.map((l) => ({ slot: l.slot, productId: l.productId, variantId: l.variantId, quantity: l.quantity })),
              total: plan.total,
              currency: plan.currency,
            },
            intent: mergeIntent(s.intent, { goal: input.goal, ...(input.budget != null ? { budgetMax: input.budget } : {}), ...(input.exclude ? { excluded: input.exclude } : {}), ...(input.prefer ? { preferred: input.prefer } : {}) }),
          }));
          return { ok: true as const, ...plan, signedIn: Boolean(scope.customerId) };
        }),
    }),

    saveForLater: tool({
      description: "Save products the customer wants to keep ('save these two', 'keep that one') so they can come back to them later, on the web or Telegram. Use exact product ids.",
      inputSchema: z.object({ productIds: z.array(productId).min(1).max(4) }),
      execute: ({ productIds }) =>
        guard(async () => {
          const shown = [...(scope.session.current.lastResults ?? []), ...(scope.session.current.shortlist ?? [])];
          const picked = productIds.filter((id) => UUID.test(id)).map((id) => shown.find((i) => i.id === id)).filter((i): i is SessionItem => Boolean(i));
          if (!picked.length) return fail("Those aren't products I've shown in this conversation — search first and use their ids.", "NOT_FOUND");
          await scope.session.update((s) => ({ ...s, shortlist: [...(s.shortlist ?? []), ...picked] }));
          return { ok: true as const, saved: picked.map((p) => p.name), shortlist: scope.session.current.shortlist };
        }),
    }),

    updateShoppingList: tool({
      description: "Keep the customer's shopping list for this conversation: add, remove or clear items ('add milk', 'remove juice'). To buy the list, use planBasket with one slot per item.",
      inputSchema: z.object({
        add: z.array(z.string().min(2).max(40)).max(12).optional(),
        remove: z.array(z.string().min(2).max(40)).max(12).optional(),
        clear: z.boolean().optional(),
      }),
      execute: ({ add, remove, clear }) =>
        guard(async () => {
          const drop = new Set((remove ?? []).map((r) => r.toLowerCase().trim()));
          await scope.session.update((s) => ({
            ...s,
            list: [...(clear ? [] : (s.list ?? []).filter((i) => !drop.has(i.toLowerCase()) && ![...drop].some((d) => i.toLowerCase().includes(d)))), ...(add ?? [])],
          }));
          return { ok: true as const, list: scope.session.current.list ?? [] };
        }),
    }),
  };
}

export type AgentTools = ReturnType<typeof createAgentTools>;

/* ─────────────────────────────── Turn gating ─────────────────────────────── */

/** Multi-part goals worth a basket: events, headcounts, budgets for several things, kits, plans, lists. */
export const PLAN_TALK =
  /\b(?:party|parties|event|guests?|friends over|people|birthday|wedding|dinner|lunch|meal plan|plan|outfit|set ?up|setting up|kit|bundle|everything|shopping list|my list|the list|cart for|basket|home office|decorate|for \d+|\d+ (?:people|friends|guests|kids))\b|\b(?:make|keep) (?:it|everything|them) (?:cheaper|under|below)\b|\bcheaper\b|\bremove the\b|\bupgrade the\b|\bunder ₦?\d/i;
export const SAVE_TALK = /\b(?:save|keep|bookmark|shortlist|remember (?:these|this|that one|them))\b/i;
export const LIST_TALK = /\b(?:list|add (?:milk|bread|eggs|juice|water|rice)|remove (?:the )?\w+ from|get everything on)\b/i;
export const COMPARE_TALK = /\b(?:compare|comparison|versus|vs\.?|which (?:one )?is better|what'?s (?:the )?different|difference between|which (?:has|is) (?:better|lighter|cheaper|longer))\b/i;
