import type { Metadata } from "next";
import Link from "next/link";
import { LogOut, ShieldCheck, Sparkles } from "lucide-react";
import { Card, CardBody, Mascot, buttonClasses } from "@nia/ui";
import { customerPassport } from "@nia/memory";
import { WalrusChip } from "@/components/brand";
import { MemoryPassport } from "@/components/store/memory-passport";
import { MemoryToggle } from "@/components/store/memory-toggle";
import { signOutAction } from "@/app/actions/auth";
import { loadMarket } from "@/lib/market";
import { ensureCustomer } from "@/lib/storefront";
import { userFirstName, userLabel } from "@/lib/user";
import { db, memoryStore } from "@/lib/server";

export const metadata: Metadata = { title: "Your market profile" };
export const dynamic = "force-dynamic";

export default async function MarketProfile() {
  const sf = await loadMarket();
  if (!sf?.user) {
    return (
      <main className="mx-auto flex max-w-md flex-col items-center px-4 pt-14 pb-20 text-center">
        <Mascot size={96} state="privacy" decorative />
        <h1 className="mt-4 text-xl font-bold">Your market profile</h1>
        <p className="mt-2 text-sm text-muted-foreground">Sign in to see what Nia remembers from your shopping chats — your budget, sizes and what you’re looking for — and correct or delete it.</p>
        <Link href="/market/signin?next=/market/profile" className={buttonClasses({ size: "lg", className: "mt-6" })}>
          Sign in
        </Link>
      </main>
    );
  }
  const { merchant, user } = sf;
  const customer = (await ensureCustomer(sf))!;
  const entries = await customerPassport(db(), { merchantId: merchant.id, customerId: customer.id });
  const store = memoryStore();
  const name = customer.displayName ?? userFirstName(user);

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 pt-6 pb-24 md:px-6">
      <div className="flex items-center gap-4">
        <span className="grid size-14 place-items-center rounded-2xl bg-surface-2 text-lg font-bold" aria-hidden="true">
          {name.slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-extrabold tracking-tight">{name}</h1>
          <p className="truncate text-sm text-muted-foreground">{userLabel(user)}</p>
        </div>
        <form action={signOutAction}>
          <input type="hidden" name="next" value="/market" />
          <button className="inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-muted-foreground hover:bg-surface-2 hover:text-foreground">
            <LogOut className="size-4" aria-hidden="true" /> Sign out
          </button>
        </form>
      </div>

      <section aria-labelledby="passport">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 id="passport" className="text-lg font-bold tracking-tight">
              Your market profile
            </h2>
            <p className="text-sm text-muted-foreground">What Nia remembers from your chats in Walrus Market.</p>
          </div>
          {store?.backend === "walrus" ? <WalrusChip /> : !store ? <span className="text-xs font-semibold text-warning">Walrus Memory not configured</span> : null}
        </div>
        <div className="mt-4">
          <MemoryPassport slug={merchant.slug} entries={entries} backend={store?.backend ?? null} />
        </div>
        {entries.length === 0 ? (
          <Link href="/market/nia" className={buttonClasses({ className: "mt-4" })}>
            <Sparkles className="size-4" aria-hidden="true" /> Tell Nia what you’re shopping for
          </Link>
        ) : null}
      </section>

      <Card>
        <CardBody className="space-y-4">
          <MemoryToggle slug={merchant.slug} enabled={customer.memoryEnabled} />
          <p className="flex gap-2 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">
            <ShieldCheck className="size-4 shrink-0 text-accent-strong" aria-hidden="true" />
            Stored encrypted with Walrus Memory in a space that belongs only to you in Walrus Market. Shops never see it, and each shop’s own memory of you stays with that shop. Nia never stores passwords, card numbers, codes or keys.
          </p>
        </CardBody>
      </Card>
    </main>
  );
}
