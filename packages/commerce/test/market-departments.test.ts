import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { applyDemoTemplate, DEMO_TEMPLATES, productVariants, products, type Database, type DemoTemplateKey } from "@nia/database";
import { createCustomer, createMerchant, setupTestDb } from "@nia/database/testing";
import { MARKET_DEPARTMENTS, POPULAR_MART_RAILS, toMinorUnits } from "@nia/shared";
import { addItemToDraft, departmentSummaries, getDraft, getProduct, marketCatalog, marketCategories, railProducts, searchMarket, tokenize, type MarketCatalogItem } from "../src";

describe("demo catalog data", () => {
  const all = Object.values(DEMO_TEMPLATES).flatMap((t) => t.products.map((p) => ({ ...p, shop: t.key })));

  it("has unique slugs, SKUs and variant names, and every product is priced or quoted", () => {
    const slugs = all.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    const skus = all.map((p) => p.sku).filter(Boolean);
    expect(new Set(skus).size).toBe(skus.length);
    for (const p of all) {
      expect(p.price != null || p.kind === "CUSTOM_ORDER", p.slug).toBe(true);
      const names = (p.variants ?? []).map((v) => v.name);
      expect(new Set(names).size, p.slug).toBe(names.length);
      expect(p.description.length, p.slug).toBeGreaterThan(20);
    }
  });

  it("fills every department with enough to browse", () => {
    const count = (key: DemoTemplateKey) => DEMO_TEMPLATES[key].products.length;
    expect(count("gadgets")).toBeGreaterThanOrEqual(20);
    expect(count("designers")).toBeGreaterThanOrEqual(25);
    expect(count("kitchen")).toBeGreaterThanOrEqual(25);
    expect(count("drinks")).toBeGreaterThanOrEqual(15);
    expect(count("bakery")).toBeGreaterThanOrEqual(15);
    expect(count("beauty")).toBeGreaterThanOrEqual(15);
    expect(count("home")).toBeGreaterThanOrEqual(15);
    const gadgets = DEMO_TEMPLATES.gadgets.products;
    expect(gadgets.filter((p) => p.category === "Phones").length).toBeGreaterThanOrEqual(8);
    expect(gadgets.filter((p) => p.category === "Laptops" || p.category === "Tablets").length).toBeGreaterThanOrEqual(8);
  });

  it("keeps the drinks shop non-alcoholic", () => {
    const alcohol = /\b(beer|lager|stout|wine|vodka|whisk(e)?y|gin|rum|brandy|tequila|liqueur|cider)\b/i;
    for (const p of DEMO_TEMPLATES.drinks.products) expect(`${p.name} ${p.description} ${(p.tags ?? []).join(" ")}`, p.slug).not.toMatch(alcohol);
  });

  it("reads plurals in search words as the singular", () => {
    expect(tokenize("black dresses")).toEqual(["black", "dress"]);
    expect(tokenize("men's sneakers")).toEqual(["men", "sneaker"]);
    expect(tokenize("watches, glasses and boxes")).toEqual(["watch", "glass", "box"]);
    expect(tokenize("shoes bodies dress")).toEqual(["shoe", "body", "dress"]);
  });

  it("maps every shop to exactly one department", () => {
    for (const t of Object.values(DEMO_TEMPLATES)) {
      expect(MARKET_DEPARTMENTS.filter((d) => d.businessTypes.includes(t.businessType)), t.key).toHaveLength(1);
    }
  });
});

