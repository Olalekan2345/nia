/**
 * Catalog search. Structured database filtering first (merchant scope,
 * active flag, price, kind, variant options), then lightweight relevance
 * ranking. Results only ever contain real rows — Nia cannot recommend
 * something that is not in this merchant's catalog.
 */
import { and, asc, eq, inArray, or, sql, type SQL } from "drizzle-orm";
import { products, productVariants, services, type Db, type Product, type ProductVariant, type Service } from "@nia/database";
import type { InventoryStatus, OfferingKind } from "@nia/shared";
import type { ProductCardData, ServiceCardData, VariantCardData } from "./types";
import { nextAvailableSlot } from "./slots";

const STOPWORDS = new Set([
  "a", "an", "the", "and", "or", "for", "of", "to", "in", "on", "with", "me", "my", "i", "you", "do", "have", "any", "some",
  "please", "want", "need", "looking", "show", "find", "get", "something", "can", "is", "are", "it", "that", "this", "under",
  "below", "less", "than", "about", "like", "similar", "what", "which", "your", "got", "there", "buy", "order",
]);

/** Colour families so "darker colours" or "blue" reach the right variants. */
const COLOUR_FAMILIES: Record<string, string[]> = {
  dark: ["black", "navy", "charcoal", "onyx", "midnight", "deep", "wine", "burgundy", "indigo"],
  darker: ["black", "navy", "charcoal", "onyx", "midnight", "deep", "wine", "burgundy", "indigo"],
  light: ["white", "ivory", "cream", "sand", "sky", "champagne"],
  blue: ["blue", "navy", "cobalt", "indigo", "sky"],
  green: ["green", "emerald"],
  red: ["red", "wine", "burgundy", "terracotta"],
  neutral: ["sand", "cream", "ivory", "charcoal", "white", "black"],
  earth: ["terracotta", "sand", "brown", "olive", "rust"],
};

export function tokenize(query: string): string[] {
  return [
    ...new Set(
      query
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s-]/gu, " ")
        .split(/\s+/)
        // Plurals to singular: bodies → body, dresses → dress, watches → watch, shoes → shoe (never dress → dres).
        .map((t) => t.replace(/(?:ies)$/, "y").replace(/(ss|sh|ch|x|z)es$/, "$1").replace(/(?<=[a-z]{3})(?<!s)s$/, ""))
        .filter((t) => t.length >= 2 && !STOPWORDS.has(t)),
    ),
  ].slice(0, 12);
}

/** Plain colour words: "black dresses" is about dresses, so colour alone never qualifies a product. */
const COLOUR_WORDS = new Set(["black", "white", "red", "blue", "green", "yellow", "pink", "purple", "orange", "brown", "grey", "gray", "navy", "gold", "silver", "cream", "ivory", "beige", "burgundy", "wine", "emerald", "indigo", "lavender", "lilac", "charcoal", "champagne", "terracotta", "teal", "olive"]);

function expandColour(term: string): string[] {
  const key = term.toLowerCase().replace(/colou?rs?/, "").trim();
  return COLOUR_FAMILIES[key] ?? [key];
}

const AVAILABLE: ReadonlySet<InventoryStatus> = new Set(["in_stock", "low_stock", "made_to_order"]);

export function variantCard(v: ProductVariant, productPrice: number | null): VariantCardData {
  return {
    id: v.id,
    name: v.name,
    options: v.options,
    price: v.price ?? productPrice,
    inventoryStatus: v.inventoryStatus,
    available: v.active && AVAILABLE.has(v.inventoryStatus),
  };
}

export function productCard(p: Product, variants: ProductVariant[], matchedVariantIds?: string[]): ProductCardData {
  const vs = variants.filter((v) => v.active).sort((a, b) => a.sortOrder - b.sortOrder).map((v) => variantCard(v, p.price));
  const purchasable = vs.filter((v) => v.available);
  const prices = (purchasable.length ? purchasable : vs).map((v) => v.price).filter((x): x is number => x != null);
  const hasVariants = vs.length > 0;
  const inventoryStatus: InventoryStatus = hasVariants
    ? purchasable.some((v) => v.inventoryStatus === "in_stock")
      ? "in_stock"
      : purchasable.some((v) => v.inventoryStatus === "made_to_order")
        ? "made_to_order"
        : purchasable.some((v) => v.inventoryStatus === "low_stock")
          ? "low_stock"
          : vs.every((v) => v.inventoryStatus === "unknown")
            ? "unknown"
            : "out_of_stock"
    : p.inventoryStatus;
  return {
    kind: "product",
    id: p.id,
    slug: p.slug,
    name: p.name,
    description: p.description,
    category: p.category,
    offeringKind: p.kind,
    price: prices.length ? Math.min(...prices) : p.price,
    priceMax: prices.length ? Math.max(...prices) : p.price,
    currency: p.currency,
    unit: p.unit,
    inventoryStatus,
    available: AVAILABLE.has(inventoryStatus),
    image: p.images[0] ?? null,
    attributes: p.attributes,
    tags: p.tags,
    variants: vs,
    ...(matchedVariantIds ? { matchedVariantIds } : {}),
  };
}

