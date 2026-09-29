"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, Minus, PackageCheck, Plus, Trash2 } from "lucide-react";
import { Button, Field, Select, buttonClasses, cn } from "@nia/ui";
import { formatMoney, type DeliveryArea } from "@nia/shared";
import type { OrderSummaryData, PaymentStart } from "@nia/commerce";
import { confirmOrderAction, removeCartItemAction, setFulfillmentAction, updateCartItemAction } from "@/app/actions/store";

export function CartEditor({
  slug,
  cart,
  locale,
  areas,
  delivery,
  pickup,
  pickupAddress,
}: {
  slug: string;
  cart: OrderSummaryData;
  locale: string;
  areas: DeliveryArea[];
  delivery: boolean;
  pickup: boolean;
  pickupAddress: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [placed, setPlaced] = useState<{ summary: OrderSummaryData; payment: PaymentStart | null } | null>(null);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setError(null);
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Something went wrong");
      router.refresh();
    });

  if (placed) {
    return (
      <div className="rounded-2xl border border-success/25 bg-success-soft p-5" role="status">
        <p className="font-bold text-success">Order #{placed.summary.number} placed</p>
        <p className="mt-1 text-sm">{placed.payment?.instructions ?? "The shop will confirm availability and payment details."}</p>
        {placed.payment?.url ? (
          <a href={placed.payment.url} target="_blank" rel="noopener noreferrer" className={buttonClasses({ size: "sm", className: "mt-3" })}>
            Pay securely <ExternalLink className="size-3.5" aria-hidden="true" />
          </a>
        ) : null}
      </div>
    );
  }

  const total = cart.hasUnpricedItems ? "To be confirmed" : formatMoney(cart.total, cart.currency, { locale });
  return (
    <section aria-labelledby="cart-title" className="rounded-3xl border border-ink-900/[0.06] bg-surface shadow-soft">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <h2 id="cart-title" className="font-bold">
          Your cart
        </h2>
        <span className="text-sm text-muted-foreground">
          {cart.items.length} item{cart.items.length === 1 ? "" : "s"}
        </span>
      </header>
      <ul className="divide-y divide-ink-900/[0.06] px-4">
        {cart.items.map((i) => (
          <li key={i.id} className="flex items-center gap-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium">{i.name}</p>
              <p className="text-sm text-muted-foreground">
                {i.variantLabel ?? "Standard"}
                {i.unitPrice != null ? ` · ${formatMoney(i.unitPrice, cart.currency, { locale })}${i.unit && !["piece", "item"].includes(i.unit) ? ` / ${i.unit}` : ""}` : " · quote"}
              </p>
            </div>
            <div className="flex items-center rounded-xl border border-border">
              <button type="button" className="grid size-10 place-items-center disabled:opacity-40" disabled={pending || i.quantity <= 1} onClick={() => run(() => updateCartItemAction(slug, i.id, i.quantity - 1))} aria-label={`Decrease ${i.name}`}>
                <Minus className="size-4" aria-hidden="true" />
              </button>
              <span className="min-w-7 text-center text-sm font-semibold tabular">{i.quantity}</span>
              <button type="button" className="grid size-10 place-items-center disabled:opacity-40" disabled={pending} onClick={() => run(() => updateCartItemAction(slug, i.id, i.quantity + 1))} aria-label={`Increase ${i.name}`}>
                <Plus className="size-4" aria-hidden="true" />
              </button>
            </div>
            <button type="button" className="grid size-10 place-items-center rounded-full text-muted-foreground transition-colors duration-150 hover:bg-danger-soft hover:text-danger" disabled={pending} onClick={() => run(() => removeCartItemAction(slug, i.id))} aria-label={`Remove ${i.name}`}>
              <Trash2 className="size-4" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>

      <div className="space-y-3 border-t border-border px-4 py-4">
        <fieldset>
          <legend className="text-sm font-semibold">How would you like it?</legend>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {delivery ? (
              <button
                type="button"
                onClick={() => run(() => setFulfillmentAction(slug, "delivery", cart.deliveryArea))}
                aria-pressed={cart.fulfillmentMethod === "delivery"}
                className={cn("min-h-11 rounded-xl border px-3 text-sm font-semibold", cart.fulfillmentMethod === "delivery" ? "border-accent bg-accent-soft text-accent-strong" : "border-border")}
              >
                Delivery
              </button>
            ) : null}
            {pickup ? (
              <button
                type="button"
                onClick={() => run(() => setFulfillmentAction(slug, "pickup"))}
                aria-pressed={cart.fulfillmentMethod === "pickup"}
                className={cn("min-h-11 rounded-xl border px-3 text-sm font-semibold", cart.fulfillmentMethod === "pickup" ? "border-accent bg-accent-soft text-accent-strong" : "border-border")}
              >
                Pickup
              </button>
            ) : null}
          </div>
        </fieldset>
        {cart.fulfillmentMethod === "delivery" ? (
          <Field label="Delivery area" htmlFor="area">
            <Select id="area" value={cart.deliveryArea ?? ""} disabled={pending} onChange={(e) => run(() => setFulfillmentAction(slug, "delivery", e.target.value))}>
              <option value="" disabled>
                Choose an area
              </option>
              {areas.map((a) => (
                <option key={a.name} value={a.name}>
                  {a.name} — {a.fee == null ? "fee quoted" : formatMoney(a.fee, cart.currency, { locale })}
                  {a.sameDay ? " · same day" : ""}
                </option>
              ))}
            </Select>
          </Field>
        ) : cart.fulfillmentMethod === "pickup" && pickupAddress ? (
          <p className="text-sm text-muted-foreground">{pickupAddress}</p>
        ) : null}
      </div>

      <div className="flex items-baseline justify-between border-t border-border px-4 py-3">
        <span className="font-semibold">Total</span>
        <span className="text-xl font-bold tabular">{total}</span>
      </div>
      {error ? (
        <p className="mx-4 mb-3 rounded-2xl border border-danger/15 bg-danger-soft px-4 py-2.5 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2 px-4 pb-4">
        <Button
          size="lg"
          className="flex-1"
          disabled={cart.blockers.length > 0}
          loading={pending}
          onClick={() =>
            start(async () => {
              setError(null);
              const res = await confirmOrderAction(slug, cart.id);
              if (res.ok) {
                setPlaced({ summary: res.summary, payment: res.payment });
                // The cart disappears once the order exists; the page keeps showing the confirmation.
                router.replace(`/s/${slug}/orders?placed=${res.summary.id}`, { scroll: false });
              } else {
                setError(res.error);
                router.refresh();
              }
            })
          }
        >
          <PackageCheck className="size-5" aria-hidden="true" /> Confirm order
        </Button>
        <Link href={`/s/${slug}/chat?q=${encodeURIComponent("Help me with my cart")}`} className={buttonClasses({ variant: "secondary", size: "lg" })}>
          Ask Nia
        </Link>
      </div>
      {cart.blockers.length ? <p className="px-4 pb-4 text-sm text-muted-foreground">Still needed: {cart.blockers.join(" · ")}</p> : null}
    </section>
  );
}
