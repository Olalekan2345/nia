/**
 * Basket planner: "six friends tonight — drinks, snacks and something sweet
 * under ₦40,000". The model names the slots (what kinds of items, how many);
 * everything else is deterministic server code over the real catalog:
 *
 *   search each slot → choose an available priced option → keep unchanged
 *   slots stable → step the priciest line down to cheaper real options until
 *   the basket fits the budget → exact totals in minor units, per shop.
 *
 * Nothing is added to a cart here. The customer reviews the proposal and adds
 * it themselves; checkout still happens per shop.
 */
import type { BasketLineState, BasketSlotInput } from "@nia/shared";
import { searchMarket, type MarketProduct } from "./market";

export interface BasketPlanInput {
  goal: string;
  /** Whole-basket budget, minor units. */
  budget?: number | null;
  people?: number | null;
  /** maxPrice per unit is in MINOR units here. */
  slots: (Omit<BasketSlotInput, "maxPrice"> & { maxPrice?: number })[];
  /** Soft: rank items described by these words higher. */
  prefer?: string[];
  /** Hard: never choose items described by these words. */
  exclude?: string[];
  /** Apply a colour to every slot whose items come in it ("change everything to black"). */
  colour?: string;
  /** Slot labels to move to a cheaper option than the previous proposal. */
  cheaper?: string[];
  /** The previous proposal's choices — unchanged slots keep them. */
  previous?: BasketLineState[];
  /** Limit to these shop slugs (a shop's own Nia). Default: every live shop. */
  shops?: string[];
}

export interface BasketLine {
  slot: string;
  productId: string;
  variantId: string | null;
  name: string;
  variantName: string | null;
  shop: { name: string; slug: string };
  unit: string | null;
  /** Minor units. */
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  image: string | null;
  url: string;
  /** Other real options found for this slot (for "show alternatives"). */
  otherOptions: number;
}

export interface BasketPlan {
  goal: string;
  currency: string;
  lines: BasketLine[];
  /** Slots with nothing suitable in stock (honest gaps, never filled with guesses). */
  missing: { slot: string; reason: string }[];
  /** Minor units. */
  total: number;
  budget: number | null;
  remaining: number | null;
  overBudgetBy: number | null;
  byShop: { shop: { name: string; slug: string }; subtotal: number; items: number }[];
  notes: string[];
}

interface Option {
  product: MarketProduct;
  variantId: string | null;
  variantName: string | null;
  unitPrice: number;
}

const key = (s: string) => s.trim().toLowerCase();
const clampQty = (n: number) => Math.max(1, Math.min(50, Math.floor(n)));

/** One serving per person ("8 friends" → 8 cans); shared sizes by servings; whole items (cake, platter, box) stay at 1. */
const PER_PERSON_UNIT = /^(?:can|bottle|cup|glass|plate|bowl|wrap|portion|serving|sachet|meal|pack of 1)$/i;
const SHARED_UNIT: [RegExp, number][] = [
  [/^(?:carton|litre|liter|1 l)$/i, 4],
  [/^(?:jug|pitcher)$/i, 6],
];

/** The quantity for a slot: what the model asked for, else a sensible default from the headcount. */
export function defaultQuantity(unit: string | null, people: number | null | undefined): number {
  if (!people || people < 2 || !unit) return 1;
  if (PER_PERSON_UNIT.test(unit.trim())) return clampQty(people);
  const shared = SHARED_UNIT.find(([re]) => re.test(unit.trim()));
  return shared ? clampQty(Math.ceil(people / shared[1])) : 1;
}

/** Buyable options for one product: the colour-matched variant if asked, else the cheapest available. */
function optionFor(p: MarketProduct, wantColour: boolean): Option | null {
  if (!p.available) return null;
  const purchasable = p.variants.filter((v) => v.available && v.price != null);
  if (p.variants.length) {
    const matched = wantColour && p.matchedVariantIds?.length ? purchasable.filter((v) => p.matchedVariantIds!.includes(v.id)) : purchasable;
    const pick = [...matched].sort((a, b) => a.price! - b.price!)[0];
    return pick ? { product: p, variantId: pick.id, variantName: pick.name, unitPrice: pick.price! } : null;
  }
  return p.price != null ? { product: p, variantId: null, variantName: null, unitPrice: p.price } : null;
}

