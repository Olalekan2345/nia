/**
 * Clearly fictional demo catalogs. Used by `pnpm db:seed` for the public demo
 * stores and by onboarding ("Start from a template"). Every business, address
 * and product here is invented.
 */
import { and, eq, sql } from "drizzle-orm";
import type { DeliveryArea, ServiceAvailability, WeeklyHours } from "@nia/shared";
import type { Db } from "./client";
import { merchantKnowledge, merchants, products, productVariants, services, type MerchantFulfillment } from "./schema";

export type DemoTemplateKey = "fabric" | "beauty" | "bakery";

interface VariantSeed {
  name: string;
  options: Record<string, string>;
  price?: number | null;
  inventoryStatus?: "in_stock" | "low_stock" | "out_of_stock" | "made_to_order" | "unknown";
  stockQuantity?: number | null;
}

/**
 * Free stock photos (Burst — free for commercial use) for demo items, served from
 * apps/web/public/stock/<slug>.jpg; sources in apps/web/public/stock/credits.json.
 * Items not listed keep Nia's generated swatch until a merchant uploads a photo.
 */
const STOCK_PHOTOS = new Set([
  "classic-ankara-wax-print",
  "corded-french-lace",
  "aso-oke-celebration-set",
  "midnight-linen-kaftan",
  "everyday-linen-shirt",
  "silk-headwrap",
  "made-to-measure-outfit",
  "measurement-style-consultation",
  "alterations",
  "whipped-shea-body-butter",
  "hydrating-hair-serum",
  "silk-press",
  "knotless-braids",
  "gel-manicure",
  "brow-lamination",
  "country-sourdough-loaf",
  "cinnamon-rolls",
  "celebration-cake",
]);
const stockPhotos = (slug: string): string[] => (STOCK_PHOTOS.has(slug) ? [`/stock/${slug}.jpg`] : []);

interface ProductSeed {
  kind?: "PRODUCT" | "CUSTOM_ORDER" | "PACKAGE";
  name: string;
  slug: string;
  description: string;
  category: string;
  sku?: string;
  price: number | null;
  unit?: string;
  attributes?: Record<string, string | string[]>;
  inventoryStatus?: "in_stock" | "low_stock" | "out_of_stock" | "made_to_order" | "unknown";
  stockQuantity?: number | null;
  tags?: string[];
  variants?: VariantSeed[];
}

interface ServiceSeed {
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
}

interface KnowledgeSeed {
  category: string;
  title: string;
  body: string;
}

