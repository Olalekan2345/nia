import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { Badge, Card, CardBody, CardHeader } from "@nia/ui";
import { conversations, customers } from "@nia/database";
import { customerChannels, getCustomerBookings, getCustomerRecentOrders } from "@nia/commerce";
import { customerPassport } from "@nia/memory";
import { CONFIRMATION_LABELS, MEMORY_TYPE_META, formatDateTime, formatMoney } from "@nia/shared";
import { PageHeader } from "@/components/dashboard/ui";
import { RestoreButton } from "@/components/dashboard/restore-button";
import { requireMerchant } from "@/lib/access";
import { db } from "@/lib/server";

export const metadata: Metadata = { title: "Customer" };

export default async function CustomerDetail({ params }: { params: Promise<{ merchantId: string; customerId: string }> }) {
  const { merchantId, customerId } = await params;
  const { merchant, role } = await requireMerchant(merchantId);
  if (!/^[0-9a-f-]{36}$/i.test(customerId)) notFound();
  const [c] = await db().select().from(customers).where(and(eq(customers.id, customerId), eq(customers.merchantId, merchant.id)));
  if (!c) notFound();
  const base = `/dashboard/${merchant.id}`;

  const [channels, passport, orderList, bookingList, convs] = await Promise.all([
    customerChannels(db(), merchant.id, c.id),
    customerPassport(db(), { merchantId: merchant.id, customerId: c.id }),
    getCustomerRecentOrders(db(), merchant.id, c.id, 10),
    getCustomerBookings(db(), merchant.id, c.id, 10),
    db().select().from(conversations).where(and(eq(conversations.merchantId, merchant.id), eq(conversations.customerId, c.id))).orderBy(desc(conversations.lastMessageAt)).limit(10),
  ]);
  const active = passport.filter((p) => p.lifecycle === "active");
  const history = passport.filter((p) => p.lifecycle === "superseded");

  return (
    <>
      <Link href={`${base}/customers`} className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden="true" /> Customers
      </Link>
      <PageHeader
        title={c.displayName ?? "Customer"}
        description={
          <span className="flex flex-wrap items-center gap-2">
            {c.email ?? "No email"} ·{" "}
            {channels.map((ch) => (
              <Badge key={ch.provider} tone={ch.provider === "TELEGRAM" ? "info" : "neutral"}>
                {ch.provider === "TELEGRAM" ? `Telegram ${ch.handle ?? ""}` : "Web"}
              </Badge>
            ))}
            {!c.memoryEnabled ? <Badge tone="warning">Memory turned off by customer</Badge> : null}
          </span>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] [&>*]:min-w-0">
        <Card>
          <CardHeader title={`Memory (${active.length} current)`} description="What Nia remembers about this customer. Customers can see, correct and forget these in their Memory Passport." />
          <CardBody>
            {active.length === 0 ? (
              <p className="text-sm text-muted-foreground">No memories yet.</p>
            ) : (
              <ul className="divide-y divide-ink-900/[0.06]">
                {active.map((p) => (
                  <li key={p.id} className="relative py-3 pl-6">
                    <span className="nia-orb absolute top-[1.15rem] left-0 size-2.5" aria-hidden="true" />
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-semibold tracking-tight">{p.label}</p>
                      <Badge tone="neutral">{MEMORY_TYPE_META[p.type].label}</Badge>
                      <Badge tone={p.persistStatus === "stored" ? "success" : "warning"}>{p.persistStatus}</Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {CONFIRMATION_LABELS[p.confirmation]} · {p.channel ?? "web"} · {formatDateTime(p.validFrom, { timeZone: merchant.timezone })}
                      {p.blobId ? <span className="font-mono text-[11px]"> · {p.blobId.slice(0, 12)}…</span> : null}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            {history.length ? (
              <details className="mt-4 text-sm">
                <summary className="cursor-pointer font-semibold text-muted-foreground">Earlier values ({history.length})</summary>
                <ul className="mt-2 space-y-1 text-muted-foreground">
                  {history.map((h) => (
                    <li key={h.id}>
                      {h.label} <span className="text-xs">(until {formatDateTime(h.validTo ?? h.validFrom, { timeZone: merchant.timezone, withTime: false })})</span>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
            {role === "OWNER" ? (
              <div className="mt-5 border-t border-border pt-4">
                <p className="mb-2 text-xs text-muted-foreground">Recovery (owner only): re-index this customer’s namespace on the relayer from the blobs stored on Walrus.</p>
                <RestoreButton merchantId={merchant.id} customerId={c.id} />
              </div>
            ) : null}
          </CardBody>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Orders" />
            <CardBody>
              {orderList.length === 0 ? (
                <p className="text-sm text-muted-foreground">No orders yet.</p>
              ) : (
                <ul className="divide-y divide-ink-900/[0.06] text-sm">
                  {orderList.map((o) => (
                    <li key={o.id}>
                      <Link href={`${base}/orders/${o.id}`} className="flex items-center gap-2 py-2 hover:opacity-80">
                        <span className="font-semibold tabular">#{o.number}</span>
                        <span className="min-w-0 flex-1 truncate text-muted-foreground">{o.items.map((i) => i.name).join(", ")}</span>
                        <span className="tabular">{o.hasUnpricedItems ? "Quote" : formatMoney(o.total, o.currency, { locale: merchant.locale })}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Bookings" />
            <CardBody>
              {bookingList.length === 0 ? (
                <p className="text-sm text-muted-foreground">No bookings.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {bookingList.map((b) => (
                    <li key={b.id} className="flex justify-between gap-2">
                      <span>{b.serviceName}</span>
                      <span className="text-muted-foreground">
                        {formatDateTime(b.startAt, { timeZone: merchant.timezone })} · {b.statusLabel}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Conversations" />
            <CardBody>
              {convs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No conversations.</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {convs.map((cv) => (
                    <li key={cv.id}>
                      <Link href={`${base}/conversations/${cv.id}`} className="flex justify-between gap-2 hover:underline">
                        <span className="truncate">{cv.title ?? "Conversation"}</span>
                        <span className="shrink-0 text-muted-foreground">{cv.channel}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
