import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { Badge } from "@nia/ui";
import { conversations, customers, messages } from "@nia/database";
import { formatRelative } from "@nia/shared";
import { EmptyPanel, PageHeader, Table, Td } from "@/components/dashboard/ui";
import { requireMerchant } from "@/lib/access";
import { db } from "@/lib/server";

export const metadata: Metadata = { title: "Conversations" };

export default async function ConversationsPage({ params }: { params: Promise<{ merchantId: string }> }) {
  const { merchantId } = await params;
  const { merchant } = await requireMerchant(merchantId);
  const rows = await db()
    .select({
      c: conversations,
      name: customers.displayName,
      messageCount: sql<number>`(select count(*)::int from ${messages} where ${messages.conversationId} = ${conversations.id})`,
      memoryTurns: sql<number>`(select count(*)::int from ${messages} where ${messages.conversationId} = ${conversations.id} and jsonb_array_length(${messages.memoryUsed}) > 0)`,
    })
    .from(conversations)
    .leftJoin(customers, eq(customers.id, conversations.customerId))
    .where(eq(conversations.merchantId, merchant.id))
    .orderBy(desc(conversations.lastMessageAt))
    .limit(100);

  return (
    <>
      <PageHeader title="Conversations" description="Chats with Nia on your store and in Telegram. Replies informed by memory are marked." />
      {rows.length === 0 ? (
        <EmptyPanel title="No conversations yet" body="Share your store link or Telegram bot. Conversations appear here as they happen." />
      ) : (
        <Table head={["Conversation", "Customer", "Channel", "Messages", "Memory used", "Last activity"]}>
          {rows.map(({ c, name, messageCount, memoryTurns }) => (
            <tr key={c.id} className="hover:bg-surface-2/60">
              <Td className="max-w-72">
                <Link href={`/dashboard/${merchant.id}/conversations/${c.id}`} className="block truncate font-medium hover:underline">
                  {c.title ?? "Conversation"}
                </Link>
                {c.memoryMode === "off" ? <span className="text-xs text-muted-foreground">Memory-off comparison</span> : null}
              </Td>
              <Td>{name ?? <span className="text-muted-foreground">Guest</span>}</Td>
              <Td>
                <Badge tone={c.channel === "telegram" ? "info" : "neutral"}>{c.channel === "telegram" ? "Telegram" : "Web"}</Badge>
              </Td>
              <Td className="tabular">{messageCount}</Td>
              <Td className="tabular">{memoryTurns ? <Badge tone="success">{memoryTurns} replies</Badge> : "—"}</Td>
              <Td className="text-muted-foreground">{formatRelative(c.lastMessageAt)}</Td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
