"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PackageCheck } from "lucide-react";
import { Button } from "@nia/ui";
import { confirmOrderAction } from "@/app/actions/store";

/**
 * Confirm every cart that is ready (delivery or pickup chosen, all in stock) —
 * one explicit tap by the customer, then one order per shop, each with that
 * shop's own payment instructions.
 */
export function ConfirmAllButton({ ready, placed }: { ready: { slug: string; orderId: string; shop: string }[]; placed: string[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [errors, setErrors] = useState<string[]>([]);
  if (ready.length < 2) return null;
  return (
    <div className="space-y-2">
      <Button
        size="lg"
        className="w-full"
        loading={pending}
        onClick={() =>
          start(async () => {
            const done: string[] = [];
            const failed: string[] = [];
            for (const c of ready) {
              const res = await confirmOrderAction(c.slug, c.orderId);
              if (res.ok) done.push(res.summary.id);
              else failed.push(`${c.shop}: ${res.error}`);
            }
            setErrors(failed);
            router.replace(`/market/cart?placed=${[...placed, ...done].join(",")}`, { scroll: false });
            router.refresh();
          })
        }
      >
        <PackageCheck className="size-5" aria-hidden="true" /> Confirm all {ready.length} orders
      </Button>
      {errors.length ? (
        <ul className="rounded-2xl border border-danger/15 bg-danger-soft px-4 py-2.5 text-sm text-danger" role="alert">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
