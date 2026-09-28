/**
 * Telegram update processing.
 *
 * The webhook route verifies the secret token and claims the update id
 * (dedup) before calling `processUpdate`. Telegram-native patterns: typing
 * indicator, inline keyboards, deep links — not a copy of the web UI.
 */
import { and, desc, eq, gt, ne, sql } from "drizzle-orm";
import { generateText, stepCountIs } from "ai";
import {
  checkRateLimit,
  conversations,
  merchants,
  messages,
  services,
  telegramIdentities,
  telegramLoginRequests,
  telegramUpdates,
  type Conversation,
  type Customer,
  type Db,
  type Merchant,
  type TelegramIdentity,
} from "@nia/database";
import {
  consumeTelegramLinkToken,
  createBookingDraft,
  decideTelegramLogin,
  findLoginRequestByToken,
  numberChoices,
  signOutEverywhere,
  getCustomerRecentOrders,
  resolveRepeatOrder,
  resolveTelegramCustomer,
  type BookingSummaryData,
  type OrderSummaryData,
  type ProductCardData,
  type ServiceCardData,
} from "@nia/commerce";
import { awaitDurable, customerPassport, resolveCandidate, type MemoryReceipt, type MemoryStore } from "@nia/memory";
import {
  aiBusyMessage,
  cancelCustomerBooking,
  confirmCustomerBooking,
  confirmCustomerOrder,
  createConversation,
  extractAndRemember,
  getChatModel,
  isAiConfigured,
  memoryUsage,
  prepareTurn,
  saveAssistantMessage,
  saveUserMessage,
} from "@nia/ai";
import { safeEqual } from "@nia/shared/server";
import { isAppError } from "@nia/shared";
import type { Bot } from "./api";
import {
  bookingSummaryText,
  CB,
  escapeHtml,
  quote,
  orderSummaryText,
  productCaption,
  serviceCaption,
  storefrontUrl,
  toTelegramHtml,
  welcomeKeyboard,
  welcomeText,
} from "./format";
import type { InlineKeyboardMarkup, TgCallbackQuery, TgMessage, TgUpdate, TgUser } from "./types";

export interface TelegramDeps {
  db: Db;
  store: MemoryStore | null;
  bot: Bot;
  appUrl: string;
  defaultShopSlug?: string | null;
  /** Max time to wait for Walrus to confirm a memory before leaving the "saving" note as is. */
  durableWaitMs?: number;
}

/* ─────────────────────────────── Webhook guards ─────────────────────────────── */

export function verifyWebhookSecret(header: string | null, expected: string | undefined): boolean {
  if (!expected || !header) return false;
  return safeEqual(header, expected);
}

/** Returns true the first time an update id is seen (Telegram retries deliveries). */
export async function claimUpdate(db: Db, updateId: number): Promise<boolean> {
  const rows = await db.insert(telegramUpdates).values({ updateId }).onConflictDoNothing().returning({ id: telegramUpdates.updateId });
  return rows.length === 1;
}

export async function finishUpdate(db: Db, updateId: number, error?: string): Promise<void> {
  await db
    .update(telegramUpdates)
    .set({ status: error ? "failed" : "done", error: error?.slice(0, 500) ?? null })
    .where(eq(telegramUpdates.updateId, updateId));
}

/* ─────────────────────────────── Context resolution ─────────────────────────────── */

interface ChatContext {
  deps: TelegramDeps;
  user: TgUser;
  chatId: number;
  identity: TelegramIdentity;
}

async function upsertIdentity(db: Db, user: TgUser, chatId: number): Promise<TelegramIdentity> {
  const [row] = await db
    .insert(telegramIdentities)
    .values({
      telegramUserId: user.id,
      chatId,
      username: user.username ?? null,
      firstName: user.first_name,
      lastName: user.last_name ?? null,
      languageCode: user.language_code ?? null,
    })
    .onConflictDoUpdate({
      target: telegramIdentities.telegramUserId,
      set: { chatId, username: user.username ?? null, firstName: user.first_name, lastName: user.last_name ?? null, updatedAt: new Date() },
    })
    .returning();
  return row!;
}

async function activeMerchant(c: ChatContext): Promise<Merchant | null> {
  const { db, defaultShopSlug } = c.deps;
  if (c.identity.activeMerchantId) {
    const [m] = await db.select().from(merchants).where(eq(merchants.id, c.identity.activeMerchantId));
    if (m && m.telegramEnabled && m.status !== "paused") return m;
  }
  if (defaultShopSlug) {
    const [m] = await db.select().from(merchants).where(eq(merchants.slug, defaultShopSlug));
    if (m && m.telegramEnabled) {
      await setActiveMerchant(c, m.id);
      return m;
    }
  }
  return null;
}

async function setActiveMerchant(c: ChatContext, merchantId: string): Promise<void> {
  await c.deps.db.update(telegramIdentities).set({ activeMerchantId: merchantId, activeConversationId: null }).where(eq(telegramIdentities.id, c.identity.id));
  c.identity = { ...c.identity, activeMerchantId: merchantId, activeConversationId: null };
}

