/**
 * "Continue with Telegram" — the bot proves who you are, the browser gets the session.
 *
 *   1. The browser starts a request: it keeps a secret (httpOnly cookie) and shows a
 *      two-digit number.
 *   2. The deep link opens the bot (/start g_<token>); the bot asks the Telegram user
 *      to tap the number they see on the website (three choices).
 *   3. Right number → approved. Wrong number or "Not me" → denied. This stops a
 *      forwarded sign-in link from logging someone else into the sender's browser.
 *   4. The browser polls; with its secret it consumes the approval once and gets a
 *      session.
 *
 * Requests are single use and expire after five minutes. Only hashes of the deep-link
 * token and the browser secret are stored.
 */
import { randomInt } from "node:crypto";
import { and, desc, eq, gt, inArray, isNotNull, isNull } from "drizzle-orm";
import { audit, customerIdentities, customers, sessions, telegramLoginRequests, users, type Db, type TelegramLoginRequest, type User } from "@nia/database";
import { randomToken, safeEqual, sha256Hex } from "@nia/shared/server";
import type { TelegramUserRef } from "./customers";

export const LOGIN_TOKEN_PREFIX = "g_";
export const LOGIN_TTL_MS = 5 * 60 * 1000;

export interface NewLoginRequest {
  id: string;
  /** Deep-link /start parameter (fits Telegram's 64-character limit). */
  startToken: string;
  /** Kept by the requesting browser only. */
  browserSecret: string;
  matchNumber: number;
  expiresAt: Date;
}

export async function createTelegramLoginRequest(
  db: Db,
  input: { purpose: "signin" | "connect"; userId?: string | null; merchantId?: string | null; nextPath?: string | null; device?: string | null },
): Promise<NewLoginRequest> {
  const startToken = `${LOGIN_TOKEN_PREFIX}${randomToken(24)}`;
  const browserSecret = randomToken(32);
  const matchNumber = randomInt(10, 100);
  const expiresAt = new Date(Date.now() + LOGIN_TTL_MS);
  const [row] = await db
    .insert(telegramLoginRequests)
    .values({
      tokenHash: sha256Hex(startToken),
      browserSecretHash: sha256Hex(browserSecret),
      purpose: input.purpose,
      userId: input.userId ?? null,
      merchantId: input.merchantId ?? null,
      nextPath: input.nextPath ?? null,
      device: input.device?.slice(0, 80) ?? null,
      matchNumber,
      expiresAt,
    })
    .returning({ id: telegramLoginRequests.id });
  return { id: row!.id, startToken, browserSecret, matchNumber, expiresAt };
}

/** The request behind a /start parameter (any status), or null. */
export async function findLoginRequestByToken(db: Db, startToken: string): Promise<TelegramLoginRequest | null> {
  if (!startToken.startsWith(LOGIN_TOKEN_PREFIX) || startToken.length > 64) return null;
  const [row] = await db.select().from(telegramLoginRequests).where(eq(telegramLoginRequests.tokenHash, sha256Hex(startToken)));
  return row ?? null;
}

/** The right number plus two different decoys, shuffled. */
export function numberChoices(correct: number): number[] {
  const choices = new Set([correct]);
  while (choices.size < 3) choices.add(randomInt(10, 100));
  const list = [...choices];
  for (let i = list.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1);
    [list[i], list[j]] = [list[j]!, list[i]!];
  }
  return list;
}

export type LoginDecision = "approved" | "denied" | "wrong_number" | "expired" | "already_decided" | "invalid";

/** The Telegram user's answer in the bot: a number, or "deny" ("Not me"). */
export async function decideTelegramLogin(db: Db, { requestId, tg, choice }: { requestId: string; tg: TelegramUserRef; choice: number | "deny" }): Promise<LoginDecision> {
  const [row] = await db.select().from(telegramLoginRequests).where(eq(telegramLoginRequests.id, requestId));
  if (!row) return "invalid";
  if (row.status !== "pending") return "already_decided";
  if (row.expiresAt.getTime() <= Date.now()) return "expired";

  const approve = choice !== "deny" && choice === row.matchNumber;
  const updated = await db
    .update(telegramLoginRequests)
    .set({
      status: approve ? "approved" : "denied",
      decidedAt: new Date(),
      ...(approve ? { telegramUserId: tg.telegramUserId, telegramUsername: tg.username, telegramName: tg.displayName } : {}),
    })
    .where(and(eq(telegramLoginRequests.id, row.id), eq(telegramLoginRequests.status, "pending"), gt(telegramLoginRequests.expiresAt, new Date())))
    .returning({ id: telegramLoginRequests.id });
  if (updated.length === 0) return "already_decided";
  return approve ? "approved" : choice === "deny" ? "denied" : "wrong_number";
}

export type LoginCompletion =
  | { status: "pending" | "denied" | "expired" | "invalid" }
  | { status: "approved"; request: TelegramLoginRequest & { telegramUserId: number } };

