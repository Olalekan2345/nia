import Link from "next/link";
import { ShoppingCart } from "lucide-react";
import { cn } from "@nia/ui";

/** The one cart across every shop, with how many items are in it. */
export function CartLink({ count, className }: { count: number; className?: string }) {
  return (
    <Link
      href="/market/cart"
      className={cn("relative grid size-10 place-items-center rounded-full text-muted-foreground transition-colors duration-150 hover:bg-ink-900/[0.05] hover:text-foreground", className)}
      aria-label={count ? `Your cart, ${count} item${count === 1 ? "" : "s"}` : "Your cart"}
    >
      <ShoppingCart className="size-5" aria-hidden="true" />
      {count ? (
        <span className="absolute -top-0.5 -right-0.5 grid min-w-5 place-items-center rounded-full bg-accent px-1 text-[11px] leading-5 font-bold text-accent-foreground tabular" aria-hidden="true">
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </Link>
  );
}
