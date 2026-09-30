"use client";

import { useRef } from "react";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@nia/ui";

/**
 * A horizontal product rail: native scroll with snap (touch and trackpad),
 * plus previous/next buttons for mouse users on wider screens.
 */
export function Rail({ id, title, note, seeAll, badge, children }: { id: string; title: string; note?: string; seeAll?: { href: string; label?: string }; badge?: string; children: React.ReactNode }) {
  const scroller = useRef<HTMLUListElement>(null);
  const page = (dir: 1 | -1) => {
    const el = scroller.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(240, el.clientWidth * 0.85), behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  };
  return (
    <section aria-labelledby={id} className="space-y-3">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h3 id={id} className="flex flex-wrap items-center gap-2 text-lg font-extrabold tracking-[-0.02em]">
            {title}
            {badge ? <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{badge}</span> : null}
          </h3>
          {note ? <p className="mt-0.5 text-sm text-muted-foreground">{note}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {seeAll ? (
            <Link href={seeAll.href} className="inline-flex h-9 items-center gap-1 rounded-full px-3 text-sm font-semibold text-accent-strong transition-colors duration-150 hover:bg-accent-soft">
              {seeAll.label ?? "See all"} <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          ) : null}
          {(["prev", "next"] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => page(d === "next" ? 1 : -1)}
              className="hidden size-9 place-items-center rounded-full border border-ink-900/10 bg-surface text-foreground transition-colors duration-150 hover:bg-surface-2 md:grid"
              aria-label={`${d === "next" ? "Next" : "Previous"} ${title}`}
              aria-controls={`${id}-list`}
            >
              {d === "next" ? <ChevronRight className="size-4" aria-hidden="true" /> : <ChevronLeft className="size-4" aria-hidden="true" />}
            </button>
          ))}
        </div>
      </div>
      <ul ref={scroller} id={`${id}-list`} className={cn("-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-3 scrollbar-none sm:gap-4 md:mx-0 md:px-0")}>
        {children}
      </ul>
    </section>
  );
}

/** One card slot in a rail: fixed width so rails line up across the page. */
export function RailItem({ children }: { children: React.ReactNode }) {
  return <li className="w-[46vw] max-w-56 shrink-0 snap-start sm:w-52 lg:w-[13.25rem]">{children}</li>;
}
