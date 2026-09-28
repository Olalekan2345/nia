import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { memoryRecords, type Customer } from "@nia/database";
import { searchMarket, type MarketProduct } from "@nia/commerce";
import { toMinorUnits } from "@nia/shared";
import { loadStorefront, type Storefront } from "./storefront";
import { db } from "./server";

export const MARKET_SLUG = "market";

/** The Walrus Market record + the signed-in shopper's market-level customer (if any). */
export async function loadMarket(): Promise<Storefront | null> {
  const sf = await loadStorefront(MARKET_SLUG);
  return sf && sf.merchant.kind === "market" ? sf : null;
}

export function greeting(timeZone: string, now = new Date()): string {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone }).format(now));
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

export interface MarketMemory {
  id: string;
  type: string;
  subjectKey: string;
  label: string;
}

/** Active, Walrus-confirmed market memories of this shopper (metadata only — the text lives on Walrus). */
export async function marketMemories(merchantId: string, customer: Customer | null): Promise<MarketMemory[]> {
  if (!customer) return [];
  return db()
    .select({ id: memoryRecords.id, type: memoryRecords.type, subjectKey: memoryRecords.subjectKey, label: memoryRecords.label })
    .from(memoryRecords)
    .where(
      and(
        eq(memoryRecords.merchantId, merchantId),
        eq(memoryRecords.customerId, customer.id),
        eq(memoryRecords.scope, "customer"),
        eq(memoryRecords.persistStatus, "stored"),
        eq(memoryRecords.lifecycle, "active"),
      ),
    )
    .orderBy(desc(memoryRecords.createdAt))
    .limit(40);
}

/** "Budget: ₦20,000" → "₦20,000" (labels are short "Subject: value" strings). */
const valueOf = (label: string) => (label.includes(":") ? label.slice(label.indexOf(":") + 1) : label).trim();

/**
 * Picks for the shopper from what they told Nia in the market: preferred colour,
 * size, budget and interests narrow a market search; each step relaxes the
 * filters until something real matches.
 */
export async function forYou(memories: MarketMemory[], currency: string): Promise<{ products: MarketProduct[]; reasons: string[] } | null> {
  if (memories.length === 0) return null;
  const find = (...keys: string[]) => memories.find((m) => keys.includes(m.subjectKey));
  const colour = find("colour_preference");
  const size = find("clothing_size", "shoe_size");
  const budget = find("budget_range") ?? memories.find((m) => m.type === "BUDGET");
  const interests = memories.filter((m) => m.type === "PRODUCT_INTEREST" || m.type === "OCCASION" || ["material_preference", "style_preference", "preferred_variant"].includes(m.subjectKey));
  const budgetMajor = budget ? Number(valueOf(budget.label).replace(/[^\d.]/g, "")) : NaN;
  const maxPrice = Number.isFinite(budgetMajor) && budgetMajor > 0 ? toMinorUnits(budgetMajor, currency) : undefined;
  const query = interests.map((m) => valueOf(m.label)).join(" ");

  const attempts = [
    { query, colour: colour && valueOf(colour.label), size: size && valueOf(size.label), maxPrice, used: [interests[0], colour, size, budget] },
    { query, maxPrice, used: [interests[0], budget] },
    { colour: colour && valueOf(colour.label), maxPrice, used: [colour, budget] },
    { query, used: [interests[0]] },
    { maxPrice, used: [budget] },
  ];
  for (const a of attempts) {
    if (!a.query && !a.colour && !a.maxPrice) continue;
    const products = await searchMarket(db(), { query: a.query || undefined, colour: a.colour || undefined, size: a.size || undefined, maxPrice: a.maxPrice, inStockOnly: true, limit: 8 });
    if (products.length) {
      const reasons = a.used.filter((m): m is MarketMemory => Boolean(m)).map((m) => m.label);
      return { products, reasons: [...new Set(reasons)].slice(0, 4) };
    }
  }
  return { products: [], reasons: [] };
}