/** Browser side: needs the secret it was given. An approval can be consumed once. */
export async function completeTelegramLogin(db: Db, { requestId, browserSecret }: { requestId: string; browserSecret: string }): Promise<LoginCompletion> {
  const [row] = await db.select().from(telegramLoginRequests).where(eq(telegramLoginRequests.id, requestId));
  if (!row || !browserSecret || !safeEqual(sha256Hex(browserSecret), row.browserSecretHash)) return { status: "invalid" };
  if (row.status === "denied") return { status: "denied" };
  if (row.status === "consumed") return { status: "invalid" };
  if (row.status === "pending") return { status: row.expiresAt.getTime() <= Date.now() ? "expired" : "pending" };

  const [consumed] = await db
    .update(telegramLoginRequests)
    .set({ status: "consumed", consumedAt: new Date() })
    .where(and(eq(telegramLoginRequests.id, row.id), eq(telegramLoginRequests.status, "approved"), isNotNull(telegramLoginRequests.telegramUserId)))
    .returning();
  if (!consumed) return { status: "invalid" };
  return { status: "approved", request: consumed as TelegramLoginRequest & { telegramUserId: number } };
}

/**
 * The Nia account for a Telegram user: the one already connected to it; else a web
 * account that linked this Telegram at a shop before (per-shop link tokens); else a
 * new Telegram-only account.
 */
export async function telegramAccountUser(db: Db, tg: TelegramUserRef): Promise<User> {
  const profile = { telegramUsername: tg.username, ...(tg.displayName ? { name: tg.displayName } : {}) };
  const [owner] = await db.select().from(users).where(eq(users.telegramUserId, tg.telegramUserId));
  if (owner) {
    const [u] = await db.update(users).set({ telegramUsername: tg.username, name: owner.name ?? tg.displayName }).where(eq(users.id, owner.id)).returning();
    return u!;
  }

  const [linked] = await db
    .select({ userId: customers.userId })
    .from(customerIdentities)
    .innerJoin(customers, eq(customers.id, customerIdentities.customerId))
    .where(and(eq(customerIdentities.provider, "TELEGRAM"), eq(customerIdentities.subject, String(tg.telegramUserId)), isNotNull(customers.userId)))
    .orderBy(desc(customerIdentities.verifiedAt))
    .limit(1);
  if (linked?.userId) {
    const [u] = await db
      .update(users)
      .set({ telegramUserId: tg.telegramUserId, telegramUsername: tg.username })
      .where(and(eq(users.id, linked.userId), isNull(users.telegramUserId)))
      .returning();
    if (u) return u;
  }

  const [created] = await db
    .insert(users)
    .values({ telegramUserId: tg.telegramUserId, ...profile })
    .onConflictDoNothing()
    .returning();
  return created ?? (await db.select().from(users).where(eq(users.telegramUserId, tg.telegramUserId)))[0]!;
}

/** Attach a Telegram account to a signed-in (email) account. */
export async function connectTelegramToUser(db: Db, { userId, tg }: { userId: string; tg: TelegramUserRef }): Promise<{ ok: true } | { ok: false; reason: "taken" | "has_other" }> {
  const [owner] = await db.select({ id: users.id }).from(users).where(eq(users.telegramUserId, tg.telegramUserId));
  if (owner && owner.id !== userId) return { ok: false, reason: "taken" };
  const [me] = await db.select().from(users).where(eq(users.id, userId));
  if (me?.telegramUserId && me.telegramUserId !== tg.telegramUserId) return { ok: false, reason: "has_other" };
  await db.update(users).set({ telegramUserId: tg.telegramUserId, telegramUsername: tg.username, name: me?.name ?? tg.displayName }).where(eq(users.id, userId));
  await audit(db, { actorType: "user", actorId: userId, action: "identity.telegram_connected", targetType: "user", targetId: userId });
  return { ok: true };
}

/** Detach Telegram from an account that can still sign in with email. */
export async function disconnectTelegram(db: Db, userId: string): Promise<boolean> {
  const [me] = await db.select().from(users).where(eq(users.id, userId));
  if (!me?.telegramUserId || !me.email) return false;
  const subject = String(me.telegramUserId);
  const mine = db.select({ id: customers.id }).from(customers).where(eq(customers.userId, userId));
  await db.transaction(async (tx) => {
    await tx.update(users).set({ telegramUserId: null, telegramUsername: null }).where(eq(users.id, userId));
    await tx.delete(customerIdentities).where(and(eq(customerIdentities.provider, "TELEGRAM"), eq(customerIdentities.subject, subject), inArray(customerIdentities.customerId, mine)));
  });
  await audit(db, { actorType: "user", actorId: userId, action: "identity.telegram_disconnected", targetType: "user", targetId: userId });
  return true;
}

/** Revoke every web session of the account connected to this Telegram user. */
export async function signOutEverywhere(db: Db, telegramUserId: number): Promise<number | null> {
  const [owner] = await db.select({ id: users.id }).from(users).where(eq(users.telegramUserId, telegramUserId));
  if (!owner) return null;
  const removed = await db.delete(sessions).where(eq(sessions.userId, owner.id)).returning({ id: sessions.id });
  await audit(db, { actorType: "telegram", actorId: sha256Hex(String(telegramUserId)).slice(0, 16), action: "auth.sign_out_everywhere", targetType: "user", targetId: owner.id, metadata: { sessions: removed.length } });
  return removed.length;
}
