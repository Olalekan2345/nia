import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { customerIdentities, customers, sessions, telegramLoginRequests, users, type Database } from "@nia/database";
import { setupTestDb, createMerchant, createCustomer, createUser } from "@nia/database/testing";
import { sha256Hex } from "@nia/shared/server";
import {
  completeTelegramLogin,
  connectTelegramToUser,
  createTelegramLoginRequest,
  decideTelegramLogin,
  disconnectTelegram,
  findLoginRequestByToken,
  numberChoices,
  resolveTelegramCustomer,
  resolveWebCustomer,
  signOutEverywhere,
  telegramAccountUser,
} from "../src";

let db: Database;
let close: () => Promise<void>;
let seq = 700_000_000;
const tgUser = (name = "Ada") => ({ telegramUserId: ++seq, displayName: name, username: `${name.toLowerCase()}${seq}` });

beforeAll(async () => {
  ({ db, close } = await setupTestDb());
});
afterAll(async () => close());

describe("Continue with Telegram", () => {
  it("approves only when the Telegram user taps the number shown in the browser", async () => {
    const tg = tgUser();
    const wrong = await createTelegramLoginRequest(db, { purpose: "signin", device: "Chrome on Windows" });
    expect(await findLoginRequestByToken(db, wrong.startToken)).toMatchObject({ id: wrong.id, status: "pending" });
    expect(await decideTelegramLogin(db, { requestId: wrong.id, tg, choice: wrong.matchNumber === 99 ? 98 : wrong.matchNumber + 1 })).toBe("wrong_number");
    expect(await completeTelegramLogin(db, { requestId: wrong.id, browserSecret: wrong.browserSecret })).toEqual({ status: "denied" });

    const req = await createTelegramLoginRequest(db, { purpose: "signin" });
    expect(await completeTelegramLogin(db, { requestId: req.id, browserSecret: req.browserSecret })).toEqual({ status: "pending" });
    expect(await decideTelegramLogin(db, { requestId: req.id, tg, choice: req.matchNumber })).toBe("approved");
    expect(await decideTelegramLogin(db, { requestId: req.id, tg, choice: req.matchNumber })).toBe("already_decided");

    // Another browser (wrong secret) can't use the approval; the right one can, once.
    expect(await completeTelegramLogin(db, { requestId: req.id, browserSecret: "someone-else" })).toEqual({ status: "invalid" });
    const done = await completeTelegramLogin(db, { requestId: req.id, browserSecret: req.browserSecret });
    expect(done.status).toBe("approved");
    if (done.status === "approved") expect(done.request.telegramUserId).toBe(tg.telegramUserId);
    expect(await completeTelegramLogin(db, { requestId: req.id, browserSecret: req.browserSecret })).toEqual({ status: "invalid" });
  });

  it("lets the Telegram user refuse, and expires unanswered requests", async () => {
    const tg = tgUser();
    const refused = await createTelegramLoginRequest(db, { purpose: "signin" });
    expect(await decideTelegramLogin(db, { requestId: refused.id, tg, choice: "deny" })).toBe("denied");

    const stale = await createTelegramLoginRequest(db, { purpose: "signin" });
    await db.update(telegramLoginRequests).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(telegramLoginRequests.id, stale.id));
    expect(await decideTelegramLogin(db, { requestId: stale.id, tg, choice: stale.matchNumber })).toBe("expired");
    expect(await completeTelegramLogin(db, { requestId: stale.id, browserSecret: stale.browserSecret })).toEqual({ status: "expired" });
  });

  it("stores only hashes and offers three distinct numbers including the right one", async () => {
    const req = await createTelegramLoginRequest(db, { purpose: "signin" });
    const [row] = await db.select().from(telegramLoginRequests).where(eq(telegramLoginRequests.id, req.id));
    expect(row!.tokenHash).toBe(sha256Hex(req.startToken));
    expect(row!.browserSecretHash).not.toContain(req.browserSecret);
    expect(req.startToken.length).toBeLessThanOrEqual(64);
    for (let i = 0; i < 20; i++) {
      const choices = numberChoices(req.matchNumber);
      expect(new Set(choices).size).toBe(3);
      expect(choices).toContain(req.matchNumber);
      for (const n of choices) expect(n >= 10 && n <= 99).toBe(true);
    }
  });
});

