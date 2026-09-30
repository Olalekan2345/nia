/**
 * Walrus Market — discovery across every live shop.
 *
 * Read-only by design: buying happens in each shop (its own cart, delivery and
 * payment), and each shop keeps its own memory of the customer. The market's
 * guide (Nia) has a separate, market-level memory per shopper, stored under the
 * single `kind = "market"` merchant record.
 */
import { and, asc, eq, inArray } from "drizzle-orm";
import { merchants, products, productVariants, type Db, type Merchant } from "@nia/database";
import { BUSINESS_TYPES, MARKET_DEPARTMENTS, departmentForBusinessType, marketCollection, marketDepartment, toMinorUnits, type MarketRail } from "@nia/shared";
import { productCard, searchProducts, searchServices, type ProductSearchInput } from "./catalog";
import type { ProductCardData, ServiceCardData } from "./types";

export interface MarketShop {
  id: string;
  slug: string;
  name: string;
  businessType: string;
  businessLabel: string;
  city: string | null;
  accentColor: string;
  logoUrl: string | null;
  isDemo: boolean;
  delivery: boolean;
  pickup: boolean;
  deliveryAreas: { name: string; fee: number | null; sameDay: boolean }[];
  currency: string;
  locale: string;
  timezone: string;
}

export type MarketProduct = ProductCardData & { shop: MarketShop; url: string };
export type MarketService = ServiceCardData & { shop: MarketShop; url: string };

export interface MarketSearchInput extends ProductSearchInput {
  /** Limit to these shop slugs. */
  shops?: string[];
  /** Limit to shops of this business type (e.g. "bakery"). */
  businessType?: string;
  /** Limit to a market department (e.g. "gadgets"): its shops' business types. */
  department?: string;
  /** A featured collection (e.g. "phones-laptops"): its department and categories. */
  collection?: string;
}

export function shopView(m: Merchant): MarketShop {
  return {
    id: m.id,
    slug: m.slug,
    name: m.name,
    businessType: m.businessType,
    businessLabel: BUSINESS_TYPES.find((b) => b.value === m.businessType)?.label ?? "Shop",
    city: m.city,
    accentColor: m.accentColor,
    logoUrl: m.logoUrl,
    isDemo: m.isDemo,
    delivery: m.fulfillment.delivery,
    pickup: m.fulfillment.pickup,
    deliveryAreas: m.deliveryAreas.map((a) => ({ name: a.name, fee: a.fee, sameDay: Boolean(a.sameDay) })),
    currency: m.currency,
    locale: m.locale,
    timezone: m.timezone,
  };
}

/** The Walrus Market record (holds the market guide's per-shopper memory), if seeded. */
export async function marketMerchant(db: Db): Promise<Merchant | null> {
  const [m] = await db.select().from(merchants).where(eq(merchants.kind, "market")).limit(1);
  return m ?? null;
}

/** Live storefronts that appear in the market. */
export async function marketShops(db: Db, filter: { slugs?: string[]; businessType?: string; businessTypes?: string[] } = {}): Promise<MarketShop[]> {
  const rows = await db
    .select()
    .from(merchants)
    .where(
      and(
        eq(merchants.kind, "shop"),
        eq(merchants.status, "live"),
        filter.slugs?.length ? inArray(merchants.slug, filter.slugs) : undefined,
        filter.businessType ? eq(merchants.businessType, filter.businessType) : undefined,
        filter.businessTypes ? inArray(merchants.businessType, filter.businessTypes.length ? filter.businessTypes : ["__none__"]) : undefined,
      ),
    )
    .orderBy(asc(merchants.createdAt));
  return rows.map(shopView);
}

/** Live shops with the product categories each one actually stocks (for the guide's prompt). */
export async function marketShopsWithCategories(db: Db): Promise<(MarketShop & { categories: string[] })[]> {
  const shops = await marketShops(db);
  if (shops.length === 0) return [];
  const rows = await db
    .selectDistinct({ merchantId: products.merchantId, category: products.category })
    .from(products)
    .where(and(eq(products.active, true), inArray(products.merchantId, shops.map((s) => s.id))))
    .orderBy(asc(products.category));
  return shops.map((s) => ({ ...s, categories: rows.filter((r) => r.merchantId === s.id && r.category).map((r) => r.category!) }));
}