function tgRef(user: TgUser) {
  return { telegramUserId: user.id, displayName: [user.first_name, user.last_name].filter(Boolean).join(" ") || null, username: user.username ?? null };
}

async function customerFor(c: ChatContext, merchant: Merchant): Promise<Customer> {
  return resolveTelegramCustomer(c.deps.db, merchant.id, tgRef(c.user));
}

/** Conversations stay open across channels for this long after the last message. */
const CONTINUE_WINDOW_MS = 12 * 3600_000;

/**
 * The conversation this Telegram message belongs to: the customer's most recent one
 * at this shop from the last 12 hours — on either channel, so a chat started on the
 * website carries on here — or a new one.
 */
async function conversationFor(c: ChatContext, merchant: Merchant, customer: Customer, fresh = false): Promise<Conversation> {
  const { db } = c.deps;
  if (!fresh) {
    const [recent] = await db
      .select()
      .from(conversations)
      .where(
        and(
          eq(conversations.merchantId, merchant.id),
          eq(conversations.customerId, customer.id),
          ne(conversations.memoryMode, "off"),
          gt(conversations.lastMessageAt, new Date(Date.now() - CONTINUE_WINDOW_MS)),
        ),
      )
      .orderBy(desc(conversations.lastMessageAt))
      .limit(1);
    if (recent) {
      if (c.identity.activeConversationId !== recent.id) await setActiveConversation(c, recent.id);
      return recent;
    }
  }
  const conv = await createConversation(db, { merchantId: merchant.id, customerId: customer.id, channel: "telegram" });
  await setActiveConversation(c, conv.id);
  return conv;
}

async function setActiveConversation(c: ChatContext, conversationId: string): Promise<void> {
  await c.deps.db.update(telegramIdentities).set({ activeConversationId: conversationId }).where(eq(telegramIdentities.id, c.identity.id));
  c.identity = { ...c.identity, activeConversationId: conversationId };
}

/** A Telegram customer counts as linked once it resolves to a web-authenticated customer. */
function isLinked(customer: Customer): boolean {
  return Boolean(customer.userId);
}

async function sendShopChooser(c: ChatContext): Promise<void> {
  const shops = await c.deps.db
    .select({ slug: merchants.slug, name: merchants.name })
    .from(merchants)
    .where(and(eq(merchants.telegramEnabled, true), eq(merchants.status, "live"), eq(merchants.isDemo, true)))
    .limit(8);
  const keyboard: InlineKeyboardMarkup = { inline_keyboard: shops.map((s) => [{ text: s.name, callback_data: CB.shop(s.slug) }]) };
  await c.deps.bot.sendMessage(
    c.chatId,
    shops.length
      ? "👋 Hi, I'm <b>Nia</b>. Which shop would you like to talk to? (You can also open a shop's Telegram link from its website.)"
      : "👋 Hi, I'm <b>Nia</b>. Open a shop's Telegram link from its website to start chatting.",
    { html: true, keyboard: shops.length ? keyboard : undefined },
  );
}

async function sendWelcome(c: ChatContext, merchant: Merchant): Promise<void> {
  const customer = await customerFor(c, merchant);
  const [svc] = await c.deps.db.select({ id: services.id }).from(services).where(and(eq(services.merchantId, merchant.id), eq(services.active, true))).limit(1);
  await c.deps.bot.sendMessage(c.chatId, welcomeText(merchant, isLinked(customer)), {
    html: true,
    keyboard: welcomeKeyboard(c.deps.appUrl, merchant, Boolean(svc)),
  });
}

/* ─────────────────────────────── Entry point ─────────────────────────────── */

export async function processUpdate(deps: TelegramDeps, update: TgUpdate): Promise<void> {
  if (update.callback_query) return handleCallback(deps, update.callback_query);
  const message = update.message;
  if (!message?.from || message.chat.type !== "private" || message.from.is_bot) return;
  const text = (message.text ?? message.caption ?? "").trim();
  const identity = await upsertIdentity(deps.db, message.from, message.chat.id);
  const c: ChatContext = { deps, user: message.from, chatId: message.chat.id, identity };

  const limit = await checkRateLimit(deps.db, `tg:${message.from.id}`, { limit: 20, windowSeconds: 60 });
  if (!limit.allowed) {
    if (limit.count === 21) await deps.bot.sendMessage(c.chatId, "You're sending messages quickly — give me a moment and try again shortly.");
    return;
  }

  if (!text) {
    await deps.bot.sendMessage(c.chatId, "I can read text messages for now — tell me what you're looking for.");
    return;
  }
  if (text.startsWith("/")) return handleCommand(c, text, message);
  const merchant = await activeMerchant(c);
  if (!merchant) return sendShopChooser(c);
  await runTurn(c, merchant, text, message.message_id);
}

/* ─────────────────────────────── Commands ─────────────────────────────── */