describe("one customer on web and Telegram", () => {
  it("adopts the customer a person already had in the bot when they sign in with Telegram", async () => {
    const shop = await createMerchant(db);
    const tg = tgUser("Bola");
    const botCustomer = await resolveTelegramCustomer(db, shop.id, tg);
    expect(botCustomer.userId).toBeNull();

    const account = await telegramAccountUser(db, tg);
    expect(account.telegramUserId).toBe(tg.telegramUserId);
    expect(account.email).toBeNull();
    const web = await resolveWebCustomer(db, { merchantId: shop.id, userId: account.id, email: account.email, name: account.name, telegramUserId: account.telegramUserId, telegramUsername: account.telegramUsername });
    expect(web.id).toBe(botCustomer.id);
    expect(web.userId).toBe(account.id);
    expect((await resolveTelegramCustomer(db, shop.id, tg)).id).toBe(botCustomer.id);
  });

  it("merges earlier bot chats into the web customer when an email account connects Telegram", async () => {
    const shop = await createMerchant(db);
    const tg = tgUser("Chi");
    const user = await createUser(db);
    const webCustomer = await resolveWebCustomer(db, { merchantId: shop.id, userId: user.id, email: user.email });
    const botCustomer = await resolveTelegramCustomer(db, shop.id, tg);
    expect(botCustomer.id).not.toBe(webCustomer.id);

    expect(await connectTelegramToUser(db, { userId: user.id, tg })).toEqual({ ok: true });
    const [me] = await db.select().from(users).where(eq(users.id, user.id));
    const again = await resolveWebCustomer(db, { merchantId: shop.id, userId: me!.id, email: me!.email, name: me!.name, telegramUserId: me!.telegramUserId, telegramUsername: me!.telegramUsername });
    expect(again.id).toBe(webCustomer.id);
    const [merged] = await db.select().from(customers).where(eq(customers.id, botCustomer.id));
    expect(merged!.mergedIntoId).toBe(webCustomer.id);
    expect((await resolveTelegramCustomer(db, shop.id, tg)).id).toBe(webCustomer.id);
  });

  it("signs a Telegram user into the web account that linked it at a shop before", async () => {
    const shop = await createMerchant(db);
    const tg = tgUser("Dayo");
    const user = await createUser(db);
    const customer = await createCustomer(db, shop.id, { userId: user.id });
    await db.insert(customerIdentities).values({ merchantId: shop.id, customerId: customer.id, provider: "TELEGRAM", subject: String(tg.telegramUserId), verifiedAt: new Date() });
    const account = await telegramAccountUser(db, tg);
    expect(account.id).toBe(user.id);
    expect(account.telegramUserId).toBe(tg.telegramUserId);
  });

  it("refuses to connect a Telegram account that belongs to another Nia account", async () => {
    const tg = tgUser("Efe");
    await telegramAccountUser(db, tg);
    const other = await createUser(db);
    expect(await connectTelegramToUser(db, { userId: other.id, tg })).toEqual({ ok: false, reason: "taken" });
  });

  it("keeps Telegram-only accounts connected, and disconnects email accounts cleanly", async () => {
    const telegramOnly = await telegramAccountUser(db, tgUser("Femi"));
    expect(await disconnectTelegram(db, telegramOnly.id)).toBe(false);

    const shop = await createMerchant(db);
    const tg = tgUser("Gbenga");
    const user = await createUser(db);
    await connectTelegramToUser(db, { userId: user.id, tg });
    const c = await resolveWebCustomer(db, { merchantId: shop.id, userId: user.id, email: user.email, telegramUserId: tg.telegramUserId });
    expect(await disconnectTelegram(db, user.id)).toBe(true);
    const ids = await db.select().from(customerIdentities).where(and(eq(customerIdentities.customerId, c.id), eq(customerIdentities.provider, "TELEGRAM")));
    expect(ids).toHaveLength(0);
    // The bot now treats that Telegram account as a stranger again.
    expect((await resolveTelegramCustomer(db, shop.id, tg)).id).not.toBe(c.id);
  });

  it("signs the account out of every browser from Telegram", async () => {
    const tg = tgUser("Halima");
    const account = await telegramAccountUser(db, tg);
    const bystander = await createUser(db);
    const expiresAt = new Date(Date.now() + 86400_000);
    await db.insert(sessions).values([
      { tokenHash: sha256Hex(`a-${seq}`), userId: account.id, expiresAt, method: "telegram" },
      { tokenHash: sha256Hex(`b-${seq}`), userId: account.id, expiresAt },
      { tokenHash: sha256Hex(`c-${seq}`), userId: bystander.id, expiresAt },
    ]);
    expect(await signOutEverywhere(db, tg.telegramUserId)).toBe(2);
    expect(await db.select().from(sessions).where(eq(sessions.userId, bystander.id))).toHaveLength(1);
    expect(await signOutEverywhere(db, tgUser("Nobody").telegramUserId)).toBeNull();
  });
});
