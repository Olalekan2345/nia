"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@nia/ui";
import { BOOKING_STATUS_LABELS, BOOKING_TRANSITIONS, ORDER_STATUS_LABELS, ORDER_TRANSITIONS, type BookingStatus, type OrderStatus } from "@nia/shared";
import { markOrderPaidAction, transitionBookingAction, transitionOrderAction } from "@/app/actions/dashboard";

const ORDER_VERB: Partial<Record<OrderStatus, string>> = {
  confirmed: "Confirm order",
  paid: "Mark paid",
  processing: "Start processing",
  ready: "Mark ready",
  dispatched: "Mark dispatched",
  delivered: "Mark delivered",
  cancelled: "Cancel",
  refunded: "Refund",
};

export function OrderActions({ merchantId, orderId, status, paymentStatus }: { merchantId: string; orderId: string; status: OrderStatus; paymentStatus: string }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmDanger, setConfirmDanger] = useState<OrderStatus | null>(null);
  const next = ORDER_TRANSITIONS[status].filter((s) => s !== "paid");
  const act = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    start(async () => {
      setError(null);
      const r = await fn();
      if (!r.ok) setError(r.error ?? "Failed");
      setConfirmDanger(null);
      router.refresh();
    });
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {next
          .filter((s) => s !== "cancelled" && s !== "refunded")
          .map((s) => (
            <Button key={s} size="sm" loading={busy} onClick={() => act(() => transitionOrderAction(merchantId, orderId, s))}>
              {ORDER_VERB[s] ?? ORDER_STATUS_LABELS[s]}
            </Button>
          ))}
        {paymentStatus !== "paid" && ["confirmed", "processing", "ready", "dispatched", "delivered"].includes(status) ? (
          <Button size="sm" variant="secondary" loading={busy} onClick={() => act(() => markOrderPaidAction(merchantId, orderId))}>
            Record payment received
          </Button>
        ) : null}
        {next
          .filter((s) => s === "cancelled" || s === "refunded")
          .map((s) =>
            confirmDanger === s ? (
              <span key={s} className="inline-flex gap-2">
                <Button size="sm" variant="danger" loading={busy} onClick={() => act(() => transitionOrderAction(merchantId, orderId, s))}>
                  Yes, {ORDER_VERB[s]?.toLowerCase()}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setConfirmDanger(null)}>
                  Keep
                </Button>
              </span>
            ) : (
              <Button key={s} size="sm" variant="ghost" onClick={() => setConfirmDanger(s)}>
                {ORDER_VERB[s]}
              </Button>
            ),
          )}
      </div>
      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function BookingActions({ merchantId, bookingId, status }: { merchantId: string; bookingId: string; status: BookingStatus }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const verbs: Partial<Record<BookingStatus, string>> = { confirmed: "Confirm", completed: "Complete", cancelled: "Cancel", no_show: "No-show" };
  return (
    <div className="flex flex-wrap items-center gap-2">
      {BOOKING_TRANSITIONS[status].map((s) => (
        <Button
          key={s}
          size="sm"
          variant={s === "confirmed" || s === "completed" ? "primary" : "ghost"}
          loading={busy}
          onClick={() =>
            start(async () => {
              const r = await transitionBookingAction(merchantId, bookingId, s);
              if (!r.ok) setError(r.error);
              router.refresh();
            })
          }
        >
          {verbs[s] ?? BOOKING_STATUS_LABELS[s]}
        </Button>
      ))}
      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
