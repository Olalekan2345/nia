"use client";

import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { CalendarCheck, Check, CircleAlert, Loader2, Package, Store, Truck } from "lucide-react";
import { Button } from "@nia/ui";
import { DEMO_PAYMENT_NOTE, orderProgress } from "@nia/shared";
import type { BookingSummaryData, OrderSummaryData } from "@nia/commerce";
import type { MemoryReceiptView } from "@nia/ai";
import { useReceiptPoll } from "@/components/chat/use-receipt-poll";

/** One shop's result in the pop-up. */
export interface CheckoutOutcome {
  key: string;
  /** The shop's slug — its memory receipts are polled there. */
  slug: string;
  shop: string;
  icon: "pickup" | "delivery" | "booking" | "placed";
  headline: string;
  detail: string | null;
  receipt: MemoryReceiptView | null;
}

/** "Ready for pickup" / "On its way to Yaba" for a settled order (or "waiting for the shop" for a real one). */
export function orderOutcome(summary: OrderSummaryData, shop: { slug: string; name: string }, receipt: MemoryReceiptView | null): CheckoutOutcome {
  const p = orderProgress(summary);
  const icon = summary.status === "ready" && summary.fulfillmentMethod === "pickup" ? "pickup" : summary.status === "dispatched" ? "delivery" : "placed";
  return { key: summary.id, slug: shop.slug, shop: shop.name, icon, headline: p.headline, detail: p.detail, receipt };
}

export function bookingOutcome(booking: BookingSummaryData, shop: { slug: string; name: string }, receipt: MemoryReceiptView | null, locale: string): CheckoutOutcome {
  const when = new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: booking.timeZone }).format(new Date(booking.startAt));
  return {
    key: booking.id,
    slug: shop.slug,
    shop: shop.name,
    icon: "booking",
    headline: booking.status === "confirmed" ? `Booked: ${booking.serviceName}` : `Requested: ${booking.serviceName}`,
    detail: `${when}${booking.status === "confirmed" ? "" : " — the shop will confirm."}`,
    receipt,
  };
}

/** Run a checkout action, but keep the "confirming" moment on screen long enough to read (a couple of seconds). */
export async function withMinimumWait<T>(task: Promise<T>, ms = 2200): Promise<T> {
  const [result] = await Promise.all([task, new Promise((r) => setTimeout(r, ms))]);
  return result;
}

const ICONS = { pickup: Store, delivery: Truck, booking: CalendarCheck, placed: Package } as const;
const CONFETTI = Array.from({ length: 14 }, (_, i) => {
  const angle = (i / 14) * Math.PI * 2;
  const reach = 70 + (i % 3) * 18;
  return {
    x: `${Math.round(Math.cos(angle) * reach)}px`,
    y: `${Math.round(Math.sin(angle) * reach * 0.8 - 20)}px`,
    r: `${(i % 2 ? 1 : -1) * (90 + i * 25)}deg`,
    d: `${(i % 4) * 60}ms`,
    c: ["var(--accent)", "var(--memory)", "var(--success)", "#f5b544"][i % 4],
  };
});

function MemoryLine({ slug, receipt }: { slug: string; receipt: MemoryReceiptView }) {
  const [r] = useReceiptPoll(slug, [receipt]);
  if (!r || r.status === "skipped") return null;
  if (r.status === "pending")
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> Saving this to your Walrus memory…
      </p>
    );
  if (r.status === "failed")
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <CircleAlert className="size-3.5" aria-hidden="true" /> Couldn&apos;t save to memory this time.
      </p>
    );
  return (
    <p className="flex items-center gap-1.5 text-xs font-semibold text-memory">
      <Check className="size-3.5" aria-hidden="true" /> Saved to Walrus Memory
    </p>
  );
}

function speech(kind: "order" | "booking", phase: "confirming" | "done", outcomes: CheckoutOutcome[]): string {
  if (phase === "confirming") return "Hold on a few seconds…";
  if (kind === "booking") return outcomes[0]?.headline.startsWith("Booked") ? "You're booked in!" : "Request sent!";
  if (outcomes.length > 1) return "All paid! Every shop has your order.";
  const o = outcomes[0];
  if (o?.icon === "pickup") return "Yay! Your order is ready for pickup.";
  if (o?.icon === "delivery") return "Woohoo! Your order is on its way.";
  return "Done! The shop has your order.";
}

