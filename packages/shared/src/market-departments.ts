/**
 * Walrus Market departments. A department groups shops by business type —
 * products always belong to a shop, and each shop keeps its own cart,
 * delivery and payment. Collections are named slices of a department's
 * categories; rails are curated slices of the whole market.
 */

export interface MarketDepartment {
  key: string;
  name: string;
  short: string;
  blurb: string;
  /** Shops whose business type is one of these belong to the department. */
  businessTypes: string[];
}

export const MARKET_DEPARTMENTS: readonly MarketDepartment[] = [
  { key: "gadgets", name: "Walrus Gadgets", short: "Gadgets", blurb: "Phones, laptops, audio and the accessories that keep them going.", businessTypes: ["electronics"] },
  { key: "fashion", name: "Walrus Clothes & Designers", short: "Fashion", blurb: "Ready-to-wear, designer pieces, African fabrics, shoes and bags.", businessTypes: ["fashion", "fabric"] },
  { key: "food", name: "Food", short: "Food", blurb: "Rice bowls, grills, soups, breakfast and small chops, cooked to order.", businessTypes: ["restaurant"] },
  { key: "drinks", name: "Drinks & Beverages", short: "Drinks", blurb: "Juices, water, malt, soft drinks, coffee, tea and multipacks.", businessTypes: ["drinks"] },
  { key: "bakery", name: "Cakes & Bakery", short: "Bakery", blurb: "Celebration cakes, fresh bread, pastries, pies and treats.", businessTypes: ["bakery"] },
  { key: "beauty", name: "Beauty", short: "Beauty", blurb: "Make-up, skincare, hair care, fragrance and salon services.", businessTypes: ["beauty", "salon"] },
  { key: "home", name: "Home & Lifestyle", short: "Home", blurb: "Bedding, kitchen, lighting, décor and the home office.", businessTypes: ["homeware"] },
];

export interface MarketCollection {
  key: string;
  name: string;
  department: string;
  blurb: string;
  categories: string[];
}

/** Featured collections inside a department (a slice of its categories). */
export const MARKET_COLLECTIONS: readonly MarketCollection[] = [
  {
    key: "phones-laptops",
    name: "Phones & Laptops",
    department: "gadgets",
    blurb: "Smartphones for every budget, laptops for work, study and play, and tablets.",
    categories: ["Phones", "Laptops", "Tablets"],
  },
];

/**
 * Popular Mart rails. These are editorial — chosen by the market team with
 * product tags — or plain facts (price, newest). None claims sales numbers.
 */
export interface MarketRail {
  key: string;
  title: string;
  note: string;
  /** Products carrying this tag (editorial picks). */
  tag?: string;
  /** Limit to one department. */
  department?: string;
  /** Effective price at or below this, in major units. */
  maxPriceMajor?: number;
  /** Most recently added first. */
  newest?: boolean;
}

export const POPULAR_MART_RAILS: readonly MarketRail[] = [
  { key: "picks", title: "Popular picks", note: "Chosen by the Walrus Market team", tag: "pick" },
  { key: "new", title: "New arrivals", note: "Most recently added to the market", newest: true },
  { key: "under-10k", title: "Under ₦10,000", note: "Everyday finds at ₦10,000 or less", maxPriceMajor: 10_000 },
  { key: "weekend", title: "Weekend essentials", note: "Curated for a relaxed weekend in", tag: "weekend" },
];

export function marketDepartment(key: string | null | undefined): MarketDepartment | null {
  return MARKET_DEPARTMENTS.find((d) => d.key === key) ?? null;
}

export function marketCollection(key: string | null | undefined): MarketCollection | null {
  return MARKET_COLLECTIONS.find((c) => c.key === key) ?? null;
}

/** Which department a shop's business type belongs to (null when none fits, e.g. repair). */
export function departmentForBusinessType(businessType: string): MarketDepartment | null {
  return MARKET_DEPARTMENTS.find((d) => d.businessTypes.includes(businessType)) ?? null;
}
