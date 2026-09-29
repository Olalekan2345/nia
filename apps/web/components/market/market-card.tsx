import type { ReactNode } from "react";
import Link from "next/link";
import { Store } from "lucide-react";
import { cn } from "@nia/ui";
import type { InventoryStatus } from "@nia/shared";
import type { MarketProduct } from "@nia/commerce";
import { AvailabilityBadge, productPriceLabel } from "@/components/commerce/cards";
import { ProductVisual } from "@/components/commerce/product-visual";

/** What a market card needs — built from a MarketProduct (pages) or a market tool result (chat). */
export interface MarketCardProduct {
  id: string;
  name: string;
  image: string | null;
  category: string | null;
  price: number | null;
  priceMax: number | null;
  currency: string;
  unit: string | null;
  inventoryStatus: InventoryStatus;
  url: string;
  shop: { name: string; slug: string; label: string; city: string | null; demo: boolean };
}

export function toMarketCard(p: MarketProduct): MarketCardProduct {
  return {
    id: p.id,
    name: p.name,
    image: p.image,
    category: p.category,
    price: p.price,
    priceMax: p.priceMax,
    currency: p.currency,
    unit: p.unit,
    inventoryStatus: p.inventoryStatus,
    url: p.url,
    shop: { name: p.shop.name, slug: p.shop.slug, label: p.shop.businessLabel, city: p.shop.city, demo: p.shop.isDemo },
  };
}

/** Product tile for the market grid (photo first) or a compact row for chat. */
export function MarketProductCard({ product, locale, actions, layout = "tile" }: { product: MarketCardProduct; locale: string; actions?: ReactNode; layout?: "tile" | "row" }) {
  const tile = layout === "tile";
  return (
    <article className={cn("group overflow-hidden rounded-3xl border border-ink-900/[0.06] bg-surface shadow-soft transition-shadow duration-150 hover:shadow-float", tile ? "flex flex-col" : "flex gap-3 p-3")}>
      <Link href={product.url} className={cn("relative block", tile ? "" : "w-24 shrink-0 sm:w-28")} aria-label={`${product.name} at ${product.shop.name}`}>
        <ProductVisual name={product.name} category={product.category} image={product.image} rounded={tile ? "rounded-none" : "rounded-xl"} className={tile ? "transition-transform duration-300 group-hover:scale-[1.02]" : ""} />
      </Link>
      <div className={cn("flex min-w-0 flex-1 flex-col", tile ? "p-3.5" : "")}>
        <p className="flex items-center gap-1 truncate text-xs font-medium text-muted-foreground">
          <Store className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">
            {product.shop.name}
            {product.shop.city ? ` · ${product.shop.city}` : ""}
          </span>
        </p>
        <h3 className="mt-1 font-semibold leading-snug">
          <Link href={product.url} className="hover:underline">
            {product.name}
          </Link>
        </h3>
        <p className="mt-1 text-sm font-bold tabular">{productPriceLabel(product, locale)}</p>
        <div className="mt-2">
          <AvailabilityBadge status={product.inventoryStatus} />
        </div>
        {actions ? <div className={cn("flex flex-wrap gap-2", tile ? "mt-auto pt-3" : "mt-3")}>{actions}</div> : null}
      </div>
    </article>
  );
}
