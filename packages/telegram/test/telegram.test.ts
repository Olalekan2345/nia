import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { applyDemoTemplate, merchants, messages, orders, productVariants, products, sessions, telegramIdentities, type Database, type Merchant } from "@nia/database";
import { setupTestDb, createMerchant, createUser } from "@nia/database/testing";
import { resetEnvCache } from "@nia/config";
import type { MemoryStore } from "@nia/memory";
import { createMockStore } from "@nia/memory/testing";
import {
  addItemToDraft,
  completeTelegramLogin,
  createTelegramLinkToken,
  createTelegramLoginRequest,
  resolveTelegramCustomer,
  resolveWebCustomer,
  setDraftFulfillment,
  telegramAccountUser,
} from "@nia/commerce";
import { createConversation, saveAssistantMessage, saveUserMessage, setModelOverrides } from "@nia/ai";
import { sha256Hex } from "@nia/shared/server";
import { claimUpdate, processUpdate, toTelegramHtml, verifyWebhookSecret, type Bot, type TelegramDeps, type TgUpdate } from "../src";
import { jsonModel, scriptedModel } from "../../ai/test/mock-model";

let db: Database;
let close: () => Promise<void>;
let store: MemoryStore;
let shop: Merchant;
let sent: { method: string; args: unknown[] }[];
let updateId = 1000;

function fakeBot(): Bot {
  const record =
    (method: string) =>
    async (...args: unknown[]) => {
      sent.push({ method, args });
      return { message_id: sent.length, chat: { id: 1, type: "private" }, date: 0 } as never;
    };
  return new Proxy({} as Bot, { get: (_t, prop: string) => record(prop) });
}

function deps(): TelegramDeps {
  return { db, store, bot: fakeBot(), appUrl: "https://nia.example", durableWaitMs: 3000 };
}

const tgUser = (id: number) => ({ id, is_bot: false, first_name: "Amara", username: `amara${id}` });

function textUpdate(userId: number, text: string): TgUpdate {
  return { update_id: updateId++, message: { message_id: updateId, from: tgUser(userId), chat: { id: userId, type: "private" }, date: 0, text } };
}

function callbackUpdate(userId: number, data: string): TgUpdate {
  return { update_id: updateId++, callback_query: { id: `cb${updateId}`, from: tgUser(userId), data, message: { message_id: 5, chat: { id: userId, type: "private" }, date: 0 } } };
}

/** Messages the user sees, including later edits (memory receipts are edited in place). */
const texts = () => sent.filter((s) => s.method === "sendMessage" || s.method === "editMessageText").map((s) => String(s.method === "sendMessage" ? s.args[1] : s.args[2]));

beforeAll(async () => {
  resetEnvCache();
  ({ db, close } = await setupTestDb());
  shop = await createMerchant(db, { name: "Adire Lane", slug: "adire-lane-tg", timezone: "Africa/Lagos", isDemo: true });
  await applyDemoTemplate(db, shop.id, "fabric");
});
afterAll(async () => {
  setModelOverrides(undefined);
  await close();
});
beforeEach(() => {
  sent = [];
  store = createMockStore();
});

describe("webhook guards", () => {
  it("verifies the secret token in constant time", () => {
    expect(verifyWebhookSecret("s3cret", "s3cret")).toBe(true);
    expect(verifyWebhookSecret("wrong", "s3cret")).toBe(false);
    expect(verifyWebhookSecret(null, "s3cret")).toBe(false);
    expect(verifyWebhookSecret("s3cret", undefined)).toBe(false);
  });

  it("deduplicates retried updates by update_id", async () => {
    expect(await claimUpdate(db, 424242)).toBe(true);
    expect(await claimUpdate(db, 424242)).toBe(false);
  });
});

describe("rendering", () => {
  it("escapes HTML and keeps only bold", () => {
    expect(toTelegramHtml("**Emerald** <script>alert(1)</script> & co")).toBe("<b>Emerald</b> &lt;script&gt;alert(1)&lt;/script&gt; &amp; co");
  });
});

