import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { applyDemoTemplate, conversations, DEMO_TEMPLATES, merchants, productVariants, products, services, type Database, type DemoTemplateKey, type Merchant } from "@nia/database";
import { createMerchant, createUser, setupTestDb } from "@nia/database/testing";
import { resetEnvCache } from "@nia/config";
import { awaitDurable, type MemoryStore } from "@nia/memory";
import { createMockStore } from "@nia/memory/testing";
import { addItemToDraft, confirmBookingRequest, getAvailableBookingSlots, resolveWebCustomer, setDraftFulfillment, submitDraft, transitionBooking, createBookingDraft } from "@nia/commerce";
import { createConversation, extractAndRemember, prepareTurn, saveUserMessage, setModelOverrides, type MarketTools, type NiaTools } from "../src";
import { jsonModel } from "./mock-model";

// The commerce agent's tools and turn assembly over real (test) data. No live model:
// tools are executed directly, the way the model would call them.

let db: Database;
let close: () => Promise<void>;
let store: MemoryStore;
let market: Merchant;
const shops = new Map<DemoTemplateKey, Merchant>();
const opts = { toolCallId: "t", messages: [], context: {} as never };

beforeAll(async () => {
  resetEnvCache();
  ({ db, close } = await setupTestDb());
  store = createMockStore();
  market = await createMerchant(db, { name: "Walrus Market", slug: "market", kind: "market", businessType: "other" });
  for (const key of Object.keys(DEMO_TEMPLATES) as DemoTemplateKey[]) {
    const t = DEMO_TEMPLATES[key];
    const m = await createMerchant(db, { name: t.name, slug: t.slug, businessType: t.businessType });
    await applyDemoTemplate(db, m.id, key);
    const [row] = await db.select().from(merchants).where(eq(merchants.id, m.id));
    shops.set(key, row!);
  }
});
afterAll(async () => {
  setModelOverrides(undefined);
  await close();
});

async function shopper(merchant: Merchant, name = "Tolu") {
  const user = await createUser(db);
  return resolveWebCustomer(db, { merchantId: merchant.id, userId: user.id, email: user.email, name });
}

async function turn(merchant: Merchant, customer: Awaited<ReturnType<typeof shopper>> | null, text: string, conversationId?: string) {
  const conversation = conversationId
    ? (await db.select().from(conversations).where(eq(conversations.id, conversationId)))[0]!
    : await createConversation(db, { merchantId: merchant.id, customerId: customer?.id ?? null, channel: "web" });
  const saved = await saveUserMessage(db, { conversation, text, channel: "web" });
  const ctx = { db, store, merchant, customer, conversation, channel: "web" as const };
  const prepared = await prepareTurn(ctx, text);
  return { ctx, prepared, saved, conversation, market: prepared.tools as unknown as MarketTools, shop: prepared.tools as unknown as NiaTools };
}

describe("shopping session", () => {
  it("remembers what was shown and the goal, and feeds it back so 'the second one' resolves", async () => {
    const c = await shopper(market);
    const t1 = await turn(market, c, "I need a laptop for work, budget ₦800k, not too heavy");
    const res = (await t1.market.searchMarket.execute!({ query: "laptop", maxBudget: 800_000, prefer: ["travel"], forWhom: "me" }, opts)) as { ok: boolean; products: { id: string; name: string; why: string[] }[] };
    expect(res.ok).toBe(true);
    expect(res.products[0]!.why.join(" ")).toMatch(/Within ₦800,000/);
    const t2 = await turn(market, c, "Tell me more about the second one", t1.conversation.id);
    expect(t2.prepared.system).toContain("<nia_session>");
    expect(t2.prepared.system).toContain(`R2: ${res.products[1]!.name}`);
    expect(t2.prepared.system).toContain(res.products[1]!.id);
    expect(t2.prepared.system).toMatch(/Current goal \(this conversation only\): .*budget up to 800000/);
  });

  it("only saves products Nia actually showed in this conversation", async () => {
    const c = await shopper(market);
    const t1 = await turn(market, c, "orange juice please");
    const res = (await t1.market.searchMarket.execute!({ query: "orange juice" }, opts)) as { products: { id: string }[] };
    const other = await db.select({ id: products.id }).from(products).where(eq(products.slug, "tusk-g16-gaming-laptop"));
    const t2 = await turn(market, c, "save that one", t1.conversation.id);
    expect(await t2.market.saveForLater.execute!({ productIds: [other[0]!.id] }, opts)).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(await t2.market.saveForLater.execute!({ productIds: [res.products[0]!.id] }, opts)).toMatchObject({ ok: true, saved: ["100% Orange Juice"] });
    // Another conversation (another shopper) never sees it.
    const stranger = await shopper(market, "Ada");
    const t3 = await turn(market, stranger, "save these");
    expect(t3.prepared.system).not.toContain("100% Orange Juice");
  });

  it("offers the earlier shortlist only when the shopper asks to continue", async () => {
    const c = await shopper(market);
    const t1 = await turn(market, c, "laptops under 800k");
    const res = (await t1.market.searchMarket.execute!({ query: "laptop", maxBudget: 800_000 }, opts)) as { products: { id: string; name: string }[] };
    await t1.market.saveForLater.execute!({ productIds: [res.products[0]!.id, res.products[1]!.id] }, opts);

    const fresh = await turn(market, c, "Hi Nia");
    expect(fresh.prepared.system).not.toContain(res.products[0]!.name);
    const resume = await turn(market, c, "Let's continue with those laptops again");
    expect(resume.prepared.system).toMatch(/<nia_session from="\d+ \w+">/);
    expect(resume.prepared.system).toContain(res.products[0]!.name);
  });
});

