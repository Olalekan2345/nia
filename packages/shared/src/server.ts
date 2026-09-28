/**
 * Server-only helpers (Node crypto). Import from "@nia/shared/server".
 * Never import this module from client components.
 */
import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

export function newId(): string {
  return randomUUID();
}

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

export function hmacHex(secret: string, input: string): string {
  return createHmac("sha256", secret).update(input, "utf8").digest("hex");
}

/** Cryptographically random URL-safe token. 32 bytes → 43 chars. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** Numeric one-time code (uniform, no modulo bias). */
export function randomNumericCode(length = 6): string {
  let out = "";
  while (out.length < length) {
    const byte = randomBytes(1)[0]!;
    if (byte < 250) out += String(byte % 10);
  }
  return out;
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}

/** Short, stable, non-reversible reference for logs (never log raw ids of people). */
export function opaqueRef(value: string, secret = "nia"): string {
  return hmacHex(secret, value).slice(0, 16);
}
