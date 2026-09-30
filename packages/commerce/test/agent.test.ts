import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { applyDemoTemplate, DEMO_TEMPLATES, productVariants, products, type Database, type DemoTemplateKey } from "@nia/database";
import { createMerchant, setupTestDb } from "@nia/database/testing";
import { toMinorUnits } from "@nia/shared";
import {
  compareFacts,
  defaultQuantity,
  findAlternatives,
  getProduct,
  planBasket,
  productPriceHistoryFor,
  recordProductPrices,
  resolveRepeatBooking,
  searchProducts,
  type BookingSummaryData,
} from "../src";

// Commerce-agent building blocks against the real seeded demo catalog: baskets with
// exact totals, substitutions from catalog data, factual comparison, hard/soft
// constraints, repeat bookings and recorded price history.

let db: Database;
let close: () => Promise<void>;
const shopIds = new Map<DemoTemplateKey, string>();
const ngn = (major: number) => toMinorUnits(major, "NGN");

async function productBySlug(key: DemoTemplateKey, slug: string) {
  const [p] = await db.select().from(products).where(and(eq(products.merchantId, shopIds.get(key)!), eq(products.slug, slug)));
  return p!;
}

beforeAll(async () => {
  ({ db, close } = await setupTestDb());
  for (const key of Object.keys(DEMO_TEMPLATES) as DemoTemplateKey[]) {
    const t = DEMO_TEMPLATES[key];
    const m = await createMerchant(db, { name: t.name, slug: t.slug, businessType: t.businessType });
    await applyDemoTemplate(db, m.id, key);
    shopIds.set(key, m.id);
  }
});
afterAll(async () => close());

const PARTY = [
  { label: "Drinks", query: "juice", quantity: 4 },
  { label: "Snacks", query: "puff puff", quantity: 2 },
  { label: "Cake", query: "cake", quantity: 1 },
];

describe("planBasket", () => {
  it("builds a basket from real in-stock items across shops, within budget, with exact totals", async () => {
    const plan = await planBasket(db, { goal: "Eight friends tonight", budget: ngn(50_000), slots: PARTY });
    expect(plan.lines.map((l) => l.slot)).toEqual(["Drinks", "Snacks", "Cake"]);
    expect(plan.total).toBe(plan.lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0));
    expect(plan.total).toBeLessThanOrEqual(ngn(50_000));
    expect(plan.remaining).toBe(ngn(50_000) - plan.total);
    expect(plan.overBudgetBy).toBeNull();
    // One cart per shop: subtotals add up to the total.
    expect(new Set(plan.lines.map((l) => l.shop.slug)).size).toBe(3);
    expect(plan.byShop.reduce((s, b) => s + b.subtotal, 0)).toBe(plan.total);
    expect(plan.notes.join(" ")).toMatch(/different shops/);
    for (const l of plan.lines) {
      const p = await getProduct(db, (await db.select({ m: products.merchantId }).from(products).where(eq(products.id, l.productId)))[0]!.m, l.productId);
      expect(p?.available, l.name).toBe(true);
    }
  });

  it("steps the priciest line down to real cheaper options until it fits", async () => {
    const free = await planBasket(db, { goal: "Party", slots: PARTY });
    const tight = await planBasket(db, { goal: "Party", budget: free.total - 1, slots: PARTY });
    expect(tight.total).toBeLessThan(free.total);
    expect(tight.total).toBeLessThanOrEqual(free.total - 1);
  });

  it("says honestly when even the cheapest choices go over budget", async () => {
    const plan = await planBasket(db, { goal: "Party", budget: ngn(1), slots: PARTY });
    expect(plan.overBudgetBy).toBeGreaterThan(0);
    expect(plan.remaining).toBeNull();
    expect(plan.notes.join(" ")).toMatch(/over the budget/);
  });

  it("changes only the slot asked to get cheaper; the rest stay put", async () => {
    const first = await planBasket(db, { goal: "Party", slots: PARTY });
    const previous = first.lines.map((l) => ({ slot: l.slot, productId: l.productId, variantId: l.variantId, quantity: l.quantity }));
    const second = await planBasket(db, { goal: "Party", slots: PARTY, cheaper: ["Cake"], previous });
    const by = (plan: typeof first, slot: string) => plan.lines.find((l) => l.slot === slot)!;
    expect(by(second, "Drinks").productId).toBe(by(first, "Drinks").productId);
    expect(by(second, "Snacks").productId).toBe(by(first, "Snacks").productId);
    expect(by(second, "Cake").unitPrice).toBeLessThan(by(first, "Cake").unitPrice);
  });

  it("fills quantities from the headcount when the model leaves them out", async () => {
    expect(defaultQuantity("can", 8)).toBe(8);
    expect(defaultQuantity("carton", 8)).toBe(2); // 1 L serves about four
    expect(defaultQuantity("cake", 8)).toBe(1);
    expect(defaultQuantity("platter", 8)).toBe(1);
    expect(defaultQuantity("can", null)).toBe(1);
    const plan = await planBasket(db, { goal: "Eight friends", people: 8, slots: [{ label: "Drinks", query: "soft drink" }, { label: "Cake", query: "cake" }, { label: "Juice", query: "juice", quantity: 3 }] });
    const q = (slot: string) => plan.lines.find((l) => l.slot === slot)!;
    expect(q("Drinks").quantity).toBe(8);
    expect(q("Cake").quantity).toBe(1);
    expect(q("Juice").quantity).toBe(3); // explicit wins
    expect(plan.total).toBe(plan.lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0));
  });

  it("never fills a slot with a guess, respects exclusions and a shop limit", async () => {
    const plan = await planBasket(db, { goal: "Test", slots: [{ label: "Unicorn", query: "unicorn saddle" }, { label: "Drinks", query: "soft drink", quantity: 2 }], exclude: ["cola"] });
    expect(plan.missing.map((m) => m.slot)).toEqual(["Unicorn"]);
    expect(plan.lines.every((l) => !/cola/i.test(l.name))).toBe(true);
    const shopOnly = await planBasket(db, { goal: "Drinks", slots: [{ label: "Juice", query: "juice" }, { label: "Cake", query: "cake" }], shops: ["walrus-drinks"] });
    expect(shopOnly.lines.every((l) => l.shop.slug === "walrus-drinks")).toBe(true);
    expect(shopOnly.missing.map((m) => m.slot)).toEqual(["Cake"]);
  });
});

