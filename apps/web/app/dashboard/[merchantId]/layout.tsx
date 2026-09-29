import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, LogOut } from "lucide-react";
import { Badge } from "@nia/ui";
import { env } from "@nia/config";
import { NiaLogo } from "@/components/brand";
import { DashboardNav } from "@/components/dashboard/nav";
import { MerchantMark } from "@/components/store/merchant-mark";
import { signOutAction } from "@/app/actions/auth";
import { userLabel } from "@/lib/user";
import { listUserMerchants, requireMerchant } from "@/lib/access";

export const metadata: Metadata = { title: { default: "Dashboard", template: "%s · Nia dashboard" }, robots: { index: false } };

export default async function DashboardLayout({ children, params }: { children: React.ReactNode; params: Promise<{ merchantId: string }> }) {
  const { merchantId } = await params;
  const { merchant, user, role } = await requireMerchant(merchantId);
  const workspaces = await listUserMerchants(user.id);
  const base = `/dashboard/${merchant.id}`;
  const demo = env().NIA_DEMO_MODE;

  return (
    <div className="min-h-dvh bg-paper md:grid md:grid-cols-[264px_1fr]">
      <aside className="hidden border-r border-ink-900/[0.06] bg-surface/70 backdrop-blur-sm md:sticky md:top-0 md:flex md:h-dvh md:flex-col">
        <div className="px-5 pt-6 pb-5">
          <NiaLogo size={28} href="/dashboard" />
        </div>
        <div className="mx-3 mb-5 flex items-center gap-3 rounded-2xl border border-ink-900/[0.06] bg-surface p-3 shadow-soft">
          <MerchantMark name={merchant.name} logoUrl={merchant.logoUrl} accent={merchant.accentColor} size={34} />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold">{merchant.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {role.toLowerCase()} · {merchant.status === "live" ? "live" : merchant.status}
            </p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-3">
          <DashboardNav base={base} demo={demo} variant="sidebar" />
        </div>
        <div className="space-y-1 border-t border-ink-900/[0.06] p-3">
          <Link href={`/s/${merchant.slug}`} target="_blank" className="flex h-10 items-center gap-3 rounded-2xl px-3 text-sm font-semibold text-muted-foreground transition-colors duration-150 hover:bg-ink-900/[0.04] hover:text-foreground">
            <ExternalLink className="size-[18px]" aria-hidden="true" /> View store
          </Link>
          {workspaces.length > 1 ? (
            <Link href="/dashboard" className="flex h-10 items-center gap-3 rounded-2xl px-3 text-sm font-semibold text-muted-foreground transition-colors duration-150 hover:bg-ink-900/[0.04] hover:text-foreground">
              Switch workspace
            </Link>
          ) : null}
          <form action={signOutAction}>
            <button className="flex h-10 w-full items-center gap-3 rounded-2xl px-3 text-sm font-semibold text-muted-foreground transition-colors duration-150 hover:bg-ink-900/[0.04] hover:text-foreground">
              <LogOut className="size-[18px]" aria-hidden="true" /> Sign out
            </button>
          </form>
          <p className="truncate px-3 pt-1 text-xs text-muted-foreground">{userLabel(user)}</p>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 border-b border-ink-900/[0.06] bg-surface/90 px-4 pt-3 backdrop-blur-md md:hidden">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <MerchantMark name={merchant.name} logoUrl={merchant.logoUrl} accent={merchant.accentColor} size={30} />
              <span className="truncate font-bold">{merchant.name}</span>
            </div>
            <Link href={`/s/${merchant.slug}`} className="text-sm font-semibold text-accent-strong">
              View store
            </Link>
          </div>
          <DashboardNav base={base} demo={demo} variant="tabs" />
        </header>
        <main className="mx-auto max-w-6xl px-4 py-7 md:px-10 md:py-10">
          {merchant.status !== "live" ? (
            <div className="mb-8 flex flex-wrap items-center gap-3 rounded-2xl border border-warning/25 bg-warning-soft px-5 py-3.5 text-sm">
              <Badge tone="warning">{merchant.status === "paused" ? "Paused" : "Not live yet"}</Badge>
              <span className="text-foreground/80">Customers can’t see your store until you publish it.</span>
              <Link href={`${base}/settings#publish`} className="ml-auto font-semibold text-warning hover:underline">
                Publish
              </Link>
            </div>
          ) : null}
          {children}
        </main>
      </div>
    </div>
  );
}
