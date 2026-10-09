"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Badge, buttonClasses, cn } from "@nia/ui";

/**
 * The header's way back to Walrus Market and the demo badge. Large screens always show
 * "Walrus Market"; smaller screens only need it on the chat page, which has no market bar.
 */
export function StoreHeaderExtras({ slug, inMarket, isDemo }: { slug: string; inMarket: boolean; isDemo: boolean }) {
  const onChat = usePathname() === `/s/${slug}/chat`;
  return (
    <>
      {inMarket ? (
        <Link href="/market" aria-label="Back to Walrus Market" className={buttonClasses({ variant: "secondary", size: "sm", className: cn(onChat ? "inline-flex" : "hidden lg:inline-flex", "shrink-0") })}>
          <ArrowLeft className="size-4" aria-hidden="true" />
          <span className="lg:hidden">Market</span>
          <span className="hidden lg:inline">Walrus Market</span>
        </Link>
      ) : null}
      {isDemo ? (
        <Badge tone="neutral" className={cn("hidden", onChat ? "lg:inline-flex" : "sm:inline-flex")}>
          Demo store
        </Badge>
      ) : null}
    </>
  );
}
