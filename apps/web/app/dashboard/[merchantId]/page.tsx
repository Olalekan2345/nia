import Link from "next/link";
import { and, count, desc, eq, ne } from "drizzle-orm";
import { ArrowRight, CheckCircle2, Circle } from "lucide-react";
import { Card, CardBody, CardHeader, Badge, buttonClasses } from "@nia/ui";
import { customers, orders, products, services } from "@nia/database";
import { merchantMetrics } from "@nia/commerce";
import { aiConfig, telegramConfig, walrusConfig } from "@nia/config";
import { formatDateTime, formatMoney, ORDER_STATUS_LABELS } from "@nia/shared";
import { PageHeader, Stat } from "@/components/dashboard/ui";
import { RevenueChart } from "@/components/dashboard/revenue-chart";
import { requireMerchant } from "@/lib/access";
import { db } from "@/lib/server";

export default async function OverviewPage({ params }: { params: Promise<{ merchantId: string }> }) {
  const { merchantId } = await params;
  const { merchant } = await requireMerchant(merchantId);
  const base = `/dashboard/${merchant.id}`;
  const m = await merchantMetrics(db(), merchant.id, 30);
  const money = (v: number) => formatMoney(v, merchant.currency, { locale: merchant.locale });

  const [[productCount], [serviceCount], recent] = await Promise.all([
    db().select({ n: count() }).from(products).where(and(eq(products.merchantId, merchant.id), eq(products.active, true))),
    db().select({ n: count() }).from(services).where(and(eq(services.merchantId, merchant.id), eq(services.active, true))),
    db()
      .select({ order: orders, customerName: customers.displayName })
      .from(orders)
      .innerJoin(customers, eq(customers.id, orders.customerId))
      .where(and(eq(orders.merchantId, merchant.id), ne(orders.status, "draft")))
      .orderBy(desc(orders.submittedAt))
      .limit(6),
  ]);

  const delta =
    m.revenuePrevious != null && m.revenuePrevious > 0 ? Math.round(((m.revenue - m.revenuePrevious) / m.revenuePrevious) * 100) : null;

  const checklist = [
    { done: (productCount?.n ?? 0) + (serviceCount?.n ?? 0) > 0, label: "Add products or services", href: `${base}/catalog` },
    { done: aiConfig().configured, label: "AI provider connected (server)", href: `${base}/memory` },
    { done: walrusConfig().configured, label: "Walrus Memory connected (server)", href: `${base}/memory` },
    { done: merchant.deliveryAreas.length > 0 || merchant.fulfillment.pickup, label: "Set delivery areas or pickup", href: `${base}/settings#fulfilment` },
    { done: telegramConfig().configured && merchant.telegramEnabled, label: "Connect Telegram", href: `${base}/settings#telegram` },
    { done: merchant.status === "live", label: "Publish your store", href: `${base}/settings#publish` },
  ];
  const remaining = checklist.filter((c) => !c.done);

  return (
    <>
      <PageHeader
        title="Overview"
        description={`Last 30 days at ${merchant.name}. Every number comes from real orders, conversations and memory writes.`}
        actions={
          <Link href={`/s/${merchant.slug}/chat`} target="_blank" className={buttonClasses({ variant: "secondary" })}>
            Test Nia
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat label="Revenue (paid)" value={money(m.revenue)} hint={delta != null ? `${delta >= 0 ? "+" : ""}${delta}% vs previous 30 days` : "No earlier period to compare"} />
        <Stat label="Orders" value={m.orders} hint={m.ordersAwaiting ? `${m.ordersAwaiting} awaiting your confirmation` : "All caught up"} />
        <Stat label="Active customers" value={m.activeCustomers} hint={`${m.repeatCustomers} repeat customer${m.repeatCustomers === 1 ? "" : "s"}`} />
        <Stat label="Conversations" value={m.conversations} hint={`${m.bookingsUpcoming} upcoming booking${m.bookingsUpcoming === 1 ? "" : "s"}`} />
        <Stat label="Memory-powered reorders" value={m.memoryAssistedOrders} tone="accent" hint="Orders Nia rebuilt from customer memory" />
        <Stat label="Memories on Walrus" value={m.memoriesStored} tone="memory" hint={m.memoriesPending ? `${m.memoriesPending} awaiting confirmation` : "Confirmed by the relayer"} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardBody>
            <RevenueChart data={m.revenueByDay} days={30} currency={merchant.currency} locale={merchant.locale} />
          </CardBody>
        </Card>

        {remaining.length ? (
          <Card>
            <CardHeader title="Get set up" description={`${checklist.length - remaining.length} of ${checklist.length} done`} />
            <CardBody>
              <ul className="space-y-1">
                {checklist.map((c) => (
                  <li key={c.label}>
                    <Link href={c.href} className="flex items-center gap-3 rounded-xl px-2 py-2 text-sm hover:bg-surface-2">
                      {c.done ? <CheckCircle2 className="size-5 text-success" aria-hidden="true" /> : <Circle className="size-5 text-muted-foreground" aria-hidden="true" />}
                      <span className={c.done ? "text-muted-foreground line-through" : "font-medium"}>{c.label}</span>
                      <span className="sr-only">{c.done ? "(done)" : "(to do)"}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </CardBody>
          </Card>
        ) : (
          <Card>
            <CardHeader title="Store health" description="Everything is connected." />
            <CardBody className="text-sm text-muted-foreground">Customers can chat on the web and in Telegram, and Nia is saving memory to Walrus.</CardBody>
          </Card>
        )}
      </div>

      <Card className="mt-6">
        <CardHeader
          title="Recent orders"
          action={
            <Link href={`${base}/orders`} className="inline-flex items-center gap-1 text-sm font-semibold text-accent-strong hover:underline">
              All orders <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          }
        />
        <CardBody>
          {recent.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No orders yet. Share your store link or Telegram bot to get started.</p>
          ) : (
            <ul className="divide-y divide-border">
              {recent.map(({ order: o, customerName }) => (
                <li key={o.id}>
                  <Link href={`${base}/orders/${o.id}`} className="flex items-center gap-4 py-3 hover:opacity-80">
                    <span className="w-14 font-semibold tabular">#{o.number}</span>
                    <span className="min-w-0 flex-1 truncate">{customerName ?? "Customer"}</span>
                    {o.memoryAssisted ? <Badge tone="success">Memory reorder</Badge> : null}
                    <Badge tone={o.status === "awaiting_confirmation" ? "warning" : "neutral"}>{ORDER_STATUS_LABELS[o.status]}</Badge>
                    <span className="hidden w-28 text-right text-sm text-muted-foreground sm:block">{o.submittedAt ? formatDateTime(o.submittedAt, { timeZone: merchant.timezone, withTime: false }) : ""}</span>
                    <span className="w-24 text-right font-semibold tabular">{o.hasUnpricedItems ? "Quote" : money(o.total)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
      <p className="mt-6 text-xs text-muted-foreground">Timezone: {merchant.timezone} · Currency: {merchant.currency}</p>
    </>
  );
}
