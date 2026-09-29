import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { Mascot, buttonClasses, cn } from "@nia/ui";
import { listCategories, searchProducts, searchServices } from "@nia/commerce";
import { ProductCard, ServiceCard } from "@/components/commerce/cards";
import { getStorefront } from "@/lib/storefront";
import { db } from "@/lib/server";

export const metadata: Metadata = { title: "Shop" };

export default async function ShopPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ q?: string; category?: string }> }) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const { merchant } = await getStorefront(slug);
  const q = sp.q?.slice(0, 100).trim() ?? "";
  const category = sp.category?.slice(0, 80);
  const [products, services, categories] = await Promise.all([
    searchProducts(db(), merchant.id, { query: q || undefined, category, limit: 24 }),
    category ? Promise.resolve([]) : searchServices(db(), merchant.id, merchant.timezone, { query: q || undefined, limit: 12 }),
    listCategories(db(), merchant.id),
  ]);
  const base = `/s/${slug}/shop`;

  return (
    <main className="mx-auto max-w-5xl px-4 pt-6 md:px-6">
      <h1 className="text-[clamp(1.75rem,3vw,2.35rem)] leading-tight font-extrabold tracking-[-0.035em] text-balance">Shop {merchant.name}</h1>
      <form action={base} role="search" className="relative mt-4">
        <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <label htmlFor="q" className="sr-only">
          Search products and services
        </label>
        <input
          id="q"
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Search products and services"
          className="h-12 w-full rounded-3xl border border-ink-900/[0.06] bg-surface shadow-soft pr-4 pl-10 text-[16px] placeholder:text-muted-foreground/80 focus-visible:border-accent focus-visible:ring-4 focus-visible:ring-ring/20 focus-visible:outline-none"
        />
      </form>

      {categories.length ? (
        <nav aria-label="Categories" className="scrollbar-none -mx-4 mt-4 flex gap-2 overflow-x-auto px-4">
          <Link href={base} className={cn("shrink-0 rounded-full border px-3.5 py-2 text-sm font-semibold", !category ? "border-foreground bg-foreground text-background" : "border-border bg-surface hover:bg-surface-2")}>
            All
          </Link>
          {categories.map((c) => (
            <Link
              key={c}
              href={`${base}?category=${encodeURIComponent(c)}`}
              aria-current={category === c ? "page" : undefined}
              className={cn("shrink-0 rounded-full border px-3.5 py-2 text-sm font-semibold", category === c ? "border-foreground bg-foreground text-background" : "border-border bg-surface hover:bg-surface-2")}
            >
              {c}
            </Link>
          ))}
        </nav>
      ) : null}

      {products.length ? (
        <section className="mt-6" aria-label="Products">
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
            {products.map((p) => (
              <li key={p.id}>
                <Link href={`${base}/${p.slug}`} className="block h-full rounded-2xl focus-visible:outline-offset-4">
                  <ProductCard product={p} locale={merchant.locale} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {services.length ? (
        <section className="mt-8" aria-labelledby="services">
          <h2 id="services" className="font-bold tracking-tight">
            Services & appointments
          </h2>
          <ul className="mt-3 grid gap-3 md:grid-cols-2">
            {services.map((s) => (
              <li key={s.id}>
                <ServiceCard
                  service={s}
                  locale={merchant.locale}
                  timeZone={merchant.timezone}
                  actions={
                    <Link href={`/s/${slug}/chat?q=${encodeURIComponent(`I'd like to book ${s.name}. What times are available?`)}&send=1`} className={buttonClasses({ size: "sm" })}>
                      Book with Nia
                    </Link>
                  }
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {products.length === 0 && services.length === 0 ? (
        <div className="mt-10 flex flex-col items-center rounded-3xl border border-dashed border-ink-900/10 px-6 py-12 text-center">
          <Mascot size={80} state="thinking" decorative />
          <p className="mt-4 font-semibold">{q ? `Nothing matches “${q}”` : "No products yet"}</p>
          <p className="mt-1 text-sm text-muted-foreground">{q ? "Try a different word, or ask Nia to help you find something similar." : `${merchant.name} hasn’t added products yet.`}</p>
          {q ? (
            <Link href={`/s/${slug}/chat?q=${encodeURIComponent(`I'm looking for ${q}`)}&send=1`} className={buttonClasses({ className: "mt-5" })}>
              Ask Nia
            </Link>
          ) : null}
        </div>
      ) : null}
    </main>
  );
}