async function handleCommand(c: ChatContext, text: string, message: TgMessage): Promise<void> {
  const [rawCmd, ...rest] = text.split(/\s+/);
  const cmd = rawCmd!.toLowerCase().replace(/@\w+$/, "");
  const payload = rest.join(" ").trim();
  const { bot, db, appUrl } = c.deps;

  if (cmd === "/start") {
    if (payload.startsWith("g_")) return handleLoginStart(c, payload);
    if (payload.startsWith("c_")) return handleContinue(c, payload.slice(2));
    if (payload.startsWith("l_")) return handleLink(c, payload);
    if (payload.startsWith("s_")) {
      const [m] = await db.select().from(merchants).where(eq(merchants.slug, payload.slice(2)));
      if (m && m.telegramEnabled) {
        await setActiveMerchant(c, m.id);
        return sendWelcome(c, m);
      }
    }
    const merchant = await activeMerchant(c);
    return merchant ? sendWelcome(c, merchant) : sendShopChooser(c);
  }
  if (cmd === "/logout") return sendSignOutEverywhere(c);

  const merchant = await activeMerchant(c);
  if (!merchant) return sendShopChooser(c);

  switch (cmd) {
    case "/help":
      return sendWelcome(c, merchant);
    case "/shop":
      return runTurn(c, merchant, "Show me what you have — a few popular items.", message.message_id);
    case "/book":
      return runTurn(c, merchant, "I'd like to book a service. What do you offer?", message.message_id);
    case "/last":
      return sendLastOrder(c, merchant);
    case "/memory":
      return sendMemorySummary(c, merchant);
    case "/new": {
      const customer = await customerFor(c, merchant);
      await conversationFor(c, merchant, customer, true);
      await bot.sendMessage(c.chatId, "Fresh conversation started. What can I help you with?");
      return;
    }
    case "/link":
      await bot.sendMessage(
        c.chatId,
        `On the website, sign in with <b>Continue with Telegram</b> — your web account and this chat then share one profile, memory and cart at every shop. Already signed in with email? Open your profile and tap <b>Connect Telegram</b>.\n\n${escapeHtml(storefrontUrl(appUrl, merchant, "/signin"))}`,
        { html: true, keyboard: { inline_keyboard: [[{ text: "Sign in on the website", url: storefrontUrl(appUrl, merchant, "/signin") }]] } },
      );
      return;
    default:
      await bot.sendMessage(c.chatId, "I don't know that command. Try /start, /shop, /book, /last, /memory or /logout — or just type what you need.");
  }
}

/* ─────────────────────────────── Continue with Telegram ─────────────────────────────── */

async function handleLoginStart(c: ChatContext, token: string): Promise<void> {
  const { db, bot } = c.deps;
  const limit = await checkRateLimit(db, `tglogin:${c.user.id}`, { limit: 10, windowSeconds: 600 });
  if (!limit.allowed) {
    await bot.sendMessage(c.chatId, "Too many sign-in attempts. Wait a few minutes, then start again from the website.");
    return;
  }
  const req = await findLoginRequestByToken(db, token);
  if (!req || req.status !== "pending" || req.expiresAt.getTime() <= Date.now()) {
    await bot.sendMessage(c.chatId, "That sign-in link has expired or was already used. Go back to the website and tap <b>Continue with Telegram</b> again.", { html: true });
    return;
  }
  const [shop] = req.merchantId ? await db.select({ name: merchants.name }).from(merchants).where(eq(merchants.id, req.merchantId)) : [];
  const title =
    req.purpose === "connect"
      ? "🔐 <b>Connect this Telegram account to your Nia account?</b>"
      : `🔐 <b>Sign in to ${shop ? `${escapeHtml(shop.name)} on ` : ""}Nia in a web browser?</b>`;
  await bot.sendMessage(
    c.chatId,
    [title, req.device ? `Browser: ${escapeHtml(req.device)}` : null, "", "Tap the number you see on the website.", "Didn't ask for this? Tap <b>Not me</b> — nothing happens."]
      .filter((l) => l !== null)
      .join("\n"),
    {
      html: true,
      keyboard: {
        inline_keyboard: [numberChoices(req.matchNumber).map((n) => ({ text: String(n), callback_data: CB.loginPick(req.id, n) })), [{ text: "🚫 Not me", callback_data: CB.loginDeny(req.id) }]],
      },
    },
  );
}

async function handleLoginDecision(c: ChatContext, q: TgCallbackQuery, requestId: string, choice: number | "deny"): Promise<void> {
  const { db, bot } = c.deps;
  const decision = await decideTelegramLogin(db, { requestId, tg: tgRef(q.from), choice });
  if (q.message) await bot.editReplyMarkup(c.chatId, q.message.message_id).catch(() => {});
  const text = {
    approved: "✅ <b>Confirmed.</b> Go back to your browser — it signs you in automatically.",
    denied: "Okay — nobody was signed in.",
    wrong_number: "That number didn't match the website, so I cancelled this sign-in to keep your account safe. If it was you, start again from the website.",
    expired: "This sign-in request expired. Start again from the website.",
    already_decided: "This sign-in request was already answered.",
    invalid: "This sign-in request isn't valid any more. Start again from the website.",
  }[decision];
  await bot.answerCallbackQuery(q.id, decision === "approved" ? "Confirmed" : undefined).catch(() => {});
  await bot.sendMessage(c.chatId, text, { html: true });
  if (decision === "approved") {
    // Carry on with the shop the browser was on.
    const [req] = await db.select({ merchantId: telegramLoginRequests.merchantId }).from(telegramLoginRequests).where(eq(telegramLoginRequests.id, requestId));
    if (req?.merchantId) {
      const [m] = await db.select().from(merchants).where(eq(merchants.id, req.merchantId));
      if (m?.telegramEnabled) await setActiveMerchant(c, m.id);
    }
  }
}

