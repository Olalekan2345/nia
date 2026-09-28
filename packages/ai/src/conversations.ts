/**
 * Conversation + message persistence. History sent to the model is always
 * loaded from the database — never trusted from the client.
 */
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { conversations, messages, type Conversation, type Db, type MemoryUsage } from "@nia/database";
import { redactSensitive, truncate, type Channel } from "@nia/shared";

export async function getConversationForCustomer(
  db: Db,
  { merchantId, customerId, guestSessionId, conversationId }: { merchantId: string; customerId: string | null; guestSessionId: string | null; conversationId: string },
): Promise<Conversation | null> {
  const [c] = await db.select().from(conversations).where(and(eq(conversations.id, conversationId), eq(conversations.merchantId, merchantId)));
  if (!c) return null;
  if (customerId && c.customerId === customerId) return c;
  if (!c.customerId && guestSessionId && c.guestSessionId === guestSessionId) return c;
  return null;
}

export async function createConversation(
  db: Db,
  input: { id?: string; merchantId: string; customerId: string | null; guestSessionId?: string | null; channel: Channel; memoryMode?: "on" | "off" },
): Promise<Conversation> {
  const [c] = await db
    .insert(conversations)
    .values({
      ...(input.id ? { id: input.id } : {}),
      merchantId: input.merchantId,
      customerId: input.customerId,
      guestSessionId: input.customerId ? null : (input.guestSessionId ?? null),
      channel: input.channel,
      memoryMode: input.memoryMode ?? "on",
    })
    .returning();
  return c!;
}

/** Guest signed in → their guest conversations at this merchant become theirs. */
export async function claimGuestConversations(db: Db, { merchantId, customerId, guestSessionId }: { merchantId: string; customerId: string; guestSessionId: string }): Promise<number> {
  const rows = await db
    .update(conversations)
    .set({ customerId, guestSessionId: null })
    .where(and(eq(conversations.merchantId, merchantId), eq(conversations.guestSessionId, guestSessionId), sql`${conversations.customerId} is null`))
    .returning({ id: conversations.id });
  return rows.length;
}

export async function loadHistory(db: Db, conversationId: string, limit = 12): Promise<{ id: string; role: "user" | "assistant"; text: string }[]> {
  const rows = await db
    .select({ id: messages.id, role: messages.role, content: messages.content })
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(desc(messages.createdAt))
    .limit(limit);
  return rows.reverse().map((r) => ({ id: r.id, role: r.role, text: r.content }));
}

export async function listConversationMessages(db: Db, conversationId: string) {
  return db.select().from(messages).where(eq(messages.conversationId, conversationId)).orderBy(asc(messages.createdAt));
}

export async function saveUserMessage(
  db: Db,
  { conversation, text, channel, externalId }: { conversation: Conversation; text: string; channel: Channel; externalId?: string | null },
): Promise<{ id: string; text: string }> {
  // Sensitive values are never stored — not even in the transcript.
  const clean = redactSensitive(text).text;
  const [row] = await db
    .insert(messages)
    .values({ conversationId: conversation.id, merchantId: conversation.merchantId, role: "user", content: clean, parts: [{ type: "text", text: clean }], channel, externalId: externalId ?? null })
    .returning({ id: messages.id });
  await db
    .update(conversations)
    .set({ lastMessageAt: new Date(), ...(conversation.title ? {} : { title: truncate(clean, 60) }) })
    .where(eq(conversations.id, conversation.id));
  return { id: row!.id, text: clean };
}

export async function saveAssistantMessage(
  db: Db,
  { conversation, text, parts, memoryUsed, channel, id }: { conversation: Conversation; text: string; parts: unknown[]; memoryUsed: MemoryUsage[]; channel: Channel; id?: string },
): Promise<string> {
  const [row] = await db
    .insert(messages)
    .values({ ...(id ? { id } : {}), conversationId: conversation.id, merchantId: conversation.merchantId, role: "assistant", content: text, parts, memoryUsed, channel })
    .returning({ id: messages.id });
  await db.update(conversations).set({ lastMessageAt: new Date() }).where(eq(conversations.id, conversation.id));
  return row!.id;
}

/** Replace the parts of a stored assistant message (e.g. once memory receipts are confirmed). */
export async function updateAssistantParts(db: Db, messageId: string, parts: unknown[]): Promise<void> {
  await db.update(messages).set({ parts }).where(eq(messages.id, messageId));
}
