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
    <div className="min-h-dvh bg-surface-2/60 md:grid md:grid-cols-[248px_1fr]">
      <aside className="hidden border-r border-border bg-surface-2/40 md:flex md:h-dvh md:flex-col md:sticky md:top-0">
        <div className="px-4 pt-5 pb-4">
          <NiaLogo size={28} href="/dashboard" />
        </div>
        <div className="mx-3 mb-4 flex items-center gap-2.5 rounded-xl border border-border bg-surface p-2.5">
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
        <div className="space-y-1 border-t border-border p-3">
          <Link href={`/s/${merchant.slug}`} target="_blank" className="flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-muted-foreground hover:text-foreground">
            <ExternalLink className="size-[18px]" aria-hidden="true" /> View store
          </Link>
          {workspaces.length > 1 ? (
            <Link href="/dashboard" className="flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-semibold text-muted-foreground hover:text-foreground">
              Switch workspace
            </Link>
          ) : null}
          <form action={signOutAction}>
            <button className="flex h-10 w-full items-center gap-3 rounded-xl px-3 text-sm font-semibold text-muted-foreground hover:text-foreground">
              <LogOut className="size-[18px]" aria-hidden="true" /> Sign out
            </button>
          </form>
          <p className="truncate px-3 pt-1 text-xs text-muted-foreground">{userLabel(user)}</p>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 border-b border-border bg-background/90 px-4 pt-3 backdrop-blur-md md:hidden">
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
        <main className="mx-auto max-w-6xl px-4 py-6 md:px-8 md:py-8">
          {merchant.status !== "live" ? (
            <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-warning/30 bg-warning-soft px-4 py-3 text-sm">
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
