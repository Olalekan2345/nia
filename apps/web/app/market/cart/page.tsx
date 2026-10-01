import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, ShoppingCart, Sparkles } from "lucide-react";
import { Mascot, buttonClasses } from "@nia/ui";
import { cartsForAccount, placedOrdersForAccount } from "@nia/commerce";
import { DEMO_PAYMENT_NOTE, formatMoney, orderProgress } from "@nia/shared";
import { ConfirmAllButton } from "@/components/market/confirm-all";
import { CartEditor } from "@/components/store/cart-editor";
import { MerchantMark } from "@/components/store/merchant-mark";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/server";

export const metadata: Metadata = { title: "Your cart" };
export const dynamic = "force-dynamic";

/**
 * Everything the shopper has picked, from every shop, in one place. Each shop
 * keeps its own cart, delivery and payment (they are separate businesses), so
 * each is confirmed as its own order — one by one or all at once.
 */
export default async function MarketCartPage({ searchParams }: { searchParams: Promise<{ placed?: string }> }) {
  const user = await getSessionUser();
  if (!user) {
    return (
      <main className="mx-auto flex max-w-md flex-col items-center px-4 pt-14 pb-24 text-center">
        <Mascot size={96} state="idle" decorative />
        <h1 className="mt-5 text-2xl leading-tight font-extrabold tracking-[-0.03em] text-balance">Sign in to see your cart</h1>
        <p className="mt-2 text-sm text-muted-foreground">Everything you pick in any shop in Walrus Market shows up here.</p>
        <Link href="/market/signin?next=/market/cart" className={buttonClasses({ size: "lg", className: "mt-6" })}>
          Sign in
        </Link>
      </main>
    );
  }

  const placedIds = ((await searchParams).placed ?? "").split(",").filter(Boolean);
  const [carts, placed] = await Promise.all([cartsForAccount(db(), { userId: user.id, telegramUserId: user.telegramUserId }), placedOrdersForAccount(db(), { userId: user.id, telegramUserId: user.telegramUserId }, placedIds)]);
  const locale = carts[0]?.shop.locale ?? placed[0]?.shop.locale ?? "en-NG";
  const currency = carts[0]?.cart.currency ?? "NGN";
  const lines = carts.reduce((n, c) => n + c.cart.items.length, 0);
  const priced = carts.filter((c) => !c.cart.hasUnpricedItems);
  const grand = priced.reduce((s, c) => s + c.cart.total, 0);
  const ready = carts.filter((c) => c.cart.blockers.length === 0).map((c) => ({ slug: c.shop.slug, orderId: c.cart.id, shop: c.shop.name, demo: c.cart.checkout === "demo" }));
  const allDemo = carts.length > 0 && carts.every((c) => c.cart.checkout === "demo");
  const needsChoice = carts.filter((c) => c.cart.blockers.length > 0);

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 pt-6 pb-24 md:px-6">
      <h1 className="flex items-center gap-2.5 text-[clamp(1.75rem,3vw,2.35rem)] leading-tight font-extrabold tracking-[-0.035em]">
        <ShoppingCart className="size-7 text-accent-strong" aria-hidden="true" /> Your cart
      </h1>

      {placed.length ? (
        <section aria-labelledby="placed" className="space-y-3">
          <h2 id="placed" className="sr-only">
            Orders placed
          </h2>
          {placed.map((o) =>
            o.paymentMode === "demo" && o.paymentStatus === "paid" ? (
              <div key={o.id} className="rounded-2xl border border-success/25 bg-success-soft p-4" role="status">
                <p className="font-bold text-success">
                  Order #{o.number} paid · {o.shop.name}
                </p>
                <p className="mt-1 text-sm">
                  {formatMoney(o.total, o.currency, { locale: o.shop.locale })} · {orderProgress(o).headline}
                  {orderProgress(o).detail ? ` — ${orderProgress(o).detail}` : ""}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{DEMO_PAYMENT_NOTE}</p>
              </div>
            ) : (
            <div key={o.id} className="rounded-2xl border border-success/25 bg-success-soft p-4" role="status">
              <p className="font-bold text-success">
                Order #{o.number} placed · {o.shop.name}
              </p>
              <p className="mt-1 text-sm">
                {o.hasUnpricedItems ? "Total to be confirmed" : formatMoney(o.total, o.currency, { locale: o.shop.locale })} ·{" "}
                {o.paymentUrl ? `Use order #${o.number} as the payment reference.` : (o.shop.paymentInstructions ?? "The shop will confirm availability and how to pay.")}
              </p>
              {o.paymentUrl ? (
                <a href={o.paymentUrl} target="_blank" rel="noopener noreferrer" className={buttonClasses({ size: "sm", className: "mt-3" })}>
                  Pay {o.shop.name} securely <ExternalLink className="size-3.5" aria-hidden="true" />
                </a>
              ) : null}
            </div>
            ),
          )}
        </section>
      ) : null}

      {carts.length ? (
        <>
          <section aria-labelledby="summary" className="rounded-3xl border border-ink-900/[0.06] bg-surface p-4 shadow-soft">
            <h2 id="summary" className="sr-only">
              Summary
            </h2>
            <div className="flex items-baseline justify-between gap-3">
              <p className="text-sm text-muted-foreground tabular">
                {lines} item{lines === 1 ? "" : "s"} from {carts.length} shop{carts.length === 1 ? "" : "s"}
              </p>
              <p className="text-2xl font-extrabold tabular">
                {formatMoney(grand, currency, { locale })}
                {priced.length < carts.length ? <span className="text-sm font-semibold text-muted-foreground"> + quotes</span> : null}
              </p>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {allDemo
                ? `Each shop sends its own order. ${DEMO_PAYMENT_NOTE} Delivery fees are included once you choose delivery.`
                : "Each shop confirms, delivers and takes payment for its own order. Delivery fees are included once you choose delivery."}
            </p>
            {needsChoice.length ? (
              <p className="mt-2 text-sm">
                <span className="font-semibold">Still needed:</span> {needsChoice.map((c) => `${c.shop.name} — ${c.cart.blockers.join(", ").toLowerCase()}`).join(" · ")}
              </p>
            ) : null}
            <div className="mt-3">
              <ConfirmAllButton ready={ready} placed={placedIds} />
            </div>
          </section>

          <ul className="space-y-4">
            {carts.map((c) => (
              <li key={c.cart.id}>
                <CartEditor
                  slug={c.shop.slug}
                  cart={c.cart}
                  locale={c.shop.locale}
                  areas={c.shop.deliveryAreas}
                  delivery={c.shop.delivery}
                  pickup={c.shop.pickup}
                  pickupAddress={c.shop.pickupAddress}
                  title={c.shop.name}
                  shop={c.shop.name}
                  header={<MerchantMark name={c.shop.name} logoUrl={c.shop.logoUrl} accent={c.shop.accentColor} size={28} />}
                  placedHref={`/market/cart?placed=${[...placedIds, "{id}"].join(",")}`}
                />
              </li>
            ))}
          </ul>
        </>
      ) : placed.length === 0 ? (
        <div className="flex flex-col items-center rounded-3xl border border-dashed border-ink-900/10 px-6 py-12 text-center">
          <Mascot size={88} state="idle" decorative />
          <p className="mt-4 font-semibold">Your cart is empty</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">Add things from any shop — drinks, a cake, a phone — and they all show up here, ready to confirm.</p>
          <div className="mt-5 flex gap-2">
            <Link href="/market" className={buttonClasses({ variant: "secondary" })}>
              Browse the market
            </Link>
            <Link href="/market/nia" className={buttonClasses()}>
              <Sparkles className="size-4" aria-hidden="true" /> Ask Nia
            </Link>
          </div>
        </div>
      ) : (
        <Link href="/market" className={buttonClasses({ variant: "secondary" })}>
          Keep shopping
        </Link>
      )}
    </main>
  );
}
