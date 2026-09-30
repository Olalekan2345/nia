import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { applyDemoTemplate, DEMO_TEMPLATES, type Database, type DemoTemplateKey, type Merchant } from "@nia/database";
import { createMerchant, setupTestDb } from "@nia/database/testing";
import { createConversation, createMarketTools, sessionHandle, type NiaToolScope } from "../src";

// Nia's market search tool against the full demo catalog, with the arguments a model sends
// for everyday shopper requests. No model and no memory: this checks the tool, not the prompt.

let db: Database;
let close: () => Promise<void>;
let market: Merchant;

beforeAll(async () => {
  ({ db, close } = await setupTestDb());
  market = await createMerchant(db, { name: "Walrus Market", slug: "walrus-market-test", kind: "market", businessType: "other" });
  for (const key of Object.keys(DEMO_TEMPLATES) as DemoTemplateKey[]) {
    const t = DEMO_TEMPLATES[key];
    const shop = await createMerchant(db, { name: t.name, slug: t.slug, businessType: t.businessType });
    await applyDemoTemplate(db, shop.id, key);
  }
});
afterAll(async () => close());

type Found = { name: string; category: string | null; price: number | null; shop: { name: string } };

/** One tool call in a fresh reply (each reply has its own search budget). */
async function search(input: Record<string, unknown>): Promise<Found[]> {
  const conversation = await createConversation(db, { merchantId: market.id, customerId: null, channel: "web" });
  const scope: NiaToolScope = {
    db,
    store: null,
    merchant: market,
    customerId: null,
    customerMemoryEnabled: false,
    channel: "web",
    conversationId: conversation.id,
    memoryMode: "off",
    recalled: { customer: [], merchant: [] },
    flags: { memoryAssisted: false, forgotten: [] },
    session: sessionHandle(db, conversation.id, conversation.session),
  };
  const out = (await createMarketTools(scope).searchMarket.execute!(input, { toolCallId: "t", messages: [], context: {} as never })) as { ok: boolean; products: Found[] };
  expect(out.ok).toBe(true);
  return out.products;
}

describe("Nia finds the expanded Walrus Market catalog", () => {
  it("“Show me laptops under ₦700,000”", async () => {
    const found = await search({ query: "laptop", maxBudget: 700_000, limit: 6 });
    expect(found.every((p) => p.price != null && p.price <= 700_000 * 100)).toBe(true);
    // Laptops within budget come first; laptop accessories may follow.
    const laptops = found.filter((p) => p.category === "Laptops");
    expect(laptops.length).toBeGreaterThanOrEqual(3);
    expect(found.slice(0, laptops.length).every((p) => p.category === "Laptops"), found.map((p) => p.name).join(", ")).toBe(true);
    expect(laptops.map((p) => p.name)).toContain("Tusk 15 Business Laptop");
    expect(laptops.map((p) => p.name)).not.toContain("Tusk G16 Gaming Laptop");
  });

  it("“I need a phone”", async () => {
    const found = await search({ query: "phone" });
    expect(found.length).toBeGreaterThanOrEqual(3);
    expect(found.every((p) => p.category === "Phones"), found.map((p) => p.name).join(", ")).toBe(true);
  });

  it("“black dresses”", async () => {
    // Colour alone never qualifies a product: no black phones for "black dresses".
    for (const input of [{ query: "black dresses" }, { query: "dress", colour: "black" }]) {
      const found = await search(input);
      expect(found.length, JSON.stringify(input)).toBeGreaterThan(0);
      expect(found.every((p) => /dress|gown/i.test(p.name)), `${JSON.stringify(input)}: ${found.map((p) => p.name).join(", ")}`).toBe(true);
    }
  });

  it("“birthday cake”", async () => {
    const found = await search({ query: "birthday cake" });
    expect(found.length).toBeGreaterThanOrEqual(3);
    expect(found.every((p) => /cake/i.test(p.name))).toBe(true);
  });

  it("“drinks” and “orange juice”", async () => {
    const drinks = await search({ query: "drinks", limit: 6 });
    expect(drinks.length).toBe(6);
    expect(drinks.every((p) => p.shop.name === "Walrus Drinks")).toBe(true);
    const juice = await search({ query: "orange juice" });
    expect(juice[0]!.name).toBe("100% Orange Juice");
  });

  it("“wireless earbuds”", async () => {
    const found = await search({ query: "wireless earbuds" });
    expect(found[0]!.category).toBe("Earbuds");
  });

  it("“men's sneakers”", async () => {
    const found = await search({ query: "men's sneakers" });
    expect(found.length).toBeGreaterThan(0);
    expect(found[0]!.name).toMatch(/sneaker/i);
  });

  it("“something for my home office”", async () => {
    const found = await search({ query: "home office", limit: 6 });
    expect(found.length).toBeGreaterThanOrEqual(3);
    expect(found.map((p) => p.name).join(" ")).toMatch(/Office Chair|Monitor Riser|Desk Organiser|Laptop Stand/);
  });
});
