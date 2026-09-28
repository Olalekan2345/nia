import "server-only";
import { cache } from "react";
import { after } from "next/server";
import { cookies, headers } from "next/headers";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";
import { authCodes, merchantInvites, merchantMembers, sessions, users, type User } from "@nia/database";
import { authSecret, isProduction } from "@nia/config";
import { AppError } from "@nia/shared";
import { hmacHex, randomNumericCode, randomToken, safeEqual, sha256Hex } from "@nia/shared/server";
import { db } from "./server";
import { sendSignInCodeEmail } from "./email";
import { limit } from "./security";
import { describeDevice } from "./device";
import { notifyEmailSignIn } from "./telegram";

export const SESSION_COOKIE = "nia_session";
export const GUEST_COOKIE = "nia_guest";
const SESSION_DAYS = 30;
const CODE_TTL_MS = 10 * 60 * 1000;
const MAX_CODE_ATTEMPTS = 5;

const EmailSchema = z.string().trim().toLowerCase().email().max(254);

function codeHash(email: string, code: string): string {
  return hmacHex(authSecret(), `signin|${email}|${code}`);
}

export async function requestSignInCode(rawEmail: string, ip: string, context: { shopName?: string } = {}) {
  const parsed = EmailSchema.safeParse(rawEmail);
  if (!parsed.success) throw new AppError("VALIDATION", "Enter a valid email address.");
  const email = parsed.data;
  await limit(`otp-ip:${ip}`, 20, 3600);
  await limit(`otp-email:${email}`, 5, 900);

  const code = randomNumericCode(6);
  await db().insert(authCodes).values({ email, codeHash: codeHash(email, code), expiresAt: new Date(Date.now() + CODE_TTL_MS) });
  const result = await sendSignInCodeEmail(email, code, context);
  return { email, ...result };
}

export async function verifySignInCode(rawEmail: string, rawCode: string, ip: string): Promise<User> {
  const email = EmailSchema.parse(rawEmail);
  const code = rawCode.replace(/\D/g, "");
  await limit(`verify-ip:${ip}`, 30, 900);
  if (code.length !== 6) throw new AppError("VALIDATION", "Enter the 6-digit code from your email.");

  const [row] = await db()
    .select()
    .from(authCodes)
    .where(and(eq(authCodes.email, email), isNull(authCodes.consumedAt), gt(authCodes.expiresAt, new Date())))
    .orderBy(desc(authCodes.createdAt))
    .limit(1);
  if (!row) throw new AppError("VALIDATION", "That code has expired. Request a new one.");
  if (row.attempts >= MAX_CODE_ATTEMPTS) throw new AppError("RATE_LIMITED", "Too many wrong codes. Request a new one.");

  if (!safeEqual(row.codeHash, codeHash(email, code))) {
    await db().update(authCodes).set({ attempts: row.attempts + 1 }).where(eq(authCodes.id, row.id));
    throw new AppError("VALIDATION", "That code isn't right. Check the email and try again.");
  }
  const consumed = await db().update(authCodes).set({ consumedAt: new Date() }).where(and(eq(authCodes.id, row.id), isNull(authCodes.consumedAt))).returning({ id: authCodes.id });
  if (consumed.length === 0) throw new AppError("VALIDATION", "That code was already used.");

  const [existing] = await db().select().from(users).where(eq(users.email, email));
  const user = existing ?? (await db().insert(users).values({ email }).returning())[0]!;
  // Accept any pending team invites for this verified email.
  const invites = await db().select().from(merchantInvites).where(and(eq(merchantInvites.email, email), isNull(merchantInvites.acceptedAt)));
  for (const inv of invites) {
    await db().insert(merchantMembers).values({ merchantId: inv.merchantId, userId: user.id, role: inv.role }).onConflictDoNothing();
    await db().update(merchantInvites).set({ acceptedAt: new Date() }).where(eq(merchantInvites.id, inv.id));
  }
  await createSession(user.id, "email");
  // Accounts connected to Telegram get an alert there, with "sign out everywhere".
  if (user.telegramUserId) {
    const device = describeDevice((await headers()).get("user-agent"));
    after(() => notifyEmailSignIn(user, device));
  }
  return user;
}

export async function createSession(userId: string, method: "email" | "telegram"): Promise<void> {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
  const userAgent = (await headers()).get("user-agent")?.slice(0, 300) ?? null;
  await db().insert(sessions).values({ tokenHash: sha256Hex(token), userId, expiresAt, userAgent, method });
  await db().update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, userId));
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, { httpOnly: true, secure: isProduction(), sameSite: "lax", path: "/", expires: expiresAt });
}

/** The signed-in user for this request (cached per request). */
export const getSessionUser = cache(async (): Promise<User | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token || token.length > 100) return null;
  const [row] = await db()
    .select({ user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, sha256Hex(token)), gt(sessions.expiresAt, new Date())));
  return row?.user ?? null;
});

export async function signOut(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) await db().delete(sessions).where(eq(sessions.tokenHash, sha256Hex(token)));
  jar.delete(SESSION_COOKIE);
}

/** Session-only identity for anonymous visitors (no durable memory). */
export async function getGuestId(create = false): Promise<string | null> {
  const jar = await cookies();
  const existing = jar.get(GUEST_COOKIE)?.value;
  if (existing && /^[A-Za-z0-9_-]{20,64}$/.test(existing)) return existing;
  if (!create) return null;
  const id = randomToken(24);
  jar.set(GUEST_COOKIE, id, { httpOnly: true, secure: isProduction(), sameSite: "lax", path: "/" });
  return id;
}
