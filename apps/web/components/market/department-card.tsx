import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { DepartmentSummary } from "@nia/commerce";
import { cn } from "@nia/ui";
import { ProductVisual } from "@/components/commerce/product-visual";

/** A department on the market home: real product photos, name, blurb and a way in. */
export function DepartmentCard({ dept, className }: { dept: DepartmentSummary; className?: string }) {
  const [main, ...rest] = dept.images;
  return (
    <Link
      href={`/market?dept=${dept.key}`}
      className={cn(
        "group flex h-full flex-col overflow-hidden rounded-3xl border border-ink-900/[0.06] bg-surface shadow-soft transition-[box-shadow,border-color,transform] duration-200 hover:border-accent/30 hover:shadow-lift motion-safe:hover:-translate-y-0.5",
        className,
      )}
    >
      <div className="relative grid aspect-[4/3] grid-cols-3 grid-rows-2 gap-1 bg-surface-2 p-1">
        <div className="col-span-2 row-span-2 overflow-hidden rounded-[20px]">
          <ProductVisual name={dept.name} category={dept.short} image={main ?? null} rounded="rounded-none" className="aspect-auto h-full transition-transform duration-500 group-hover:scale-[1.03]" />
        </div>
        {[0, 1].map((i) => (
          <div key={i} className="overflow-hidden rounded-2xl">
            <ProductVisual name={`${dept.name} ${i}`} category={dept.short} image={rest[i] ?? null} rounded="rounded-none" className="aspect-auto h-full" />
          </div>
        ))}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase tabular">
          {dept.count} items · {dept.shops} {dept.shops === 1 ? "shop" : "shops"}
        </p>
        <h3 className="mt-1 text-lg font-extrabold tracking-[-0.02em]">{dept.name}</h3>
        <p className="mt-1 text-sm text-muted-foreground text-pretty">{dept.blurb}</p>
        <span className="mt-auto inline-flex items-center gap-1 pt-3 text-sm font-semibold text-accent-strong">
          Shop now <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
        </span>
      </div>
    </Link>
  );
}