async function attachShops(db: Db, cards: ProductCardData[], shops: MarketShop[]): Promise<MarketProduct[]> {
  if (cards.length === 0) return [];
  const owners = await db
    .select({ id: products.id, merchantId: products.merchantId })
    .from(products)
    .where(inArray(products.id, cards.map((c) => c.id)));
  const ownerOf = new Map(owners.map((o) => [o.id, o.merchantId]));
  const shopById = new Map(shops.map((s) => [s.id, s]));
  return cards.flatMap((c) => {
    const shop = shopById.get(ownerOf.get(c.id) ?? "");
    return shop ? [{ ...c, shop, url: `/s/${shop.slug}/shop/${c.slug}` }] : [];
  });
}

/** A department and/or collection as shop business types + categories (unknown keys match nothing). */
function scopeOf(input: MarketSearchInput): { businessTypes?: string[]; categories?: string[] } {
  const collection = input.collection ? marketCollection(input.collection) : null;
  const deptKey = collection?.department ?? input.department;
  const dept = deptKey ? marketDepartment(deptKey) : null;
  return {
    businessTypes: deptKey ? (dept?.businessTypes ?? []) : undefined,
    categories: input.collection ? (collection?.categories ?? ["__none__"]) : input.categories,
  };
}

/** Search products across live shops (same filters and ranking as a shop's own search). */
export async function searchMarket(db: Db, input: MarketSearchInput = {}): Promise<MarketProduct[]> {
  const scope = scopeOf(input);
  const shops = await marketShops(db, { slugs: input.shops, businessType: input.businessType, businessTypes: scope.businessTypes });
  const cards = await searchProducts(
    db,
    shops.map((s) => s.id),
    { ...input, categories: scope.categories, limit: input.limit ?? 24 },
  );
  return attachShops(db, cards, shops);
}

/** Specific products (for compare), only from live shops, in the order asked. */
export async function marketProducts(db: Db, ids: string[]): Promise<MarketProduct[]> {
  const wanted = [...new Set(ids.filter((id) => /^[0-9a-f-]{36}$/i.test(id)))].slice(0, 4);
  if (wanted.length === 0) return [];
  const shops = await marketShops(db);
  const rows = await db
    .select()
    .from(products)
    .where(and(inArray(products.id, wanted), eq(products.active, true), inArray(products.merchantId, shops.map((s) => s.id))));
  if (rows.length === 0) return [];
  const variants = await db.select().from(productVariants).where(inArray(productVariants.productId, rows.map((r) => r.id)));
  const cards = rows.map((p) => productCard(p, variants.filter((v) => v.productId === p.id)));
  const attached = await attachShops(db, cards, shops);
  return wanted.map((id) => attached.find((p) => p.id === id)).filter((p): p is MarketProduct => Boolean(p));
}

/** Bookable services across live shops. */
export async function searchMarketServices(db: Db, input: { query?: string; maxPrice?: number; limit?: number; shops?: string[] } = {}): Promise<MarketService[]> {
  const shops = await marketShops(db, { slugs: input.shops });
  const perShop = await Promise.all(
    shops.map(async (shop) =>
      (await searchServices(db, shop.id, shop.timezone, { query: input.query, maxPrice: input.maxPrice, limit: input.limit ?? 12 })).map((s) => ({
        ...s,
        shop,
        url: `/s/${shop.slug}/chat?q=${encodeURIComponent(`I'd like to book ${s.name}`)}`,
      })),
    ),
  );
  return perShop.flat().slice(0, input.limit ?? 12);
}

/** Product categories across live shops (or one department's shops), most stocked first. */
export async function marketCategories(db: Db, filter: { department?: string } = {}): Promise<{ category: string; count: number }[]> {
  const dept = filter.department ? marketDepartment(filter.department) : null;
  const shops = await marketShops(db, filter.department ? { businessTypes: dept?.businessTypes ?? [] } : {});
  if (shops.length === 0) return [];
  const rows = await db
    .select({ category: products.category })
    .from(products)
    .where(and(eq(products.active, true), inArray(products.merchantId, shops.map((s) => s.id))));
  const counts = new Map<string, number>();
  for (const r of rows) if (r.category) counts.set(r.category, (counts.get(r.category) ?? 0) + 1);
  return [...counts.entries()].map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));
}

/* ─────────────────────────────── Merchandising ─────────────────────────────── */

export type MarketCatalogItem = MarketProduct & { department: string | null; addedAt: Date };

/**
 * Every live product in the market in one pass (for department rails and
 * Popular Mart), each with its shop and department. Real records only.
 */
