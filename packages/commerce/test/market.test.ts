import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { applyDemoTemplate, merchants, products, type Database } from "@nia/database";
import { setupTestDb, createMerchant } from "@nia/database/testing";
import { marketCategories, marketMerchant, marketProducts, marketShops, searchMarket, searchMarketServices } from "../src";

let db: Database;
let close: () => Promise<void>;
let fabric: Awaited<ReturnType<typeof createMerchant>>;
let bakery: Awaited<ReturnType<typeof createMerchant>>;
let draftShop: Awaited<ReturnType<typeof createMerchant>>;

beforeAll(async () => {
  ({ db, close } = await setupTestDb());
  fabric = await createMerchant(db, { name: "Adire Lane", businessType: "fabric" });
  await applyDemoTemplate(db, fabric.id, "fabric");
  bakery = await createMerchant(db, { name: "Crumb & Co.", businessType: "bakery" });
  await applyDemoTemplate(db, bakery.id, "bakery");
  draftShop = await createMerchant(db, { name: "Not Live Yet", businessType: "bakery" });
  await applyDemoTemplate(db, draftShop.id, "bakery");
  await db.update(merchants).set({ status: "onboarding" }).where(eq(merchants.id, draftShop.id));
  await createMerchant(db, { name: "Walrus Market", slug: "market-test", kind: "market" });
});
afterAll(async () => close());

describe("Walrus Market", () => {
  it("lists live shops only, never the market record itself", async () => {
    const shops = await marketShops(db);
    const names = shops.map((s) => s.name);
    expect(names).toEqual(expect.arrayContaining(["Adire Lane", "Crumb & Co."]));
    expect(names).not.toContain("Not Live Yet");
    expect(names).not.toContain("Walrus Market");
    expect((await marketMerchant(db))?.name).toBe("Walrus Market");
  });

  it("searches across shops and says which shop each product comes from", async () => {
    const all = await searchMarket(db, { limit: 48 });
    const shopsSeen = new Set(all.map((p) => p.shop.name));
    expect(shopsSeen).toEqual(new Set(["Adire Lane", "Crumb & Co."]));
    const cake = (await searchMarket(db, { query: "cake" }))[0]!;
    expect(cake.shop.slug).toBe(bakery.slug);
    expect(cake.url).toBe(`/s/${bakery.slug}/shop/${cake.slug}`);
    // Items from a shop that isn't live never appear.
    const [hidden] = await db.select().from(products).where(eq(products.merchantId, draftShop.id)).limit(1);
    expect(all.some((p) => p.id === hidden!.id)).toBe(false);
  });

  it("filters by shop and by business type", async () => {
    expect((await searchMarket(db, { shops: [fabric.slug], limit: 48 })).every((p) => p.shop.slug === fabric.slug)).toBe(true);
    expect((await searchMarket(db, { businessType: "bakery", limit: 48 })).every((p) => p.shop.businessType === "bakery")).toBe(true);
  });

  it("loads products for comparison in the order asked, skipping unknown and non-live ones", async () => {
    const [ankara] = await searchMarket(db, { query: "ankara" });
    const [bread] = await searchMarket(db, { query: "sourdough" });
    const [hidden] = await db.select().from(products).where(eq(products.merchantId, draftShop.id)).limit(1);
    const compared = await marketProducts(db, [bread!.id, "not-an-id", hidden!.id, ankara!.id]);
    expect(compared.map((p) => p.id)).toEqual([bread!.id, ankara!.id]);
  });

  it("finds bookable services across shops and counts categories", async () => {
    const services = await searchMarketServices(db, { query: "alterations" });
    expect(services[0]?.shop.name).toBe("Adire Lane");
    const categories = await marketCategories(db);
    expect(categories.map((c) => c.category)).toEqual(expect.arrayContaining(["Ankara", "Cakes"]));
  });
});