export interface ProductSearchInput {
  query?: string;
  category?: string;
  kinds?: OfferingKind[];
  /** minor units */
  maxPrice?: number;
  minPrice?: number;
  colour?: string;
  size?: string;
  inStockOnly?: boolean;
  limit?: number;
  /** Any of these categories (case-insensitive) — e.g. a market collection. */
  categories?: string[];
  /** Products carrying any of these tags (curated collections). */
  tags?: string[];
  /** Skip this many ranked results (paging). */
  offset?: number;
}

/** One shop (its id) or several (Walrus Market passes every live shop). */
export async function searchProducts(db: Db, merchantId: string | string[], input: ProductSearchInput = {}): Promise<ProductCardData[]> {
  const limit = Math.min(Math.max(input.limit ?? 6, 1), 48);
  const tokens = tokenize(input.query ?? "");
  const merchantIds = Array.isArray(merchantId) ? merchantId : [merchantId];
  if (merchantIds.length === 0) return [];
  const conditions: SQL[] = [inArray(products.merchantId, merchantIds), eq(products.active, true)];
  if (input.kinds?.length) {
    conditions.push(inArray(products.kind, input.kinds.filter((k): k is Product["kind"] => ["PRODUCT", "CUSTOM_ORDER", "PACKAGE"].includes(k))));
  }
  if (input.category) conditions.push(sql`lower(${products.category}) = ${input.category.toLowerCase()}`);
  if (input.categories?.length) {
    conditions.push(or(...input.categories.map((c) => sql`lower(${products.category}) = ${c.toLowerCase()}`))!);
  }
  // Bound parameters only: one jsonb_exists() per tag.
  if (input.tags?.length) conditions.push(or(...input.tags.map((t) => sql`jsonb_exists(${products.tags}, ${t})`))!);

  const haystack = sql`lower(${products.name} || ' ' || coalesce(${products.description}, '') || ' ' || coalesce(${products.category}, '') || ' ' || ${products.tags}::text || ' ' || ${products.attributes}::text)`;
  if (tokens.length) {
    const tokenMatches = tokens.map(
      (t) =>
        sql`(${haystack} like ${`%${t}%`} or exists (select 1 from ${productVariants} pv where pv.product_id = ${products.id} and pv.active and lower(pv.name || ' ' || pv.options::text) like ${`%${t}%`}))`,
    );
    conditions.push(or(...tokenMatches)!);
  }

  const rows = await db.select().from(products).where(and(...conditions)).orderBy(asc(products.name)).limit(500);
  if (rows.length === 0) return [];
  const variants = await db
    .select()
    .from(productVariants)
    .where(and(inArray(productVariants.merchantId, merchantIds), inArray(productVariants.productId, rows.map((r) => r.id))));
  const byProduct = new Map<string, ProductVariant[]>();
  for (const v of variants) byProduct.set(v.productId, [...(byProduct.get(v.productId) ?? []), v]);

  const colourTerms = input.colour ? expandColour(input.colour) : [];
  const size = input.size?.toLowerCase().trim();
  // With both colour and other words, a product must match one of the other words — as a word
  // ending (plural allowed): "dress" matches "dresses", not a salad's "dressing".
  const subjectTokens = tokens.some((t) => COLOUR_WORDS.has(t))
    ? tokens.filter((t) => !COLOUR_WORDS.has(t)).map((t) => new RegExp(`${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:e?s)?(?![\\p{L}])`, "u"))
    : [];

  const scored: { card: ProductCardData; score: number }[] = [];
  for (const p of rows) {
    const vs = byProduct.get(p.id) ?? [];
    if (subjectTokens.length) {
      const hay = `${p.name} ${p.description ?? ""} ${p.category ?? ""} ${p.tags.join(" ")} ${JSON.stringify(p.attributes)}`.toLowerCase();
      if (!subjectTokens.some((re) => re.test(hay))) continue;
    }
    let matched: ProductVariant[] | undefined;
    if (colourTerms.length || size) {
      matched = vs.filter((v) => {
        const opts = Object.fromEntries(Object.entries(v.options).map(([k, val]) => [k.toLowerCase(), val.toLowerCase()]));
        const colourOk = !colourTerms.length || colourTerms.some((c) => (opts.colour ?? opts.color ?? v.name.toLowerCase()).includes(c));
        const sizeOk = !size || (opts.size ?? "") === size || (opts.size ?? "").startsWith(size);
        return colourOk && sizeOk;
      });
      if (matched.length === 0) continue;
    }
    const card = productCard(p, vs, matched?.map((v) => v.id));
    const effective = matched?.length
      ? Math.min(...matched.map((v) => v.price ?? p.price ?? Number.POSITIVE_INFINITY))
      : card.price;
    if (input.maxPrice != null && (effective == null || effective > input.maxPrice)) continue;
    if (input.minPrice != null && (effective == null || effective < input.minPrice)) continue;
    if (input.inStockOnly && !(matched ? matched.some((v) => AVAILABLE.has(v.inventoryStatus) && v.active) : card.available)) continue;

    let score = 0;
    const name = p.name.toLowerCase();
    // A word that names the category says what the product *is* ("laptop" → Laptops), which
    // outranks accessories that merely mention it ("Laptop Stand"). Headphones ≠ "phone".
    const categoryWords = tokenize(p.category ?? "");
    for (const t of tokens) {
      if (name.includes(t)) score += 3;
      if ((p.category ?? "").toLowerCase().includes(t)) score += 2;
      if (categoryWords.includes(t)) score += 3;
      if (p.tags.some((tag) => tag.toLowerCase().includes(t))) score += 2;
      if (vs.some((v) => v.name.toLowerCase().includes(t))) score += 2;
      if ((p.description ?? "").toLowerCase().includes(t)) score += 1;
    }
    if (card.available) score += 0.5;
    scored.push({ card, score });
  }
  const offset = Math.max(0, input.offset ?? 0);
  return scored.sort((a, b) => b.score - a.score).slice(offset, offset + limit).map((s) => s.card);
}