async function sendSignOutEverywhere(c: ChatContext): Promise<void> {
  const removed = await signOutEverywhere(c.deps.db, c.user.id);
  await c.deps.bot.sendMessage(
    c.chatId,
    removed === null
      ? "This Telegram account isn't connected to a Nia web account, so there's nothing to sign out."
      : `🔒 Signed out of Nia in ${removed} browser${removed === 1 ? "" : "s"}. Sign in again any time with <b>Continue with Telegram</b>.`,
    { html: true },
  );
}

/** "Continue in Telegram" from the web chat: pick up that exact conversation, if it's yours. */
async function handleContinue(c: ChatContext, conversationId: string): Promise<void> {
  const { db, bot } = c.deps;
  const [conv] = /^[0-9a-f-]{36}$/i.test(conversationId) ? await db.select().from(conversations).where(eq(conversations.id, conversationId)) : [];
  const [merchant] = conv ? await db.select().from(merchants).where(eq(merchants.id, conv.merchantId)) : [];
  if (!conv || !merchant?.telegramEnabled) {
    const m = await activeMerchant(c);
    return m ? sendWelcome(c, m) : sendShopChooser(c);
  }
  await setActiveMerchant(c, merchant.id);
  const customer = await customerFor(c, merchant);
  if (conv.customerId !== customer.id) {
    await bot.sendMessage(
      c.chatId,
      "I can only continue chats from your own account. On the website, sign in with <b>Continue with Telegram</b> (or connect Telegram in your profile), then try again.",
      { html: true },
    );
    return sendWelcome(c, merchant);
  }
  await setActiveConversation(c, conv.id);
  const recent = await db
    .select({ role: messages.role, content: messages.content })
    .from(messages)
    .where(eq(messages.conversationId, conv.id))
    .orderBy(desc(messages.createdAt))
    .limit(2);
  const lines = recent
    .reverse()
    .filter((m) => m.content.trim())
    .map((m) => `<b>${m.role === "user" ? "You" : "Nia"}:</b> ${quote(m.content, 160)}`);
  await bot.sendMessage(
    c.chatId,
    [`📱 <b>Picking up your ${escapeHtml(merchant.name)} chat from the website.</b>`, ...(lines.length ? ["", ...lines] : []), "", "Carry on here — I remember everything from there."].join("\n"),
    { html: true },
  );
}

async function handleLink(c: ChatContext, token: string): Promise<void> {
  const { db, bot } = c.deps;
  const limit = await checkRateLimit(db, `tglink:${c.user.id}`, { limit: 5, windowSeconds: 600 });
  if (!limit.allowed) {
    await bot.sendMessage(c.chatId, "Too many link attempts. Please wait a few minutes and generate a new link from the website.");
    return;
  }
  const result = await consumeTelegramLinkToken(db, { token, tg: tgRef(c.user) });
  if (!result.ok) {
    const why = {
      invalid: "That link isn't valid.",
      expired: "That link has expired (links last 10 minutes).",
      used: "That link was already used.",
      linked_elsewhere: "This Telegram account is already linked to a different web account at this shop.",
    }[result.reason];
    await bot.sendMessage(c.chatId, `${why} Generate a new one from your profile on the website.`);
    return;
  }
  await setActiveMerchant(c, result.merchantId);
  const [merchant] = await db.select().from(merchants).where(eq(merchants.id, result.merchantId));
  await bot.sendMessage(
    c.chatId,
    result.alreadyLinked
      ? "✅ This chat is already linked to your web account."
      : `✅ <b>Linked.</b> Telegram and your ${escapeHtml(merchant!.name)} web account now share one customer profile — anything Nia remembers on the web is available here too.${result.merged ? " Your earlier Telegram chats were merged in." : ""}`,
    { html: true },
  );
  await sendWelcome(c, merchant!);
}

async function sendLastOrder(c: ChatContext, merchant: Merchant): Promise<void> {
  const customer = await customerFor(c, merchant);
  const orders = await getCustomerRecentOrders(c.deps.db, merchant.id, customer.id, 3);
  if (orders.length === 0) {
    await c.deps.bot.sendMessage(c.chatId, "You haven't ordered from us yet. Want to browse?", { keyboard: { inline_keyboard: [[{ text: "🛍 Browse products", callback_data: CB.action("browse") }]] } });
    return;
  }
  const repeat = resolveRepeatOrder(orders);
  const last = orders[0]!;
  await c.deps.bot.sendMessage(c.chatId, orderSummaryText(last, merchant.locale, `Your last order · ${last.statusLabel}`), {
    html: true,
    keyboard: repeatKeyboard(repeat.status === "single" ? repeat.orderId : last.id),
  });
}

