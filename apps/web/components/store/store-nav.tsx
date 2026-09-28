"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, MessageCircle, Package, ShoppingBag, UserRound } from "lucide-react";
import { cn } from "@nia/ui";

const ITEMS = [
  { href: "", label: "Home", icon: Home },
  { href: "/shop", label: "Shop", icon: ShoppingBag },
  { href: "/chat", label: "Chat", icon: MessageCircle },
  { href: "/orders", label: "Orders", icon: Package },
  { href: "/profile", label: "Profile", icon: UserRound },
] as const;

function useActive(base: string) {
  const pathname = usePathname();
  return (href: string) => (href === "" ? pathname === base : pathname.startsWith(`${base}${href}`));
}

/** Mobile bottom navigation (hidden on md+). */
export function StoreBottomNav({ slug, cartCount }: { slug: string; cartCount: number }) {
  const base = `/s/${slug}`;
  const isActive = useActive(base);
  const pathname = usePathname();
  if (pathname.startsWith(`${base}/chat`)) return null; // chat owns the full viewport on mobile
  return (
    <nav aria-label="Store" className="safe-bottom fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur-md md:hidden">
      <ul className="mx-auto grid max-w-md grid-cols-5 px-2 pt-1.5">
        {ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(href);
          return (
            <li key={label}>
              <Link
                href={`${base}${href}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-semibold transition-colors duration-100",
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className={cn("size-[22px]", active && "text-accent-strong")} strokeWidth={active ? 2.25 : 1.9} aria-hidden="true" />
                {label}
                {label === "Orders" && cartCount > 0 ? (
                  <span className="absolute top-1 right-[calc(50%-18px)] grid min-w-4 place-items-center rounded-full bg-accent px-1 text-[10px] font-bold text-accent-foreground tabular">
                    {cartCount}
                    <span className="sr-only"> items in cart</span>
                  </span>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Desktop top navigation. */
export function StoreTopNav({ slug }: { slug: string }) {
  const base = `/s/${slug}`;
  const isActive = useActive(base);
  return (
    <nav aria-label="Store" className="hidden items-center gap-1 md:flex">
      {ITEMS.map(({ href, label }) => {
        const active = isActive(href);
        return (
          <Link
            key={label}
            href={`${base}${href}`}
            aria-current={active ? "page" : undefined}
            className={cn("rounded-lg px-3 py-2 text-sm font-semibold transition-colors duration-100", active ? "bg-surface-2 text-foreground" : "text-muted-foreground hover:text-foreground")}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
