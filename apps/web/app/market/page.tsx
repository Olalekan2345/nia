import Link from "next/link";
import { ArrowLeft, ArrowRight, Brain, SlidersHorizontal, Sparkles, Store } from "lucide-react";
import { Mascot, buttonClasses, cn } from "@nia/ui";
import { MARKET_COLLECTIONS, MARKET_DEPARTMENTS, POPULAR_MART_RAILS, formatPriceRange, marketCollection, marketDepartment, toMinorUnits } from "@nia/shared";
import { departmentSummaries, marketCatalog, marketCategories, marketShops, railProducts, searchMarket, searchMarketServices, type MarketProduct, type MarketService } from "@nia/commerce";
import { WalrusChip } from "@/components/brand";
import { ProductVisual } from "@/components/commerce/product-visual";
import { CompareToggle } from "@/components/market/compare-controls";
import { DepartmentCard } from "@/components/market/department-card";
import { MarketProductCard, toMarketCard } from "@/components/market/market-card";
import { QuickAdd } from "@/components/market/quick-add";
import { Rail, RailItem } from "@/components/market/rail";
import { MerchantMark } from "@/components/store/merchant-mark";
import { forYou, greeting, loadMarket, marketMemories } from "@/lib/market";
import { userFirstName } from "@/lib/user";
import { db } from "@/lib/server";

export const dynamic = "force-dynamic";

interface Search {
  q?: string;
  cat?: string;
  type?: string;
  dept?: string;
  col?: string;
  max?: string;
  stock?: string;
  shop?: string;
  tab?: string;
  page?: string;
}

const PAGE_SIZE = 24;
const askHref = (text: string) => `/market/nia?q=${encodeURIComponent(text)}&send=1`;

/** Rail cards are narrow: Add and Compare side by side. */
function RailActions({ p, signedIn }: { p: MarketProduct; signedIn: boolean }) {
  return (
    <>
      <QuickAdd shopSlug={p.shop.slug} productId={p.id} url={p.url} hasOptions={p.variants.length > 0} available={p.available} signedIn={signedIn} />
      <CompareToggle productId={p.id} className="flex-1 justify-center" />
    </>
  );
}

function ProductCard({ p, locale, signedIn }: { p: MarketProduct; locale: string; signedIn: boolean }) {
  return (
    <MarketProductCard
      product={toMarketCard(p)}
      locale={locale}
      actions={
        <>
          <QuickAdd shopSlug={p.shop.slug} productId={p.id} url={p.url} hasOptions={p.variants.length > 0} available={p.available} signedIn={signedIn} className="w-full basis-full" />
          <CompareToggle productId={p.id} className="flex-1 justify-center" />
          <Link href={askHref(`Help me decide about the ${p.name} from ${p.shop.name}`)} className={buttonClasses({ variant: "ghost", size: "sm", className: "flex-1" })}>
            Ask Nia
          </Link>
        </>
      }
    />
  );
}