/**
 * The demo-checkout moment: Nia confirms the (simulated) payment for a couple
 * of seconds, then dances and says what happens next — ready for pickup or on
 * its way — while the order is saved to Walrus Memory. Motion only runs when
 * the visitor allows it; otherwise the same pop-up appears still.
 */
export function CheckoutCelebration({
  kind,
  phase,
  shops,
  outcomes,
  demo,
  onClose,
}: {
  kind: "order" | "booking";
  phase: "confirming" | "done";
  /** Shop names, shown while confirming. */
  shops: string[];
  outcomes: CheckoutOutcome[];
  /** A simulated (demo) payment — say so plainly. */
  demo: boolean;
  onClose: () => void;
}) {
  const titleId = useId();
  const dialog = useRef<HTMLDivElement>(null);
  const done = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.focus();
    return () => {
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, []);
  useEffect(() => {
    if (phase === "done") done.current?.focus();
  }, [phase]);

  const title = phase === "confirming" ? (kind === "booking" ? "Confirming your booking…" : "Confirming your payment…") : kind === "booking" ? (demo ? "Booking confirmed" : "Booking requested") : demo ? "Payment confirmed" : "Order placed";

  return createPortal(
    <div
      className="fixed inset-0 z-[90] grid place-items-center bg-ink-900/35 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (phase === "done" && e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="nia-pop-dialog w-full max-w-sm rounded-3xl border border-ink-900/[0.06] bg-surface p-6 text-center shadow-float outline-none"
        onKeyDown={(e) => {
          if (e.key === "Escape" && phase === "done") onClose();
          // Only one control: keep focus inside the dialog.
          if (e.key === "Tab") {
            e.preventDefault();
            done.current?.focus();
          }
        }}
      >
        <div className="nia-celebrate" data-phase={phase} aria-hidden="true">
          <span className="nia-celebrate-glow" />
          {phase === "done"
            ? CONFETTI.map((c, i) => <span key={i} className="nia-confetti" style={{ ["--x" as string]: c.x, ["--y" as string]: c.y, ["--r" as string]: c.r, ["--d" as string]: c.d, ["--c" as string]: c.c }} />)
            : null}
          {/* eslint-disable-next-line @next/next/no-img-element -- the pre-sized brand mascot, like <Mascot> */}
          <img src="/brand/nia-mascot-384.webp" width={144} height={144} alt="" draggable={false} className="nia-celebrate-img" />
        </div>
        <p className="nia-bubble mx-auto mt-3 w-fit max-w-full rounded-2xl bg-accent-soft px-4 py-2 text-sm font-semibold text-accent-strong" aria-hidden="true">
          {speech(kind, phase, outcomes)}
        </p>

        <h2 id={titleId} className="mt-4 text-2xl font-extrabold tracking-[-0.03em] text-balance">
          {title}
        </h2>
        <div aria-live="polite">
          {phase === "confirming" ? (
            <p className="mt-1 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              {kind === "booking" ? "Checking the slot" : "Checking payment"} with {shops.join(", ") || "the shop"}
            </p>
          ) : (
            <>
              {demo && kind === "order" ? <p className="mt-1 text-xs text-muted-foreground">{DEMO_PAYMENT_NOTE}</p> : null}
              <ul className="mt-4 space-y-2 text-left">
                {outcomes.map((o) => {
                  const Icon = ICONS[o.icon];
                  return (
                    <li key={o.key} className="flex gap-3 rounded-2xl border border-ink-900/[0.06] bg-paper px-3 py-2.5">
                      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl bg-success-soft text-success">
                        <Icon className="size-4" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1 space-y-0.5">
                        {outcomes.length > 1 ? <p className="text-xs font-semibold text-muted-foreground">{o.shop}</p> : null}
                        <p className="text-sm font-bold">{o.headline}</p>
                        {o.detail ? <p className="text-sm text-muted-foreground">{o.detail}</p> : null}
                        {o.receipt ? <MemoryLine slug={o.slug} receipt={o.receipt} /> : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </div>
        {phase === "done" ? (
          <Button ref={done} className="mt-5 w-full" onClick={onClose}>
            Done
          </Button>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
