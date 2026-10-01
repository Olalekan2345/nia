import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { applyDemoShopPolicies, applyDemoTemplate, conversations, merchants, productVariants, products, services, type Database, type Merchant } from "@nia/database";
import { createMerchant, createUser, setupTestDb } from "@nia/database/testing";
import { resetEnvCache } from "@nia/config";
import { awaitDurable, recallCustomerMemory, type MemoryStore } from "@nia/memory";
import { createMockStore } from "@nia/memory/testing";
import { addItemToDraft, availableSlots, createBookingDraft, resolveWebCustomer, setDraftFulfillment } from "@nia/commerce";
import { buildSystemPrompt, confirmCustomerBooking, confirmCustomerOrder, createConversation, prepareTurn, type MarketTools } from "../src";
import { modelOutput } from "../src/model-output";

// Demo shops settle at once and save the order — with what was decided — to Walrus at checkout.

let db: Database;
let close: () => Promise<void>;
let store: MemoryStore;
let market: Merchant;
let shop: Merchant;
const opts = { toolCallId: "t", messages: [], context: {} as never };

beforeAll(async () => {
  resetEnvCache();
  ({ db, close } = await setupTestDb());
  store = createMockStore();
  market = await createMerchant(db, { name: "Walrus Market", slug: "market", kind: "market", businessType: "other" });
  const m = await createMerchant(db, { name: "Adire Lane", slug: "adire-lane", businessType: "fabric", timezone: "Africa/Lagos", isDemo: true });
  await applyDemoTemplate(db, m.id, "fabric");
  await applyDemoShopPolicies(db, m.id);
  [shop] = (await db.select().from(merchants).where(eq(merchants.id, m.id))) as [Merchant];
});
afterAll(async () => close());

async function account() {
  const user = await createUser(db);
  const at = (merchant: Merchant) => resolveWebCustomer(db, { merchantId: merchant.id, userId: user.id, email: user.email, name: "Tolu" });
  return { user, customer: await at(shop), marketCustomer: await at(market) };
}

async function emerald() {
  const [p] = await db.select().from(products).where(and(eq(products.merchantId, shop.id), eq(products.slug, "classic-ankara-wax-print")));
  const [v] = await db.select().from(productVariants).where(and(eq(productVariants.productId, p!.id), eq(productVariants.name, "Emerald")));
  return { productId: p!.id, variantId: v!.id };
}

async function orderMemory(customerId: string, recordId: string) {
  await awaitDurable(db, store, [recordId], { timeoutMs: 5000 });
  const found = await recallCustomerMemory(db, store, { merchantId: shop.id, customerId, query: "order paid delivery", maxDistance: 0.999 });
  return found.find((f) => f.record?.id === recordId)?.text ?? "";
}

