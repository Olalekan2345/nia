import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { Mascot, buttonClasses } from "@nia/ui";
import { marketProducts } from "@nia/commerce";
import { CompareTable, toCompareProduct } from "@/components/market/compare-table";
import { loadMarket } from "@/lib/market";
import { db } from "@/lib/server";

export const metadata: Metadata = { title: "Compare" };
export const dynamic = "force-dynamic";

export default async function ComparePage({ searchParams }: { searchParams: Promise<{ ids?: string }> }) {
  const { ids } = await searchParams;
  const [sf, products] = await Promise.all([loadMarket(), marketProducts(db(), (ids ?? "").split(","))]);
  const locale = sf?.merchant.locale ?? "en-NG";
  const ask = products.length >= 2 ? `Help me decide between ${products.map((p) => `the ${p.name} from ${p.shop.name}`).join(" and ")}.` : "";

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 pt-6 pb-24 md:px-6">
      <Link href="/market" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden="true" /> Back to the market
      </Link>
      <div>
        <h1 className="text-[clamp(2rem,4.2vw,3rem)] leading-[1.05] font-extrabold tracking-[-0.04em] text-balance">Compare</h1>
        <p className="mt-1 text-muted-foreground">Side by side, straight from each shop’s catalogue.</p>
      </div>

      {products.length >= 2 ? (
        <>
          <div className="rounded-3xl border border-border bg-surface p-4 sm:p-6">
            <CompareTable products={products.map(toCompareProduct)} locale={locale} />
          </div>
          <div className="nia-holo-border flex flex-wrap items-center gap-4 rounded-3xl p-5">
            <Mascot size={56} state="idle" decorative />
            <div className="min-w-0 flex-1">
              <p className="font-bold">Still torn?</p>
              <p className="text-sm text-muted-foreground">Nia can weigh these against your budget, taste and delivery area, then give you a clear pick.</p>
            </div>
            <Link href={`/market/nia?q=${encodeURIComponent(ask)}&send=1`} className={buttonClasses()}>
              <Sparkles className="size-4" aria-hidden="true" /> Ask Nia to decide
            </Link>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center rounded-3xl border border-dashed border-ink-900/10 px-6 py-14 text-center">
          <Mascot size={88} state="thinking" decorative />
          <p className="mt-4 font-semibold">Pick at least two products to compare</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">Tap “Compare” on products in the market, then come back here.</p>
          <Link href="/market" className={buttonClasses({ className: "mt-5" })}>
            Browse the market
          </Link>
        </div>
      )}
    </main>
  );
}
