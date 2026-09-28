import "server-only";
import { headers } from "next/headers";
import { appUrl } from "@nia/config";
import { checkRateLimit } from "@nia/database";
import { AppError } from "@nia/shared";
import { sha256Hex } from "@nia/shared/server";
import { db } from "./server";

export function clientIpFrom(h: Headers): string {
  const fwd = h.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return h.get("x-real-ip") ?? "local";
}

export async function clientIp(): Promise<string> {
  return clientIpFrom(await headers());
}

/**
 * CSRF defence for cookie-authenticated JSON endpoints: the Origin must match
 * this deployment. (Server Actions get the same check from Next.js.)
 */
export function assertSameOrigin(req: Request): void {
  const origin = req.headers.get("origin");
  if (!origin) throw new AppError("FORBIDDEN", "Missing origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new AppError("FORBIDDEN", "Bad origin");
  }
  const allowed = new Set([host, new URL(appUrl()).host].filter(Boolean));
  if (!allowed.has(originHost)) throw new AppError("FORBIDDEN", "Cross-site request blocked");
}

/** Rate-limit by an arbitrary key (hashed so raw emails/IPs never sit in the table). */
export async function limit(key: string, max: number, windowSeconds: number): Promise<void> {
  const res = await checkRateLimit(db(), sha256Hex(key).slice(0, 40), { limit: max, windowSeconds });
  if (!res.allowed) {
    const wait = Math.max(1, Math.ceil((res.resetAt.getTime() - Date.now()) / 1000));
    throw new AppError("RATE_LIMITED", `Too many attempts — try again in ${wait < 90 ? `${wait}s` : `${Math.ceil(wait / 60)} min`}.`);
  }
}
