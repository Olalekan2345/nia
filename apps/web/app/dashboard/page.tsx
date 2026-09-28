import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Plus } from "lucide-react";
import { buttonClasses } from "@nia/ui";
import { NiaLogo } from "@/components/brand";
import { MerchantMark } from "@/components/store/merchant-mark";
import { listUserMerchants, requireUser } from "@/lib/access";
import { signOutAction } from "@/app/actions/auth";
import { userLabel } from "@/lib/user";

export const metadata: Metadata = { title: "Workspaces" };

export default async function DashboardIndex() {
  const user = await requireUser("/dashboard");
  const workspaces = await listUserMerchants(user.id);
  if (workspaces.length === 0) redirect("/onboarding");
  if (workspaces.length === 1) redirect(`/dashboard/${workspaces[0]!.merchant.id}`);

  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 py-5">
        <NiaLogo />
        <form action={signOutAction}>
          <button className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">Sign out</button>
        </form>
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-16">
        <h1 className="text-2xl font-extrabold tracking-tight">Your workspaces</h1>
        <p className="mt-1 text-sm text-muted-foreground">Signed in as {userLabel(user)}</p>
        <ul className="mt-6 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
          {workspaces.map(({ merchant, role }) => (
            <li key={merchant.id}>
              <Link href={`/dashboard/${merchant.id}`} className="flex items-center gap-4 px-5 py-4 transition-colors duration-100 hover:bg-surface-2">
                <MerchantMark name={merchant.name} logoUrl={merchant.logoUrl} accent={merchant.accentColor} size={40} />
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{merchant.name}</span>
                  <span className="block text-sm text-muted-foreground">
                    {role.toLowerCase()} · {merchant.isDemo ? "demo store" : merchant.status}
                  </span>
                </span>
                <ArrowRight className="size-4 text-muted-foreground" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
        <Link href="/onboarding" className={buttonClasses({ variant: "secondary", className: "mt-4" })}>
          <Plus className="size-4" aria-hidden="true" /> New business
        </Link>
      </main>
    </div>
  );
}
