import type { Metadata } from "next";
import Link from "next/link";
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { Badge, cn } from "@nia/ui";
import { customers, orders } from "@nia/database";
import { ORDER_STATUS_LABELS, formatDateTime, formatMoney, type OrderStatus } from "@nia/shared";
import { EmptyPanel, PageHeader, Table, Td } from "@/components/dashboard/ui";
import { requireMerchant } from "@/lib/access";
import { db } from "@/lib/server";

export const metadata: Metadata = { title: "Orders" };

const FILTERS: { key: string; label: string; statuses: OrderStatus[] | null }[] = [
  { key: "all", label: "All", statuses: null },
  { key: "new", label: "Needs confirmation", statuses: ["awaiting_confirmation"] },
  { key: "active", label: "In progress", statuses: ["confirmed", "paid", "processing", "ready", "dispatched"] },
  { key: "done", label: "Delivered", statuses: ["delivered"] },
  { key: "closed", label: "Cancelled / refunded", statuses: ["cancelled", "refunded"] },
];

export default async function OrdersPage({ params, searchParams }: { params: Promise<{ merchantId: string }>; searchParams: Promise<{ f?: string }> }) {
  const [{ merchantId }, { f }] = await Promise.all([params, searchParams]);
  const { merchant } = await requireMerchant(merchantId);
  const filter = FILTERS.find((x) => x.key === f) ?? FILTERS[0]!;
  const base = `/dashboard/${merchant.id}/orders`;
  const rows = await db()
    .select({ o: orders, name: customers.displayName })
    .from(orders)
    .innerJoin(customers, eq(customers.id, orders.customerId))
    .where(and(eq(orders.merchantId, merchant.id), ne(orders.status, "draft"), ...(filter.statuses ? [inArray(orders.status, filter.statuses)] : [])))
    .orderBy(desc(orders.submittedAt))
    .limit(200);

  return (
    <>
      <PageHeader title="Orders" description="Orders customers confirmed on the web or in Telegram. Payments are never marked paid automatically unless a verified payment provider confirms them." />
      <nav aria-label="Filter orders" className="scrollbar-none mb-4 flex gap-2 overflow-x-auto">
        {FILTERS.map((x) => (
          <Link key={x.key} href={x.key === "all" ? base : `${base}?f=${x.key}`} aria-current={x === filter ? "page" : undefined} className={cn("shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-semibold", x === filter ? "border-foreground bg-foreground text-background" : "border-border bg-surface hover:bg-surface-2")}>
            {x.label}
          </Link>
        ))}
      </nav>
      {rows.length === 0 ? (
        <EmptyPanel title="No orders here" body="Orders appear when customers confirm their cart." />
      ) : (
        <Table head={["Order", "Customer", "Status", "Payment", "Channel", "Placed", "Total"]}>
          {rows.map(({ o, name }) => (
            <tr key={o.id} className="hover:bg-surface-2/60">
              <Td>
                <Link href={`${base}/${o.id}`} className="font-semibold hover:underline">
                  #{o.number}
                </Link>
                {o.memoryAssisted ? <Badge tone="success" className="ml-2">Memory</Badge> : null}
              </Td>
              <Td>{name ?? "Customer"}</Td>
              <Td>
                <Badge tone={o.status === "awaiting_confirmation" ? "warning" : o.status === "cancelled" ? "danger" : o.status === "delivered" ? "success" : "neutral"}>{ORDER_STATUS_LABELS[o.status]}</Badge>
              </Td>
              <Td className="text-muted-foreground">{o.paymentStatus}</Td>
              <Td className="text-muted-foreground">{o.channel}</Td>
              <Td className="text-muted-foreground">{o.submittedAt ? formatDateTime(o.submittedAt, { timeZone: merchant.timezone }) : "—"}</Td>
              <Td className="text-right font-semibold tabular">{o.hasUnpricedItems ? "Quote" : formatMoney(o.total, o.currency, { locale: merchant.locale })}</Td>
            </tr>
          ))}
        </Table>
      )}
    </>
  );
}
