"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Brain, CalendarDays, Gauge, MessagesSquare, Package, Settings, ShoppingBag, Sparkles, Users } from "lucide-react";
import { cn } from "@nia/ui";

export function dashboardNav(base: string, demo: boolean) {
  return [
    { href: base, label: "Overview", icon: Gauge, exact: true },
    { href: `${base}/conversations`, label: "Conversations", icon: MessagesSquare },
    { href: `${base}/customers`, label: "Customers", icon: Users },
    { href: `${base}/catalog`, label: "Catalog", icon: ShoppingBag },
    { href: `${base}/orders`, label: "Orders", icon: Package },
    { href: `${base}/bookings`, label: "Bookings", icon: CalendarDays },
    { href: `${base}/memory`, label: "Memory", icon: Brain },
    { href: `${base}/settings`, label: "Settings", icon: Settings },
    ...(demo ? [{ href: `${base}/judge`, label: "Judge mode", icon: Sparkles }] : []),
  ];
}

export function DashboardNav({ base, demo, variant }: { base: string; demo: boolean; variant: "sidebar" | "tabs" }) {
  const pathname = usePathname();
  const items = dashboardNav(base, demo);
  const active = (href: string, exact?: boolean) => (exact ? pathname === href : pathname.startsWith(href));
  if (variant === "tabs") {
    return (
      <nav aria-label="Workspace" className="scrollbar-none -mx-4 flex gap-1 overflow-x-auto px-4 pb-2">
        {items.map(({ href, label, exact }) => (
          <Link
            key={href}
            href={href}
            aria-current={active(href, exact) ? "page" : undefined}
            className={cn("shrink-0 rounded-full px-3.5 py-2 text-sm font-semibold transition-colors duration-150", active(href, exact) ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
          >
            {label}
          </Link>
        ))}
      </nav>
    );
  }
  return (
    <nav aria-label="Workspace" className="space-y-1">
      {items.map(({ href, label, icon: Icon, exact }) => {
        const on = active(href, exact);
        return (
          <Link
            key={href}
            href={href}
            aria-current={on ? "page" : undefined}
            className={cn(
              "relative flex h-11 items-center gap-3 rounded-2xl px-3.5 text-sm font-semibold transition-[background-color,color,box-shadow] duration-150",
              on ? "bg-surface text-foreground shadow-soft ring-1 ring-ink-900/[0.05]" : "text-muted-foreground hover:bg-ink-900/[0.04] hover:text-foreground",
            )}
          >
            {/* Active: a small aqua glow at the edge, not a heavy block. */}
            {on ? <span aria-hidden="true" className="absolute top-1/2 left-1.5 h-5 w-[3px] -translate-y-1/2 rounded-full bg-aqua-400 shadow-[0_0_10px_rgb(81_224_246/0.7)]" /> : null}
            <Icon className={cn("size-[18px]", on && "text-memory")} aria-hidden="true" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