function repeatKeyboard(orderId: string): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: "Same quantity", callback_data: CB.repeat(orderId) }],
      [
        { text: "Change quantity", callback_data: CB.action("change_qty") },
        { text: "View similar options", callback_data: CB.action("similar") },
      ],
    ],
  };
}

async function sendMemorySummary(c: ChatContext, merchant: Merchant): Promise<void> {
  const customer = await customerFor(c, merchant);
  const entries = (await customerPassport(c.deps.db, { merchantId: merchant.id, customerId: customer.id })).filter((e) => e.lifecycle === "active" && e.persistStatus === "stored");
  const url = storefrontUrl(c.deps.appUrl, merchant, "/profile");
  if (entries.length === 0) {
    await c.deps.bot.sendMessage(c.chatId, `Nia doesn't remember anything about you at ${escapeHtml(merchant.name)} yet. Tell me things like your size or usual delivery area and I'll keep them — you can review or remove them any time.`, { html: true });
    return;
  }
  const lines = entries.slice(0, 12).map((e) => `• ${escapeHtml(e.label)}`);
  await c.deps.bot.sendMessage(c.chatId, `<b>What Nia remembers about you</b>\n${lines.join("\n")}\n\nReview, correct or forget items in your Memory Passport.`, {
    html: true,
    keyboard: { inline_keyboard: [[{ text: "Open Memory Passport", url }]] },
  });
}

/* ─────────────────────────────── AI turn ─────────────────────────────── */

type ToolOutputs = {
  products?: ProductCardData[];
  services?: ServiceCardData[];
  cart?: { summary: OrderSummaryData; needsConfirmation: boolean };
  booking?: BookingSummaryData;
  slots?: { serviceId: string; timeZone: string; slots: { startAt: string; label: string }[] };
  repeat?: { orderId: string } | null;
  signInRequired?: boolean;
};

function collectOutputs(steps: { toolResults: { toolName: string; input: unknown; output: unknown }[] }[]): ToolOutputs {
  const out: ToolOutputs = {};
  for (const step of steps) {
    for (const r of step.toolResults) {
      const o = r.output as Record<string, unknown> & { ok?: boolean; code?: string };
      if (!o || o.ok === false) {
        if (o?.code === "SIGN_IN_REQUIRED") out.signInRequired = true;
        continue;
      }
      switch (r.toolName) {
        case "searchProducts":
          out.products = o.products as ProductCardData[];
          break;
        case "getProduct":
          out.products = [o.product as ProductCardData];
          break;
        case "searchServices":
          out.services = o.services as ServiceCardData[];
          break;
        case "getService":
          out.services = [o.service as ServiceCardData];
          break;
        case "showOrderSummary":
          out.cart = { summary: o.summary as OrderSummaryData, needsConfirmation: Boolean(o.needsConfirmation) };
          break;
        case "createBookingDraft":
          out.booking = o.booking as BookingSummaryData;
          break;
        case "getAvailableBookingSlots":
          out.slots = { serviceId: (r.input as { serviceId: string }).serviceId, timeZone: o.timeZone as string, slots: (o.slots as { startAt: string; label: string }[]) ?? [] };
          break;
        case "getCustomerRecentOrders": {
          const repeat = o.repeat as { status: string; orderId?: string } | undefined;
          out.repeat = repeat?.status === "single" && repeat.orderId ? { orderId: repeat.orderId } : null;
          break;
        }
      }
    }
  }
  return out;
}

