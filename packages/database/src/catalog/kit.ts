/**
 * Building blocks for the demo catalogs (see ../demo-templates.ts). Every
 * business, address and product in the catalogs is fictional.
 */
import type { DeliveryArea, ServiceAvailability, WeeklyHours } from "@nia/shared";
import type { MerchantFulfillment } from "../schema";

export type StockStatus = "in_stock" | "low_stock" | "out_of_stock" | "made_to_order" | "unknown";

export interface VariantSeed {
  name: string;
  options: Record<string, string>;
  price?: number | null;
  inventoryStatus?: StockStatus;
  stockQuantity?: number | null;
}

export interface ProductSeed {
  kind?: "PRODUCT" | "CUSTOM_ORDER" | "PACKAGE";
  name: string;
  slug: string;
  description: string;
  category: string;
  sku?: string;
  price: number | null;
  unit?: string;
  attributes?: Record<string, string | string[]>;
  inventoryStatus?: StockStatus;
  stockQuantity?: number | null;
  tags?: string[];
  variants?: VariantSeed[];
  /** Search phrase for `pnpm market:images` (never used at runtime). */
  photoQuery?: string | string[];
}

export interface ServiceSeed {
  kind?: "SERVICE" | "APPOINTMENT";
  name: string;
  slug: string;
  description: string;
  category: string;
  priceMin: number | null;
  priceMax?: number | null;
  durationMinutes: number | null;
  locationType?: "in_store" | "at_customer" | "online";
  depositAmount?: number | null;
  bookingRequirements?: string;
  options?: { name: string; priceDelta?: number | null; durationDelta?: number | null }[];
  availability: ServiceAvailability;
  tags?: string[];
  photoQuery?: string | string[];
}

export interface KnowledgeSeed {
  category: "shipping" | "returns" | "hours" | "service_policy" | "stock_note" | "product_guidance" | "faq" | "special_instructions";
  title: string;
  body: string;
}

export interface DemoTemplateBase {
  label: string;
  businessType: string;
  name: string;
  slug: string;
  tagline: string;
  description: string;
  accentColor: string;
  welcomeMessage: string;
  city: string;
  country: string;
  fulfillment: MerchantFulfillment;
  deliveryAreas: DeliveryArea[];
  openingHours: WeeklyHours;
  paymentInstructions: string;
  products: ProductSeed[];
  services: ServiceSeed[];
  knowledge: KnowledgeSeed[];
}

/** ₦ → kobo */
export const ngn = (naira: number) => naira * 100;

export const weekdayHours = (open: string, close: string, days: (keyof WeeklyHours)[]): WeeklyHours =>
  Object.fromEntries(days.map((d) => [d, [[open, close]]])) as WeeklyHours;

export const EVERY_DAY: (keyof WeeklyHours)[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
export const MON_SAT: (keyof WeeklyHours)[] = ["mon", "tue", "wed", "thu", "fri", "sat"];

/** Lagos delivery zones shared by the market's demo shops (fees in naira). */
export function lagosAreas(fees: { core: number; mainland: number; far: number }): DeliveryArea[] {
  return [
    { name: "Lekki", fee: ngn(fees.core), etaDays: 0, sameDay: true },
    { name: "Victoria Island", fee: ngn(fees.core), etaDays: 0, sameDay: true },
    { name: "Ikoyi", fee: ngn(fees.core), etaDays: 0, sameDay: true },
    { name: "Yaba", fee: ngn(fees.mainland), etaDays: 1, sameDay: false },
    { name: "Surulere", fee: ngn(fees.mainland), etaDays: 1, sameDay: false },
    { name: "Ikeja", fee: ngn(fees.mainland), etaDays: 1, sameDay: false },
    { name: "Ajah", fee: ngn(fees.far), etaDays: 1, sameDay: false },
  ];
}

/** An option value, optionally with its own price in naira: "128 GB" or ["256 GB", 199_000]. */
export type Opt = string | readonly [string, number];

/**
 * Variants as the cartesian product of option axes, e.g.
 * variantsOf({ storage: [["128 GB", 169_000], ["256 GB", 199_000]], colour: ["Black", "Blue"] }).
 * A priced option sets that variant's price (the last priced axis wins).
 * `low` / `out` name variants (by their "A / B" name) that are low or out of stock.
 */
export function variantsOf(axes: Record<string, readonly Opt[]>, stock: { low?: string[]; out?: string[]; qty?: number } = {}): VariantSeed[] {
  let combos: { name: string[]; options: Record<string, string>; price: number | null }[] = [{ name: [], options: {}, price: null }];
  for (const [axis, values] of Object.entries(axes)) {
    combos = combos.flatMap((c) =>
      values.map((v) => {
        const [label, price] = typeof v === "string" ? [v, null] : [v[0], v[1]];
        return { name: [...c.name, label], options: { ...c.options, [axis]: label }, price: price ?? c.price };
      }),
    );
  }
  return combos.map((c) => {
    const name = c.name.join(" / ");
    const status: StockStatus = stock.out?.includes(name) ? "out_of_stock" : stock.low?.includes(name) ? "low_stock" : "in_stock";
    return {
      name,
      options: c.options,
      price: c.price == null ? null : ngn(c.price),
      inventoryStatus: status,
      stockQuantity: status === "out_of_stock" ? 0 : status === "low_stock" ? 2 : (stock.qty ?? 10),
    };
  });
}

export const WOMEN_SIZES = ["XS", "S", "M", "L", "XL"] as const;
export const MEN_SIZES = ["S", "M", "L", "XL", "XXL"] as const;
export const UNISEX_SIZES = ["XS", "S", "M", "L", "XL", "XXL"] as const;
export const SHOE_SIZES = ["38", "39", "40", "41", "42", "43", "44", "45"] as const;

type ProductMore = Omit<Partial<ProductSeed>, "slug" | "name" | "category" | "price" | "unit" | "description"> & { q?: string | string[] };

/** A product in one line: slug, name, category, price in naira (null = price on request), unit, description. */
export function item(slug: string, name: string, category: string, priceNaira: number | null, unit: string, description: string, more: ProductMore = {}): ProductSeed {
  const { q, ...rest } = more;
  return {
    inventoryStatus: "in_stock",
    stockQuantity: 12,
    ...rest,
    slug,
    name,
    category,
    price: priceNaira == null ? null : ngn(priceNaira),
    unit,
    description,
    photoQuery: q,
  };
}

/** Stable SKUs from a shop prefix and the category, e.g. WG-PHO-001. */
export function withSkus(prefix: string, products: ProductSeed[]): ProductSeed[] {
  const counters = new Map<string, number>();
  return products.map((p) => {
    if (p.sku) return p;
    const code = p.category.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || "GEN";
    const n = (counters.get(code) ?? 0) + 1;
    counters.set(code, n);
    return { ...p, sku: `${prefix}-${code}-${String(n).padStart(3, "0")}` };
  });
}
