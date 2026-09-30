/**
 * Shopping session state (see ShoppingSession in @nia/shared): the current
 * goal and what Nia has shown in THIS conversation. Kept on the conversation
 * row, so it follows the conversation across web and Telegram, and fed back
 * to the model as <nia_session> — the model otherwise only sees past text,
 * not past tool results ("the second one", "compare these", "make it cheaper").
 *
 * Not long-term memory: nothing here is written to Walrus.
 */
import { and, desc, eq, gt, ne, sql } from "drizzle-orm";
import { conversations, type Db } from "@nia/database";
import { SESSION_LIMITS, type SessionItem, type ShoppingIntent, type ShoppingSession } from "@nia/shared";

/** Patch the session in memory and persist it (writes are serialised per turn). */
export interface SessionHandle {
  readonly current: ShoppingSession;
  update(fn: (s: ShoppingSession) => ShoppingSession): Promise<void>;
}

export function sessionHandle(db: Db, conversationId: string, initial: ShoppingSession | null | undefined): SessionHandle {
  let state: ShoppingSession = initial && typeof initial === "object" ? { ...initial } : {};
  let queue: Promise<void> = Promise.resolve();
  return {
    get current() {
      return state;
    },
    update(fn) {
      state = clampSession({ ...fn(state), updatedAt: new Date().toISOString() });
      const snapshot = state;
      queue = queue.then(() => db.update(conversations).set({ session: snapshot }).where(eq(conversations.id, conversationId)).then(() => undefined));
      return queue;
    },
  };
}

function clampSession(s: ShoppingSession): ShoppingSession {
  return {
    ...s,
    ...(s.lastResults ? { lastResults: s.lastResults.slice(0, SESSION_LIMITS.lastResults) } : {}),
    ...(s.shortlist ? { shortlist: dedupe(s.shortlist).slice(0, SESSION_LIMITS.shortlist) } : {}),
    ...(s.list ? { list: [...new Set(s.list.map((i) => i.trim()).filter(Boolean))].slice(0, SESSION_LIMITS.list) } : {}),
  };
}

function dedupe(items: SessionItem[]): SessionItem[] {
  const seen = new Set<string>();
  return items.filter((i) => (seen.has(i.id) ? false : (seen.add(i.id), true)));
}

/** Merge newly stated constraints into the current intent; an explicit empty value clears a field. */
export function mergeIntent(prev: ShoppingIntent | undefined, next: ShoppingIntent): ShoppingIntent {
  const out: ShoppingIntent = { ...(prev ?? {}) };
  for (const [k, v] of Object.entries(next) as [keyof ShoppingIntent, ShoppingIntent[keyof ShoppingIntent]][]) {
    if (v === undefined) continue;
    if (v === "" || (Array.isArray(v) && v.length === 0)) delete out[k];
    else (out as Record<string, unknown>)[k] = v;
  }
  return out;
}

const clean = (t: string, max = 60) => t.replace(/[<>\n]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

function itemLine(prefix: string, i: SessionItem, n: number): string {
  return `${prefix}${n + 1}: ${clean(i.name)}${i.shop ? ` — ${clean(i.shop, 40)}` : ""}${i.price ? ` — ${i.price}` : ""} (id ${i.id})`;
}

/** Compact prompt block. Empty sessions add nothing. */
export function formatSession(s: ShoppingSession | null | undefined, opts: { label?: string } = {}): string {
  if (!s) return "";
  const lines: string[] = [];
  const it = s.intent;
  if (it && Object.keys(it).length) {
    const parts = [
      it.goal && `goal: ${clean(it.goal)}`,
      it.recipient && `for: ${clean(it.recipient, 40)}`,
      it.occasion && `occasion: ${clean(it.occasion, 40)}`,
      it.budgetMax != null && `budget up to ${it.budgetMax}`,
      it.budgetMin != null && `from ${it.budgetMin}`,
      it.colour && `colour: ${clean(it.colour, 30)}`,
      it.size && `size: ${clean(it.size, 20)}`,
      it.excluded?.length && `never: ${it.excluded.map((e) => clean(e, 20)).join(", ")}`,
      it.preferred?.length && `prefers: ${it.preferred.map((e) => clean(e, 20)).join(", ")}`,
    ].filter(Boolean);
    if (parts.length) lines.push(`Current goal (this conversation only): ${parts.join("; ")}`);
  }
  if (s.lastResults?.length) lines.push("Last shown, in order:", ...s.lastResults.map((i, n) => itemLine("R", i, n)));
  if (s.shortlist?.length) lines.push("Saved by the customer:", ...s.shortlist.map((i, n) => itemLine("S", i, n)));
  if (s.list?.length) lines.push(`Shopping list: ${s.list.map((i) => clean(i, 40)).join("; ")}`);
  if (s.basket?.lines.length) {
    lines.push(`Proposed basket "${clean(s.basket.goal)}"${s.basket.budget != null ? ` (budget ${s.basket.budget})` : ""}: slots ${s.basket.slots.map((x) => `${clean(x.label, 24)}="${clean(x.query, 40)}"${x.quantity ? `×${x.quantity}` : ""}`).join(", ")}`);
  }
  if (!lines.length) return "";
  return `<nia_session${opts.label ? ` from="${opts.label}"` : ""}>\n${lines.join("\n")}\n</nia_session>`;
}

/** "Let's continue", "those laptops again", "did you find anything?" — the customer is picking up earlier shopping. */
export const CONTINUE_TALK = /\b(?:continue|carry on|pick up where|where (?:were|was) we|those (?:\w+ ){0,2}again|show (?:me )?(?:those|them|that) again|did you find|anything yet|earlier|last time we|we were (?:looking|talking)|saved|shortlist|my list)\b/i;

const RESUME_WINDOW_DAYS = 14;

/**
 * The customer's most recent other conversation at this merchant with unfinished
 * shopping (a shortlist, a basket, a list or a goal) from the last two weeks.
 * Only used when they ask to continue — Nia doesn't resurrect old shopping unprompted.
 */
export async function previousSession(db: Db, { merchantId, customerId, excludeConversationId }: { merchantId: string; customerId: string; excludeConversationId: string }) {
  const [row] = await db
    .select({ id: conversations.id, session: conversations.session, lastMessageAt: conversations.lastMessageAt })
    .from(conversations)
    .where(
      and(
        eq(conversations.merchantId, merchantId),
        eq(conversations.customerId, customerId),
        ne(conversations.id, excludeConversationId),
        ne(conversations.memoryMode, "off"),
        gt(conversations.lastMessageAt, new Date(Date.now() - RESUME_WINDOW_DAYS * 86400_000)),
        sql`${conversations.session} ?| array['shortlist','basket','list','intent']`,
      ),
    )
    .orderBy(desc(conversations.lastMessageAt))
    .limit(1);
  return row ?? null;
}