describe("baskets", () => {
  it("proposes a cross-shop basket in the session and keeps unchanged slots when one gets cheaper", async () => {
    const c = await shopper(market);
    const t1 = await turn(market, c, "I'm having eight friends over tonight. Get drinks, snacks and a cake. Budget ₦50,000.");
    expect(t1.prepared.activeTools).toContain("planBasket");
    const slots = [
      { label: "Drinks", query: "juice", quantity: 4 },
      { label: "Snacks", query: "puff puff", quantity: 2 },
      { label: "Cake", query: "cake", quantity: 1 },
    ];
    const first = (await t1.market.planBasket.execute!({ goal: "Eight friends tonight", budget: 50_000, people: 8, slots }, opts)) as { ok: boolean; lines: { slot: string; productId: string; unitPrice: number }[]; total: number; totalLabel: string; remainingLabel: string };
    expect(first.ok).toBe(true);
    expect(first.total).toBeLessThanOrEqual(50_000 * 100);
    expect(first.totalLabel).toMatch(/^₦/);
    expect(first.remainingLabel).toMatch(/^₦/);

    const t2 = await turn(market, c, "Make the cake cheaper", t1.conversation.id);
    expect(t2.prepared.activeTools).toContain("planBasket");
    expect(t2.prepared.system).toContain('Proposed basket "Eight friends tonight"');
    const second = (await t2.market.planBasket.execute!({ goal: "Eight friends tonight", budget: 50_000, slots, cheaper: ["Cake"] }, opts)) as typeof first;
    const line = (p: typeof first, s: string) => p.lines.find((l) => l.slot === s)!;
    expect(line(second, "Drinks").productId).toBe(line(first, "Drinks").productId);
    expect(line(second, "Snacks").productId).toBe(line(first, "Snacks").productId);
    expect(line(second, "Cake").unitPrice).toBeLessThan(line(first, "Cake").unitPrice);
  });
});

describe("what do you remember about me?", () => {
  it("is offered for the question, needs sign-in, and shows only this customer's Walrus-stored memories", async () => {
    const shop = shops.get("designers")!;
    const guest = await turn(shop, null, "What do you remember about me?");
    expect(guest.prepared.activeTools).not.toContain("showMyMemory");
    expect(await guest.shop.showMyMemory.execute!({}, opts)).toMatchObject({ ok: false, code: "SIGN_IN_REQUIRED" });

    const amara = await shopper(shop, "Amara");
    setModelOverrides({
      extraction: jsonModel({
        candidates: [
          { type: "SIZE_OR_VARIANT", subject: "clothing_size", value: "Medium", statement: "Customer normally wears size Medium.", label: "Size: Medium", evidence: "I normally wear Medium", explicit: true, confidence: 0.95, importance: 0.8, futureUsefulness: 0.9, durability: "long_term", temporalScope: "current", isCorrection: false, previousValue: null },
        ],
      }),
    });
    const said = await turn(shop, amara, "I normally wear Medium and prefer darker colours.");
    const after = await extractAndRemember(said.ctx, said.prepared, { assistantText: "Noted.", userMessageId: said.saved.id });
    await awaitDurable(db, store, after.outcomes.map((o) => o.receipt!.recordId!), { timeoutMs: 5000 });

    const ask = await turn(shop, amara, "What do you remember about me?");
    expect(ask.prepared.activeTools).toContain("showMyMemory");
    const card = (await ask.shop.showMyMemory.execute!({}, opts)) as { ok: boolean; sections: { items: { label: string; certainty: string; blobId: string | null }[] }[]; memories: { text: string }[] };
    expect(card.ok).toBe(true);
    const items = card.sections.flatMap((s) => s.items);
    expect(items).toEqual([expect.objectContaining({ label: "Size: Medium", certainty: "Confirmed" })]);
    expect(items[0]!.blobId).toBeTruthy();
    // The model gets Walrus-recalled text, not UI labels.
    expect(card.memories.map((m) => m.text).join(" ")).toMatch(/Medium/);

    const other = await shopper(shop, "Bisi");
    const theirs = (await (await turn(shop, other, "What do you remember about me?")).shop.showMyMemory.execute!({}, opts)) as { count: number };
    expect(theirs.count).toBe(0);
  });
});