describe("findAlternatives", () => {
  it("offers the same item in another option first", async () => {
    const phone = await productBySlug("gadgets", "arc-a15-smartphone");
    const [black64] = await db.select().from(productVariants).where(and(eq(productVariants.productId, phone.id), eq(productVariants.name, "64 GB / Black")));
    const alts = await findAlternatives(db, { merchantIds: [shopIds.get("gadgets")!], productId: phone.id, variantId: black64!.id });
    expect(alts[0]!.sameProduct).toBe(true);
    expect(alts[0]!.variantName).toBe("64 GB / Ocean Blue"); // same storage kept, other colour
    expect(alts[0]!.reason).toMatch(/^Same item in Ocean Blue/);
  });

  it("finds similar products from shared catalog data and a sensible price band", async () => {
    const laptop = await productBySlug("gadgets", "tusk-15-business-laptop");
    const alts = await findAlternatives(db, { merchantIds: [shopIds.get("gadgets")!], productId: laptop.id, limit: 3 });
    expect(alts.length).toBeGreaterThan(0);
    for (const a of alts) {
      expect(a.sameProduct).toBe(false);
      expect(a.reason).toMatch(/^(Similar|Another) laptop/);
      expect(a.price! / laptop.price!).toBeGreaterThanOrEqual(0.6);
      expect(a.price! / laptop.price!).toBeLessThanOrEqual(1.4);
    }
    expect(alts.map((a) => a.slug)).not.toContain("tusk-g16-gaming-laptop"); // ₦1.39M is outside the band
  });

  it("only ever looks inside the shops it is given", async () => {
    const laptop = await productBySlug("gadgets", "tusk-15-business-laptop");
    expect(await findAlternatives(db, { merchantIds: [shopIds.get("drinks")!], productId: laptop.id })).toEqual([]);
  });
});

describe("compareFacts", () => {
  it("compares real specs and marks what isn't listed instead of guessing", async () => {
    const m = shopIds.get("gadgets")!;
    const a = (await getProduct(db, m, (await productBySlug("gadgets", "tusk-15-business-laptop")).id))!;
    const b = (await getProduct(db, m, (await productBySlug("gadgets", "tusk-air-13-ultrabook")).id))!;
    const facts = compareFacts([a, b], ["weight", "battery"]);
    const weight = facts.rows.find((r) => r.key === "weight")!;
    expect(weight.values).toEqual([null, "1.15 kg"]);
    expect(weight.differs).toBe(true);
    expect(facts.notListed).toEqual(["battery"]);
    expect(facts.rows.find((r) => r.key === "battery")!.values).toEqual([null, null]); // shown as "Not listed"
    expect(compareFacts([a, b]).rows.map((r) => r.key)).toEqual(expect.arrayContaining(["screen", "processor", "use"]));
  });
});