export default async function MarketPage({ searchParams }: { searchParams: Promise<Search> }) {
  const sp = await searchParams;
  const q = sp.q?.trim().slice(0, 120) || undefined;
  const tab = sp.tab === "services" || sp.tab === "for-you" ? sp.tab : "all";
  const maxMajor = Number(sp.max);
  const collection = marketCollection(sp.col);
  const dept = marketDepartment(collection?.department ?? sp.dept);
  const page = Math.max(1, Math.min(50, Math.floor(Number(sp.page)) || 1));
  const browsing = Boolean(q || sp.cat || sp.type || sp.shop || sp.stock || dept || collection || (Number.isFinite(maxMajor) && maxMajor > 0));
  const home = tab === "all" && !browsing;

  const sf = await loadMarket();
  const signedIn = Boolean(sf?.user);
  const locale = sf?.merchant.locale ?? "en-NG";
  const currency = sf?.merchant.currency ?? "NGN";
  const timeZone = sf?.merchant.timezone ?? "Africa/Lagos";
  const [memories, shops, categories] = await Promise.all([
    sf ? marketMemories(sf.merchant.id, sf.customer) : Promise.resolve([]),
    marketShops(db()),
    marketCategories(db(), dept ? { department: dept.key } : {}),
  ]);

  const [catalog, listed, services, picks] = await Promise.all([
    home ? marketCatalog(db()) : Promise.resolve(null),
    tab === "all" && browsing
      ? searchMarket(db(), {
          query: q,
          category: sp.cat || undefined,
          department: dept?.key,
          collection: collection?.key,
          businessType: sp.type || undefined,
          shops: sp.shop ? [sp.shop] : undefined,
          maxPrice: Number.isFinite(maxMajor) && maxMajor > 0 ? toMinorUnits(maxMajor, currency) : undefined,
          inStockOnly: sp.stock === "1",
          limit: PAGE_SIZE + 1,
          offset: (page - 1) * PAGE_SIZE,
        })
      : Promise.resolve([] as MarketProduct[]),
    tab === "services" || home ? searchMarketServices(db(), { query: q, limit: tab === "services" ? 24 : 4 }) : Promise.resolve([] as MarketService[]),
    (tab === "for-you" || home) && memories.length ? forYou(memories, currency) : Promise.resolve(null),
  ]);

  const products = listed.slice(0, PAGE_SIZE);
  const hasMore = listed.length > PAGE_SIZE;
  const summaries = catalog ? departmentSummaries(catalog) : [];
  // Each Popular Mart rail skips what an earlier rail already shows, so the four rails don't repeat each other.
  const shown = new Set<string>();
  const rails = catalog
    ? POPULAR_MART_RAILS.map((rail) => {
        const items = railProducts(catalog, rail, { currency, exclude: shown });
        for (const p of items) shown.add(p.id);
        return { rail, items };
      }).filter((r) => r.items.length >= 3)
    : [];
  const featured = (rails[0]?.items ?? products).filter((p) => p.image).slice(0, 3);

  const name = sf?.customer?.displayName ?? (sf?.user ? userFirstName(sf.user) : null);
  const departmentsLive = MARKET_DEPARTMENTS.filter((d) => shops.some((s) => d.businessTypes.includes(s.businessType)));
  const link = (t: Record<string, string | undefined>, keepQuery = true) => {
    const params = new URLSearchParams(Object.entries({ ...(keepQuery ? { q } : {}), ...t }).filter((e): e is [string, string] => Boolean(e[1])));
    const s = params.toString();
    return s ? `/market?${s}` : "/market";
  };
  const activeTab = tab === "services" ? "services" : tab === "for-you" ? "for-you" : dept ? `dept:${dept.key}` : "all";
  const heading = q ? `Results for “${q}”` : collection ? collection.name : dept ? dept.name : sp.type ? (shops.find((s) => s.businessType === sp.type)?.businessLabel ?? "Products") : "Everything in the market";
  const collectionsHere = dept ? MARKET_COLLECTIONS.filter((c) => c.department === dept.key) : [];

  return (
    <main className="mx-auto max-w-6xl space-y-10 px-4 pt-6 pb-24 md:px-6">
      {/* Welcome + Nia banner */}
      {tab === "all" && !dept && !collection ? (
        <section className="grid gap-4 lg:grid-cols-[1fr_1.35fr]">
          <div className="nia-wash flex flex-col justify-between rounded-3xl border border-border p-6">
            <div>
              <p className="text-sm font-semibold text-muted-foreground">
                {greeting(timeZone)}
                {name ? "," : ""}
              </p>
              <h1 className="mt-1 text-[clamp(2rem,4.2vw,3rem)] leading-[1.05] font-extrabold tracking-[-0.04em] text-balance">{name ? `${name}, welcome to Walrus Market` : "Welcome to Walrus Market"}</h1>
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
      ) : null}

      {/* Browse: All · For you · departments · Services */}
      <nav className="-mx-4 flex gap-1 overflow-x-auto px-4 scrollbar-none" aria-label="Browse">
        {[
          { key: "all", label: "All", href: "/market" },
          ...(memories.length ? [{ key: "for-you", label: "For you", href: link({ tab: "for-you" }, false) }] : []),
          ...departmentsLive.map((d) => ({ key: `dept:${d.key}`, label: d.short, href: link({ dept: d.key }, false) })),
          { key: "services", label: "Services", href: link({ tab: "services" }, false) },
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

      {/* Picked for you (from the shopper's own market memory) */}
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
        <p className="rounded-3xl border border-dashed border-ink-900/10 p-6 text-center text-sm text-muted-foreground">
          Nothing in the market matches what you told Nia yet.{" "}
          <Link href="/market/nia" className="font-semibold text-accent-strong hover:underline">
            Ask Nia
          </Link>{" "}
          for other ideas.
        </p>
      ) : null}

      {home ? (
        <>
          {/* Shop by department */}
          <section aria-labelledby="departments" className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <h2 id="departments" className="text-xl font-extrabold tracking-tight">
                Shop by department
              </h2>
              <p className="text-sm text-muted-foreground tabular">{catalog?.length ?? 0} products from {shops.length} shops</p>
            </div>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
              {summaries.map((d) => (
                <li key={d.key}>
                  <DepartmentCard dept={d} />
                </li>
              ))}
              {MARKET_COLLECTIONS.map((c) => {
                const d = summaries.find((s) => s.key === c.department);
                if (!d) return null;
                const photo = catalog?.find((p) => c.categories.includes(p.category ?? "") && p.image)?.image ?? null;
                return (
                  <li key={c.key}>
                    <Link
                      href={link({ col: c.key }, false)}
                      className="group relative flex h-full min-h-56 flex-col justify-end overflow-hidden rounded-3xl bg-ink-900 p-5 text-white shadow-soft transition-[box-shadow,transform] duration-200 hover:shadow-lift motion-safe:hover:-translate-y-0.5"
                    >
                      <div className="absolute inset-0 opacity-70 transition-transform duration-500 group-hover:scale-[1.03]" aria-hidden="true">
                        <ProductVisual name={c.name} category="Phones" image={photo} rounded="rounded-none" className="aspect-auto h-full" />
                      </div>
                      <div className="absolute inset-0 bg-linear-to-t from-ink-950/90 via-ink-950/40 to-transparent" aria-hidden="true" />
                      <div className="relative">
                        <p className="text-xs font-semibold tracking-wide text-aqua-200 uppercase">Featured in {d.short}</p>
                        <h3 className="mt-1 text-lg font-extrabold tracking-[-0.02em]">{c.name}</h3>
                        <p className="mt-1 text-sm text-white/80 text-pretty">{c.blurb}</p>
                        <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold">
                          Explore <ArrowRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5" aria-hidden="true" />
                        </span>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* Popular Mart: curated rails, labelled as curated */}
          {rails.length ? (
            <section aria-labelledby="popular-mart" className="space-y-6 rounded-[32px] border border-ink-900/[0.06] bg-surface p-4 shadow-soft sm:p-6">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="inline-flex items-center gap-1.5 rounded-full bg-memory-soft px-3 py-1 text-xs font-semibold text-memory">
                    <Sparkles className="size-3.5" aria-hidden="true" /> Popular Mart
                  </p>
                  <h2 id="popular-mart" className="mt-2 text-2xl font-extrabold tracking-[-0.03em]">
                    Popular right now in Walrus Market
                  </h2>
                  <p className="mt-1 max-w-xl text-sm text-muted-foreground">Collections picked by the market team, new additions and everyday prices — across every department.</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {departmentsLive.map((d) => (
                    <Link key={d.key} href={link({ dept: d.key }, false)} className="rounded-full border border-ink-900/10 bg-paper px-3.5 py-1.5 text-sm font-semibold text-foreground transition-colors duration-150 hover:border-accent/40 hover:bg-accent-soft">
                      {d.short}
                    </Link>
                  ))}
                </div>
              </div>
              {rails.map(({ rail, items }) => (
                <Rail key={rail.key} id={`rail-${rail.key}`} title={rail.title} note={rail.note} badge={rail.tag ? "Curated" : undefined}>
                  {items.map((p) => (
                    <RailItem key={p.id}>
                      <MarketProductCard product={toMarketCard(p)} locale={locale} actions={<RailActions p={p} signedIn={signedIn} />} />
                    </RailItem>
                  ))}
                </Rail>
              ))}
            </section>
          ) : null}

          {/* One rail per department */}
          <div className="space-y-9">
            {summaries.map((d) => (
              <Rail key={d.key} id={`dept-${d.key}`} title={d.name} note={d.blurb} seeAll={{ href: link({ dept: d.key }, false), label: `See all ${d.count}` }}>
                {d.products.map((p) => (
                  <RailItem key={p.id}>
                    <MarketProductCard product={toMarketCard(p)} locale={locale} actions={<RailActions p={p} signedIn={signedIn} />} />
                  </RailItem>
                ))}
              </Rail>
            ))}
          </div>
        </>
      ) : null}

      {/* Browsing: a department, collection, search or filter */}
      {tab === "all" && browsing ? (
        <section aria-labelledby="products" className="space-y-4">
          {dept || collection ? (
            <Link href="/market" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
              <ArrowLeft className="size-4" aria-hidden="true" /> All departments
            </Link>
          ) : null}
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 id="products" className="text-[clamp(1.6rem,3vw,2.2rem)] leading-tight font-extrabold tracking-[-0.03em] text-balance">
                {heading}
              </h1>
              {collection ? <p className="mt-1 text-muted-foreground">{collection.blurb}</p> : dept && !q ? <p className="mt-1 text-muted-foreground">{dept.blurb}</p> : null}
            </div>
          </div>

          {dept ? (
            <nav className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-none" aria-label={`${dept.short} categories`}>
              {collectionsHere.map((c) => (
                <Link
                  key={c.key}
                  href={link({ col: c.key })}
                  aria-current={collection?.key === c.key ? "page" : undefined}
                  className={cn("shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-semibold whitespace-nowrap", collection?.key === c.key ? "border-transparent bg-primary text-primary-foreground" : "border-memory/25 bg-memory-soft text-memory hover:opacity-90")}
                >
                  {c.name}
                </Link>
              ))}
              {categories.map((c) => (
                <Link
                  key={c.category}
                  href={link({ dept: dept.key, cat: c.category })}
                  aria-current={sp.cat === c.category ? "page" : undefined}
                  className={cn("shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-semibold whitespace-nowrap tabular", sp.cat === c.category ? "border-transparent bg-primary text-primary-foreground" : "border-ink-900/10 bg-surface hover:bg-surface-2")}
                >
                  {c.category} <span className="font-normal opacity-70">{c.count}</span>
                </Link>
              ))}
            </nav>
          ) : null}

          <form action="/market" className="flex flex-wrap items-end gap-2 rounded-3xl border border-ink-900/[0.06] bg-surface p-3 shadow-soft">
            {q ? <input type="hidden" name="q" value={q} /> : null}
            {sp.type ? <input type="hidden" name="type" value={sp.type} /> : null}
            {dept && !collection ? <input type="hidden" name="dept" value={dept.key} /> : null}
            {collection ? <input type="hidden" name="col" value={collection.key} /> : null}
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
              <input name="max" type="number" inputMode="numeric" min={0} step={500} defaultValue={sp.max ?? ""} placeholder="Any" className="h-10 w-32 rounded-2xl border border-ink-900/12 bg-surface px-4 text-sm font-medium text-foreground" />
            </label>
            <label className="grid gap-1 text-xs font-semibold text-muted-foreground">
              Shop
              <select name="shop" defaultValue={sp.shop ?? ""} className="nia-select h-10 min-w-36 appearance-none rounded-xl border border-border bg-background bg-[length:16px] bg-[right_10px_center] bg-no-repeat pr-8 pl-3 text-sm font-medium text-foreground">
                <option value="">All shops</option>
                {shops
                  .filter((s) => !dept || dept.businessTypes.includes(s.businessType))
                  .map((s) => (
                    <option key={s.slug} value={s.slug}>
                      {s.name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="flex h-10 items-center gap-2 rounded-2xl border border-ink-900/12 bg-surface px-4 text-sm font-medium">
              <input type="checkbox" name="stock" value="1" defaultChecked={sp.stock === "1"} className="size-4 accent-[var(--accent)]" />
              In stock
            </label>
            <button type="submit" className={buttonClasses({ size: "sm", className: "h-10" })}>
              Apply
            </button>
            <Link href={dept ? link({ dept: dept.key }, false) : "/market"} className="h-10 px-2 text-sm leading-10 font-semibold text-muted-foreground hover:text-foreground">
              Clear
            </Link>
          </form>

          {products.length ? (
            <>
              <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
                {products.map((p) => (
                  <li key={p.id}>
                    <ProductCard p={p} locale={locale} signedIn={signedIn} />
                  </li>
                ))}
              </ul>
              {page > 1 || hasMore ? (
                <nav className="flex items-center justify-between gap-3 pt-2" aria-label="Pages">
                  {page > 1 ? (
                    <Link href={link({ dept: sp.dept, col: sp.col, cat: sp.cat, type: sp.type, shop: sp.shop, max: sp.max, stock: sp.stock, page: page - 1 > 1 ? String(page - 1) : undefined })} className={buttonClasses({ variant: "secondary", size: "sm" })}>
                      <ArrowLeft className="size-4" aria-hidden="true" /> Previous
                    </Link>
                  ) : (
                    <span />
                  )}
                  <p className="text-sm text-muted-foreground tabular">Page {page}</p>
                  {hasMore ? (
                    <Link href={link({ dept: sp.dept, col: sp.col, cat: sp.cat, type: sp.type, shop: sp.shop, max: sp.max, stock: sp.stock, page: String(page + 1) })} className={buttonClasses({ variant: "secondary", size: "sm" })}>
                      Next <ArrowRight className="size-4" aria-hidden="true" />
                    </Link>
                  ) : (
                    <span />
                  )}
                </nav>
              ) : null}
            </>
          ) : (
            <div className="flex flex-col items-center rounded-3xl border border-dashed border-ink-900/10 px-6 py-12 text-center">
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
              <li key={`${s.shop.slug}-${s.id}`} className="flex flex-col overflow-hidden rounded-3xl border border-ink-900/[0.06] bg-surface shadow-soft">
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
      {home ? (
        <section aria-labelledby="shops" className="space-y-4">
          <h2 id="shops" className="text-xl font-extrabold tracking-tight">
            Shops in the market
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shops.map((s) => (
              <li key={s.slug}>
                <Link href={`/s/${s.slug}`} className="flex items-center gap-3 rounded-3xl border border-ink-900/[0.06] bg-surface p-4 shadow-soft transition-[border-color,box-shadow] duration-200 hover:border-accent/40 hover:shadow-lift">
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