describe("substitutions and repeat services", () => {
  it("an out-of-stock add comes back with real alternatives", async () => {
    const shop = shops.get("gadgets")!;
    const [phone] = await db.select().from(products).where(and(eq(products.merchantId, shop.id), eq(products.slug, "arc-a15-smartphone")));
    const [v] = await db.select().from(productVariants).where(and(eq(productVariants.productId, phone!.id), eq(productVariants.name, "128 GB / Black")));
    await db.update(productVariants).set({ inventoryStatus: "out_of_stock" }).where(eq(productVariants.id, v!.id));
    const c = await shopper(shop);
    const t = await turn(shop, c, "add the black 128 GB one");
    const res = (await t.shop.addItemToDraft.execute!({ productId: phone!.id, variantId: v!.id, quantity: 1 }, opts)) as { ok: boolean; error: string; alternatives: { variantName: string; reason: string }[] };
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/out of stock/);
    expect(res.alternatives[0]).toMatchObject({ variantName: "128 GB / Ocean Blue" });
    expect(res.alternatives[0]!.reason).toMatch(/^Same item in Ocean Blue/);
  });

  it("'book the same as last time' resolves the real previous booking", async () => {
    const shop = shops.get("beauty")!;
    const c = await shopper(shop);
    const [svc] = await db.select().from(services).where(eq(services.merchantId, shop.id)).limit(1);
    const { slots } = await getAvailableBookingSlots(db, { merchantId: shop.id, serviceId: svc!.id, query: { limit: 1 } });
    const draft = await createBookingDraft(db, { merchantId: shop.id, customerId: c.id, serviceId: svc!.id, startAt: slots[0]!.startAt, channel: "web" });
    await confirmBookingRequest(db, { merchantId: shop.id, customerId: c.id, bookingId: draft.id });
    await transitionBooking(db, { merchantId: shop.id, bookingId: draft.id, to: "confirmed", actor: { type: "merchant" } });
    const t = await turn(shop, c, "Book the same as last time");
    const res = (await t.shop.getCustomerRecentOrders.execute!({}, opts)) as { repeatBooking: { status: string; serviceId: string } };
    expect(res.repeatBooking).toMatchObject({ status: "single", serviceId: svc!.id });
  });

  it("a reorder with an unavailable item offers alternatives instead of a silent swap", async () => {
    const shop = shops.get("drinks")!;
    const c = await shopper(shop);
    const [juice] = await db.select().from(products).where(and(eq(products.merchantId, shop.id), eq(products.slug, "pineapple-juice")));
    const [oneLitre] = await db.select().from(productVariants).where(and(eq(productVariants.productId, juice!.id), eq(productVariants.name, "1 L")));
    await addItemToDraft(db, { merchantId: shop.id, customerId: c.id, productId: juice!.id, variantId: oneLitre!.id, quantity: 2, channel: "web" });
    await setDraftFulfillment(db, { merchantId: shop.id, customerId: c.id, method: "pickup", channel: "web" });
    const order = await submitDraft(db, { merchantId: shop.id, customerId: c.id });
    await db.update(productVariants).set({ inventoryStatus: "out_of_stock" }).where(eq(productVariants.id, oneLitre!.id));
    const t = await turn(shop, c, "Same as last time please");
    const res = (await t.shop.createDraftOrder.execute!({ fromOrderId: order.id }, opts)) as { ok: boolean; unavailable: string[]; alternatives: { for: string; options: { name: string }[] }[] };
    expect(res.ok).toBe(true);
    expect(res.unavailable[0]).toMatch(/Pineapple Juice/);
    expect(res.alternatives[0]!.for).toMatch(/Pineapple Juice/);
    expect(res.alternatives[0]!.options.length).toBeGreaterThan(0);
  });
});
