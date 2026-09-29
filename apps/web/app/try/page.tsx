import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, count, eq, inArray } from "drizzle-orm";
import { ArrowRight } from "lucide-react";
import { merchants, products, services } from "@nia/database";
import { BUSINESS_TYPES } from "@nia/shared";
import { Mascot, buttonClasses } from "@nia/ui";
import { NiaLogo, WalrusChip } from "@/components/brand";
import { MerchantMark } from "@/components/store/merchant-mark";
import { db } from "@/lib/server";

export const metadata: Metadata = { title: "Try Nia" };
export const dynamic = "force-dynamic";

const typeLabel = (value: string) => BUSINESS_TYPES.find((b) => b.value === value)?.label ?? "Shop";
const plural = (n: number, word: string) => (n ? `${n} ${word}${n === 1 ? "" : "s"}` : null);

/** "Try Nia" → pick a demo shop. Nia works for any business type; the demo shops show a few. */
export default async function TryPage() {
  const shops = await db()
    .select({
      id: merchants.id,
      slug: merchants.slug,
      name: merchants.name,
      businessType: merchants.businessType,
      tagline: merchants.tagline,
      city: merchants.city,
      logoUrl: merchants.logoUrl,
      accentColor: merchants.accentColor,
    })
    .from(merchants)
    .where(and(eq(merchants.isDemo, true), eq(merchants.status, "live")))
    .orderBy(asc(merchants.createdAt));

  const ids = shops.map((s) => s.id);
  const [productCounts, serviceCounts] = ids.length
    ? await Promise.all([
        db().select({ merchantId: products.merchantId, n: count() }).from(products).where(and(inArray(products.merchantId, ids), eq(products.active, true))).groupBy(products.merchantId),
        db().select({ merchantId: services.merchantId, n: count() }).from(services).where(and(inArray(services.merchantId, ids), eq(services.active, true))).groupBy(services.merchantId),
      ])
    : [[], []];
  const countFor = (rows: { merchantId: string; n: number }[], id: string) => rows.find((r) => r.merchantId === id)?.n ?? 0;

  return (
    <div className="nia-wash flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <NiaLogo />
        <Link href="/signin?next=/onboarding" className="text-sm font-medium text-muted-foreground hover:text-foreground">
          Set up your shop
        </Link>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 pt-6 pb-16 sm:px-6 sm:pt-12">
        <div className="flex flex-col items-center text-center">
          <Mascot size={80} state="greeting" decorative />
          <h1 className="mt-5 text-[clamp(2rem,4.2vw,3rem)] leading-[1.05] font-extrabold tracking-[-0.04em] text-balance">Pick a shop to try Nia</h1>
          <p className="mt-3 max-w-xl text-muted-foreground">
            Chat with the shop’s assistant, sign in, and tell it what you like. Start a new chat later and it remembers you, with memory stored on Walrus.
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <WalrusChip />
            <Link href="/market" className="text-sm font-semibold text-accent-strong hover:underline">
              Or browse every shop in Walrus Market →
            </Link>
          </div>
        </div>

        {shops.length ? (
          <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shops.map((s) => (
              <li key={s.slug}>
                <Link
                  href={`/s/${s.slug}`}
                  className="group flex h-full flex-col rounded-3xl border border-ink-900/[0.06] bg-surface shadow-soft p-5 shadow-float transition-colors duration-100 hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <div className="flex items-center gap-3">
                    <MerchantMark name={s.name} logoUrl={s.logoUrl} accent={s.accentColor} size={44} />
                    <div className="min-w-0">
                      <p className="truncate font-bold tracking-tight">{s.name}</p>
                      <p className="text-xs font-medium text-muted-foreground">
                        {typeLabel(s.businessType)}
                        {s.city ? ` · ${s.city}` : ""}
                      </p>
                    </div>
                  </div>
                  {s.tagline ? <p className="mt-3 text-sm text-muted-foreground">{s.tagline}</p> : null}
                  <p className="mt-auto flex items-center justify-between pt-4 text-sm">
                    <span className="text-muted-foreground">{[plural(countFor(productCounts, s.id), "product"), plural(countFor(serviceCounts, s.id), "service")].filter(Boolean).join(" · ")}</span>
                    <span className="inline-flex items-center gap-1 font-semibold text-accent-strong">
                      Open <ArrowRight className="size-4 transition-transform duration-100 group-hover:translate-x-0.5" aria-hidden="true" />
                    </span>
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-10 rounded-3xl border border-dashed border-ink-900/10 bg-surface p-8 text-center">
            <p className="font-semibold">No demo shops on this deployment yet</p>
            <p className="mt-2 text-sm text-muted-foreground">
              Run <code className="rounded bg-surface-2 px-1.5 py-0.5 text-xs">pnpm db:seed</code> to add them, or set up your own shop.
            </p>
          </div>
        )}
        <p className="mt-4 text-center text-xs text-muted-foreground">Demo shops are fictional businesses for trying Nia. The memories you create in them are real.</p>

        <section aria-labelledby="any-business" className="mt-14 rounded-3xl border border-ink-900/[0.06] bg-surface shadow-soft p-6 sm:p-8">
          <h2 id="any-business" className="text-xl font-extrabold tracking-tight">
            Run a different kind of business?
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Nia sells products, books services and remembers customers for any of these. Add your own catalog, prices, hours, delivery areas and policies in a few minutes.
          </p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {BUSINESS_TYPES.filter((b) => b.value !== "other").map((b) => (
              <li key={b.value} className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium">
                {b.label}
              </li>
            ))}
          </ul>
          <Link href="/signin?next=/onboarding" className={buttonClasses({ className: "mt-6" })}>
            Set up your shop
          </Link>
        </section>
      </main>
    </div>
  );
}
