import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { ArrowLeft } from "lucide-react";
import { Card, CardBody, CardHeader } from "@nia/ui";
import { customers, orderEvents, orders } from "@nia/database";
import { orderSummary } from "@nia/commerce";
import { ORDER_STATUS_LABELS, formatDateTime } from "@nia/shared";
import { OrderSummaryCard } from "@/components/commerce/cards";
import { OrderActions } from "@/components/dashboard/status-actions";
import { requireMerchant } from "@/lib/access";
import { db } from "@/lib/server";

export const metadata: Metadata = { title: "Order" };

export default async function OrderDetail({ params }: { params: Promise<{ merchantId: string; orderId: string }> }) {
  const { merchantId, orderId } = await params;
  const { merchant } = await requireMerchant(merchantId);
  if (!/^[0-9a-f-]{36}$/i.test(orderId)) notFound();
  const [o] = await db().select().from(orders).where(and(eq(orders.id, orderId), eq(orders.merchantId, merchant.id)));
  if (!o || o.status === "draft") notFound();
  const [summary, [customer], events] = await Promise.all([
    orderSummary(db(), merchant.id, o.id),
    db().select().from(customers).where(eq(customers.id, o.customerId)),
    db().select().from(orderEvents).where(eq(orderEvents.orderId, o.id)).orderBy(asc(orderEvents.createdAt)),
  ]);
  const base = `/dashboard/${merchant.id}`;

  return (
    <>
      <Link href={`${base}/orders`} className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden="true" /> Orders
      </Link>
      <h1 className="mb-6 text-2xl font-extrabold tracking-tight">Order #{o.number}</h1>
      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-4">
          <OrderSummaryCard order={summary} locale={merchant.locale} title="Items" />
          <Card>
            <CardBody className="space-y-3">
              <p className="text-sm font-semibold">Next step</p>
              <OrderActions merchantId={merchant.id} orderId={o.id} status={o.status} paymentStatus={o.paymentStatus} />
            </CardBody>
          </Card>
        </div>
        <div className="space-y-4">
          <Card>
            <CardHeader title="Customer" />
            <CardBody className="text-sm">
              {customer ? (
                <Link href={`${base}/customers/${customer.id}`} className="font-semibold text-accent-strong hover:underline">
                  {customer.displayName ?? "Customer"}
                </Link>
              ) : null}
              <p className="text-muted-foreground">{customer?.email ?? ""}</p>
              {o.deliveryAddress ? <p className="mt-2">{o.deliveryAddress}</p> : null}
              {o.notes ? <p className="mt-2 rounded-xl bg-surface-2 p-2">Note: {o.notes}</p> : null}
              <dl className="mt-3 grid grid-cols-2 gap-2">
                <dt className="text-muted-foreground">Channel</dt>
                <dd>{o.channel}</dd>
                <dt className="text-muted-foreground">Payment</dt>
                <dd>
                  {o.paymentStatus} · {o.paymentMode.replace("_", " ")}
                </dd>
                {o.memoryAssisted ? (
                  <>
                    <dt className="text-muted-foreground">Built with memory</dt>
                    <dd>Yes — reordered via Nia</dd>
                  </>
                ) : null}
              </dl>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Timeline" />
            <CardBody>
              <ol className="space-y-3 border-l border-border pl-4 text-sm">
                {events.map((e) => (
                  <li key={e.id}>
                    <p className="font-medium">{ORDER_STATUS_LABELS[e.toStatus]}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(e.createdAt, { timeZone: merchant.timezone })} · by {e.actorType}
                      {e.note ? ` · ${e.note}` : ""}
                    </p>
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