export async function marketCatalog(db: Db): Promise<MarketCatalogItem[]> {
  const shops = await marketShops(db);
  if (shops.length === 0) return [];
  const shopById = new Map(shops.map((s) => [s.id, s]));
  const rows = await db
    .select()
    .from(products)
    .where(and(eq(products.active, true), inArray(products.merchantId, shops.map((s) => s.id))))
    .orderBy(asc(products.name));
  if (rows.length === 0) return [];
  const variants = await db.select().from(productVariants).where(inArray(productVariants.productId, rows.map((r) => r.id)));
  const byProduct = new Map<string, (typeof variants)[number][]>();
  for (const v of variants) byProduct.set(v.productId, [...(byProduct.get(v.productId) ?? []), v]);
  return rows.flatMap((p) => {
    const shop = shopById.get(p.merchantId);
    if (!shop) return [];
    const card = productCard(p, byProduct.get(p.id) ?? []);
    return [{ ...card, shop, url: `/s/${shop.slug}/shop/${card.slug}`, department: departmentForBusinessType(shop.businessType)?.key ?? null, addedAt: p.createdAt }];
  });
}

/** Photos first, then editorial picks, then in-stock — so rails lead with the strongest cards. */
function merchandised(items: MarketCatalogItem[]): MarketCatalogItem[] {
  const rank = (p: MarketCatalogItem) => (p.image ? 0 : 4) + (p.tags.includes("pick") ? 0 : 1) + (p.available ? 0 : 2);
  return [...items].sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
}

/** Take turns between shops (keeping each shop's order), so one big shop doesn't fill a whole rail. */
function mixShops(items: MarketCatalogItem[]): MarketCatalogItem[] {
  const queues = new Map<string, MarketCatalogItem[]>();
  for (const p of items) queues.set(p.shop.id, [...(queues.get(p.shop.id) ?? []), p]);
  const out: MarketCatalogItem[] = [];
  while (out.length < items.length) for (const q of queues.values()) if (q.length) out.push(q.shift()!);
  return out;
}

/** The products in one Popular Mart rail (editorial tag, department, price ceiling or newest). */
export function railProducts(catalog: MarketCatalogItem[], rail: MarketRail, { currency = "NGN", limit = 10, exclude }: { currency?: string; limit?: number; exclude?: ReadonlySet<string> } = {}): MarketCatalogItem[] {
  let items = catalog.filter((p) => p.available);
  if (rail.tag) items = items.filter((p) => p.tags.includes(rail.tag!));
  if (rail.department) items = items.filter((p) => p.department === rail.department);
  if (rail.maxPriceMajor != null) {
    const ceiling = toMinorUnits(rail.maxPriceMajor, currency);
    items = items.filter((p) => p.price != null && p.price <= ceiling);
  }
  // Skip products an earlier rail already shows, unless that would leave this rail nearly empty.
  if (exclude?.size) {
    const unseen = items.filter((p) => !exclude.has(p.id));
    if (unseen.length >= 3) items = unseen;
  }
  if (rail.newest) {
    // Newest day first; products added the same day are equally new, so they're shown photos first, shops mixed.
    const days = new Map<string, MarketCatalogItem[]>();
    for (const p of items) {
      const day = p.addedAt.toISOString().slice(0, 10);
      days.set(day, [...(days.get(day) ?? []), p]);
    }
    return [...days.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .flatMap(([, group]) => mixShops(merchandised(group)))
      .slice(0, limit);
  }
  return merchandised(items).slice(0, limit);
}

export interface DepartmentSummary {
  key: string;
  name: string;
  short: string;
  blurb: string;
  count: number;
  shops: number;
  /** Up to three product photos from the department, for its card. */
  images: string[];
  /** A short, merchandised selection for the department's rail. */
  products: MarketCatalogItem[];
}

/** Departments that have live products, in the configured order. */
export function departmentSummaries(catalog: MarketCatalogItem[], { railLimit = 10 } = {}): DepartmentSummary[] {
  return MARKET_DEPARTMENTS.flatMap((d) => {
    const items = catalog.filter((p) => p.department === d.key);
    if (items.length === 0) return [];
    const ordered = mixShops(merchandised(items));
    return [
      {
        key: d.key,
        name: d.name,
        short: d.short,
        blurb: d.blurb,
        count: items.length,
        shops: new Set(items.map((p) => p.shop.id)).size,
        images: ordered.filter((p) => p.image).slice(0, 3).map((p) => p.image!),
        products: ordered.slice(0, railLimit),
      },
    ];
  });
}
