/**
 * Customer identity: one customer (per merchant), many channel identities.
 *
 *   WEB_AUTH  — subject = authenticated user id (Telegram or email sign-in)
 *   TELEGRAM  — subject = Telegram user id (verified via the webhook secret)
 *
 * Identities are never matched by display name. A Nia account with a Telegram
 * user id (`users.telegram_user_id`, proven through the bot) is the same customer
 * on the web and in Telegram at every shop. The older per-shop link token
 * (deep link from the profile page) still works.
 */
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import {
  audit,
  bookings,
  conversations,
  customerIdentities,
  customers,
  memoryCandidates,
  memoryRecords,
  orders,
  telegramLinkTokens,
  users,
  type Customer,
  type Db,
} from "@nia/database";
import { AppError } from "@nia/shared";
import { randomToken, sha256Hex } from "@nia/shared/server";

export const LINK_TOKEN_TTL_MS = 10 * 60 * 1000;
export const LINK_TOKEN_PREFIX = "l_";

/** Follow merge pointers to the surviving customer record. */
export async function canonicalCustomer(db: Db, customer: Customer): Promise<Customer> {
  let current = customer;
  for (let i = 0; i < 5 && current.mergedIntoId; i++) {
    const [next] = await db.select().from(customers).where(eq(customers.id, current.mergedIntoId));
    if (!next) break;
    current = next;
  }
  return current;
}

export interface WebUserRef {
  merchantId: string;
  userId: string;
  email?: string | null;
  name?: string | null;
  /** Set when the account signed in with (or connected) Telegram. */
  telegramUserId?: number | null;
  telegramUsername?: string | null;
}

export async function resolveWebCustomer(db: Db, input: WebUserRef): Promise<Customer> {
  const { merchantId, userId } = input;
  const email = input.email?.toLowerCase() ?? null;
  const tg: TelegramUserRef | null = input.telegramUserId
    ? { telegramUserId: input.telegramUserId, displayName: input.name ?? null, username: input.telegramUsername ?? null }
    : null;

  const [existing] = await db
    .select({ customer: customers })
    .from(customerIdentities)
    .innerJoin(customers, eq(customers.id, customerIdentities.customerId))
    .where(and(eq(customerIdentities.merchantId, merchantId), eq(customerIdentities.provider, "WEB_AUTH"), eq(customerIdentities.subject, userId)));
  if (existing) {
    const c = await canonicalCustomer(db, existing.customer);
    await db.update(customers).set({ lastSeenAt: new Date() }).where(eq(customers.id, c.id));
    return tg ? attachTelegramIdentity(db, merchantId, c, tg) : c;
  }

  // First web visit. If this person already chats with the shop's bot, adopt that customer.
  const telegramOnly = tg ? await telegramOnlyCustomer(db, merchantId, tg.telegramUserId) : null;
  const handle = email ?? (tg?.username ? `@${tg.username}` : null);
  const customer = await db.transaction(async (tx) => {
    let c: Customer;
    if (telegramOnly) {
      const [adopted] = await tx.update(customers).set({ userId, email, lastSeenAt: new Date() }).where(eq(customers.id, telegramOnly.id)).returning();
      c = adopted!;
    } else {
      const [created] = await tx
        .insert(customers)
        .values({ merchantId, userId, email, displayName: input.name ?? email?.split("@")[0] ?? null })
        .onConflictDoNothing()
        .returning();
      c = created ?? (await tx.select().from(customers).where(and(eq(customers.merchantId, merchantId), eq(customers.userId, userId))))[0]!;
    }
    await tx
      .insert(customerIdentities)
      .values({ merchantId, customerId: c.id, provider: "WEB_AUTH", subject: userId, displayHandle: handle, verifiedAt: new Date() })
      .onConflictDoNothing();
    return c;
  });
  return tg && !telegramOnly ? attachTelegramIdentity(db, merchantId, customer, tg) : customer;
}

/** The shop's Telegram-only customer (no web account yet) for this Telegram user, if any. */
async function telegramOnlyCustomer(db: Db, merchantId: string, telegramUserId: number): Promise<Customer | null> {
  const [row] = await db
    .select({ customer: customers })
    .from(customerIdentities)
    .innerJoin(customers, eq(customers.id, customerIdentities.customerId))
    .where(and(eq(customerIdentities.merchantId, merchantId), eq(customerIdentities.provider, "TELEGRAM"), eq(customerIdentities.subject, String(telegramUserId))));
  if (!row) return null;
  const c = await canonicalCustomer(db, row.customer);
  return c.userId ? null : c;
}

/**
 * Make this shop's TELEGRAM identity for `tg` point at `primary` (a customer with a
 * web account). A Telegram-only customer from earlier bot chats is merged in; a
 * customer that belongs to a different web account is left alone.
 */
