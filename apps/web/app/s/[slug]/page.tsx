import Link from "next/link";
import { and, eq, sql } from "drizzle-orm";
import { ArrowRight, CalendarPlus, MessageCircle, Repeat, ShoppingBag, Sparkles } from "lucide-react";
import { Mascot, buttonClasses, cn } from "@nia/ui";
import { memoryRecords } from "@nia/database";
import { getCustomerRecentOrders, searchProducts, searchServices } from "@nia/commerce";
import { customerNamespaces } from "@nia/memory";
import { formatDateTime, greetingFor } from "@nia/shared";
import { ProductCard } from "@/components/commerce/cards";
import { WalrusChip } from "@/components/brand";
import { getStorefront } from "@/lib/storefront";
import { userFirstName } from "@/lib/user";
import { db } from "@/lib/server";

export default async function StoreHome({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { merchant, customer, user } = await getStorefront(slug);
  const base = `/s/${slug}`;

  const [lastOrders, featured, services, memoryCount] = await Promise.all([
    customer ? getCustomerRecentOrders(db(), merchant.id, customer.id, 1) : Promise.resolve([]),
    searchProducts(db(), merchant.id, { inStockOnly: true, limit: 4 }),
    searchServices(db(), merchant.id, merchant.timezone, { limit: 3 }),
    customer
      ? customerNamespaces(db(), merchant.id, customer.id).then(async (ns) => {
          const [row] = await db()
            .select({ n: sql<number>`count(*)::int` })
            .from(memoryRecords)
            .where(and(eq(memoryRecords.merchantId, merchant.id), sql`${memoryRecords.namespace} in ${ns}`, eq(memoryRecords.lifecycle, "active"), eq(memoryRecords.persistStatus, "stored")));
          return row?.n ?? 0;
        })
      : Promise.resolve(0),
  ]);
  const lastOrder = lastOrders[0];
  const name = customer?.displayName ?? (user ? userFirstName(user) : null);
  const firstName = name ? name.split(/[\s._-]/)[0]!.replace(/^\w/, (c) => c.toUpperCase()) : null;

  const actions = [
    lastOrder ? { href: `${base}/chat?q=${encodeURIComponent("Same as last time")}&send=1`, label: "Reorder last purchase", icon: Repeat, primary: true } : null,
    { href: `${base}/shop`, label: "Browse products", icon: ShoppingBag, primary: !lastOrder },
    services.length ? { href: `${base}/chat?q=${encodeURIComponent("I'd like to book a service")}&send=1`, label: "Book a service", icon: CalendarPlus, primary: false } : null,
    { href: `${base}/chat`, label: "Ask Nia", icon: MessageCircle, primary: false },
  ].filter(Boolean) as { href: string; label: string; icon: typeof Repeat; primary: boolean }[];

  return (
    <main className="mx-auto max-w-5xl px-4 md:px-6">
      <section className="nia-wash -mx-4 px-4 pt-8 pb-6 md:mx-0 md:mt-6 md:rounded-3xl md:border md:border-border md:px-10 md:py-10">
        <div className="flex items-center gap-4 md:gap-8">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-muted-foreground">
              {greetingFor(new Date(), merchant.timezone)}
              {firstName ? `, ${firstName}` : ""}
            </p>
            <h1 className="mt-1 text-[clamp(2rem,4.2vw,3rem)] leading-[1.05] font-extrabold tracking-[-0.04em] text-balance">What can I help you find today?</h1>
            {merchant.welcomeMessage ? <p className="mt-2 max-w-md text-[15px] text-muted-foreground">{merchant.welcomeMessage}</p> : null}
          </div>
          <Mascot size={104} state="greeting" className="md:hidden" decorative />
          <Mascot size={148} state="greeting" className="hidden md:block" decorative />
        </div>
        <ul className="mt-6 grid grid-cols-2 gap-2.5 md:flex md:flex-wrap">
          {actions.map(({ href, label, icon: Icon, primary }, i) => (
            <li key={label} className={cn(actions.length % 2 === 1 && i === actions.length - 1 && "col-span-2")}>
              <Link
                href={href}
                className={cn(
                  "flex h-full min-h-14 items-center gap-2.5 rounded-2xl px-4 py-3 text-[15px] font-semibold transition-[background-color,transform] duration-100 ease-out motion-safe:active:scale-[0.98]",
                  primary ? "bg-primary text-primary-foreground hover:bg-primary/90" : "border border-border bg-surface hover:bg-surface-2",
                )}
              >
                <Icon className="size-5 shrink-0" aria-hidden="true" />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {lastOrder ? (
        <section className="mt-6" aria-labelledby="last-order">
          <div className="flex items-center justify-between">
            <h2 id="last-order" className="font-bold tracking-tight">
              Your last order
            </h2>
            <Link href={`${base}/orders`} className="text-sm font-semibold text-accent-strong hover:underline">
              All orders
            </Link>
          </div>
          <Link href={`${base}/chat?q=${encodeURIComponent("Same as last time")}&send=1`} className="mt-3 flex items-center gap-4 rounded-3xl border border-ink-900/[0.06] bg-surface shadow-soft p-4 transition-colors duration-100 hover:bg-surface-2">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-strong">
              <Repeat className="size-5" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-semibold">
                {lastOrder.items[0]?.quantity} × {lastOrder.items[0]?.name}
                {lastOrder.items[0]?.variantLabel ? ` · ${lastOrder.items[0].variantLabel}` : ""}
                {lastOrder.items.length > 1 ? ` + ${lastOrder.items.length - 1} more` : ""}
              </span>
              <span className="block text-sm text-muted-foreground">
                #{lastOrder.number} · {lastOrder.statusLabel} · {formatDateTime(lastOrder.submittedAt ?? lastOrder.createdAt, { withTime: false, timeZone: merchant.timezone })}
              </span>
            </span>
            <span className="hidden text-sm font-semibold text-accent-strong sm:block">Order again</span>
            <ArrowRight className="size-4 text-muted-foreground" aria-hidden="true" />
          </Link>
        </section>
      ) : null}

      <section className="mt-6 rounded-3xl border border-ink-900/[0.06] bg-surface shadow-soft p-4" aria-label="Memory">
        {customer ? (
          <Link href={`${base}/profile`} className="flex items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-memory-soft text-memory">
              <Sparkles className="size-5" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{memoryCount ? `Nia remembers ${memoryCount} thing${memoryCount === 1 ? "" : "s"} about you` : "Nia will remember what helps"}</span>
              <span className="block text-sm text-muted-foreground">{memoryCount ? "See, correct or forget them in your Memory Passport" : "Tell Nia your size, colours or delivery area in chat"}</span>
            </span>
            <WalrusChip className="hidden sm:inline-flex" />
          </Link>
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-memory-soft text-memory">
              <Sparkles className="size-5" aria-hidden="true" />
            </span>
            <p className="min-w-0 flex-1 text-sm">
              <span className="block font-semibold">Want Nia to remember you next time?</span>
              <span className="text-muted-foreground">Sign in so your size, favourites and delivery area carry over — on the web and in Telegram.</span>
            </p>
            <Link href={`${base}/signin`} className={buttonClasses({ variant: "secondary", size: "sm" })}>
              Sign in
            </Link>
          </div>
        )}
      </section>

      {featured.length ? (
        <section className="mt-8" aria-labelledby="featured">
          <div className="flex items-center justify-between">
            <h2 id="featured" className="font-bold tracking-tight">
              In stock now
            </h2>
            <Link href={`${base}/shop`} className="text-sm font-semibold text-accent-strong hover:underline">
              See all
            </Link>
          </div>
          <ul className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {featured.map((p) => (
              <li key={p.id}>
                <Link href={`${base}/shop/${p.slug}`} className="block h-full rounded-2xl focus-visible:outline-offset-4">
                  <ProductCard product={p} locale={merchant.locale} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <section className="mt-8 flex flex-col items-center rounded-3xl border border-dashed border-ink-900/10 p-8 text-center">
          <Mascot size={72} state="idle" decorative />
          <p className="mt-3 font-semibold">The shelves are being stocked</p>
          <p className="mt-1 text-sm text-muted-foreground">{merchant.name} hasn’t added products yet. You can still ask Nia a question.</p>
        </section>
      )}
    </main>
  );
}
