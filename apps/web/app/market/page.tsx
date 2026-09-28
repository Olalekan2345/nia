import Link from "next/link";
import { ArrowRight, Brain, SlidersHorizontal, Sparkles, Store } from "lucide-react";
import { Mascot, buttonClasses, cn } from "@nia/ui";
import { formatPriceRange, toMinorUnits } from "@nia/shared";
import { marketCategories, marketShops, searchMarket, searchMarketServices, type MarketService } from "@nia/commerce";
import { WalrusChip } from "@/components/brand";
import { ProductVisual } from "@/components/commerce/product-visual";
import { CompareToggle } from "@/components/market/compare-controls";
import { MarketProductCard, toMarketCard } from "@/components/market/market-card";
import { MerchantMark } from "@/components/store/merchant-mark";
import { forYou, greeting, loadMarket, marketMemories } from "@/lib/market";
import { userFirstName } from "@/lib/user";
import { db } from "@/lib/server";

export const dynamic = "force-dynamic";

interface Search {
  q?: string;
  cat?: string;
  type?: string;
  max?: string;
  stock?: string;
  shop?: string;
  tab?: string;
}

const askHref = (text: string) => `/market/nia?q=${encodeURIComponent(text)}&send=1`;

export default async function MarketPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const q = sp.q?.trim().slice(0, 120) || undefined;
  const tab = sp.tab === "services" || sp.tab === "for-you" ? sp.tab : "all";
  const maxMajor = Number(sp.max);
  const filtered = Boolean(q || sp.cat || sp.type || sp.shop || sp.stock || (Number.isFinite(maxMajor) && maxMajor > 0));

  const sf = await loadMarket();
  const locale = sf?.merchant.locale ?? "en-NG";
  const currency = sf?.merchant.currency ?? "NGN";
  const timeZone = sf?.merchant.timezone ?? "Africa/Lagos";
  const [memories, shops, categories] = await Promise.all([sf ? marketMemories(sf.merchant.id, sf.customer) : Promise.resolve([]), marketShops(db()), marketCategories(db())]);

  const [products, services, picks] = await Promise.all([
    tab === "services"
      ? Promise.resolve([])
      : searchMarket(db(), {
          query: q,
          category: sp.cat || undefined,
          businessType: sp.type || undefined,
          shops: sp.shop ? [sp.shop] : undefined,
          maxPrice: Number.isFinite(maxMajor) && maxMajor > 0 ? toMinorUnits(maxMajor, currency) : undefined,
          inStockOnly: sp.stock === "1",
          limit: 48,
        }),
    tab === "services" || !filtered ? searchMarketServices(db(), { query: q, limit: tab === "services" ? 24 : 4 }) : Promise.resolve([] as MarketService[]),
    (tab === "for-you" || (tab === "all" && !filtered)) && memories.length ? forYou(memories, currency) : Promise.resolve(null),
  ]);

  const name = sf?.customer?.displayName ?? (sf?.user ? userFirstName(sf.user) : null);
  const businessTypes = [...new Map(shops.map((s) => [s.businessType, s.businessLabel])).entries()];
  const featured = products.filter((p) => p.image).slice(0, 3);
  const tabHref = (t: Record<string, string | undefined>) => {
    const params = new URLSearchParams(Object.entries({ q, ...t }).filter((e): e is [string, string] => Boolean(e[1])));
    const s = params.toString();
    return s ? `/market?${s}` : "/market";
  };
  const activeTab = tab === "services" ? "services" : tab === "for-you" ? "for-you" : sp.type ? `type:${sp.type}` : "all";

  return (
    <main className="mx-auto max-w-6xl space-y-10 px-4 pt-6 pb-24 md:px-6">
      {/* Welcome + Nia banner */}
      <section className="grid gap-4 lg:grid-cols-[1fr_1.35fr]">
        <div className="nia-wash flex flex-col justify-between rounded-3xl border border-border p-6">
          <div>
            <p className="text-sm font-semibold text-muted-foreground">{greeting(timeZone)}{name ? "," : ""}</p>
            <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-balance">{name ? `${name}, welcome to Walrus Market` : "Welcome to Walrus Market"}</h1>
            <p className="mt-2 text-muted-foreground text-pretty">Independent shops in one place. Compare, decide, then buy from the shop you pick.</p>
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            {sf?.user ? (
              <Link href="/market/profile" className="inline-flex items-center gap-2 rounded-full border border-memory/25 bg-memory-soft px-3.5 py-2 text-sm font-semibold text-memory hover:opacity-90">
                <Brain className="size-4" aria-hidden="true" />
                {memories.length ? `Your market profile · ${memories.length} thing${memories.length === 1 ? "" : "s"} Nia remembers` : "Your market profile · tell Nia what you like"}
              </Link>
            ) : (
              <Link href="/market/signin" className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3.5 py-2 text-sm font-semibold hover:bg-surface-2">
                <Brain className="size-4 text-memory" aria-hidden="true" /> Sign in so Nia remembers your answers
              </Link>
            )}
            <WalrusChip label="Memory on Walrus" />
          </div>
        </div>

        <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-ink-800 via-periwinkle-700 to-periwinkle-500 p-6 text-white">
          <div className="pointer-events-none absolute -top-16 -right-10 size-64 rounded-full bg-lavender-300/35 blur-3xl" aria-hidden="true" />
          <div className="pointer-events-none absolute -bottom-20 left-1/3 size-56 rounded-full bg-aqua-300/30 blur-3xl" aria-hidden="true" />
          <div className="relative grid items-center gap-5 sm:grid-cols-[1.1fr_1fr]">
            <div>
              <p className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">
                <Sparkles className="size-3.5" aria-hidden="true" /> Nia, your shopping guide
              </p>
              <h2 className="mt-3 text-2xl font-extrabold tracking-tight text-balance">Not sure what to pick?</h2>
              <p className="mt-2 text-sm text-white/85 text-pretty">Nia asks a couple of quick questions — who it’s for, budget, style — and finds the best match across every shop. Your answers are remembered for next time.</p>
              <Link href="/market/nia" className={buttonClasses({ className: "mt-5 bg-white text-ink-800 hover:bg-white/90" })}>
                Help me choose <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
            <div className="relative hidden h-44 sm:block" aria-hidden="true">
              {featured.length >= 2 ? (
                featured.map((p, i) => (
                  <div
                    key={p.id}
                    className={cn("absolute w-28 overflow-hidden rounded-2xl border-2 border-white/60 shadow-float", i === 0 && "top-0 left-2 -rotate-6", i === 1 && "top-8 left-24 rotate-3", i === 2 && "top-1 right-0 rotate-6")}
                  >
                    <ProductVisual name={p.name} image={p.image} rounded="rounded-none" />
                  </div>
                ))
              ) : (
                <div className="grid h-full place-items-center">
                  <Mascot size={132} state="greeting" decorative />
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Tabs */}
      <nav className="-mx-4 flex gap-1 overflow-x-auto px-4 scrollbar-none" aria-label="Browse">
        {[
          { key: "all", label: "All", href: tabHref({}) },
          ...(memories.length ? [{ key: "for-you", label: "For you", href: tabHref({ tab: "for-you" }) }] : []),
          ...businessTypes.map(([value, label]) => ({ key: `type:${value}`, label, href: tabHref({ type: value }) })),
          { key: "services", label: "Services", href: tabHref({ tab: "services" }) },
        ].map((t) => (
          <Link
            key={t.key}
            href={t.href}
            aria-current={activeTab === t.key ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap transition-colors duration-100",
              activeTab === t.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-surface-2 hover:text-foreground",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {/* Picked for you */}
      {picks && picks.products.length ? (
        <section aria-labelledby="for-you">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 id="for-you" className="text-xl font-extrabold tracking-tight">
                Picked for you
              </h2>
              <p className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
                Because you told Nia:
                {picks.reasons.map((r) => (
                  <span key={r} className="rounded-full bg-memory-soft px-2 py-0.5 text-xs font-semibold text-memory">
                    {r}
                  </span>
                ))}
              </p>
            </div>
            <Link href="/market/profile" className="text-sm font-semibold text-accent-strong hover:underline">
              Edit what Nia remembers
            </Link>
          </div>
          <ul className="-mx-4 mt-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 scrollbar-none">
            {picks.products.map((p) => (
              <li key={p.id} className="w-56 shrink-0 snap-start">
                <MarketProductCard product={toMarketCard(p)} locale={locale} actions={<CompareToggle productId={p.id} />} />
              </li>
            ))}
          </ul>
        </section>
      ) : tab === "for-you" ? (
        <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Nothing in the market matches what you told Nia yet.{" "}
          <Link href="/market/nia" className="font-semibold text-accent-strong hover:underline">
            Ask Nia
          </Link>{" "}
          for other ideas.
        </p>
      ) : null}

      {/* Products */}
      {tab !== "services" ? (
        <section aria-labelledby="products" className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 id="products" className="text-xl font-extrabold tracking-tight">
              {q ? `Results for “${q}”` : sp.type ? (businessTypes.find(([v]) => v === sp.type)?.[1] ?? "Products") : "Everything in the market"}
              <span className="ml-2 text-sm font-medium text-muted-foreground">{products.length}</span>
            </h2>
          </div>

          <form action="/market" className="flex flex-wrap items-end gap-2 rounded-2xl border border-border bg-surface p-3">
            {q ? <input type="hidden" name="q" value={q} /> : null}
            {sp.type ? <input type="hidden" name="type" value={sp.type} /> : null}
            <SlidersHorizontal className="mb-2.5 size-4 text-muted-foreground" aria-hidden="true" />
            <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
              Category
              <select name="cat" defaultValue={sp.cat ?? ""} className="nia-select h-10 min-w-36 appearance-none rounded-xl border border-border bg-background bg-[length:16px] bg-[right_10px_center] bg-no-repeat pr-8 pl-3 text-sm font-medium text-foreground">
                <option value="">All</option>
                {categories.map((c) => (
                  <option key={c.category} value={c.category}>
                    {c.category} ({c.count})
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
              Max budget ({currency === "NGN" ? "₦" : currency})
              <input name="max" type="number" inputMode="numeric" min={0} step={500} defaultValue={sp.max ?? ""} placeholder="Any" className="h-10 w-32 rounded-xl border border-border bg-background px-3 text-sm font-medium text-foreground" />
            </label>
            <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
              Shop
              <select name="shop" defaultValue={sp.shop ?? ""} className="nia-select h-10 min-w-36 appearance-none rounded-xl border border-border bg-background bg-[length:16px] bg-[right_10px_center] bg-no-repeat pr-8 pl-3 text-sm font-medium text-foreground">
                <option value="">All shops</option>
                {shops.map((s) => (
                  <option key={s.slug} value={s.slug}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex h-10 items-center gap-2 rounded-xl border border-border bg-background px-3 text-sm font-medium">
              <input type="checkbox" name="stock" value="1" defaultChecked={sp.stock === "1"} className="size-4 accent-[var(--accent)]" />
              In stock
            </label>
            <button type="submit" className={buttonClasses({ size: "sm", className: "h-10" })}>
              Apply
            </button>
            {filtered ? (
              <Link href={tabHref({ type: sp.type })} className="h-10 px-2 text-sm leading-10 font-semibold text-muted-foreground hover:text-foreground">
                Clear
              </Link>
            ) : null}
          </form>

          {products.length ? (
            <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
              {products.map((p) => (
                <li key={p.id}>
                  <MarketProductCard
                    product={toMarketCard(p)}
                    locale={locale}
                    actions={
                      <>
                        <CompareToggle productId={p.id} className="flex-1 justify-center" />
                        <Link href={askHref(`Help me decide about the ${p.name} from ${p.shop.name}`)} className={buttonClasses({ variant: "ghost", size: "sm", className: "flex-1" })}>
                          Ask Nia
                        </Link>
                      </>
                    }
                  />
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex flex-col items-center rounded-2xl border border-dashed border-border px-6 py-12 text-center">
              <Mascot size={80} state="thinking" decorative />
              <p className="mt-4 font-semibold">Nothing matches that yet</p>
              <p className="mt-1 max-w-sm text-sm text-muted-foreground">Try another word or fewer filters — or tell Nia what you need and she’ll look across every shop.</p>
              <Link href={askHref(q ? `I'm looking for ${q}` : "Help me find something")} className={buttonClasses({ className: "mt-5" })}>
                Ask Nia
              </Link>
            </div>
          )}
        </section>
      ) : null}

      {/* Services */}
      {services.length ? (
        <section aria-labelledby="services" className="space-y-4">
          <h2 id="services" className="text-xl font-extrabold tracking-tight">
            Book a service
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {services.map((s) => (
              <li key={`${s.shop.slug}-${s.id}`} className="flex flex-col overflow-hidden rounded-2xl border border-border bg-surface">
                <ProductVisual name={s.name} category={s.category} image={s.image} kind="SERVICE" rounded="rounded-none" />
                <div className="flex flex-1 flex-col p-3.5">
                  <p className="truncate text-xs font-medium text-muted-foreground">{s.shop.name}</p>
                  <h3 className="mt-1 font-semibold leading-snug">{s.name}</h3>
                  <p className="mt-1 text-sm font-bold tabular">
                    {s.priceMin == null && s.priceMax == null ? "Price on consultation" : formatPriceRange(s.priceMin, s.priceMax, s.currency, { locale })}
                    {s.durationMinutes ? <span className="font-normal text-muted-foreground"> · {s.durationMinutes} min</span> : null}
                  </p>
                  <Link href={s.url} className={buttonClasses({ size: "sm", variant: "secondary", className: "mt-auto self-start" })}>
                    Book at {s.shop.name}
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Shops */}
      {!filtered && tab === "all" ? (
        <section aria-labelledby="shops" className="space-y-4">
          <h2 id="shops" className="text-xl font-extrabold tracking-tight">
            Shops in the market
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shops.map((s) => (
              <li key={s.slug}>
                <Link href={`/s/${s.slug}`} className="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 transition-colors duration-100 hover:border-accent">
                  <MerchantMark name={s.name} logoUrl={s.logoUrl} accent={s.accentColor} size={44} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold">{s.name}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {s.businessLabel}
                      {s.city ? ` · ${s.city}` : ""}
                      {s.isDemo ? " · demo" : ""}
                    </span>
                  </span>
                  <Store className="size-4 text-muted-foreground" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