describe("demo checkout", () => {
  it("pays at once, sends the order out, and saves it to Walrus with the decisions from the chat", async () => {
    const { customer } = await account();
    const conversation = await createConversation(db, { merchantId: shop.id, customerId: customer.id, channel: "web" });
    await db.update(conversations).set({ session: { intent: { recipient: "my sister", occasion: "birthday", budgetMax: 50_000, excluded: ["red"] } } }).where(eq(conversations.id, conversation.id));
    await addItemToDraft(db, { merchantId: shop.id, customerId: customer.id, ...(await emerald()), quantity: 6, channel: "web", conversationId: conversation.id });
    await setDraftFulfillment(db, { merchantId: shop.id, customerId: customer.id, method: "delivery", deliveryArea: "Lekki", channel: "web" });

    const placed = await confirmCustomerOrder({ db, store, merchant: shop, customer, channel: "web" });
    expect(placed.summary.status).toBe("dispatched");
    expect(placed.summary.paymentStatus).toBe("paid");
    expect(placed.payment?.mode).toBe("demo");
    expect(placed.payment?.instructions).toMatch(/no real money moves/);
    // Saved at checkout — not when the order is delivered.
    expect(placed.receipt?.type).toBe("PAST_ORDER");
    const text = await orderMemory(customer.id, placed.receipt!.recordId!);
    // Same-day area: "today", or the next day when paid late in the evening.
    expect(text).toMatch(/Paid with a simulated demo payment; sent out for delivery to Lekki, expected (today|by \w{3} \d{1,2} \w{3})\./);
    expect(text).toContain("Shopping decisions: for my sister; occasion: birthday; budget up to ₦50,000; avoided red.");
  });

  it("links an order to the basket planned with the Walrus Market guide", async () => {
    const { customer, marketCustomer } = await account();
    const item = await emerald();
    const chat = await createConversation(db, { merchantId: market.id, customerId: marketCustomer.id, channel: "web" });
    await db
      .update(conversations)
      .set({ session: { basket: { goal: "Owambe outfit", budget: 80_000, people: 1, slots: [], lines: [{ slot: "Fabric", productId: item.productId, variantId: item.variantId, quantity: 6 }], total: 0, currency: "NGN" } } })
      .where(eq(conversations.id, chat.id));
    await addItemToDraft(db, { merchantId: shop.id, customerId: customer.id, ...item, quantity: 6, channel: "web" });
    await setDraftFulfillment(db, { merchantId: shop.id, customerId: customer.id, method: "pickup", channel: "web" });

    const placed = await confirmCustomerOrder({ db, store, merchant: shop, customer, channel: "web" });
    expect(placed.summary.status).toBe("ready");
    const text = await orderMemory(customer.id, placed.receipt!.recordId!);
    expect(text).toMatch(/ready for pickup at Studio pickup/);
    expect(text).toContain('Shopping decisions: goal "Owambe outfit"; 1 people; budget up to ₦80,000.');
  });

  it("confirms a demo booking straight away and remembers it", async () => {
    const { customer } = await account();
    const [service] = await db.select().from(services).where(and(eq(services.merchantId, shop.id), eq(services.slug, "measurement-style-consultation")));
    const [slot] = await availableSlots(db, service!, "Africa/Lagos", { limit: 1 });
    const draft = await createBookingDraft(db, { merchantId: shop.id, customerId: customer.id, serviceId: service!.id, startAt: slot!.startAt, channel: "web" });
    const { booking, receipt } = await confirmCustomerBooking({ db, store, merchant: shop, customer, channel: "web" }, draft.id);
    expect(booking.status).toBe("confirmed");
    await awaitDurable(db, store, [receipt!.recordId!], { timeoutMs: 5000 });
    const found = await recallCustomerMemory(db, store, { merchantId: shop.id, customerId: customer.id, query: "booked consultation", maxDistance: 0.999 });
    expect(found.find((f) => f.record?.id === receipt!.recordId)?.text).toContain("The shop confirmed it straight away.");
  });

  it("tells Nia the payment is simulated in a demo shop (and never in a real one)", () => {
    const at = (merchant: Merchant) => buildSystemPrompt({ merchant, channel: "web", now: new Date(), customer: null, memoryMode: "on", memoryConfigured: true });
    expect(at(shop)).toContain("Demo shop: payment is simulated");
    expect(at(shop)).not.toContain(shop.paymentInstructions ?? "—");
    expect(at({ ...shop, isDemo: false })).toContain("Nia never takes card details or marks anything paid");
  });

  it("answers 'where is my order?' in the market chat from the account's real orders and the shop's policy", async () => {
    const { customer, marketCustomer } = await account();
    await addItemToDraft(db, { merchantId: shop.id, customerId: customer.id, ...(await emerald()), quantity: 6, channel: "web" });
    await setDraftFulfillment(db, { merchantId: shop.id, customerId: customer.id, method: "delivery", deliveryArea: "Yaba", channel: "web" });
    const placed = await confirmCustomerOrder({ db, store, merchant: shop, customer, channel: "web" });

    const conversation = await createConversation(db, { merchantId: market.id, customerId: marketCustomer.id, channel: "web" });
    const text = "My delivery hasn't arrived yet";
    const turn = await prepareTurn({ db, store, merchant: market, customer: marketCustomer, conversation, channel: "web" }, text);
    expect(turn.activeTools).toContain("getMyOrders");
    const res = (await (turn.tools as unknown as MarketTools).getMyOrders.execute!({}, opts)) as { ok: boolean; orders: { id: string }[] };
    expect(res.orders.map((o) => o.id)).toEqual([placed.summary.id]);
    const seen = modelOutput("getMyOrders", res) as { orders: Record<string, unknown>[] };
    expect(seen.orders[0]).toMatchObject({ shop: "Adire Lane", status: "dispatched", paid: "yes (demo payment)" });
    expect(String(seen.orders[0]!.progress)).toMatch(/^On its way to Yaba — Expected by /);
    expect(String(seen.orders[0]!.deliveryPolicy)).toMatch(/within 24 hours of the estimated time/);

    // Any way of asking works for a signed-in shopper ("what did I buy last?" has no order words) — never for guests.
    for (const q of ["what did i buy last?", "Show me ankara fabric"]) {
      expect((await prepareTurn({ db, store, merchant: market, customer: marketCustomer, conversation, channel: "web" }, q)).activeTools).toContain("getMyOrders");
    }
    const latest = (await (turn.tools as unknown as MarketTools).getMyOrders.execute!({}, opts)) as { orders: { items: { name: string }[]; shop: { name: string } }[] };
    expect(latest.orders[0]).toMatchObject({ shop: { name: "Adire Lane" }, items: [{ name: "Classic Ankara Wax Print" }] });
    const guest = await createConversation(db, { merchantId: market.id, customerId: null, channel: "web" });
    expect((await prepareTurn({ db, store, merchant: market, customer: null, conversation: guest, channel: "web" }, text)).activeTools).not.toContain("getMyOrders");
  });
});
