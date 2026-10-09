import Link from "next/link";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { Mascot, buttonClasses, cn } from "@nia/ui";

export interface Crumb {
  label: string;
  href?: string;
}

/** Where the shopper is inside Walrus Market, with a clear way back to the whole market. */
export function MarketWayfinder({ trail, note, className }: { trail: Crumb[]; note?: string; className?: string }) {
  return (
    <nav aria-label="You are here" className={cn("flex flex-wrap items-center gap-x-4 gap-y-3 rounded-3xl border border-ink-900/[0.06] bg-surface px-3.5 py-3 shadow-soft sm:px-4", className)}>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <Mascot size={36} decorative />
        <div className="min-w-0">
          <ol className="flex flex-wrap items-center gap-x-1 gap-y-0.5 text-sm">
            <li>
              <Link href="/market" className="font-bold hover:underline">
                Walrus Market
              </Link>
            </li>
            {trail.map((c, i) => (
              <li key={`${i}-${c.label}`} className="flex min-w-0 items-center gap-1">
                <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                {c.href && i < trail.length - 1 ? (
                  <Link href={c.href} className="font-semibold text-muted-foreground hover:text-foreground hover:underline">
                    {c.label}
                  </Link>
                ) : (
                  <span aria-current="page" className="font-semibold">
                    {c.label}
                  </span>
                )}
              </li>
            ))}
          </ol>
          {note ? <p className="mt-0.5 text-xs text-muted-foreground">{note}</p> : null}
        </div>
      </div>
      <Link href="/market" className={buttonClasses({ size: "sm", className: "w-full justify-center sm:w-auto" })}>
        <ArrowLeft className="size-4" aria-hidden="true" /> Back to Walrus Market
      </Link>
    </nav>
  );
}
