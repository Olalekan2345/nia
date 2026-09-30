/**
 * Substitutions for an unavailable item — deterministic, from catalog data only.
 *
 *   1. the same product in another available option ("Same item in Navy")
 *   2. another product in the same category, in a similar price band, ranked by
 *      the tags/attributes it actually shares ("Similar dress (black, crepe), ₦2,000 less")
 *
 * A reason only ever cites shared catalog data; with nothing shared it says
 * "Another <category>" rather than claiming similarity.
 */
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { products, productVariants, type Db, type Product, type ProductVariant } from "@nia/database";
import { formatMoney, type InventoryStatus } from "@nia/shared";

const AVAILABLE: ReadonlySet<InventoryStatus> = new Set(["in_stock", "low_stock", "made_to_order"]);
/** Tags that say nothing about what an item is like. */
const GENERIC_TAGS = new Set(["pick", "weekend", "essential", "new", "gift", "gadget", "food", "drink", "party", "meal", "snacks", "home", "fashion"]);
const PRICE_BAND = { low: 0.6, high: 1.4 };

export interface Alternative {
  productId: string;
  variantId: string | null;
  merchantId: string;
  slug: string;
  name: string;
  variantName: string | null;
  /** Minor units. */
  price: number | null;
  currency: string;
  image: string | null;
  sameProduct: boolean;
  reason: string;
}

const isAvailable = (v: Pick<ProductVariant, "active" | "inventoryStatus">) => v.active && AVAILABLE.has(v.inventoryStatus);

function priceDelta(original: number | null, alt: number | null, currency: string, locale: string): string {
  if (original == null || alt == null) return "";
  const d = alt - original;
  if (d === 0) return "same price";
  return `${formatMoney(Math.abs(d), currency, { locale })} ${d < 0 ? "less" : "more"}`;
}

function sharedTraits(a: Product, b: Product): string[] {
  const tags = new Set(a.tags.map((t) => t.toLowerCase()).filter((t) => !GENERIC_TAGS.has(t)));
  const shared = b.tags.map((t) => t.toLowerCase()).filter((t) => tags.has(t));
  const attrValues = (p: Product) => new Set(Object.values(p.attributes).flat().map((v) => String(v).toLowerCase()));
  const av = attrValues(a);
  for (const v of attrValues(b)) if (av.has(v)) shared.push(v);
  return [...new Set(shared)].filter((t) => t.length <= 24);
}

export async function findAlternatives(
  db: Db,
  { merchantIds, productId, variantId, limit = 3, locale = "en-NG" }: { merchantIds: string[]; productId: string; variantId?: string | null; limit?: number; locale?: string },
): Promise<Alternative[]> {
  if (merchantIds.length === 0) return [];
  const [product] = await db.select().from(products).where(and(eq(products.id, productId), inArray(products.merchantId, merchantIds)));
  if (!product) return [];
  const variants = await db.select().from(productVariants).where(and(eq(productVariants.productId, product.id), eq(productVariants.merchantId, product.merchantId)));
  const original = variantId ? (variants.find((v) => v.id === variantId) ?? null) : null;
  const originalPrice = original?.price ?? product.price;
  const out: Alternative[] = [];
  const base = { merchantId: product.merchantId, slug: product.slug, name: product.name, currency: product.currency, image: product.images[0] ?? null };

  // 1. Same product, another option: keep the fit/spec options (size, storage, volume) first, then the colour.
  if (original) {
    const opts = (v: ProductVariant) => Object.fromEntries(Object.entries(v.options).map(([k, x]) => [k.toLowerCase(), x]));
    const o = opts(original);
    const others = variants.filter((v) => v.id !== original.id && isAvailable(v));
    const rank = (v: ProductVariant) => {
      const x = opts(v);
      return Object.entries(o).reduce((s, [k, val]) => s + (x[k] === val ? (/colou?r/.test(k) ? 1 : 2) : 0), 0);
    };
    for (const v of others.sort((a, b) => rank(b) - rank(a) || a.sortOrder - b.sortOrder).slice(0, 2)) {
      const x = opts(v);
      const differs = Object.entries(x).filter(([k, val]) => o[k] !== val).map(([, val]) => val);
      const delta = priceDelta(originalPrice, v.price ?? product.price, product.currency, locale);
      out.push({ ...base, productId: product.id, variantId: v.id, variantName: v.name, price: v.price ?? product.price, sameProduct: true, reason: `Same item in ${differs.join(" / ") || v.name}${delta && delta !== "same price" ? `, ${delta}` : ""}` });
    }
  }

  // 2. Similar products in the same category and price band.
  if (out.length < limit && product.category) {
    const candidates = await db
      .select()
      .from(products)
      .where(and(inArray(products.merchantId, merchantIds), eq(products.active, true), ne(products.id, product.id), sql`lower(${products.category}) = ${product.category.toLowerCase()}`))
      .limit(60);
    const candVariants = candidates.length
      ? await db.select().from(productVariants).where(inArray(productVariants.productId, candidates.map((c) => c.id)))
      : [];
    const scored = candidates
      .map((c) => {
        const vs = candVariants.filter((v) => v.productId === c.id);
        const purchasable = vs.filter(isAvailable);
        if (vs.length ? purchasable.length === 0 : !AVAILABLE.has(c.inventoryStatus)) return null;
        // Keep the original's colour/size when the alternative offers it.
        const wanted = original ? Object.values(original.options).map((x) => x.toLowerCase()) : [];
        const pick = purchasable.find((v) => wanted.some((w) => Object.values(v.options).some((x) => x.toLowerCase() === w))) ?? purchasable[0] ?? null;
        const price = pick?.price ?? c.price;
        if (originalPrice != null && price != null && (price < originalPrice * PRICE_BAND.low || price > originalPrice * PRICE_BAND.high)) return null;
        const shared = sharedTraits(product, c);
        const closeness = originalPrice != null && price != null ? 1 - Math.abs(price - originalPrice) / originalPrice : 0;
        return { c, pick, price, shared, score: shared.length * 2 + closeness };
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x))
      .sort((a, b) => b.score - a.score);
    for (const s of scored.slice(0, limit - out.length)) {
      const cat = product.category.toLowerCase().replace(/s$/, "");
      const delta = priceDelta(originalPrice, s.price, product.currency, locale);
      out.push({
        productId: s.c.id,
        variantId: s.pick?.id ?? null,
        merchantId: s.c.merchantId,
        slug: s.c.slug,
        name: s.c.name,
        variantName: s.pick?.name ?? null,
        price: s.price,
        currency: s.c.currency,
        image: s.c.images[0] ?? null,
        sameProduct: false,
        reason: `${s.shared.length ? `Similar ${cat} (${s.shared.slice(0, 2).join(", ")})` : `Another ${cat}`}${delta ? `, ${delta}` : ""}`,
      });
    }
  }
  return out.slice(0, limit);
}
