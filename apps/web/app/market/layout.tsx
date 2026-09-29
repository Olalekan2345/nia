import type { Metadata } from "next";
import Link from "next/link";
import { Search, Sparkles, Store, UserRound } from "lucide-react";
import { Mascot, buttonClasses } from "@nia/ui";
import { CompareTray } from "@/components/market/compare-controls";
import { getSessionUser } from "@/lib/auth";
import { listUserMerchants } from "@/lib/access";

export const metadata: Metadata = {
  title: { default: "Walrus Market", template: "%s · Walrus Market" },
  description: "Discover products and services from independent shops in one place — and let Nia help you choose. Memory on Walrus.",
};

export default async function MarketLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  // Sign-in lands everyone here; people who run a shop get a way back to their dashboard.
  const ownsShop = user ? (await listUserMerchants(user.id)).some((w) => w.merchant.kind === "shop") : false;
  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-30 border-b border-ink-900/[0.06] bg-surface/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 md:px-6">
          <Link href="/market" className="flex shrink-0 items-center gap-2 rounded-xl" aria-label="Walrus Market home">
            <Mascot size={34} decorative />
            <span className="leading-tight">
              <span className="block text-base font-extrabold tracking-tight">Walrus Market</span>
              <span className="block text-[11px] font-medium text-muted-foreground">with Nia</span>
            </span>
          </Link>
          <form action="/market" className="relative mx-auto hidden w-full max-w-md md:block" role="search">
            <label htmlFor="market-q" className="sr-only">
              Search Walrus Market
            </label>
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input
              id="market-q"
              name="q"
              type="search"
              placeholder="Search fabric, cakes, hair care…"
              className="h-11 w-full rounded-full border border-ink-900/12 bg-surface pr-4 pl-10 text-[15px] placeholder:text-muted-foreground/75 transition-[border-color,box-shadow] duration-150 hover:border-ink-900/20 focus-visible:border-accent focus-visible:ring-4 focus-visible:ring-ring/15 focus-visible:outline-none"
            />
          </form>
          <nav className="ml-auto flex items-center gap-1.5 md:ml-0" aria-label="Market">
            <Link href="/market/nia" className={buttonClasses({ size: "sm" })}>
              <Sparkles className="size-4" aria-hidden="true" /> Ask Nia
            </Link>
            {ownsShop ? (
              <Link href="/dashboard" className={buttonClasses({ variant: "ghost", size: "sm", className: "px-2.5 sm:px-4" })} aria-label="Your shops">
                <Store className="size-4" aria-hidden="true" />
                <span className="hidden sm:inline">Your shops</span>
              </Link>
            ) : null}
            {user ? (
              <Link href="/market/profile" className="grid size-10 place-items-center rounded-full text-muted-foreground transition-colors duration-150 hover:bg-ink-900/[0.05] hover:text-foreground" aria-label="Your market profile">
                <UserRound className="size-5" aria-hidden="true" />
              </Link>
            ) : (
              <Link href="/market/signin" className={buttonClasses({ variant: "ghost", size: "sm" })}>
                Sign in
              </Link>
            )}
          </nav>
        </div>
        <form action="/market" className="px-4 pb-3 md:hidden" role="search">
          <label htmlFor="market-q-m" className="sr-only">
            Search Walrus Market
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <input
              id="market-q-m"
              name="q"
              type="search"
              placeholder="Search fabric, cakes, hair care…"
              className="h-11 w-full rounded-full border border-ink-900/12 bg-surface pr-4 pl-10 text-[16px] placeholder:text-muted-foreground/75 transition-[border-color,box-shadow] duration-150 hover:border-ink-900/20 focus-visible:border-accent focus-visible:ring-4 focus-visible:ring-ring/15 focus-visible:outline-none"
            />
          </div>
        </form>
      </header>
      {children}
      <CompareTray />
      <footer className="border-t border-ink-900/[0.06] bg-surface py-10 text-sm text-muted-foreground">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 md:px-6">
          <p>Shops set their own prices, stock and delivery. Demo shops are fictional businesses for trying Nia.</p>
          <nav className="flex gap-4" aria-label="Footer">
            <Link href="/" className="hover:text-foreground">
              About Nia
            </Link>
            <Link href="/signin?next=/onboarding" className="hover:text-foreground">
              Sell on Walrus Market
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