export async function planBasket(db: Parameters<typeof searchMarket>[0], input: BasketPlanInput): Promise<BasketPlan> {
  const slots = input.slots.slice(0, 8);
  const cheaper = new Set((input.cheaper ?? []).map(key));
  const previous = new Map((input.previous ?? []).map((l) => [key(l.slot), l]));
  const notes: string[] = [];
  const missing: BasketPlan["missing"] = [];

  // 1. Real options per slot, in relevance order.
  const perSlot = await Promise.all(
    slots.map(async (slot) => {
      const colour = slot.colour ?? input.colour;
      const found = await searchMarket(db, {
        query: slot.query,
        category: slot.category,
        maxPrice: slot.maxPrice,
        colour,
        exclude: [...(input.exclude ?? []), ...(slot.exclude ?? [])],
        prefer: input.prefer,
        inStockOnly: true,
        shops: input.shops,
        limit: 8,
      });
      // Asked for a colour this slot doesn't come in: fall back to the slot without it, and say so.
      let options = found.map((p) => optionFor(p, Boolean(colour))).filter((o): o is Option => Boolean(o));
      if (!options.length && colour && !slot.colour) {
        const plain = await searchMarket(db, { query: slot.query, category: slot.category, maxPrice: slot.maxPrice, exclude: [...(input.exclude ?? []), ...(slot.exclude ?? [])], prefer: input.prefer, inStockOnly: true, shops: input.shops, limit: 8 });
        options = plain.map((p) => optionFor(p, false)).filter((o): o is Option => Boolean(o));
        if (options.length) notes.push(`No ${colour} option for ${slot.label}; kept the closest match.`);
      }
      return { slot, options, quantity: slot.quantity != null ? clampQty(slot.quantity) : null };
    }),
  );
  // Explicit quantity wins; otherwise a default from the headcount and the chosen item's unit.
  const qty = (s: (typeof perSlot)[number], o: Option) => s.quantity ?? defaultQuantity(o.product.unit, input.people);

  // 2. Initial choice: keep last proposal's pick unless asked to change it.
  const choice = new Map<string, number>(); // slot key → index into options
  for (const { slot, options } of perSlot) {
    const k = key(slot.label);
    if (!options.length) {
      missing.push({ slot: slot.label, reason: `Nothing in stock for “${slot.query}”${slot.maxPrice != null ? " at that price" : ""}.` });
      continue;
    }
    const prev = previous.get(k);
    const prevIdx = prev ? options.findIndex((o) => o.product.id === prev.productId && (o.variantId ?? null) === (prev.variantId ?? null)) : -1;
    const prevAny = prev && prevIdx < 0 ? options.findIndex((o) => o.product.id === prev.productId) : -1;
    const kept = prevIdx >= 0 ? prevIdx : prevAny;
    if (cheaper.has(k)) {
      const base = kept >= 0 ? options[kept]!.unitPrice : options[0]!.unitPrice;
      const idx = options.findIndex((o) => o.unitPrice < base);
      if (idx >= 0) choice.set(k, idx);
      else {
        choice.set(k, kept >= 0 ? kept : 0);
        notes.push(`No cheaper ${slot.label} in stock right now.`);
      }
    } else {
      choice.set(k, kept >= 0 ? kept : 0);
    }
  }

  const totalOf = () =>
    perSlot.reduce((sum, s) => {
      const i = choice.get(key(s.slot.label));
      return i == null ? sum : sum + s.options[i]!.unitPrice * qty(s, s.options[i]!);
    }, 0);

  // 3. Fit the budget: step the priciest line down to its next cheaper real option.
  const budget = input.budget ?? null;
  if (budget != null) {
    for (let guard = 0; guard < 80 && totalOf() > budget; guard++) {
      const steps = perSlot
        .map((s) => {
          const k = key(s.slot.label);
          if (!choice.has(k)) return null;
          const current = s.options[choice.get(k)!]!;
          // The most expensive option that is still cheaper than the current one: the smallest step down.
          const next = s.options
            .map((o, i) => ({ o, i }))
            .filter(({ o }) => o.unitPrice < current.unitPrice)
            .sort((a, b) => b.o.unitPrice - a.o.unitPrice)[0];
          return next ? { k, i: next.i, line: current.unitPrice * qty(s, current) } : null;
        })
        .filter((x): x is NonNullable<typeof x> => Boolean(x))
        .sort((a, b) => b.line - a.line);
      const step = steps[0];
      if (!step) break;
      choice.set(step.k, step.i);
    }
  }

  // 4. Lines and exact totals.
  const lines: BasketLine[] = perSlot.flatMap((s) => {
    const { slot, options } = s;
    const idx = choice.get(key(slot.label));
    if (idx == null) return [];
    const o = options[idx]!;
    const quantity = qty(s, o);
    return [
      {
        slot: slot.label,
        productId: o.product.id,
        variantId: o.variantId,
        name: o.product.name,
        variantName: o.variantName,
        shop: { name: o.product.shop.name, slug: o.product.shop.slug },
        unit: o.product.unit,
        unitPrice: o.unitPrice,
        quantity,
        lineTotal: o.unitPrice * quantity,
        image: o.product.image,
        url: o.product.url,
        otherOptions: options.length - 1,
      },
    ];
  });
  const total = lines.reduce((s, l) => s + l.lineTotal, 0);
  const byShop = new Map<string, BasketPlan["byShop"][number]>();
  for (const l of lines) {
    const entry = byShop.get(l.shop.slug) ?? { shop: l.shop, subtotal: 0, items: 0 };
    entry.subtotal += l.lineTotal;
    entry.items += l.quantity;
    byShop.set(l.shop.slug, entry);
  }
  if (byShop.size > 1) notes.push("Items come from different shops: each shop has its own cart, delivery fee and checkout.");
  else if (lines.length) notes.push("Delivery fees are added by the shop at checkout.");

  const currency = perSlot.find((s) => s.options.length)?.options[0]?.product.currency ?? "NGN";
  const over = budget != null && total > budget ? total - budget : null;
  if (over != null) notes.push("Even the cheapest in-stock choices go over the budget — drop an item, lower quantities or raise the budget.");
  return {
    goal: input.goal,
    currency,
    lines,
    missing,
    total,
    budget,
    remaining: budget != null && over == null ? budget - total : null,
    overBudgetBy: over,
    byShop: [...byShop.values()],
    notes,
  };
}
