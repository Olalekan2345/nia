/**
 * Price history from real recorded changes. A row is written when a product
 * is saved with a price different from the last one recorded for it (or its
 * variant). Nia may only say "it was ₦X before" when these rows show it.
 */
import { and, asc, desc, eq, isNull } from "drizzle-orm";
import { productPriceHistory, products, productVariants, type Db } from "@nia/database";

/** Snapshot a product's current prices; writes only the ones that changed. Returns rows written. */
export async function recordProductPrices(db: Db, { merchantId, productId }: { merchantId: string; productId: string }): Promise<number> {
  const [p] = await db.select({ id: products.id, price: products.price }).from(products).where(and(eq(products.id, productId), eq(products.merchantId, merchantId)));
  if (!p) return 0;
  const variants = await db
    .select({ id: productVariants.id, price: productVariants.price })
    .from(productVariants)
    .where(and(eq(productVariants.productId, p.id), eq(productVariants.merchantId, merchantId), eq(productVariants.active, true)));
  const targets: { variantId: string | null; price: number | null }[] = [{ variantId: null, price: p.price }, ...variants.map((v) => ({ variantId: v.id, price: v.price ?? p.price }))];
  let written = 0;
  for (const t of targets) {
    const [last] = await db
      .select({ price: productPriceHistory.price })
      .from(productPriceHistory)
      .where(and(eq(productPriceHistory.productId, p.id), t.variantId ? eq(productPriceHistory.variantId, t.variantId) : isNull(productPriceHistory.variantId)))
      .orderBy(desc(productPriceHistory.recordedAt))
      .limit(1);
    if (last && last.price === t.price) continue;
    await db.insert(productPriceHistory).values({ merchantId, productId: p.id, variantId: t.variantId, price: t.price });
    written++;
  }
  return written;
}

export interface PriceHistory {
  /** When tracking started for this product (first recorded price), or null if never recorded. */
  trackedSince: string | null;
  /** Recorded changes, oldest first. Prices in minor units. */
  changes: { variantId: string | null; from: number | null; to: number | null; at: string }[];
}

export async function productPriceHistoryFor(db: Db, { merchantId, productId }: { merchantId: string; productId: string }): Promise<PriceHistory> {
  const rows = await db
    .select()
    .from(productPriceHistory)
    .where(and(eq(productPriceHistory.productId, productId), eq(productPriceHistory.merchantId, merchantId)))
    .orderBy(asc(productPriceHistory.recordedAt));
  const lastBy = new Map<string, number | null>();
  const changes: PriceHistory["changes"] = [];
  for (const r of rows) {
    const k = r.variantId ?? "product";
    if (lastBy.has(k) && lastBy.get(k) !== r.price) changes.push({ variantId: r.variantId, from: lastBy.get(k)!, to: r.price, at: r.recordedAt.toISOString() });
    lastBy.set(k, r.price);
  }
  return { trackedSince: rows[0]?.recordedAt.toISOString() ?? null, changes };
}