describe("hard and soft constraints in search", () => {
  it("excluded words never appear; excluded options are dropped from a product", async () => {
    const m = shopIds.get("designers")!;
    const dresses = await searchProducts(db, m, { query: "dress", exclude: ["black"], limit: 20 });
    expect(dresses.length).toBeGreaterThan(0);
    for (const d of dresses) {
      expect(d.name.toLowerCase()).not.toContain("black");
      expect(d.variants.some((v) => /black/i.test(v.name))).toBe(false);
    }
    expect(dresses.map((d) => d.slug)).toContain("wrap-midi-dress"); // kept in Emerald
  });

  it("preferences change the order, never the set", async () => {
    const m = shopIds.get("gadgets")!;
    const plain = await searchProducts(db, m, { query: "laptop", limit: 10 });
    const lightFirst = await searchProducts(db, m, { query: "laptop", prefer: ["travel"], limit: 10 });
    expect(new Set(lightFirst.map((p) => p.id))).toEqual(new Set(plain.map((p) => p.id)));
    expect(lightFirst[0]!.slug).toBe("tusk-air-13-ultrabook");
  });
});

describe("resolveRepeatBooking", () => {
  const booking = (id: string, serviceId: string, startAt: string, options: string[] = []): BookingSummaryData => ({
    kind: "booking",
    id,
    status: "completed",
    statusLabel: "Completed",
    serviceId,
    serviceName: serviceId,
    startAt,
    endAt: startAt,
    timeZone: "Africa/Lagos",
    selectedOptions: options,
    price: null,
    depositAmount: null,
    currency: "NGN",
    notes: null,
    memoryAssisted: false,
  });

  it("is clear when the last bookings were the same service, ambiguous when different and close", () => {
    expect(resolveRepeatBooking([])).toMatchObject({ status: "none" });
    expect(resolveRepeatBooking([booking("b2", "cut", "2026-09-20T10:00:00Z", ["Fade"]), booking("b1", "cut", "2026-09-01T10:00:00Z", ["Fade"])])).toMatchObject({ status: "single", bookingId: "b2", options: ["Fade"] });
    expect(resolveRepeatBooking([booking("b2", "cut", "2026-09-20T10:00:00Z"), booking("b1", "nails", "2026-09-10T10:00:00Z")])).toMatchObject({ status: "ambiguous" });
    expect(resolveRepeatBooking([booking("b2", "cut", "2026-09-20T10:00:00Z"), booking("b1", "nails", "2026-05-01T10:00:00Z")])).toMatchObject({ status: "single", bookingId: "b2" });
  });
});

describe("price history", () => {
  it("records only real changes and reports them", async () => {
    const m = shopIds.get("drinks")!;
    const juice = await productBySlug("drinks", "apple-juice");
    expect((await productPriceHistoryFor(db, { merchantId: m, productId: juice.id })).trackedSince).toBeNull();
    expect(await recordProductPrices(db, { merchantId: m, productId: juice.id })).toBeGreaterThan(0);
    expect(await recordProductPrices(db, { merchantId: m, productId: juice.id })).toBe(0); // unchanged → nothing written
    await db.update(products).set({ price: ngn(2_200) }).where(eq(products.id, juice.id));
    await db.update(productVariants).set({ price: ngn(2_200) }).where(and(eq(productVariants.productId, juice.id), eq(productVariants.name, "1 L")));
    await recordProductPrices(db, { merchantId: m, productId: juice.id });
    const history = await productPriceHistoryFor(db, { merchantId: m, productId: juice.id });
    expect(history.trackedSince).not.toBeNull();
    expect(history.changes.some((c) => c.from === ngn(2_500) && c.to === ngn(2_200))).toBe(true);
    // Scoped to the merchant: another shop sees nothing.
    expect((await productPriceHistoryFor(db, { merchantId: shopIds.get("gadgets")!, productId: juice.id })).changes).toEqual([]);
  });
});
