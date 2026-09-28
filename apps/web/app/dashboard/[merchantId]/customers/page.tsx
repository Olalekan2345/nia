import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { Badge } from "@nia/ui";
import { customerIdentities, customers, memoryRecords, orders } from "@nia/database";
import { formatMoney, formatRelative } from "@nia/shared";
import { EmptyPanel, PageHeader, Table, Td } from "@/components/dashboard/ui";
import { requireMerchant } from "@/lib/access";
import { db } from "@/lib/server";

export const metadata: Metadata = { title: "Customers" };

export default async function CustomersPage({ params }: { params: Promise<{ merchantId: string }> }) {
  const { merchantId } = await params;
  const { merchant } = await requireMerchant(merchantId);
  const base = `/dashboard/${merchant.id}`;

  const rows = await db()
    .select({
      customer: customers,
      channels: sql<string[]>`coalesce((select array_agg(distinct ${customerIdentities.provider}) from ${customerIdentities} where ${customerIdentities.customerId} = ${customers.id}), '{}')`,
      orderCount: sql<number>`(select count(*)::int from ${orders} where ${orders.customerId} = ${customers.id} and ${orders.status} <> 'draft')`,
      spend: sql<number>`(select coalesce(sum(${orders.total}),0)::bigint from ${orders} where ${orders.customerId} = ${customers.id} and ${orders.status} in ('paid','processing','ready','dispatched','delivered'))`,
      memories: sql<number>`(select count(*)::int from ${memoryRecords} where ${memoryRecords.customerId} = ${customers.id} and ${memoryRecords.persistStatus} = 'stored' and ${memoryRecords.lifecycle} = 'active')`,
    })
    .from(customers)
    .where(and(eq(customers.merchantId, merchant.id), isNull(customers.mergedIntoId)))
    .orderBy(desc(customers.lastSeenAt))
    .limit(200);

  return (
    <>
      <PageHeader title="Customers" description="Everyone who has signed in to chat, order or book — on the web or in Telegram." />
      {rows.length === 0 ? (
        <EmptyPanel title="No customers yet" body="Customers appear here after they sign in on your store or message your Telegram bot." />
      ) : (
        <Table head={["Customer", "Channels", "Orders", "Spend", "Memories", "Last seen"]}>
          {rows.map(({ customer: c, channels, orderCount, spend, memories }) => (
            <tr key={c.id} className="hover:bg-surface-2/60">
              <Td>
                <Link href={`${base}/customers/${c.id}`} className="font-medium hover:underline">
                  {c.displayName ?? "Customer"}
                </Link>
                <p className="text-xs text-muted-foreground">{c.email ?? "—"}</p>
              </Td>
              <Td>
                <div className="flex flex-wrap gap-1">
                  {channels.includes("WEB_AUTH") ? <Badge tone="neutral">Web</Badge> : null}
                  {channels.includes("TELEGRAM") ? <Badge tone="info">Telegram</Badge> : null}
                </div>
              </Td>
              <Td className="tabular">{orderCount}</Td>
              <Td className="tabular">{formatMoney(Number(spend), merchant.currency, { locale: merchant.locale })}</Td>
              <Td className="tabular">
                {memories}
                {!c.memoryEnabled ? <span className="ml-2 text-xs text-muted-foreground">(memory off)</span> : null}
              </Td>
              <Td className="text-muted-foreground">{formatRelative(c.lastSeenAt)}</Td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
