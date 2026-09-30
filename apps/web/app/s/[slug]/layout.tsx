import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge } from "@nia/ui";
import { cartLineCountForAccount, getDraft, orderSummary } from "@nia/commerce";
import { CartLink } from "@/components/market/cart-link";
import { StoreBottomNav, StoreTopNav } from "@/components/store/store-nav";
import { MerchantMark } from "@/components/store/merchant-mark";
import { getStorefront } from "@/lib/storefront";
import { db } from "@/lib/server";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const { merchant } = await getStorefront(slug);
  return { title: { default: merchant.name, template: `%s · ${merchant.name}` }, description: merchant.tagline ?? undefined };
}

export default async function StoreLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { merchant, customer, isMember, user } = await getStorefront(slug);
  // The Walrus Market record is not a storefront.
  if (merchant.kind === "market") redirect("/market");
  let cartCount = 0;
  if (customer) {
    const draft = await getDraft(db(), merchant.id, customer.id);
    if (draft) cartCount = (await orderSummary(db(), merchant.id, draft.id)).items.length;
  }
  // The one cart across every shop (this shop's items included).
  const allCartCount = user ? await cartLineCountForAccount(db(), { userId: user.id, telegramUserId: user.telegramUserId }) : 0;

  return (
    <div className="min-h-dvh" style={{ ["--merchant" as string]: merchant.accentColor }}>
      <header className="sticky top-0 z-30 border-b border-ink-900/[0.06] bg-surface/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4 md:h-[68px] md:px-6">
          <Link href={`/s/${slug}`} className="flex min-w-0 items-center gap-2.5 rounded-xl">
            <MerchantMark name={merchant.name} logoUrl={merchant.logoUrl} accent={merchant.accentColor} size={32} />
            <span className="truncate font-bold tracking-tight">{merchant.name}</span>
          </Link>
          <StoreTopNav slug={slug} />
          <div className="flex items-center gap-2">
            <Link href="/market" className="hidden rounded-full px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors duration-150 hover:bg-ink-900/[0.04] hover:text-foreground lg:inline">
              Walrus Market
            </Link>
            {merchant.isDemo ? (
              <Badge tone="neutral" className="hidden sm:inline-flex">
                Demo store
              </Badge>
            ) : null}
            {merchant.status !== "live" && isMember ? <Badge tone="warning">Preview</Badge> : null}
            <CartLink count={allCartCount} />
          </div>
        </div>
      </header>
      {merchant.isDemo ? (
        <p className="border-b border-ink-900/[0.06] bg-paper px-4 py-1.5 text-center text-xs text-muted-foreground sm:hidden">Demo store — fictional business for trying Nia</p>
      ) : null}
      <div className="pb-24 md:pb-10">{children}</div>
      <StoreBottomNav slug={slug} cartCount={cartCount} />
    </div>
  );
}