export interface DemoTemplate {
  key: DemoTemplateKey;
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
const ngn = (naira: number) => naira * 100;

const weekdayHours = (open: string, close: string, days: (keyof WeeklyHours)[]): WeeklyHours =>
  Object.fromEntries(days.map((d) => [d, [[open, close]]])) as WeeklyHours;

const sizes = ["S", "M", "L", "XL"] as const;

function sizeColourVariants(colours: string[], price: number, lowStock: string[] = []): VariantSeed[] {
  const out: VariantSeed[] = [];
  for (const colour of colours) {
    for (const size of sizes) {
      const key = `${colour}/${size}`;
      out.push({
        name: `${colour} / ${size}`,
        options: { colour, size },
        price,
        inventoryStatus: lowStock.includes(key) ? "low_stock" : "in_stock",
        stockQuantity: lowStock.includes(key) ? 2 : 8,
      });
    }
  }
  return out;
}

export const DEMO_TEMPLATES: Record<DemoTemplateKey, DemoTemplate> = {
  fabric: {
    key: "fabric",
    label: "Fabric & tailoring",
    businessType: "fabric",
    name: "Adire Lane",
    slug: "adire-lane",
    tagline: "Hand-picked fabrics and made-to-measure tailoring",
    description:
      "A fictional Lagos fabric house and tailoring studio used to demo Nia. Ankara, adire, lace and aso-oke by the yard, plus ready-to-wear linen.",
    accentColor: "#0F8F8A",
    welcomeMessage: "I can help you find fabric, reorder what you loved, or book a fitting.",
    city: "Lagos",
    country: "NG",
    fulfillment: { delivery: true, pickup: true, pickupAddress: "Studio pickup — 7 Demo Close, Lekki Phase 1 (fictional)" },
    deliveryAreas: [
      { name: "Lekki", fee: ngn(3500), etaDays: 0, sameDay: true },
      { name: "Victoria Island", fee: ngn(3000), etaDays: 0, sameDay: true },
      { name: "Ikoyi", fee: ngn(3000), etaDays: 0, sameDay: true },
      { name: "Yaba", fee: ngn(3000), etaDays: 1, sameDay: false },
      { name: "Surulere", fee: ngn(3000), etaDays: 1, sameDay: false },
      { name: "Ikeja", fee: ngn(4000), etaDays: 1, sameDay: false },
      { name: "Ajah", fee: ngn(4500), etaDays: 1, sameDay: false },
      { name: "Outside Lagos", fee: null, etaDays: 4, sameDay: false },
    ],
    openingHours: weekdayHours("09:00", "18:00", ["mon", "tue", "wed", "thu", "fri", "sat"]),
    paymentInstructions:
      "We confirm availability first, then send bank-transfer details. Your order is processed once payment is confirmed by our team.",
    products: [
      {
        name: "Classic Ankara Wax Print",
        slug: "classic-ankara-wax-print",
        description: "Crisp 100% cotton wax print with a bold geometric motif. Sold per yard, 46 inches wide.",
        category: "Ankara",
        sku: "ANK-CLS",
        price: ngn(7500),
        unit: "yard",
        attributes: { material: "100% cotton wax print", width: "46 in", pattern: "geometric" },
        inventoryStatus: "in_stock",
        tags: ["ankara", "cotton", "print", "occasion"],
        variants: [
          { name: "Emerald", options: { colour: "Emerald" }, inventoryStatus: "in_stock", stockQuantity: 60 },
          { name: "Cobalt Blue", options: { colour: "Cobalt Blue" }, inventoryStatus: "in_stock", stockQuantity: 48 },
          { name: "Midnight Black", options: { colour: "Midnight Black" }, inventoryStatus: "in_stock", stockQuantity: 36 },
          { name: "Terracotta", options: { colour: "Terracotta" }, inventoryStatus: "low_stock", stockQuantity: 6 },
        ],
      },
      {
        name: "Hand-dyed Indigo Adire",
        slug: "hand-dyed-indigo-adire",
        description: "Resist-dyed cotton adire, hand-finished in small batches. Every yard is slightly unique. Sold per yard.",
        category: "Adire",
        sku: "ADR-IND",
        price: ngn(9000),
        unit: "yard",
        attributes: { material: "cotton", technique: "tie-and-dye resist", width: "44 in" },
        inventoryStatus: "in_stock",
        tags: ["adire", "indigo", "hand-dyed", "cotton"],
        variants: [
          { name: "Deep Indigo", options: { colour: "Deep Indigo" }, inventoryStatus: "in_stock", stockQuantity: 40 },
          { name: "Sky Indigo", options: { colour: "Sky Indigo" }, inventoryStatus: "in_stock", stockQuantity: 22 },
        ],
      },
      {
        name: "Corded French Lace",
        slug: "corded-french-lace",
        description: "Soft corded lace with a scalloped edge — for weddings and big days. Sold per yard.",
        category: "Lace",
        sku: "LCE-FR",
        price: ngn(18000),
        unit: "yard",
        attributes: { material: "polyester-cotton corded lace", finish: "scalloped edge" },
        inventoryStatus: "in_stock",
        tags: ["lace", "wedding", "occasion", "premium"],
        variants: [
          { name: "Ivory", options: { colour: "Ivory" }, inventoryStatus: "in_stock", stockQuantity: 30 },
          { name: "Champagne", options: { colour: "Champagne" }, inventoryStatus: "in_stock", stockQuantity: 18 },
          { name: "Onyx Black", options: { colour: "Onyx Black" }, inventoryStatus: "in_stock", stockQuantity: 20 },
          { name: "Wine", options: { colour: "Wine" }, inventoryStatus: "out_of_stock", stockQuantity: 0 },
        ],
      },
      {
        kind: "PACKAGE",
        name: "Aso-oke Celebration Set",
        slug: "aso-oke-celebration-set",
        description: "Hand-woven aso-oke set: gele, ipele and a matching fila. One set per order line.",
        category: "Aso-oke",
        sku: "ASO-SET",
        price: ngn(65000),
        unit: "set",
        attributes: { includes: ["gele", "ipele", "fila"], weave: "hand-woven" },
        inventoryStatus: "made_to_order",
        tags: ["aso-oke", "wedding", "set", "occasion"],
        variants: [
          { name: "Gold & Cream", options: { colour: "Gold & Cream" }, inventoryStatus: "made_to_order" },
          { name: "Burgundy", options: { colour: "Burgundy" }, inventoryStatus: "made_to_order" },
          { name: "Navy", options: { colour: "Navy" }, inventoryStatus: "made_to_order" },
        ],
      },
      {
        name: "Midnight Linen Kaftan",
        slug: "midnight-linen-kaftan",
        description: "Relaxed ready-to-wear kaftan in breathable washed linen. True to size.",
        category: "Ready-to-wear",
        sku: "RTW-KFT",
        price: ngn(42000),
        unit: "piece",
        attributes: { material: "washed linen", fit: "relaxed" },
        inventoryStatus: "in_stock",
        tags: ["kaftan", "linen", "ready-to-wear", "dark"],
        variants: sizeColourVariants(["Black", "Navy", "Sand"], ngn(42000), ["Navy/XL", "Sand/S"]),
      },
      {
        name: "Everyday Linen Shirt",
        slug: "everyday-linen-shirt",
        description: "A clean-cut linen shirt with a soft collar. Pairs with adire trousers.",
        category: "Ready-to-wear",
        sku: "RTW-SHT",
        price: ngn(24000),
        unit: "piece",
        attributes: { material: "linen", fit: "regular" },
        inventoryStatus: "in_stock",
        tags: ["shirt", "linen", "ready-to-wear"],
        variants: sizeColourVariants(["Black", "Charcoal", "Sand", "White"], ngn(24000), ["Charcoal/L"]),
      },
      {
        name: "Silk Headwrap",
        slug: "silk-headwrap",
        description: "Lightweight silk-blend headwrap, 180 cm long.",
        category: "Accessories",
        sku: "ACC-HWR",
        price: ngn(8500),
        unit: "piece",
        attributes: { material: "silk blend", length: "180 cm" },
        inventoryStatus: "in_stock",
        tags: ["headwrap", "gele", "accessory"],
        variants: [
          { name: "Gold", options: { colour: "Gold" }, inventoryStatus: "in_stock", stockQuantity: 14 },
          { name: "Emerald", options: { colour: "Emerald" }, inventoryStatus: "in_stock", stockQuantity: 9 },
          { name: "Black", options: { colour: "Black" }, inventoryStatus: "in_stock", stockQuantity: 12 },
        ],
      },
      {
        kind: "CUSTOM_ORDER",
        name: "Made-to-measure Outfit",
        slug: "made-to-measure-outfit",
        description:
          "A tailored outfit cut to your measurements from any fabric you choose. Priced after a measurement consultation — no fixed price.",
        category: "Tailoring",
        sku: "TLR-MTM",
        price: null,
        unit: "outfit",
        attributes: { turnaround: "10–14 days after measurements" },
        inventoryStatus: "made_to_order",
        tags: ["tailoring", "custom", "made-to-measure"],
      },
    ],
    services: [
      {
        kind: "APPOINTMENT",
        name: "Measurement & Style Consultation",
        slug: "measurement-style-consultation",
        description: "A 45-minute studio session to take measurements and plan your outfit. Fee is credited to your tailoring order.",
        category: "Tailoring",
        priceMin: ngn(5000),
        durationMinutes: 45,
        locationType: "in_store",
        bookingRequirements: "Bring any fabric you already own and a reference photo if you have one.",
        availability: {
          weekly: weekdayHours("10:00", "17:00", ["tue", "wed", "thu", "fri", "sat"]),
          slotIntervalMinutes: 60,
          capacityPerSlot: 1,
          leadTimeHours: 12,
          advanceDays: 21,
        },
        tags: ["fitting", "measurements", "consultation"],
      },
      {
        kind: "SERVICE",
        name: "Alterations",
        slug: "alterations",
        description: "Hemming, taking in and resizing. Book a 15-minute drop-off slot; most alterations are ready in 3 days.",
        category: "Tailoring",
        priceMin: ngn(3000),
        priceMax: ngn(12000),
        durationMinutes: 15,
        locationType: "in_store",
        options: [
          { name: "Hemming", priceDelta: 0 },
          { name: "Take in / let out", priceDelta: ngn(3000) },
          { name: "Express (24h)", priceDelta: ngn(4000) },
        ],
        availability: {
          weekly: weekdayHours("09:00", "17:30", ["mon", "tue", "wed", "thu", "fri", "sat"]),
          slotIntervalMinutes: 30,
          capacityPerSlot: 2,
          leadTimeHours: 2,
          advanceDays: 14,
        },
        tags: ["alterations", "repair"],
      },
    ],
    knowledge: [
      {
        category: "shipping",
        title: "Same-day delivery",
        body: "Same-day delivery is only available to Lekki, Victoria Island and Ikoyi for orders confirmed before 1pm. Other Lagos areas are next-day. Outside Lagos is quoted per order (3–5 days).",
      },
      {
        category: "returns",
        title: "Returns & exchanges",
        body: "Cut fabric cannot be returned unless it is faulty. Ready-to-wear items can be exchanged within 7 days if unworn with tags attached.",
      },
      {
        category: "product_guidance",
        title: "How many yards do I need?",
        body: "Most adult outfits need 4–6 yards. Iro and buba usually takes 6 yards; a men's kaftan and trousers about 5 yards; a simple dress 3–4 yards.",
      },
      {
        category: "faq",
        title: "Payment",
        body: "We confirm availability first, then share bank-transfer details. Orders move to processing once our team confirms payment.",
      },
    ],
  },

  beauty: {
    key: "beauty",
    label: "Salon & beauty",
    businessType: "salon",
    name: "Glow Theory Studio",
    slug: "glow-theory",
    tagline: "Hair, nails and brows — plus the products we use",
    description: "A fictional beauty studio used to demo Nia's service bookings and repeat product orders.",
    accentColor: "#B45F7A",
    welcomeMessage: "Book your usual appointment or restock your favourites.",
    city: "Lagos",
    country: "NG",
    fulfillment: { delivery: true, pickup: true, pickupAddress: "Studio reception — 3 Sample Avenue, Victoria Island (fictional)" },
    deliveryAreas: [
      { name: "Victoria Island", fee: ngn(2500), etaDays: 0, sameDay: true },
      { name: "Lekki", fee: ngn(3000), etaDays: 1, sameDay: false },
      { name: "Ikoyi", fee: ngn(2500), etaDays: 0, sameDay: true },
      { name: "Yaba", fee: ngn(3500), etaDays: 1, sameDay: false },
    ],
    openingHours: weekdayHours("09:00", "19:00", ["tue", "wed", "thu", "fri", "sat"]),
    paymentInstructions: "Services are paid at the studio. Saturday bookings need a deposit, which we confirm by message.",
    products: [
      {
        name: "Whipped Shea Body Butter",
        slug: "whipped-shea-body-butter",
        description: "Unscented whipped shea with jojoba. Our most reordered product.",
        category: "Body",
        sku: "BDY-SHEA",
        price: ngn(8500),
        unit: "jar",
        attributes: { scent: "unscented" },
        inventoryStatus: "in_stock",
        tags: ["shea", "body butter", "moisturiser"],
        variants: [
          { name: "250 ml", options: { size: "250 ml" }, price: ngn(8500), inventoryStatus: "in_stock", stockQuantity: 20 },
          { name: "500 ml", options: { size: "500 ml" }, price: ngn(12500), inventoryStatus: "in_stock", stockQuantity: 14 },
        ],
      },
      {
        name: "Hydrating Hair Serum",
        slug: "hydrating-hair-serum",
        description: "Lightweight serum for silk presses and protective styles. 50 ml.",
        category: "Hair",
        sku: "HR-SRM",
        price: ngn(9800),
        unit: "bottle",
        inventoryStatus: "low_stock",
        stockQuantity: 4,
        tags: ["hair", "serum", "silk press"],
      },
      {
        name: "Satin Sleep Bonnet",
        slug: "satin-sleep-bonnet",
        description: "Double-layer satin bonnet with a soft band.",
        category: "Hair",
        sku: "HR-BNT",
        price: ngn(6000),
        unit: "piece",
        inventoryStatus: "in_stock",
        tags: ["bonnet", "hair care"],
        variants: [
          { name: "Black", options: { colour: "Black" }, inventoryStatus: "in_stock", stockQuantity: 10 },
          { name: "Champagne", options: { colour: "Champagne" }, inventoryStatus: "in_stock", stockQuantity: 7 },
        ],
      },
    ],
    services: [
      {
        kind: "APPOINTMENT",
        name: "Silk Press",
        slug: "silk-press",
        description: "Wash, deep condition and silk press on natural hair.",
        category: "Hair",
        priceMin: ngn(25000),
        durationMinutes: 90,
        options: [{ name: "Trim", priceDelta: ngn(5000), durationDelta: 15 }],
        availability: {
          weekly: weekdayHours("09:00", "18:00", ["tue", "wed", "thu", "fri", "sat"]),
          slotIntervalMinutes: 90,
          capacityPerSlot: 2,
          leadTimeHours: 12,
          advanceDays: 30,
        },
        tags: ["hair", "silk press"],
      },
      {
        kind: "APPOINTMENT",
        name: "Knotless Braids",
        slug: "knotless-braids",
        description: "Medium knotless braids, mid-back length. Hair included.",
        category: "Hair",
        priceMin: ngn(45000),
        priceMax: ngn(70000),
        durationMinutes: 300,
        depositAmount: ngn(15000),
        bookingRequirements: "Come with hair washed and detangled. Deposit secures the slot.",
        options: [
          { name: "Small size", priceDelta: ngn(15000), durationDelta: 90 },
          { name: "Waist length", priceDelta: ngn(10000), durationDelta: 60 },
        ],
        availability: {
          // Long service: slots must finish before closing, so only 09:00 and 12:00 starts fit.
          weekly: weekdayHours("09:00", "19:00", ["tue", "wed", "thu", "fri", "sat"]),
          slotIntervalMinutes: 180,
          capacityPerSlot: 1,
          leadTimeHours: 24,
          advanceDays: 30,
        },
        tags: ["braids", "protective style"],
      },
      {
        kind: "APPOINTMENT",
        name: "Gel Manicure",
        slug: "gel-manicure",
        description: "Cuticle care, shaping and long-wear gel colour.",
        category: "Nails",
        priceMin: ngn(12000),
        durationMinutes: 60,
        availability: {
          weekly: weekdayHours("10:00", "18:00", ["tue", "wed", "thu", "fri", "sat"]),
          slotIntervalMinutes: 60,
          capacityPerSlot: 2,
          leadTimeHours: 4,
          advanceDays: 21,
        },
        tags: ["nails", "manicure"],
      },
      {
        kind: "APPOINTMENT",
        name: "Brow Lamination",
        slug: "brow-lamination",
        description: "Brow lamination with tint and shaping.",
        category: "Brows",
        priceMin: ngn(18000),
        durationMinutes: 45,
        availability: {
          weekly: weekdayHours("10:00", "17:00", ["wed", "thu", "fri", "sat"]),
          slotIntervalMinutes: 60,
          capacityPerSlot: 1,
          leadTimeHours: 12,
          advanceDays: 21,
        },
        tags: ["brows", "lamination"],
      },
    ],
    knowledge: [
      { category: "service_policy", title: "Saturday deposits", body: "All Saturday bookings require a deposit of ₦10,000 or the service deposit, whichever is higher." },
      { category: "service_policy", title: "Late arrivals", body: "If you arrive more than 20 minutes late we may need to reschedule to protect the next client's time." },
      { category: "returns", title: "Product returns", body: "Unopened products can be returned within 14 days. Opened skincare can't be returned for hygiene reasons." },
    ],
  },

  bakery: {
    key: "bakery",
    label: "Bakery",
    businessType: "bakery",
    name: "Crumb & Co.",
    slug: "crumb-and-co",
    tagline: "Small-batch bread, pastries and celebration cakes",
    description: "A fictional neighbourhood bakery used to demo custom orders and weekly repeat orders.",
    accentColor: "#B7791F",
    welcomeMessage: "Order your usual loaf or plan a celebration cake.",
    city: "Lagos",
    country: "NG",
    fulfillment: { delivery: true, pickup: true, pickupAddress: "Counter pickup — 12 Placeholder Street, Yaba (fictional)" },
    deliveryAreas: [
      { name: "Yaba", fee: ngn(1500), etaDays: 0, sameDay: true },
      { name: "Surulere", fee: ngn(2500), etaDays: 0, sameDay: true },
      { name: "Lekki", fee: ngn(4000), etaDays: 1, sameDay: false },
    ],
    openingHours: weekdayHours("07:00", "19:00", ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]),
    paymentInstructions: "Pay on pickup or by transfer after we confirm your order.",
    products: [
      {
        name: "Country Sourdough Loaf",
        slug: "country-sourdough-loaf",
        description: "48-hour fermented sourdough, 800 g.",
        category: "Bread",
        price: ngn(6500),
        unit: "loaf",
        inventoryStatus: "in_stock",
        stockQuantity: 18,
        tags: ["bread", "sourdough"],
      },
      {
        name: "Cinnamon Rolls",
        slug: "cinnamon-rolls",
        description: "Soft rolls with brown-butter cinnamon filling and cream cheese glaze.",
        category: "Pastry",
        price: ngn(9000),
        unit: "box of 6",
        inventoryStatus: "in_stock",
        stockQuantity: 10,
        tags: ["pastry", "sweet"],
      },
      {
        kind: "CUSTOM_ORDER",
        name: "Celebration Cake",
        slug: "celebration-cake",
        description: "Custom celebration cake. Tell us the occasion, servings and flavour — we quote after reviewing the design. Needs 72 hours' notice.",
        category: "Cakes",
        price: null,
        unit: "cake",
        attributes: { notice: "72 hours", flavours: ["vanilla bean", "red velvet", "dark chocolate", "lemon"] },
        inventoryStatus: "made_to_order",
        tags: ["cake", "birthday", "custom", "celebration"],
      },
    ],
    services: [],
    knowledge: [
      { category: "shipping", title: "Cake delivery", body: "Celebration cakes are delivered by our own rider only, within Yaba, Surulere and Lekki." },
      { category: "stock_note", title: "Sourdough bake days", body: "Sourdough is baked fresh every day except Sunday; Sunday orders are baked Saturday evening." },
    ],
  },
};