async function attachTelegramIdentity(db: Db, merchantId: string, primary: Customer, tg: TelegramUserRef): Promise<Customer> {
  const subject = String(tg.telegramUserId);
  const [identity] = await db
    .select()
    .from(customerIdentities)
    .where(and(eq(customerIdentities.merchantId, merchantId), eq(customerIdentities.provider, "TELEGRAM"), eq(customerIdentities.subject, subject)));
  if (identity?.customerId === primary.id) return primary;
  if (!identity) {
    await db
      .insert(customerIdentities)
      .values({ merchantId, customerId: primary.id, provider: "TELEGRAM", subject, displayHandle: tg.username ? `@${tg.username}` : tg.displayName, verifiedAt: new Date() })
      .onConflictDoNothing();
    return primary;
  }
  const [holder] = await db.select().from(customers).where(eq(customers.id, identity.customerId));
  const other = holder ? await canonicalCustomer(db, holder) : null;
  if (other && other.id !== primary.id && other.userId && other.userId !== primary.userId) return primary;
  await db.transaction(async (tx) => {
    if (other && other.id !== primary.id) await mergeCustomerInto(tx, other.id, primary.id);
    await tx.update(customerIdentities).set({ customerId: primary.id, verifiedAt: new Date() }).where(eq(customerIdentities.id, identity.id));
  });
  if (other && other.id !== primary.id) {
    await audit(db, { merchantId, actorType: "telegram", actorId: sha256Hex(subject).slice(0, 16), action: "identity.telegram_linked", targetType: "customer", targetId: primary.id, metadata: { merged: true } });
  }
  return primary;
}

/**
 * Fold a duplicate customer into the surviving one. Operational rows move;
 * Walrus memories stay in their namespace and are recalled via the merge pointer.
 */
async function mergeCustomerInto(tx: Db, fromId: string, intoId: string): Promise<void> {
  await tx.update(orders).set({ customerId: intoId }).where(eq(orders.customerId, fromId));
  await tx.update(bookings).set({ customerId: intoId }).where(eq(bookings.customerId, fromId));
  await tx.update(conversations).set({ customerId: intoId }).where(eq(conversations.customerId, fromId));
  await tx.update(memoryRecords).set({ customerId: intoId }).where(eq(memoryRecords.customerId, fromId));
  await tx.update(memoryCandidates).set({ customerId: intoId }).where(eq(memoryCandidates.customerId, fromId));
  await tx.update(customers).set({ mergedIntoId: intoId }).where(eq(customers.id, fromId));
}

export interface TelegramUserRef {
  telegramUserId: number;
  displayName: string | null;
  username: string | null;
}

/**
 * Telegram user → customer at this merchant. If the Telegram account belongs to a
 * Nia account, that account's customer is used (same memory, cart and orders as
 * the web); otherwise a Telegram-only customer is created on first contact.
 */
export async function resolveTelegramCustomer(db: Db, merchantId: string, tg: TelegramUserRef): Promise<Customer> {
  const [owner] = await db.select().from(users).where(eq(users.telegramUserId, tg.telegramUserId));
  if (owner) {
    return resolveWebCustomer(db, { merchantId, userId: owner.id, email: owner.email, name: owner.name, telegramUserId: owner.telegramUserId, telegramUsername: owner.telegramUsername });
  }
  const subject = String(tg.telegramUserId);
  const [existing] = await db
    .select({ customer: customers })
    .from(customerIdentities)
    .innerJoin(customers, eq(customers.id, customerIdentities.customerId))
    .where(and(eq(customerIdentities.merchantId, merchantId), eq(customerIdentities.provider, "TELEGRAM"), eq(customerIdentities.subject, subject)));
  if (existing) {
    const c = await canonicalCustomer(db, existing.customer);
    await db.update(customers).set({ lastSeenAt: new Date() }).where(eq(customers.id, c.id));
    return c;
  }
  return db.transaction(async (tx) => {
    const [customer] = await tx.insert(customers).values({ merchantId, displayName: tg.displayName }).returning();
    await tx.insert(customerIdentities).values({
      merchantId,
      customerId: customer!.id,
      provider: "TELEGRAM",
      subject,
      displayHandle: tg.username ? `@${tg.username}` : tg.displayName,
      verifiedAt: new Date(),
    });
    return customer!;
  });
}

export async function createTelegramLinkToken(db: Db, { merchantId, customerId }: { merchantId: string; customerId: string }): Promise<{ token: string; expiresAt: Date }> {
  const token = `${LINK_TOKEN_PREFIX}${randomToken(24)}`; // 34 chars — fits Telegram's 64-char start parameter
  const expiresAt = new Date(Date.now() + LINK_TOKEN_TTL_MS);
  // Invalidate earlier unused tokens for this customer.
  await db
    .update(telegramLinkTokens)
    .set({ consumedAt: new Date() })
    .where(and(eq(telegramLinkTokens.customerId, customerId), isNull(telegramLinkTokens.consumedAt)));
  await db.insert(telegramLinkTokens).values({ tokenHash: sha256Hex(token), merchantId, customerId, expiresAt });
  return { token, expiresAt };
}

