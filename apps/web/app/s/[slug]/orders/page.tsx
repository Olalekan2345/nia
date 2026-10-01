import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, Package } from "lucide-react";
import { Mascot, buttonClasses } from "@nia/ui";
import { getCustomerBookings, getCustomerRecentOrders, getDraft, orderSummary } from "@nia/commerce";
import { DEMO_PAYMENT_NOTE, formatDateTime, formatMoney, orderProgress } from "@nia/shared";
import { BookingCard } from "@/components/commerce/cards";
import { CartEditor } from "@/components/store/cart-editor";
import { CancelButton } from "@/components/store/cancel-button";
import { getStorefront } from "@/lib/storefront";
import { db } from "@/lib/server";

export const metadata: Metadata = { title: "Orders" };

export default async function OrdersPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ placed?: string }> }) {
  const [{ slug }, { placed: placedId }] = await Promise.all([params, searchParams]);
  const { merchant, customer, user } = await getStorefront(slug);

  if (!user) {
    return (
      <main className="mx-auto flex max-w-md flex-col items-center px-4 pt-14 text-center">
        <Mascot size={96} state="idle" decorative />
        <h1 className="mt-5 text-2xl leading-tight font-extrabold tracking-[-0.03em] text-balance">Sign in to see your orders</h1>
        <p className="mt-2 text-sm text-muted-foreground">Your cart, orders and bookings at {merchant.name} live here.</p>
        <Link href={`/s/${slug}/signin?next=/s/${slug}/orders`} className={buttonClasses({ size: "lg", className: "mt-6" })}>
          Sign in
        </Link>
      </main>
    );
  }

  const [draft, orders, bookings] = customer
    ? await Promise.all([
        getDraft(db(), merchant.id, customer.id).then((d) => (d ? orderSummary(db(), merchant.id, d.id) : null)),
        getCustomerRecentOrders(db(), merchant.id, customer.id, 20),
        getCustomerBookings(db(), merchant.id, customer.id, 20),
      ])
    : [null, [], []];

  const empty = !draft?.items.length && orders.length === 0 && bookings.length === 0;
  const placed = placedId ? orders.find((o) => o.id === placedId) : undefined;

  return (
    <main className="mx-auto max-w-2xl space-y-8 px-4 pt-6 md:px-6">
      <h1 className="text-[clamp(1.75rem,3vw,2.35rem)] leading-tight font-extrabold tracking-[-0.035em] text-balance">Orders</h1>

      {placed && placed.paymentMode === "demo" && placed.paymentStatus === "paid" ? (
        <div className="rounded-2xl border border-success/25 bg-success-soft p-5" role="status">
          <p className="font-bold text-success">
            Order #{placed.number} paid · {orderProgress(placed).headline}
          </p>
          {orderProgress(placed).detail ? <p className="mt-1 text-sm">{orderProgress(placed).detail}</p> : null}
          <p className="mt-1 text-xs text-muted-foreground">{DEMO_PAYMENT_NOTE}</p>
        </div>
      ) : placed ? (
        <div className="rounded-2xl border border-success/25 bg-success-soft p-5" role="status">
          <p className="font-bold text-success">Order #{placed.number} placed</p>
          <p className="mt-1 text-sm">{placed.paymentUrl ? `Use order #${placed.number} as the payment reference. ${merchant.name} confirms once payment arrives.` : "The shop will confirm availability and payment details."}</p>
          {placed.paymentUrl ? (
            <a href={placed.paymentUrl} target="_blank" rel="noopener noreferrer" className={buttonClasses({ size: "sm", className: "mt-3" })}>
              Pay securely <ExternalLink className="size-3.5" aria-hidden="true" />
            </a>
          ) : null}
        </div>
      ) : null}

      {draft && draft.items.length ? (
        <CartEditor
          slug={slug}
          cart={draft}
          locale={merchant.locale}
          areas={merchant.deliveryAreas}
          delivery={merchant.fulfillment.delivery}
          pickup={merchant.fulfillment.pickup}
          pickupAddress={merchant.fulfillment.pickupAddress ?? null}
          shop={merchant.name}
        />
      ) : null}

      {empty ? (
        <div className="flex flex-col items-center rounded-3xl border border-dashed border-ink-900/10 px-6 py-12 text-center">
          <Mascot size={88} state="idle" decorative />
          <p className="mt-4 font-semibold">No orders yet</p>
          <p className="mt-1 text-sm text-muted-foreground">Browse the shop or ask Nia to help you choose.</p>
          <div className="mt-5 flex gap-2">
            <Link href={`/s/${slug}/shop`} className={buttonClasses({ variant: "secondary" })}>
              Browse
            </Link>
            <Link href={`/s/${slug}/chat`} className={buttonClasses()}>
              Ask Nia
            </Link>
          </div>
        </div>
      ) : null}

      {orders.length ? (
        <section aria-labelledby="past-orders">
          <h2 id="past-orders" className="font-bold tracking-tight">
            Past orders
          </h2>
          <ul className="mt-3 divide-y divide-ink-900/[0.06] overflow-hidden rounded-3xl border border-ink-900/[0.06] bg-surface shadow-soft">
            {orders.map((o) => (
              <li key={o.id} className="flex items-start gap-3 px-4 py-4">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2">
                  <Package className="size-5 text-muted-foreground" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">#{o.number}</p>
                    <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-semibold">{orderProgress(o).headline}</span>
                    {o.paymentMode === "demo" && o.paymentStatus === "paid" ? <span className="rounded-full bg-success-soft px-2 py-0.5 text-xs font-semibold text-success">Paid (demo)</span> : null}
                    {o.memoryAssisted ? <span className="rounded-full bg-memory-soft px-2 py-0.5 text-xs font-semibold text-memory">Reordered with Nia</span> : null}
                  </div>
                  <p className="mt-1 truncate text-sm">{o.items.map((i) => `${i.quantity} × ${i.name}${i.variantLabel ? ` (${i.variantLabel})` : ""}`).join(", ")}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDateTime(o.submittedAt ?? o.createdAt, { timeZone: merchant.timezone })} · {o.fulfillmentMethod === "pickup" ? "Pickup" : o.deliveryArea ?? "Delivery"}
                  </p>
                  {orderProgress(o).detail ? <p className="text-sm text-muted-foreground">{orderProgress(o).detail}</p> : null}
                </div>
                <div className="flex flex-col items-end gap-2">
                  <p className="font-semibold tabular">{o.hasUnpricedItems ? "Quote" : formatMoney(o.total, o.currency, { locale: merchant.locale })}</p>
                  {o.status === "awaiting_confirmation" ? <CancelButton slug={slug} kind="order" id={o.id} /> : null}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {bookings.length ? (
        <section aria-labelledby="bookings">
          <h2 id="bookings" className="font-bold tracking-tight">
            Bookings
          </h2>
          <ul className="mt-3 space-y-3">
            {bookings.map((b) => (
              <li key={b.id}>
                <BookingCard booking={b} locale={merchant.locale} actions={b.status === "pending" || b.status === "confirmed" ? <CancelButton slug={slug} kind="booking" id={b.id} /> : null} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