describe("Walrus Market departments", () => {
  let db: Database;
  let close: () => Promise<void>;
  const shopIds = new Map<DemoTemplateKey, string>();
  let catalog: MarketCatalogItem[];

  beforeAll(async () => {
    ({ db, close } = await setupTestDb());
    for (const key of Object.keys(DEMO_TEMPLATES) as DemoTemplateKey[]) {
      const t = DEMO_TEMPLATES[key];
      const m = await createMerchant(db, { name: t.name, slug: t.slug, businessType: t.businessType });
      await applyDemoTemplate(db, m.id, key);
      shopIds.set(key, m.id);
    }
    catalog = await marketCatalog(db);
  });
  afterAll(async () => close());

  it("seeds idempotently: a second run adds nothing", async () => {
    const again = await applyDemoTemplate(db, shopIds.get("gadgets")!, "gadgets");
    expect(again).toEqual({ products: 0, services: 0 });
    const rows = await db.select({ id: products.id }).from(products).where(eq(products.merchantId, shopIds.get("gadgets")!));
    expect(rows).toHaveLength(DEMO_TEMPLATES.gadgets.products.length);
  });

  it("re-seeding refreshes withdrawn demo photos but never a merchant's own image", async () => {
    const shop = shopIds.get("gadgets")!;
    const imagesOf = async (slug: string) => (await db.select({ images: products.images }).from(products).where(and(eq(products.merchantId, shop), eq(products.slug, slug))))[0]!.images;
    const current = await imagesOf("arc-a15-smartphone");
    await db.update(products).set({ images: ["/stock/arc-a15-smartphone.jpg"] }).where(and(eq(products.merchantId, shop), eq(products.slug, "arc-a15-smartphone")));
    await db.update(products).set({ images: ["https://cdn.example.com/own-photo.jpg"] }).where(and(eq(products.merchantId, shop), eq(products.slug, "arc-pro-smartphone")));
    await applyDemoTemplate(db, shop, "gadgets");
    expect(await imagesOf("arc-a15-smartphone")).toEqual(current);
    expect(await imagesOf("arc-pro-smartphone")).toEqual(["https://cdn.example.com/own-photo.jpg"]);
  });

  it("filters by department, including shops of several business types", async () => {
    const gadgets = await searchMarket(db, { department: "gadgets", limit: 48 });
    expect(gadgets.length).toBeGreaterThan(20);
    expect(gadgets.every((p) => p.shop.slug === "walrus-gadgets")).toBe(true);
    const fashion = await searchMarket(db, { department: "fashion", limit: 48 });
    expect(new Set(fashion.map((p) => p.shop.slug))).toEqual(new Set(["walrus-designers", "adire-lane"]));
    expect(await searchMarket(db, { department: "no-such-department" })).toEqual([]);
  });

  it("serves the Phones & Laptops collection from its categories", async () => {
    const items = await searchMarket(db, { collection: "phones-laptops", limit: 48 });
    expect(items.length).toBeGreaterThanOrEqual(16);
    expect(new Set(items.map((p) => p.category))).toEqual(new Set(["Phones", "Laptops", "Tablets"]));
  });

  it("finds new items by everyday words, not exact names", async () => {
    const top = async (query: string) => (await searchMarket(db, { query, limit: 5 })).map((p) => p.shop.slug);
    expect(await top("laptop")).toContain("walrus-gadgets");
    expect(await top("wireless earbuds")).toContain("walrus-gadgets");
    expect((await searchMarket(db, { query: "orange juice", limit: 3 }))[0]!.slug).toBe("orange-juice");
    expect(await top("drinks")).toContain("walrus-drinks");
    expect(await top("jollof rice")).toContain("walrus-kitchen");
    expect(await top("birthday cake")).toContain("crumb-and-co");
    expect(await top("dress")).toContain("walrus-designers");
    expect(await top("lipstick")).toContain("glow-theory");
    expect(await top("home office")).toEqual(expect.arrayContaining(["walrus-home"]));
  });

  it("applies budget, colour and stock filters to the new catalog", async () => {
    const laptops = await searchMarket(db, { query: "laptop", maxPrice: toMinorUnits(700_000, "NGN"), limit: 48 });
    expect(laptops.length).toBeGreaterThan(0);
    expect(laptops.every((p) => p.price != null && p.price <= toMinorUnits(700_000, "NGN"))).toBe(true);
    expect(laptops.map((p) => p.slug)).toContain("tusk-15-business-laptop");
    expect(laptops.map((p) => p.slug)).not.toContain("tusk-g16-gaming-laptop");
    const black = await searchMarket(db, { query: "dress", colour: "black", limit: 10 });
    expect(black.map((p) => p.slug)).toContain("wrap-midi-dress");
    // Every result, not just the top few: no black phones, no salads with "dressing".
    const blackDresses = await searchMarket(db, { query: "black dresses", limit: 48 });
    expect(blackDresses.length).toBeGreaterThan(2);
    expect(blackDresses.filter((p) => !/dress|gown/i.test(p.name)).map((p) => p.name)).toEqual([]);
    expect((await searchMarket(db, { department: "drinks", inStockOnly: true, limit: 48 })).every((p) => p.available)).toBe(true);
  });

  it("pages through results without overlap", async () => {
    const first = await searchMarket(db, { department: "fashion", limit: 12 });
    const second = await searchMarket(db, { department: "fashion", limit: 12, offset: 12 });
    expect(second.length).toBeGreaterThan(0);
    expect(second.some((p) => first.some((q) => q.id === p.id))).toBe(false);
  });

  it("scopes categories to a department", async () => {
    const cats = (await marketCategories(db, { department: "drinks" })).map((c) => c.category);
    expect(cats).toEqual(expect.arrayContaining(["Juices", "Water", "Soft Drinks"]));
    expect(cats).not.toContain("Laptops");
  });

  it("builds Popular Mart rails from real prices, tags and dates", () => {
    const rail = (key: string) => railProducts(catalog, POPULAR_MART_RAILS.find((r) => r.key === key)!);
    const cheap = rail("under-10k");
    expect(cheap.length).toBeGreaterThan(5);
    expect(cheap.every((p) => p.price != null && p.price <= toMinorUnits(10_000, "NGN"))).toBe(true);
    const picks = rail("picks");
    expect(picks.length).toBeGreaterThan(5);
    expect(picks.every((p) => p.tags.includes("pick"))).toBe(true);
    const fresh = rail("new");
    // Newest day first; the same day's additions take turns between shops.
    const days = fresh.map((p) => p.addedAt.toISOString().slice(0, 10));
    expect(days).toEqual([...days].sort().reverse());
    expect(new Set(fresh.map((p) => p.shop.slug)).size).toBeGreaterThan(1);
    // A later rail skips what an earlier one already shows.
    const shown = new Set(picks.map((p) => p.id));
    const cheapUnseen = railProducts(catalog, POPULAR_MART_RAILS.find((r) => r.key === "under-10k")!, { exclude: shown });
    expect(cheapUnseen.length).toBeGreaterThanOrEqual(3);
    expect(cheapUnseen.some((p) => shown.has(p.id))).toBe(false);
  });

  it("summarises every department that has products", () => {
    const summaries = departmentSummaries(catalog);
    expect(summaries.map((d) => d.key)).toEqual(MARKET_DEPARTMENTS.map((d) => d.key));
    const gadgets = summaries.find((d) => d.key === "gadgets")!;
    expect(gadgets.count).toBe(DEMO_TEMPLATES.gadgets.products.length);
    expect(gadgets.products.length).toBeLessThanOrEqual(10);
    // A department with several shops takes turns between them, so no shop fills the whole rail.
    const fashion = summaries.find((d) => d.key === "fashion")!;
    expect(fashion.shops).toBe(2);
    expect(new Set(fashion.products.slice(0, 2).map((p) => p.shop.slug))).toEqual(new Set(["walrus-designers", "adire-lane"]));
  });

  it("opens variant products and keeps one cart per shop across departments", async () => {
    const phone = await getProduct(db, shopIds.get("gadgets")!, "arc-a15-smartphone");
    expect(phone?.variants.map((v) => v.name)).toEqual(["64 GB / Black", "64 GB / Ocean Blue", "128 GB / Black", "128 GB / Ocean Blue"]);
    const pricier = phone!.variants.find((v) => v.name === "128 GB / Black")!;
    expect(pricier.price).toBe(toMinorUnits(169_000, "NGN"));

    const gadgetsShop = shopIds.get("gadgets")!;
    const drinksShop = shopIds.get("drinks")!;
    const shopper = await createCustomer(db, gadgetsShop, { displayName: "Tolu" });
    const drinksShopper = await createCustomer(db, drinksShop, { displayName: "Tolu" });
    const [v] = await db.select().from(productVariants).where(and(eq(productVariants.productId, phone!.id), eq(productVariants.name, "128 GB / Black")));
    await addItemToDraft(db, { merchantId: gadgetsShop, customerId: shopper.id, productId: phone!.id, variantId: v!.id, quantity: 1, channel: "web" });
    const juice = await getProduct(db, drinksShop, "orange-juice");
    const [jv] = await db.select().from(productVariants).where(and(eq(productVariants.productId, juice!.id), eq(productVariants.name, "1 L")));
    await addItemToDraft(db, { merchantId: drinksShop, customerId: drinksShopper.id, productId: juice!.id, variantId: jv!.id, quantity: 3, channel: "web" });
    expect(await getDraft(db, gadgetsShop, shopper.id)).not.toBeNull();
    expect(await getDraft(db, drinksShop, drinksShopper.id)).not.toBeNull();
  });
});
