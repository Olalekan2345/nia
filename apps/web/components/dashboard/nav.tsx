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
            className={cn("shrink-0 rounded-lg px-3 py-2 text-sm font-semibold", active(href, exact) ? "bg-surface text-foreground shadow-sm" : "text-muted-foreground")}
          >
            {label}
          </Link>
        ))}
      </nav>
    );
  }
  return (
    <nav aria-label="Workspace" className="space-y-0.5">
      {items.map(({ href, label, icon: Icon, exact }) => {
        const on = active(href, exact);
        return (
          <Link
            key={href}
            href={href}
            aria-current={on ? "page" : undefined}
            className={cn(
              "flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors duration-100",
              on ? "bg-surface text-foreground shadow-sm" : "text-muted-foreground hover:bg-surface/60 hover:text-foreground",
            )}
          >
            <Icon className={cn("size-[18px]", on && "text-accent-strong")} aria-hidden="true" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
