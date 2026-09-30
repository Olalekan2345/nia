/**
 * The scope every tool is bound to, and the result guard all tools share.
 * (Kept apart from tools.ts so the shop, market and agent tool files can all
 * import it without a cycle.)
 */
import type { Db, Merchant } from "@nia/database";
import type { MemoryStore, RecalledMemory } from "@nia/memory";
import { formatMoney, isAppError, type Channel } from "@nia/shared";
import type { SessionHandle } from "./session";

export interface NiaToolScope {
  db: Db;
  store: MemoryStore | null;
  merchant: Merchant;
  customerId: string | null;
  customerMemoryEnabled: boolean;
  channel: Channel;
  conversationId: string;
  memoryMode: "on" | "off";
  /** Memories shown to the model this turn (refs M1.., B1..). Tools may append. */
  recalled: { customer: RecalledMemory[]; merchant: RecalledMemory[] };
  /** Side-channel flags for the orchestrator. */
  flags: { memoryAssisted: boolean; forgotten: string[] };
  /** This conversation's shopping session (current goal, results shown, shortlist, list, basket). */
  session: SessionHandle;
}

type Fail = { ok: false; error: string; code?: "SIGN_IN_REQUIRED" | "MEMORY_OFF" | "NOT_FOUND" | "INVALID" };

export function fail(error: string, code?: Fail["code"]): Fail {
  return { ok: false, error, ...(code ? { code } : {}) };
}

const MONEY_FIELDS = new Set(["price", "priceMin", "priceMax", "unitPrice", "lineTotal", "deliveryFee", "subtotal", "total", "depositAmount", "budget", "remaining", "overBudgetBy", "from", "to"]);

/**
 * Amounts in tool results are minor units (kobo, cents) — exact, for the UI cards.
 * A model reads `price: 750000` as ₦750,000, so every amount also gets a formatted
 * `…Label` ("₦7,500") and the prompt says to quote only those.
 */
export function withMoneyLabels<T>(value: T, locale: string, currency?: string): T {
  if (Array.isArray(value)) return value.map((v) => withMoneyLabels(v, locale, currency)) as T;
  if (!value || typeof value !== "object" || value instanceof Date) return value;
  const obj = value as Record<string, unknown>;
  const cur = typeof obj.currency === "string" ? obj.currency : currency;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    out[k] = withMoneyLabels(v, locale, cur);
    if (cur && MONEY_FIELDS.has(k) && typeof v === "number") out[`${k}Label`] = formatMoney(v, cur, { locale });
  }
  return out as T;
}

/** Every tool result: errors become typed failures, amounts get human-readable labels. */
export function toolGuard(merchant: Pick<Merchant, "locale" | "currency">) {
  return <T,>(fn: () => Promise<T>) => guardRaw(async () => withMoneyLabels(await fn(), merchant.locale, merchant.currency));
}

async function guardRaw<T>(fn: () => Promise<T>): Promise<T | Fail> {
  try {
    return await fn();
  } catch (err) {
    if (isAppError(err)) return fail(err.message, err.code === "NOT_FOUND" ? "NOT_FOUND" : "INVALID");
    console.error("[nia tool] unexpected error", err);
    return fail("Something went wrong on our side. Please try again.");
  }
}
