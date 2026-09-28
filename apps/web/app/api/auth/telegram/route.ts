/**
 * "Continue with Telegram" (flow and threat model: packages/commerce/src/telegram-login.ts).
 *
 *   POST  → start a request: returns the bot deep link and the number to show, and
 *           gives this browser the secret (httpOnly cookie) needed to finish.
 *   GET   → poll: pending / denied / expired — or, once the Telegram user tapped the
 *           right number, sign in (or connect Telegram to the signed-in account).
 */
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { merchants } from "@nia/database";
import { isProduction } from "@nia/config";
import { claimGuestConversations } from "@nia/ai";
import { completeTelegramLogin, connectTelegramToUser, createTelegramLoginRequest, resolveWebCustomer, telegramAccountUser } from "@nia/commerce";
import { isAppError } from "@nia/shared";
import { createSession, getGuestId, getSessionUser } from "@/lib/auth";
import { describeDevice } from "@/lib/device";
import { assertSameOrigin, clientIpFrom, limit } from "@/lib/security";
import { botLink } from "@/lib/telegram";
import { safeNext } from "@/lib/user";
import { db } from "@/lib/server";

const COOKIE = "nia_tg_login";

const StartBody = z.object({
  purpose: z.enum(["signin", "connect"]).default("signin"),
  next: z.string().max(300).optional(),
  shop: z.string().regex(/^[a-z0-9-]{1,64}$/).optional(),
});

function fail(err: unknown) {
  if (isAppError(err)) {
    const status = err.code === "FORBIDDEN" ? 403 : err.code === "RATE_LIMITED" ? 429 : 400;
    return Response.json({ error: err.message }, { status });
  }
  console.error("[auth/telegram]", err);
  return Response.json({ error: "Something went wrong. Please try again." }, { status: 500 });
}

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const body = StartBody.parse(await req.json().catch(() => ({})));
    await limit(`tglogin-ip:${clientIpFrom(req.headers)}`, 20, 600);
    const user = await getSessionUser();
    if (body.purpose === "connect" && !user) return Response.json({ error: "Sign in first." }, { status: 401 });
    const [shop] = body.shop ? await db().select({ id: merchants.id }).from(merchants).where(eq(merchants.slug, body.shop)) : [];

    const request = await createTelegramLoginRequest(db(), {
      purpose: body.purpose,
      userId: body.purpose === "connect" ? user!.id : null,
      merchantId: shop?.id ?? null,
      nextPath: safeNext(body.next, body.shop ? `/s/${body.shop}` : "/dashboard"),
      device: describeDevice(req.headers.get("user-agent")),
    });
    const url = botLink(request.startToken);
    if (!url) return Response.json({ error: "Telegram sign-in isn't set up on this deployment." }, { status: 503 });

    (await cookies()).set(COOKIE, request.browserSecret, { httpOnly: true, secure: isProduction(), sameSite: "lax", path: "/api/auth/telegram", maxAge: 600 });
    return Response.json({ id: request.id, url, number: request.matchNumber, expiresAt: request.expiresAt.toISOString() });
  } catch (err) {
    return fail(err);
  }
}

export async function GET(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get("id") ?? "";
    if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.json({ status: "invalid" });
    await limit(`tglogin-poll:${clientIpFrom(req.headers)}`, 400, 600);
    const jar = await cookies();
    const result = await completeTelegramLogin(db(), { requestId: id, browserSecret: jar.get(COOKIE)?.value ?? "" });
    if (result.status !== "approved") return Response.json({ status: result.status });

    const r = result.request;
    const tg = { telegramUserId: r.telegramUserId, displayName: r.telegramName, username: r.telegramUsername };
    jar.delete({ name: COOKIE, path: "/api/auth/telegram" });

    if (r.purpose === "connect") {
      const user = await getSessionUser();
      if (!user || user.id !== r.userId) return Response.json({ status: "invalid" });
      const connected = await connectTelegramToUser(db(), { userId: user.id, tg });
      if (!connected.ok) {
        return Response.json({
          status: "conflict",
          message: connected.reason === "taken" ? "That Telegram account already belongs to another Nia account. Sign out and use Continue with Telegram instead." : "A different Telegram account is already connected.",
        });
      }
      return Response.json({ status: "connected", next: r.nextPath ?? "/" });
    }

    const user = await telegramAccountUser(db(), tg);
    await createSession(user.id, "telegram");
    if (r.merchantId) {
      const customer = await resolveWebCustomer(db(), {
        merchantId: r.merchantId,
        userId: user.id,
        email: user.email,
        name: user.name,
        telegramUserId: user.telegramUserId,
        telegramUsername: user.telegramUsername,
      });
      const guest = await getGuestId(false);
      if (guest) await claimGuestConversations(db(), { merchantId: r.merchantId, customerId: customer.id, guestSessionId: guest });
    }
    return Response.json({ status: "signed_in", next: r.nextPath ?? "/" });
  } catch (err) {
    return fail(err);
  }
}