/**
 * Populate a merchant with a template catalog. Idempotent per slug: products
 * and services with an existing slug are skipped.
 */
export async function applyDemoTemplate(
  db: Db,
  merchantId: string,
  key: DemoTemplateKey,
  { currency = "NGN", applySettings = true }: { currency?: string; applySettings?: boolean } = {},
): Promise<{ products: number; services: number }> {
  const template = DEMO_TEMPLATES[key];

  if (applySettings) {
    await db
      .update(merchants)
      .set({
        fulfillment: template.fulfillment,
        deliveryAreas: template.deliveryAreas,
        openingHours: template.openingHours,
        paymentInstructions: template.paymentInstructions,
      })
      .where(eq(merchants.id, merchantId));
  }

  const existingProducts = new Set(
    (await db.select({ slug: products.slug }).from(products).where(eq(products.merchantId, merchantId))).map((r) => r.slug),
  );
  const existingServices = new Set(
    (await db.select({ slug: services.slug }).from(services).where(eq(services.merchantId, merchantId))).map((r) => r.slug),
  );

  let productCount = 0;
  for (const p of template.products) {
    if (existingProducts.has(p.slug)) continue;
    const [row] = await db
      .insert(products)
      .values({
        merchantId,
        kind: p.kind ?? "PRODUCT",
        name: p.name,
        slug: p.slug,
        description: p.description,
        category: p.category,
        sku: p.sku,
        price: p.price,
        currency,
        unit: p.unit,
        attributes: p.attributes ?? {},
        inventoryStatus: p.inventoryStatus ?? "unknown",
        stockQuantity: p.stockQuantity ?? null,
        tags: p.tags ?? [],
        images: stockPhotos(p.slug),
        metadata: { template: key },
      })
      .returning({ id: products.id });
    if (row && p.variants?.length) {
      await db.insert(productVariants).values(
        p.variants.map((v, i) => ({
          productId: row.id,
          merchantId,
          name: v.name,
          sku: p.sku ? `${p.sku}-${Object.values(v.options).join("-").toUpperCase().replace(/[^A-Z0-9]+/g, "")}` : null,
          options: v.options,
          price: v.price ?? null,
          inventoryStatus: v.inventoryStatus ?? "unknown",
          stockQuantity: v.stockQuantity ?? null,
          sortOrder: i,
        })),
      );
    }
    productCount++;
  }

  let serviceCount = 0;
  for (const s of template.services) {
    if (existingServices.has(s.slug)) continue;
    await db.insert(services).values({
      merchantId,
      kind: s.kind ?? "SERVICE",
      name: s.name,
      slug: s.slug,
      description: s.description,
      category: s.category,
      priceMin: s.priceMin,
      priceMax: s.priceMax ?? null,
      currency,
      durationMinutes: s.durationMinutes,
      locationType: s.locationType ?? "in_store",
      depositAmount: s.depositAmount ?? null,
      bookingRequirements: s.bookingRequirements,
      options: s.options ?? [],
      availability: s.availability,
      tags: s.tags ?? [],
      images: stockPhotos(s.slug),
    });
    serviceCount++;
  }

  // Demo items created before photos existed: add the stock photo, never replacing a merchant's own.
  for (const p of template.products) {
    if (!existingProducts.has(p.slug) || !STOCK_PHOTOS.has(p.slug)) continue;
    await db
      .update(products)
      .set({ images: stockPhotos(p.slug) })
      .where(and(eq(products.merchantId, merchantId), eq(products.slug, p.slug), sql`${products.images} = '[]'::jsonb`));
  }
  for (const sv of template.services) {
    if (!existingServices.has(sv.slug) || !STOCK_PHOTOS.has(sv.slug)) continue;
    await db
      .update(services)
      .set({ images: stockPhotos(sv.slug) })
      .where(and(eq(services.merchantId, merchantId), eq(services.slug, sv.slug), sql`${services.images} = '[]'::jsonb`));
  }

  const existingKnowledge = await db
    .select({ title: merchantKnowledge.title })
    .from(merchantKnowledge)
    .where(eq(merchantKnowledge.merchantId, merchantId));
  const titles = new Set(existingKnowledge.map((k) => k.title));
  const newKnowledge = template.knowledge.filter((k) => !titles.has(k.title));
  if (newKnowledge.length) {
    await db.insert(merchantKnowledge).values(newKnowledge.map((k) => ({ merchantId, ...k })));
  }

  return { products: productCount, services: serviceCount };
}
