import type { Metadata } from "next";
import { and, desc, eq, gt, ne } from "drizzle-orm";
import { conversations, messages } from "@nia/database";
import { env } from "@nia/config";
import { getConversationForCustomer, isAiConfigured, listConversationMessages, type NiaUIMessage } from "@nia/ai";
import { getCustomerRecentOrders, listCategories, searchServices } from "@nia/commerce";
import { newId } from "@nia/shared/server";
import { ChatView } from "@/components/chat/chat-view";
import { getGuestId } from "@/lib/auth";
import { getStorefront } from "@/lib/storefront";
import { db, memoryStore } from "@/lib/server";
import { botLink } from "@/lib/telegram";

export const metadata: Metadata = { title: "Chat with Nia" };

export default async function ChatPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ c?: string; q?: string; send?: string; memory?: string }> }) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const sf = await getStorefront(slug);
  const { merchant, customer, user } = sf;
  const guestId = customer ? null : await getGuestId(false);

  let conversationId: string | null = null;
  let initialMessages: NiaUIMessage[] = [];
  if (sp.c && /^[0-9a-f-]{36}$/i.test(sp.c)) {
    const conv = await getConversationForCustomer(db(), { merchantId: merchant.id, customerId: customer?.id ?? null, guestSessionId: guestId, conversationId: sp.c });
    if (conv) {
      conversationId = conv.id;
      const rows = await listConversationMessages(db(), conv.id);
      initialMessages = rows.slice(-40).map((r) => ({
        id: r.id,
        role: r.role,
        metadata: { conversationId: conv.id, createdAt: r.createdAt.toISOString() },
        parts: (r.parts.length ? r.parts : [{ type: "text", text: r.content }]) as NiaUIMessage["parts"],
      }));
    }
  }

  const [orders, services, categories] = await Promise.all([
    customer ? getCustomerRecentOrders(db(), merchant.id, customer.id, 1) : Promise.resolve([]),
    searchServices(db(), merchant.id, merchant.timezone, { limit: 1 }),
    listCategories(db(), merchant.id),
  ]);
  const suggestions = [
    orders.length ? "Same as last time" : null,
    customer ? "What do I normally like?" : null,
    categories[0] ? `What ${categories[0].toLowerCase()} do you have in stock?` : "What do you have in stock?",
    services.length ? `I'd like to book ${services[0]!.name.toLowerCase()}` : null,
    !customer ? "What are your delivery options?" : null,
  ].filter(Boolean) as string[];

  const store = memoryStore();
  const allowOff = sf.isMember && env().NIA_DEMO_MODE && sp.memory === "off";
  const q = sp.q?.slice(0, 300);
  const chatId = conversationId ?? newId();
  const telegramUrl = user?.telegramUserId && merchant.telegramEnabled ? botLink(`c_${chatId}`) : null;
  const resume = !conversationId && customer ? await recentTelegramChat(merchant.id, customer.id, slug) : null;

  return (
    <main className="fixed inset-x-0 top-14 bottom-0 z-20 mx-auto max-w-3xl md:static md:h-[calc(100dvh-4rem-2.5rem)] md:py-4">
      <div className="h-full overflow-hidden bg-surface md:rounded-[32px] md:border md:border-ink-900/[0.06] md:shadow-lift">
        <ChatView
          slug={slug}
          shopName={merchant.name}
          locale={merchant.locale}
          timeZone={merchant.timezone}
          conversationId={chatId}
          initialMessages={initialMessages}
          signedIn={Boolean(user)}
          customerName={customer?.displayName ?? null}
          memory={{
            enabled: Boolean(merchant.niaSettings.memoryEnabled && (customer ? customer.memoryEnabled : true)),
            backend: store?.backend ?? null,
            network: store?.network ?? null,
          }}
          aiConfigured={isAiConfigured()}
          suggestions={suggestions.slice(0, 4)}
          initialPrompt={q ? { text: q, send: sp.send === "1" } : null}
          memoryMode={allowOff ? "off" : "on"}
          showExtraction={sf.isMember && env().NIA_DEMO_MODE}
          telegramUrl={telegramUrl}
          resume={resume}
        />
      </div>
    </main>
  );
}

/** The customer's Telegram conversation from the last 12 hours, to pick up on the web. */
async function recentTelegramChat(merchantId: string, customerId: string, slug: string): Promise<{ href: string; preview: string } | null> {
  const [conv] = await db()
    .select({ id: conversations.id, channel: conversations.channel })
    .from(conversations)
    .where(and(eq(conversations.merchantId, merchantId), eq(conversations.customerId, customerId), ne(conversations.memoryMode, "off"), gt(conversations.lastMessageAt, new Date(Date.now() - 12 * 3600_000))))
    .orderBy(desc(conversations.lastMessageAt))
    .limit(1);
  if (!conv) return null;
  const [last] = await db().select({ content: messages.content, channel: messages.channel }).from(messages).where(eq(messages.conversationId, conv.id)).orderBy(desc(messages.createdAt)).limit(1);
  if (!last || last.channel !== "telegram") return null;
  return { href: `/s/${slug}/chat?c=${conv.id}`, preview: last.content.replace(/\s+/g, " ").slice(0, 120) };
}