describe("conversation flow", () => {
  it("shows a shop chooser, then welcomes with native buttons", async () => {
    await processUpdate(deps(), textUpdate(5001, "hello"));
    expect(texts()[0]).toMatch(/Which shop/);
    sent = [];
    await processUpdate(deps(), textUpdate(5001, `/start s_${shop.slug}`));
    expect(texts()[0]).toMatch(/I'm Nia/);
    const keyboard = JSON.stringify(sent[0]!.args[2]);
    expect(keyboard).toContain("Browse products");
    expect(keyboard).toContain("Link account");
  });

  it("runs an AI turn with product cards and a truthful memory receipt", async () => {
    setModelOverrides({
      chat: scriptedModel([{ toolCalls: [{ name: "searchProducts", input: { query: "ankara" } }] }, { text: "Here are our **Ankara** prints." }]),
      extraction: jsonModel({
        candidates: [
          {
            type: "SIZE_OR_VARIANT",
            subject: "clothing_size",
            value: "Medium",
            statement: "Customer normally buys size Medium.",
            label: "Size: Medium",
            evidence: "I normally buy Medium",
            explicit: true,
            confidence: 0.95,
            importance: 0.8,
            futureUsefulness: 0.9,
            durability: "long_term",
            temporalScope: "current",
            isCorrection: false,
            previousValue: null,
          },
        ],
      }),
    });
    await processUpdate(deps(), textUpdate(5002, `/start s_${shop.slug}`));
    sent = [];
    await processUpdate(deps(), textUpdate(5002, "Show me ankara — I normally buy Medium"));
    const all = texts();
    expect(all[0]).toContain("<b>Ankara</b>");
    expect(all.some((t) => t.includes("Classic Ankara Wax Print"))).toBe(true);
    // Honest receipt: "saving" is sent first, then that same message is edited once storage confirms.
    const savingAt = sent.findIndex((x) => x.method === "sendMessage" && String(x.args[1]).includes("Saving to memory"));
    const editAt = sent.findIndex((x) => x.method === "editMessageText" && String(x.args[2]).includes("I'll remember that"));
    expect(savingAt).toBeGreaterThanOrEqual(0);
    expect(editAt).toBeGreaterThan(savingAt);
    const receipt = all.find((t) => t.includes("I'll remember that"));
    expect(receipt).toContain("Size: Medium");
    expect(receipt).not.toContain("Walrus"); // never claims Walrus when the store isn't Walrus
    expect(sent.some((s) => s.method === "sendChatAction")).toBe(true);
  });

  it("links a web account via deep link and places an order from an inline button", async () => {
    const user = await createUser(db);
    const web = await resolveWebCustomer(db, { merchantId: shop.id, userId: user.id, email: user.email });
    const { token } = await createTelegramLinkToken(db, { merchantId: shop.id, customerId: web.id });
    await processUpdate(deps(), textUpdate(5003, `/start ${token}`));
    expect(texts()[0]).toMatch(/Linked/);
    const [identity] = await db.select().from(telegramIdentities).where(eq(telegramIdentities.telegramUserId, 5003));
    expect(identity!.activeMerchantId).toBe(shop.id);
    expect((await resolveTelegramCustomer(db, shop.id, { telegramUserId: 5003, displayName: null, username: null })).id).toBe(web.id);

    // Replay of the same deep link fails.
    sent = [];
    await processUpdate(deps(), textUpdate(5003, `/start ${token}`));
    expect(texts()[0]).toMatch(/already used/);

    // Cart built on the web, confirmed from Telegram.
    const [p] = await db.select().from(products).where(and(eq(products.merchantId, shop.id), eq(products.slug, "classic-ankara-wax-print")));
    const [v] = await db.select().from(productVariants).where(and(eq(productVariants.productId, p!.id), eq(productVariants.name, "Emerald")));
    const cart = await addItemToDraft(db, { merchantId: shop.id, customerId: web.id, productId: p!.id, variantId: v!.id, quantity: 6, channel: "web" });
    await setDraftFulfillment(db, { merchantId: shop.id, customerId: web.id, method: "delivery", deliveryArea: "Lekki", channel: "web" });
    sent = [];
    await processUpdate(deps(), callbackUpdate(5003, `oc:${cart.id}`));
    const [order] = await db.select().from(orders).where(eq(orders.id, cart.id));
    expect(order!.status).toBe("awaiting_confirmation");
    expect(texts().some((t) => t.includes("Order placed"))).toBe(true);
    expect(texts().some((t) => t.includes("Added to your order history"))).toBe(true);

    // Another Telegram user cannot confirm someone else's order.
    sent = [];
    await processUpdate(deps(), textUpdate(5004, `/start s_${shop.slug}`));
    sent = [];
    await processUpdate(deps(), callbackUpdate(5004, `oc:${cart.id}`));
    expect(texts().join(" ")).toMatch(/no cart|not found/i);
  });

  it("answers 'last order' with repeat buttons", async () => {
    await processUpdate(deps(), textUpdate(5003, "/last"));
    const last = sent.find((s) => s.method === "sendMessage")!;
    expect(String(last.args[1])).toContain("Classic Ankara Wax Print");
    const kb = JSON.stringify(last.args[2]);
    expect(kb).toContain("Same quantity");
    expect(kb).toContain("Change quantity");
    expect(kb).toContain("View similar options");
  });
});

describe("Continue with Telegram", () => {
  const buttons = (i = 0) => (sent.filter((x) => x.method === "sendMessage")[i]!.args[2] as { keyboard: { inline_keyboard: { text: string; callback_data?: string }[][] } }).keyboard.inline_keyboard.flat();

  it("signs the browser in only after the Telegram user taps the number it shows", async () => {
    const wrong = await createTelegramLoginRequest(db, { purpose: "signin", merchantId: shop.id, device: "Chrome on Windows" });
    await processUpdate(deps(), textUpdate(6001, `/start ${wrong.startToken}`));
    expect(texts()[0]).toContain("Sign in to Adire Lane on Nia");
    expect(texts()[0]).toContain("Chrome on Windows");
    const choices = buttons().filter((b) => /^\d+$/.test(b.text));
    expect(choices).toHaveLength(3);
    expect(buttons().some((b) => b.text.includes("Not me"))).toBe(true);
    const decoy = choices.find((b) => Number(b.text) !== wrong.matchNumber)!;
    sent = [];
    await processUpdate(deps(), callbackUpdate(6001, decoy.callback_data!));
    expect(texts()[0]).toMatch(/didn't match/);
    expect(await completeTelegramLogin(db, { requestId: wrong.id, browserSecret: wrong.browserSecret })).toEqual({ status: "denied" });

    const req = await createTelegramLoginRequest(db, { purpose: "signin", merchantId: shop.id });
    sent = [];
    await processUpdate(deps(), textUpdate(6001, `/start ${req.startToken}`));
    const right = buttons().find((b) => Number(b.text) === req.matchNumber)!;
    sent = [];
    await processUpdate(deps(), callbackUpdate(6001, right.callback_data!));
    expect(texts()[0]).toMatch(/Confirmed/);
    const [identity] = await db.select().from(telegramIdentities).where(eq(telegramIdentities.telegramUserId, 6001));
    expect(identity!.activeMerchantId).toBe(shop.id);
    const done = await completeTelegramLogin(db, { requestId: req.id, browserSecret: req.browserSecret });
    expect(done.status).toBe("approved");

    // The deep link can't be reused.
    sent = [];
    await processUpdate(deps(), textUpdate(6001, `/start ${req.startToken}`));
    expect(texts()[0]).toMatch(/expired or was already used/);
  });

  it("continues the customer's web conversation in Telegram, and only their own", async () => {
    const account = await telegramAccountUser(db, { telegramUserId: 6002, displayName: "Amara", username: "amara6002" });
    const web = await resolveWebCustomer(db, { merchantId: shop.id, userId: account.id, name: account.name, telegramUserId: account.telegramUserId, telegramUsername: account.telegramUsername });
    const conv = await createConversation(db, { merchantId: shop.id, customerId: web.id, channel: "web" });
    await saveUserMessage(db, { conversation: conv, text: "Do you have navy Ankara?", channel: "web" });
    await saveAssistantMessage(db, { conversation: conv, text: "Yes — Classic Ankara comes in Navy.", parts: [], memoryUsed: [], channel: "web" });

    await processUpdate(deps(), textUpdate(6002, `/start c_${conv.id}`));
    expect(texts()[0]).toContain("Picking up your Adire Lane chat");
    expect(texts()[0]).toContain("navy Ankara");
    const [identity] = await db.select().from(telegramIdentities).where(eq(telegramIdentities.telegramUserId, 6002));
    expect(identity!.activeConversationId).toBe(conv.id);

    setModelOverrides({ chat: scriptedModel([{ text: "Six yards of Navy it is." }]), extraction: jsonModel({ candidates: [] }) });
    sent = [];
    await processUpdate(deps(), textUpdate(6002, "Great, 6 yards please"));
    const rows = await db.select().from(messages).where(eq(messages.conversationId, conv.id));
    expect(rows.map((r) => r.channel)).toEqual(expect.arrayContaining(["web", "telegram"]));
    expect(rows).toHaveLength(4);

    // Someone else's Telegram can't open that conversation.
    sent = [];
    await processUpdate(deps(), textUpdate(6003, `/start c_${conv.id}`));
    expect(texts()[0]).toMatch(/only continue chats from your own account/);
  });

  it("signs the account out of every browser with /logout", async () => {
    const account = await telegramAccountUser(db, { telegramUserId: 6004, displayName: "Tunde", username: null });
    const expiresAt = new Date(Date.now() + 86400_000);
    await db.insert(sessions).values([
      { tokenHash: sha256Hex("tg-logout-a"), userId: account.id, expiresAt, method: "telegram" },
      { tokenHash: sha256Hex("tg-logout-b"), userId: account.id, expiresAt },
    ]);
    await processUpdate(deps(), textUpdate(6004, "/logout"));
    expect(texts()[0]).toMatch(/Signed out of Nia in 2 browsers/);
    expect(await db.select().from(sessions).where(eq(sessions.userId, account.id))).toHaveLength(0);

    sent = [];
    await processUpdate(deps(), textUpdate(6005, "/logout"));
    expect(texts()[0]).toMatch(/isn't connected/);
  });
});

describe("Walrus Market on Telegram", () => {
  let market: Merchant;
  const juiceShop = { slug: "walrus-drinks-tg" };
  const cakeShop = { slug: "crumb-tg" };

  beforeAll(async () => {
    market = await createMerchant(db, { name: "Walrus Market", slug: "market-tg", kind: "market", businessType: "other", telegramEnabled: false });
    const drinks = await createMerchant(db, { name: "Walrus Drinks", slug: juiceShop.slug, businessType: "drinks", isDemo: true });
    await applyDemoTemplate(db, drinks.id, "drinks");
    const bakery = await createMerchant(db, { name: "Crumb & Co.", slug: cakeShop.slug, businessType: "bakery", isDemo: true });
    await applyDemoTemplate(db, bakery.id, "bakery");
  });

  it("offers the market in the chooser and shops across every shop, with links to each shop", async () => {
    await processUpdate(deps(), textUpdate(7101, "hi"));
    expect(JSON.stringify(sent.find((x) => String(x.args[1]).includes("Which shop"))!.args[2])).toContain("Walrus Market");
    sent = [];
    await processUpdate(deps(), callbackUpdate(7101, `s:${market.slug}`));
    expect(texts()[0]).toMatch(/Walrus Market shopping guide/);
    sent = [];
    setModelOverrides({ chat: scriptedModel([{ toolCalls: [{ name: "searchMarket", input: { query: "orange juice" } }] }, { text: "Here's the orange juice." }]) });
    await processUpdate(deps(), textUpdate(7101, "orange juice please"));
    const card = sent.find((s) => (s.method === "sendMessage" || s.method === "sendPhoto") && JSON.stringify(s.args).includes("100% Orange Juice"));
    expect(card).toBeTruthy();
    expect(JSON.stringify(card!.args)).toContain(`https://nia.example/s/${juiceShop.slug}/shop/orange-juice`);
  });

  it("turns a tapped decision option into the shopper's answer", async () => {
    setModelOverrides({ chat: scriptedModel([{ toolCalls: [{ name: "askDecision", input: { question: "Who is it for?", options: ["My mum", "A friend"], topic: "Recipient" } }] }, { text: "Happy to help!" }]) });
    await processUpdate(deps(), textUpdate(7102, `/start s_${market.slug}`));
    sent = [];
    await processUpdate(deps(), textUpdate(7102, "I need a gift"));
    expect(JSON.stringify(sent.map((s) => s.args))).toContain('"callback_data":"ad:0"');
    sent = [];
    setModelOverrides({ chat: scriptedModel([{ text: "Lovely — for your mum." }]) });
    await processUpdate(deps(), callbackUpdate(7102, "ad:0"));
    const [identity] = await db.select().from(telegramIdentities).where(eq(telegramIdentities.telegramUserId, 7102));
    const saved = await db.select().from(messages).where(and(eq(messages.conversationId, identity!.activeConversationId!), eq(messages.role, "user")));
    expect(saved.map((m) => m.content)).toContain("My mum");
  });

  it("adds a proposed basket to each shop's cart, then confirmation happens in that shop", async () => {
    setModelOverrides({
      chat: scriptedModel([
        { toolCalls: [{ name: "planBasket", input: { goal: "Movie night", budget: 60_000, slots: [{ label: "Drinks", query: "juice", quantity: 2 }, { label: "Cake", query: "cake", quantity: 1 }] } }] },
        { text: "Here's a basket for movie night." },
      ]),
    });
    await processUpdate(deps(), textUpdate(7103, `/start s_${market.slug}`));
    sent = [];
    await processUpdate(deps(), textUpdate(7103, "Movie night for 4 under ₦60,000 — drinks and a cake"));
    const basket = sent.find((s) => String(s.args[1]).includes("Movie night") && JSON.stringify(s.args).includes('"callback_data":"pb"'));
    expect(basket).toBeTruthy();
    expect(String(basket!.args[1])).toMatch(/Total: ₦/);

    sent = [];
    await processUpdate(deps(), callbackUpdate(7103, "pb"));
    expect(texts().join("\n")).toMatch(/Added to your carts/);
    const kb = JSON.stringify(sent.map((s) => s.args));
    expect(kb).toContain(`cs:${juiceShop.slug}`);
    expect(kb).toContain(`cs:${cakeShop.slug}`);
    // Nothing was ordered: each shop holds a draft cart for this Telegram customer.
    for (const slug of [juiceShop.slug, cakeShop.slug]) {
      const [m] = await db.select().from(merchants).where(eq(merchants.slug, slug));
      const customer = await resolveTelegramCustomer(db, m!.id, { telegramUserId: 7103, displayName: "Amara", username: "amara7103" });
      const carts = await db.select().from(orders).where(and(eq(orders.merchantId, m!.id), eq(orders.customerId, customer.id)));
      expect(carts.map((o) => o.status)).toEqual(["draft"]);
    }

    sent = [];
    await processUpdate(deps(), callbackUpdate(7103, `cs:${cakeShop.slug}`));
    expect(texts()[0]).toMatch(/Your cart · Crumb &amp; Co\./);
  });
});

describe("moving between shops and the market on Telegram", () => {
  const activeSlug = async (userId: number) => {
    const [identity] = await db.select().from(telegramIdentities).where(eq(telegramIdentities.telegramUserId, userId));
    const [m] = identity?.activeMerchantId ? await db.select().from(merchants).where(eq(merchants.id, identity.activeMerchantId)) : [];
    return m?.slug ?? null;
  };

  it("goes back to the market and to another shop in plain words, keeping the rest of the request", async () => {
    await processUpdate(deps(), textUpdate(7201, "/start s_walrus-drinks-tg"));
    expect(await activeSlug(7201)).toBe("walrus-drinks-tg");
    sent = [];
    await processUpdate(deps(), textUpdate(7201, "take me back to the market"));
    expect(await activeSlug(7201)).toBe("market-tg");
    expect(texts()[0]).toMatch(/Walrus Market shopping guide/);

    sent = [];
    setModelOverrides({ chat: scriptedModel([{ text: "Here are our cakes." }]) });
    await processUpdate(deps(), textUpdate(7201, "switch to Crumb & Co. and show me cakes"));
    expect(await activeSlug(7201)).toBe("crumb-tg");
    expect(texts()[0]).toMatch(/now chatting with <b>Crumb &amp; Co\.<\/b>/);
    expect(texts().join("\n")).toContain("Here are our cakes.");
    // The request after "and" was answered in the new shop.
    const [identity] = await db.select().from(telegramIdentities).where(eq(telegramIdentities.telegramUserId, 7201));
    const asked = await db.select().from(messages).where(and(eq(messages.conversationId, identity!.activeConversationId!), eq(messages.role, "user")));
    expect(asked.map((m) => m.content)).toContain("show me cakes");
  });

  it("has /market and /shops commands and navigation buttons in every shop", async () => {
    await processUpdate(deps(), textUpdate(7202, "/start s_crumb-tg"));
    expect(JSON.stringify(sent.map((s) => s.args))).toContain('"callback_data":"a:market"');
    sent = [];
    await processUpdate(deps(), textUpdate(7202, "/market"));
    expect(await activeSlug(7202)).toBe("market-tg");
    sent = [];
    await processUpdate(deps(), textUpdate(7202, "/shops"));
    expect(texts()[0]).toMatch(/Which shop/);
  });

  it("offers the whole market when a shop has nothing, and asks the same question there", async () => {
    await processUpdate(deps(), textUpdate(7203, "/start s_crumb-tg"));
    sent = [];
    setModelOverrides({ chat: scriptedModel([{ toolCalls: [{ name: "searchProducts", input: { query: "laptop" } }] }, { text: "We only sell baked goods, sorry." }]) });
    await processUpdate(deps(), textUpdate(7203, "Do you have a laptop?"));
    expect(JSON.stringify(sent.map((s) => s.args))).toContain('"callback_data":"mk"');
    sent = [];
    setModelOverrides({ chat: scriptedModel([{ text: "Across the market I found laptops at Walrus Gadgets." }]) });
    await processUpdate(deps(), callbackUpdate(7203, "mk"));
    expect(await activeSlug(7203)).toBe("market-tg");
    expect(texts().join("\n")).toContain("Across the market");
  });
});