export async function getProduct(db: Db, merchantId: string, idOrSlug: string): Promise<ProductCardData | null> {
  const isUuid = /^[0-9a-f-]{36}$/i.test(idOrSlug);
  const [p] = await db
    .select()
    .from(products)
    .where(and(eq(products.merchantId, merchantId), isUuid ? eq(products.id, idOrSlug) : eq(products.slug, idOrSlug)));
  if (!p || !p.active) return null;
  const vs = await db.select().from(productVariants).where(and(eq(productVariants.productId, p.id), eq(productVariants.merchantId, merchantId)));
  return productCard(p, vs);
}

export async function listCategories(db: Db, merchantId: string): Promise<string[]> {
  const rows = await db
    .selectDistinct({ category: products.category })
    .from(products)
    .where(and(eq(products.merchantId, merchantId), eq(products.active, true)));
  return rows.map((r) => r.category).filter((c): c is string => Boolean(c)).sort();
}

export async function serviceCard(db: Db, s: Service, timeZone: string, now = new Date()): Promise<ServiceCardData> {
  const next = s.availability ? await nextAvailableSlot(db, s, timeZone, now) : null;
  return {
    kind: "service",
    id: s.id,
    slug: s.slug,
    name: s.name,
    description: s.description,
    category: s.category,
    offeringKind: s.kind,
    priceMin: s.priceMin,
    priceMax: s.priceMax,
    currency: s.currency,
    durationMinutes: s.durationMinutes,
    depositAmount: s.depositAmount,
    locationType: s.locationType,
    bookingRequirements: s.bookingRequirements,
    options: s.options,
    nextAvailable: next?.startAt ?? null,
    image: s.images[0] ?? null,
  };
}

export async function searchServices(
  db: Db,
  merchantId: string,
  timeZone: string,
  input: { query?: string; maxPrice?: number; limit?: number } = {},
): Promise<ServiceCardData[]> {
  const limit = Math.min(Math.max(input.limit ?? 6, 1), 24);
  const tokens = tokenize(input.query ?? "");
  const conditions: SQL[] = [eq(services.merchantId, merchantId), eq(services.active, true)];
  if (tokens.length) {
    const hay = sql`lower(${services.name} || ' ' || coalesce(${services.description}, '') || ' ' || coalesce(${services.category}, '') || ' ' || ${services.tags}::text || ' ' || ${services.options}::text)`;
    conditions.push(or(...tokens.map((t) => sql`${hay} like ${`%${t}%`}`))!);
  }
  const rows = await db.select().from(services).where(and(...conditions)).orderBy(asc(services.name)).limit(100);
  const filtered = rows.filter((s) => input.maxPrice == null || (s.priceMin != null && s.priceMin <= input.maxPrice));
  const scored = filtered
    .map((s) => ({
      s,
      score: tokens.reduce((acc, t) => acc + (s.name.toLowerCase().includes(t) ? 3 : 0) + ((s.category ?? "").toLowerCase().includes(t) ? 2 : 0), 0),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  return Promise.all(scored.map(({ s }) => serviceCard(db, s, timeZone)));
}

export async function getService(db: Db, merchantId: string, idOrSlug: string, timeZone: string): Promise<ServiceCardData | null> {
  const isUuid = /^[0-9a-f-]{36}$/i.test(idOrSlug);
  const [s] = await db
    .select()
    .from(services)
    .where(and(eq(services.merchantId, merchantId), isUuid ? eq(services.id, idOrSlug) : eq(services.slug, idOrSlug)));
  if (!s || !s.active) return null;
  return serviceCard(db, s, timeZone);
}