async function sendCards(c: ChatContext, merchant: Merchant, outputs: ToolOutputs): Promise<void> {
  const { bot, appUrl } = c.deps;
  for (const p of (outputs.products ?? []).slice(0, 3)) {
    const keyboard: InlineKeyboardMarkup = { inline_keyboard: [[{ text: "View in shop", url: storefrontUrl(appUrl, merchant, `/shop/${p.slug}`) }]] };
    const caption = productCaption(p, merchant.locale);
    if (p.image && /^https:\/\//.test(p.image)) await bot.sendPhoto(c.chatId, p.image, caption, keyboard);
    else await bot.sendMessage(c.chatId, caption, { html: true, keyboard });
  }
  for (const s of (outputs.services ?? []).slice(0, 3)) {
    await bot.sendMessage(c.chatId, serviceCaption(s, merchant.locale, merchant.timezone), {
      html: true,
      keyboard: { inline_keyboard: [[{ text: "Book this", callback_data: `bk:${s.id}` }]] },
    });
  }
  if (outputs.slots?.slots.length) {
    const rows = outputs.slots.slots.slice(0, 6).map((s) => [{ text: s.label, callback_data: `sl:${outputs.slots!.serviceId}:${Math.floor(new Date(s.startAt).getTime() / 60000)}` }]);
    await bot.sendMessage(c.chatId, "Pick a time:", { keyboard: { inline_keyboard: rows } });
  }
  if (outputs.booking && outputs.booking.status === "draft") {
    await bot.sendMessage(c.chatId, bookingSummaryText(outputs.booking, merchant.locale, "Please confirm"), {
      html: true,
      keyboard: { inline_keyboard: [[{ text: "✅ Confirm booking", callback_data: CB.confirmBooking(outputs.booking.id) }, { text: "Change", callback_data: CB.cancelBooking(outputs.booking.id) }]] },
    });
  }
  if (outputs.cart) {
    const s = outputs.cart.summary;
    await bot.sendMessage(c.chatId, orderSummaryText(s, merchant.locale), {
      html: true,
      keyboard: outputs.cart.needsConfirmation
        ? { inline_keyboard: [[{ text: "✅ Confirm order", callback_data: CB.confirmOrder(s.id) }, { text: "✏️ Edit", callback_data: CB.editOrder(s.id) }]] }
        : undefined,
    });
  }
  if (outputs.repeat && !outputs.cart) {
    await bot.sendMessage(c.chatId, "Would you like:", { keyboard: repeatKeyboard(outputs.repeat.orderId) });
  }
}

/**
 * Walrus Mainnet saves take ~30–60 s, and one webhook run has 60 s in total. So:
 * say "saving" at once, then edit that same message when the relayer confirms —
 * never claim "saved" before it has.
 */
const DURABLE_WAIT_MS = 35_000;

interface ReceiptWording {
  saving: string;
  saved: (stored: MemoryReceipt[]) => string;
  stillSaving: string;
}

const bullets = (receipts: MemoryReceipt[]) => receipts.map((r) => `• ${escapeHtml(r.label)}`).join("\n");
const savedWhere = (receipts: MemoryReceipt[]) => (receipts[0]?.backend === "walrus" ? "saved with Walrus Memory" : "saved");

function memoryWording(pending: MemoryReceipt[]): ReceiptWording {
  const walrus = pending[0]?.backend === "walrus";
  return {
    saving: `🧠 <b>Saving to memory…</b>\n${bullets(pending)}\n<i>${walrus ? "Waiting for Walrus Memory to confirm." : "Waiting for confirmation."}</i>`,
    saved: (stored) => `🧠 <b>Got it — I'll remember that.</b>\n${bullets(stored)}\n<i>${savedWhere(stored)}</i>`,
    stillSaving: `🧠 <b>Saving to memory…</b>\n${bullets(pending)}\n<i>${walrus ? "Walrus Memory is still confirming" : "Still confirming"} — /memory shows it once it's stored.</i>`,
  };
}

/** Send the "saving" note now; returns a function that waits for Walrus and edits it. */
async function startReceipt(c: ChatContext, pending: MemoryReceipt[], wording: ReceiptWording): Promise<() => Promise<void>> {
  const { bot, db, store } = c.deps;
  const note = await bot.sendMessage(c.chatId, wording.saving, { html: true });
  return async () => {
    const done = await awaitDurable(db, store, pending.map((r) => r.recordId!), { timeoutMs: c.deps.durableWaitMs ?? DURABLE_WAIT_MS });
    const stored = done.filter((r) => r.status === "stored");
    const text = stored.length === done.length ? wording.saved(stored) : wording.stillSaving;
    await bot.editMessageText(c.chatId, note.message_id, text, { html: true }).catch(() => {});
  };
}

const isPending = (r: MemoryReceipt | null | undefined): r is MemoryReceipt => Boolean(r?.recordId && r.status === "pending");

export async function runTurn(c: ChatContext, merchant: Merchant, text: string, externalId?: number): Promise<void> {
  const { db, store, bot } = c.deps;
  if (!isAiConfigured()) {
    await bot.sendMessage(c.chatId, "Nia's assistant isn't fully set up yet (the shop's AI provider isn't configured). Please try again later.");
    return;
  }
  const customer = await customerFor(c, merchant);
  const conversation = await conversationFor(c, merchant, customer);
  const typing = setInterval(() => void bot.sendChatAction(c.chatId).catch(() => {}), 4500);
  void bot.sendChatAction(c.chatId).catch(() => {});

  try {
    const saved = await saveUserMessage(db, { conversation, text, channel: "telegram", externalId: externalId ? String(externalId) : null });
    const ctx = { db, store, merchant, customer, conversation, channel: "telegram" as const };
    const turn = await prepareTurn(ctx, text);
    const result = await generateText({
      model: getChatModel(),
      system: turn.system,
      messages: turn.messages,
      tools: turn.tools,
      activeTools: turn.activeTools,
      stopWhen: stepCountIs(6),
      temperature: 0.4,
      maxRetries: turn.maxRetries,
    });
    const outputs = collectOutputs(result.steps as never);
    const usage = memoryUsage(turn.scope);
    const customerMemories = usage.filter((u) => u.scope === "customer").length;
    let reply = toTelegramHtml(result.text || (outputs.products?.length ? "Here's what I found:" : "Done."));
    if (customerMemories > 0) reply += `\n\n<i>🧠 ${customerMemories === 1 ? "Remembered from a previous visit" : `${customerMemories} memories used`}</i>`;
    if (outputs.signInRequired) reply += `\n\n<i>Link your web account (/link) so I can manage orders here.</i>`;
    await bot.sendMessage(c.chatId, reply, { html: true });
    await sendCards(c, merchant, outputs);
    await saveAssistantMessage(db, { conversation, text: result.text, parts: [{ type: "text", text: result.text }], memoryUsed: usage, channel: "telegram" });

    // Memory: extract → persist → "saving…" now, "saved with Walrus Memory" once confirmed.
    const after = await extractAndRemember(ctx, turn, { assistantText: result.text, userMessageId: saved.id });
    const pending = after.outcomes.map((o) => o.receipt).filter(isPending);
    const confirm = pending.length ? await startReceipt(c, pending, memoryWording(pending)) : null;
    for (const o of after.outcomes.filter((o) => o.pendingCandidateId).slice(0, 2)) {
      await bot.sendMessage(c.chatId, `Should I remember this for next time? <b>${escapeHtml(o.candidate.label)}</b>`, {
        html: true,
        keyboard: { inline_keyboard: [[{ text: "Yes, remember", callback_data: CB.consentYes(o.pendingCandidateId!) }, { text: "No thanks", callback_data: CB.consentNo(o.pendingCandidateId!) }]] },
      });
    }
    await confirm?.();
  } catch (err) {
    const busy = aiBusyMessage(err);
    if (!busy) throw err;
    console.warn("[telegram] model provider rate limit", (err as Error).message?.slice(0, 200));
    await bot.sendMessage(c.chatId, busy);
  } finally {
    clearInterval(typing);
  }
}

/* ─────────────────────────────── Callbacks ─────────────────────────────── */

async function handleCallback(deps: TelegramDeps, q: TgCallbackQuery): Promise<void> {
  const { bot, db } = deps;
  const chatId = q.message?.chat.id;
  if (!chatId || !q.data) {
    await bot.answerCallbackQuery(q.id).catch(() => {});
    return;
  }
  const identity = await upsertIdentity(db, q.from, chatId);
  const c: ChatContext = { deps, user: q.from, chatId, identity };
  const [kind, ...parts] = q.data.split(":");
  const arg = parts.join(":");

  const limit = await checkRateLimit(db, `tgcb:${q.from.id}`, { limit: 30, windowSeconds: 60 });
  if (!limit.allowed) {
    await bot.answerCallbackQuery(q.id, "Slow down a little 🙂").catch(() => {});
    return;
  }

  if (kind === "gl" || kind === "gx") return handleLoginDecision(c, q, parts[0] ?? "", kind === "gx" ? "deny" : Number(parts[1]));
  if (kind === "so") {
    await bot.answerCallbackQuery(q.id).catch(() => {});
    if (q.message) await bot.editReplyMarkup(chatId, q.message.message_id).catch(() => {});
    return sendSignOutEverywhere(c);
  }

  if (kind === "s") {
    const [m] = await db.select().from(merchants).where(eq(merchants.slug, arg));
    await bot.answerCallbackQuery(q.id).catch(() => {});
    if (m && m.telegramEnabled) {
      await setActiveMerchant(c, m.id);
      await sendWelcome(c, m);
    }
    return;
  }

  const merchant = await activeMerchant(c);
  if (!merchant) {
    await bot.answerCallbackQuery(q.id).catch(() => {});
    return sendShopChooser(c);
  }
  const customer = await customerFor(c, merchant);
  const actx = { db, store: deps.store, merchant, customer, channel: "telegram" as const };

  try {
    switch (kind) {
      case "a": {
        await bot.answerCallbackQuery(q.id).catch(() => {});
        const prompts: Record<string, string> = {
          browse: "Show me what you have — a few popular items.",
          book: "I'd like to book a service. What do you offer?",
          change_qty: "I'd like the same as my last order, but with a different quantity.",
          similar: "Show me options similar to my last order.",
        };
        if (arg === "last") return sendLastOrder(c, merchant);
        if (arg === "link") return handleCommand(c, "/link", q.message!);
        if (arg === "memory") return sendMemorySummary(c, merchant);
        if (prompts[arg]) return runTurn(c, merchant, prompts[arg]!);
        return;
      }
      case "rp": {
        await bot.answerCallbackQuery(q.id).catch(() => {});
        return runTurn(c, merchant, `Yes please — repeat my last order with the same quantity (previous order id ${arg}).`);
      }
      case "bk": {
        await bot.answerCallbackQuery(q.id).catch(() => {});
        const [s] = await db.select().from(services).where(and(eq(services.id, arg), eq(services.merchantId, merchant.id)));
        if (s) return runTurn(c, merchant, `I'd like to book ${s.name}. What times are available?`);
        return;
      }
      case "sl": {
        const [serviceId, minutes] = [parts[0]!, Number(parts[1])];
        const booking = await createBookingDraft(db, { merchantId: merchant.id, customerId: customer.id, serviceId, startAt: new Date(minutes * 60000).toISOString(), channel: "telegram" });
        await bot.answerCallbackQuery(q.id).catch(() => {});
        await bot.sendMessage(chatId, bookingSummaryText(booking, merchant.locale, "Please confirm"), {
          html: true,
          keyboard: { inline_keyboard: [[{ text: "✅ Confirm booking", callback_data: CB.confirmBooking(booking.id) }, { text: "Change", callback_data: CB.cancelBooking(booking.id) }]] },
        });
        return;
      }
      case "oc": {
        const { summary, payment, receipt } = await confirmCustomerOrder(actx, arg);
        await bot.answerCallbackQuery(q.id, `Order #${summary.number} placed`).catch(() => {});
        if (q.message) await bot.editReplyMarkup(chatId, q.message.message_id).catch(() => {});
        const payLine = payment ? `\n\n${escapeHtml(payment.instructions)}` : "";
        await bot.sendMessage(chatId, `✅ ${orderSummaryText(summary, merchant.locale, "Order placed")}${payLine}\n\n${escapeHtml(merchant.name)} will confirm availability shortly.`, {
          html: true,
          keyboard: payment?.url ? { inline_keyboard: [[{ text: "Pay now", url: payment.url }]] } : undefined,
        });
        if (isPending(receipt)) {
          const confirm = await startReceipt(c, [receipt], {
            saving: "🧠 <i>Adding this order to your history…</i>",
            saved: (stored) => `🧠 <i>Added to your order history — ${savedWhere(stored)}. Next time just say "same as last time".</i>`,
            stillSaving: "🧠 <i>Adding this order to your history — Walrus Memory is still confirming.</i>",
          });
          await confirm();
        }
        return;
      }
      case "oe": {
        await bot.answerCallbackQuery(q.id).catch(() => {});
        await bot.sendMessage(chatId, "Sure — what would you like to change? (quantity, option, delivery or pickup)");
        return;
      }
      case "bc": {
        const { booking, receipt } = await confirmCustomerBooking(actx, arg);
        await bot.answerCallbackQuery(q.id, "Booking requested").catch(() => {});
        if (q.message) await bot.editReplyMarkup(chatId, q.message.message_id).catch(() => {});
        await bot.sendMessage(chatId, `✅ ${bookingSummaryText(booking, merchant.locale, "Booking requested")}\n\n${escapeHtml(merchant.name)} will confirm your appointment.`, { html: true });
        if (isPending(receipt)) {
          const confirm = await startReceipt(c, [receipt], {
            saving: "🧠 <i>Adding this booking to your history…</i>",
            saved: (stored) => `🧠 <i>Added to your booking history — ${savedWhere(stored)}.</i>`,
            stillSaving: "🧠 <i>Adding this booking to your history — Walrus Memory is still confirming.</i>",
          });
          await confirm();
        }
        return;
      }
      case "bx": {
        await cancelCustomerBooking(actx, arg);
        await bot.answerCallbackQuery(q.id, "Cancelled").catch(() => {});
        if (q.message) await bot.editReplyMarkup(chatId, q.message.message_id).catch(() => {});
        await bot.sendMessage(chatId, "No problem — which day or time would suit you better?");
        return;
      }
      case "my":
      case "mn": {
        const receipt = await resolveCandidate(db, deps.store, { merchantId: merchant.id, customerId: customer.id, candidateId: arg, accept: kind === "my" });
        await bot.answerCallbackQuery(q.id, kind === "my" ? "Thanks!" : "Okay, I won't").catch(() => {});
        if (q.message) await bot.editReplyMarkup(chatId, q.message.message_id).catch(() => {});
        if (isPending(receipt)) await (await startReceipt(c, [receipt], memoryWording([receipt])))();
        return;
      }
      default:
        await bot.answerCallbackQuery(q.id).catch(() => {});
    }
  } catch (err) {
    const msg = isAppError(err) ? err.message : "Something went wrong — please try again.";
    if (!isAppError(err)) console.error("[telegram] callback failed", err);
    await bot.answerCallbackQuery(q.id, msg).catch(() => {});
    await bot.sendMessage(chatId, escapeHtml(msg), { html: true });
  }
}

/** Status summary for the dashboard (no secrets). */
export async function telegramStats(db: Db) {
  const [row] = await db
    .select({
      total: sql<number>`count(*)::int`,
      failed: sql<number>`count(*) filter (where ${telegramUpdates.status} = 'failed')::int`,
      last: sql<string | null>`max(${telegramUpdates.receivedAt})::text`,
    })
    .from(telegramUpdates);
  const [recent] = await db.select().from(telegramUpdates).orderBy(desc(telegramUpdates.receivedAt)).limit(1);
  return { processed: row?.total ?? 0, failed: row?.failed ?? 0, lastReceivedAt: recent?.receivedAt?.toISOString() ?? null };
}