export type LinkResult =
  | { ok: true; merchantId: string; customerId: string; merged: boolean; alreadyLinked: boolean }
  | { ok: false; reason: "invalid" | "expired" | "used" | "linked_elsewhere" };

/**
 * Consume a link token from Telegram /start. Single use; the token row is
 * marked consumed atomically so a replayed deep link fails.
 */
export async function consumeTelegramLinkToken(db: Db, { token, tg }: { token: string; tg: TelegramUserRef }): Promise<LinkResult> {
  if (!token.startsWith(LINK_TOKEN_PREFIX) || token.length > 64) return { ok: false, reason: "invalid" };
  const hash = sha256Hex(token);
  const [row] = await db.select().from(telegramLinkTokens).where(eq(telegramLinkTokens.tokenHash, hash));
  if (!row) return { ok: false, reason: "invalid" };
  if (row.consumedAt) return { ok: false, reason: "used" };
  if (row.expiresAt.getTime() <= Date.now()) return { ok: false, reason: "expired" };

  // Atomic single-use claim.
  const claimed = await db
    .update(telegramLinkTokens)
    .set({ consumedAt: new Date(), consumedByTelegramUserId: tg.telegramUserId })
    .where(and(eq(telegramLinkTokens.id, row.id), isNull(telegramLinkTokens.consumedAt), gt(telegramLinkTokens.expiresAt, new Date())))
    .returning({ id: telegramLinkTokens.id });
  if (claimed.length === 0) return { ok: false, reason: "used" };

  const merchantId = row.merchantId;
  const [target] = await db.select().from(customers).where(and(eq(customers.id, row.customerId), eq(customers.merchantId, merchantId)));
  if (!target) return { ok: false, reason: "invalid" };
  const primary = await canonicalCustomer(db, target);
  const subject = String(tg.telegramUserId);

  const [existingIdentity] = await db
    .select()
    .from(customerIdentities)
    .where(and(eq(customerIdentities.merchantId, merchantId), eq(customerIdentities.provider, "TELEGRAM"), eq(customerIdentities.subject, subject)));

  if (existingIdentity?.customerId === primary.id) {
    return { ok: true, merchantId, customerId: primary.id, merged: false, alreadyLinked: true };
  }

  let merged = false;
  await db.transaction(async (tx) => {
    if (existingIdentity) {
      const [other] = await tx.select().from(customers).where(eq(customers.id, existingIdentity.customerId));
      if (other && other.userId && other.userId !== primary.userId) {
        // That Telegram account belongs to a different signed-in web customer — refuse.
        throw new AppError("CONFLICT", "linked_elsewhere");
      }
      if (other) {
        // Telegram-only customer → merge into the web customer.
        await mergeCustomerInto(tx, other.id, primary.id);
        merged = true;
      }
      await tx.update(customerIdentities).set({ customerId: primary.id, verifiedAt: new Date() }).where(eq(customerIdentities.id, existingIdentity.id));
    } else {
      await tx.insert(customerIdentities).values({
        merchantId,
        customerId: primary.id,
        provider: "TELEGRAM",
        subject,
        displayHandle: tg.username ? `@${tg.username}` : tg.displayName,
        verifiedAt: new Date(),
      });
    }
  }).catch((err) => {
    if ((err as Error).message === "linked_elsewhere") return "linked_elsewhere";
    throw err;
  });

  // Re-check in case the transaction refused.
  const [now] = await db
    .select()
    .from(customerIdentities)
    .where(and(eq(customerIdentities.merchantId, merchantId), eq(customerIdentities.provider, "TELEGRAM"), eq(customerIdentities.subject, subject)));
  if (now?.customerId !== primary.id) return { ok: false, reason: "linked_elsewhere" };

  await audit(db, { merchantId, actorType: "telegram", actorId: sha256Hex(subject).slice(0, 16), action: "identity.telegram_linked", targetType: "customer", targetId: primary.id, metadata: { merged } });
  return { ok: true, merchantId, customerId: primary.id, merged, alreadyLinked: false };
}

export async function unlinkTelegram(db: Db, { merchantId, customerId }: { merchantId: string; customerId: string }): Promise<number> {
  const rows = await db
    .delete(customerIdentities)
    .where(and(eq(customerIdentities.merchantId, merchantId), eq(customerIdentities.customerId, customerId), eq(customerIdentities.provider, "TELEGRAM")))
    .returning({ id: customerIdentities.id });
  return rows.length;
}

export async function customerChannels(db: Db, merchantId: string, customerId: string) {
  return db
    .select({ provider: customerIdentities.provider, handle: customerIdentities.displayHandle, verifiedAt: customerIdentities.verifiedAt })
    .from(customerIdentities)
    .where(and(eq(customerIdentities.merchantId, merchantId), eq(customerIdentities.customerId, customerId)));
}

export async function customerCount(db: Db, merchantId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(customers)
    .where(and(eq(customers.merchantId, merchantId), isNull(customers.mergedIntoId)));
  return row?.n ?? 0;
}
