"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check, GitCompareArrows, Plus, X } from "lucide-react";
import { buttonClasses, cn } from "@nia/ui";
import { COMPARE_MAX, useCompare } from "./compare-store";

/** Add/remove a product from the compare selection. */
export function CompareToggle({ productId, className }: { productId: string; className?: string }) {
  const compare = useCompare();
  const on = compare.has(productId);
  return (
    <button
      type="button"
      onClick={() => compare.toggle(productId)}
      aria-pressed={on}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-sm font-semibold transition-colors duration-100",
        on ? "border-accent bg-accent-soft text-accent-strong" : "border-border bg-surface hover:bg-surface-2",
        className,
      )}
    >
      {on ? <Check className="size-4" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
      Compare
    </button>
  );
}

/** Floating bar once something is selected. Opening the comparison uses the selection up, so the bar goes away. */
export function CompareTray() {
  const compare = useCompare();
  const onComparePage = usePathname() === "/market/compare";
  const { ids, clear } = compare;
  useEffect(() => {
    if (onComparePage && ids.length) clear();
  }, [onComparePage, ids.length, clear]);
  if (ids.length === 0 || onComparePage) return null;
  const ready = compare.ids.length >= 2;
  return (
    <div className="fixed inset-x-0 bottom-4 z-40 flex justify-center px-4" role="region" aria-label="Compare selection">
      <div className="flex items-center gap-2 rounded-3xl border border-ink-900/[0.06] bg-surface shadow-soft/95 p-2 pl-4 shadow-float backdrop-blur-md">
        <GitCompareArrows className="size-4 text-accent-strong" aria-hidden="true" />
        <p className="text-sm font-semibold">
          {compare.ids.length} of {COMPARE_MAX} selected
        </p>
        {ready ? (
          <Link href={`/market/compare?ids=${compare.ids.join(",")}`} className={buttonClasses({ size: "sm" })}>
            Compare now
          </Link>
        ) : (
          <span className="px-2 text-xs text-muted-foreground">Pick one more</span>
        )}
        <button type="button" onClick={compare.clear} className="grid size-9 place-items-center rounded-full text-muted-foreground transition-colors duration-150 hover:bg-ink-900/[0.05] hover:text-foreground" aria-label="Clear selection">
          <X className="size-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
