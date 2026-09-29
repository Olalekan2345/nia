import type { Metadata } from "next";
import Link from "next/link";
import { getConversationForCustomer, isAiConfigured, listConversationMessages, type NiaUIMessage } from "@nia/ai";
import { newId } from "@nia/shared/server";
import { ChatView } from "@/components/chat/chat-view";
import { getGuestId } from "@/lib/auth";
import { loadMarket } from "@/lib/market";
import { db, memoryStore } from "@/lib/server";

export const metadata: Metadata = { title: "Ask Nia" };
export const dynamic = "force-dynamic";

export default async function MarketNiaPage({ searchParams }: { searchParams: Promise<{ c?: string; q?: string; send?: string }> }) {
  const sp = await searchParams;
  const sf = await loadMarket();
  if (!sf) {
    return (
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="font-semibold">Nia’s market guide isn’t set up on this deployment yet.</p>
        <p className="mt-2 text-sm text-muted-foreground">Run the seed (pnpm db:seed) to create the Walrus Market record.</p>
        <Link href="/market" className="mt-4 inline-block text-sm font-semibold text-accent-strong hover:underline">
          Back to the market
        </Link>
      </main>
    );
  }
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

  const store = memoryStore();
  const q = sp.q?.slice(0, 300);
  return (
    <main className="fixed inset-x-0 top-[7.5rem] bottom-0 z-20 mx-auto max-w-3xl md:static md:h-[calc(100dvh-4rem-2.5rem)] md:py-4">
      <div className="h-full overflow-hidden bg-surface md:rounded-[32px] md:border md:border-ink-900/[0.06] md:shadow-lift">
        <ChatView
          slug={merchant.slug}
          shopName="Walrus Market"
          locale={merchant.locale}
          timeZone={merchant.timezone}
          conversationId={conversationId ?? newId()}
          initialMessages={initialMessages}
          signedIn={Boolean(user)}
          customerName={customer?.displayName ?? null}
          memory={{
            enabled: Boolean(merchant.niaSettings.memoryEnabled && (customer ? customer.memoryEnabled : true)),
            backend: store?.backend ?? null,
            network: store?.network ?? null,
          }}
          aiConfigured={isAiConfigured()}
          suggestions={["Help me choose a gift", "I need fabric for an owambe", "Something sweet for a birthday", "I want to book a hair appointment"]}
          initialPrompt={q ? { text: q, send: sp.send === "1" } : null}
          headerNote="Your Walrus Market shopping guide"
          intro="Tell me what you’re after. I’ll ask a quick question or two, then find the best options across every shop."
          paths={{ signIn: "/market/signin?next=/market/nia", profile: "/market/profile", newChat: "/market/nia" }}
        />
      </div>
    </main>
  );
}
