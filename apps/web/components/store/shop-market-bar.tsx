"use client";

import { usePathname } from "next/navigation";
import { MarketWayfinder, type Crumb } from "@/components/market/market-wayfinder";

/**
 * Tells shoppers this shop is one of the shops in Walrus Market, with a clear way back.
 * Not on the chat page: the chat fills the screen there (the header keeps a way back on desktop).
 */
export function ShopMarketBar({ slug, shopName, department }: { slug: string; shopName: string; department: Crumb | null }) {
  const pathname = usePathname();
  if (pathname === `/s/${slug}/chat`) return null;
  return (
    <div className="mx-auto max-w-5xl px-4 pt-4 md:px-6">
      <MarketWayfinder trail={[...(department ? [department] : []), { label: shopName }]} note={`You're shopping at ${shopName}, one of the shops in Walrus Market.`} />
    </div>
  );
}
