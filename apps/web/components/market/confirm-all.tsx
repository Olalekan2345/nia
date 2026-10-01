"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PackageCheck } from "lucide-react";
import { Button } from "@nia/ui";
import type { MemoryReceiptView } from "@nia/ai";
import { confirmOrderAction } from "@/app/actions/store";
import { CheckoutCelebration, orderOutcome, withMinimumWait, type CheckoutOutcome } from "@/components/commerce/checkout-celebration";

/**
 * Confirm every cart that is ready (delivery or pickup chosen, all in stock) —
 * one explicit tap by the customer, then one order per shop, each with that
 * shop's own payment. In demo shops the payment is simulated and confirmed at
 * once, so Nia celebrates and says what happens next before the page moves on.
 */
export function ConfirmAllButton({ ready, placed }: { ready: { slug: string; orderId: string; shop: string; demo: boolean }[]; placed: string[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<string[]>([]);
  const [popup, setPopup] = useState<{ phase: "confirming" | "done"; outcomes: CheckoutOutcome[]; next?: () => void } | null>(null);
  if (ready.length < 2) return null;
  const demo = ready.some((c) => c.demo);
  return (
    <div className="space-y-2">
      <Button
        size="lg"
        className="w-full"
        loading={pending}
        onClick={() => {
          // Shown straight away (state set inside the async transition would wait for it to finish).
          if (demo) setPopup({ phase: "confirming", outcomes: [] });
          start(async () => {
            const done: string[] = [];
            const failed: string[] = [];
            const outcomes: CheckoutOutcome[] = [];
            const run = async () => {
              for (const c of ready) {
                const res = await confirmOrderAction(c.slug, c.orderId);
                if (res.ok) {
                  done.push(res.summary.id);
                  outcomes.push(orderOutcome(res.summary, { slug: c.slug, name: c.shop }, (res.receipt as MemoryReceiptView | null) ?? null));
                } else failed.push(`${c.shop}: ${res.error}`);
              }
            };
            await (demo ? withMinimumWait(run()) : run());
            setErrors(failed);
            const next = () => {
              router.replace(`/market/cart?placed=${[...placed, ...done].join(",")}`, { scroll: false });
              router.refresh();
            };
            if (demo && outcomes.length) setPopup({ phase: "done", outcomes, next });
            else {
              setPopup(null);
              next();
            }
          });
        }}
      >
        <PackageCheck className="size-5" aria-hidden="true" /> {demo ? `Pay for all ${ready.length} orders (demo)` : `Confirm all ${ready.length} orders`}
      </Button>
      {errors.length ? (
        <ul className="rounded-2xl border border-danger/15 bg-danger-soft px-4 py-2.5 text-sm text-danger" role="alert">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      ) : null}
      {popup ? (
        <CheckoutCelebration
          kind="order"
          phase={popup.phase}
          demo={demo}
          shops={ready.map((c) => c.shop)}
          outcomes={popup.outcomes}
          onClose={() => {
            setPopup(null);
            popup.next?.();
          }}
        />
      ) : null}
    </div>
  );
}
