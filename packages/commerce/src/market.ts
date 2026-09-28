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
import { BUSINESS_TYPES } from "@nia/shared";
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
export async function marketShops(db: Db, filter: { slugs?: string[]; businessType?: string } = {}): Promise<MarketShop[]> {
  const rows = await db
    .select()
    .from(merchants)
    .where(
      and(
        eq(merchants.kind, "shop"),
        eq(merchants.status, "live"),
        filter.slugs?.length ? inArray(merchants.slug, filter.slugs) : undefined,
        filter.businessType ? eq(merchants.businessType, filter.businessType) : undefined,
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

/** Search products across live shops (same filters and ranking as a shop's own search). */
export async function searchMarket(db: Db, input: MarketSearchInput = {}): Promise<MarketProduct[]> {
  const shops = await marketShops(db, { slugs: input.shops, businessType: input.businessType });
  const cards = await searchProducts(
    db,
    shops.map((s) => s.id),
    { ...input, limit: input.limit ?? 24 },
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

/** Product categories across live shops, most stocked first. */
export async function marketCategories(db: Db): Promise<{ category: string; count: number }[]> {
  const shops = await marketShops(db);
  if (shops.length === 0) return [];
  const rows = await db
    .select({ category: products.category })
    .from(products)
    .where(and(eq(products.active, true), inArray(products.merchantId, shops.map((s) => s.id))));
  const counts = new Map<string, number>();
  for (const r of rows) if (r.category) counts.set(r.category, (counts.get(r.category) ?? 0) + 1);
  return [...counts.entries()].map(([category, count]) => ({ category, count })).sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));
}
