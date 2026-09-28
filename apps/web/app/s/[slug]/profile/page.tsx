import type { Metadata } from "next";
import Link from "next/link";
import { LogOut, ShieldCheck } from "lucide-react";
import { Card, CardBody, Mascot, buttonClasses } from "@nia/ui";
import { customerPassport } from "@nia/memory";
import { WalrusChip } from "@/components/brand";
import { MemoryPassport } from "@/components/store/memory-passport";
import { MemoryToggle } from "@/components/store/memory-toggle";
import { TelegramConnect } from "@/components/store/telegram-connect";
import { signOutAction } from "@/app/actions/auth";
import { ensureCustomer, getStorefront } from "@/lib/storefront";
import { db, memoryStore } from "@/lib/server";
import { botLink, telegramBotUsername } from "@/lib/telegram";
import { userFirstName, userLabel } from "@/lib/user";

export const metadata: Metadata = { title: "Profile & memory" };

export default async function ProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const sf = await getStorefront(slug);
  const { merchant, user } = sf;

  if (!user) {
    return (
      <main className="mx-auto flex max-w-md flex-col items-center px-4 pt-14 text-center">
        <Mascot size={96} state="privacy" decorative />
        <h1 className="mt-4 text-xl font-bold">Your profile and Memory Passport</h1>
        <p className="mt-2 text-sm text-muted-foreground">Sign in to see what Nia remembers about you at {merchant.name}, correct it, or connect Telegram.</p>
        <Link href={`/s/${slug}/signin?next=/s/${slug}/profile`} className={buttonClasses({ size: "lg", className: "mt-6" })}>
          Sign in
        </Link>
      </main>
    );
  }

  const customer = (await ensureCustomer(sf))!;
  const entries = await customerPassport(db(), { merchantId: merchant.id, customerId: customer.id });
  const store = memoryStore();
  const name = customer.displayName ?? userFirstName(user);

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 pt-6 md:px-6">
      <div className="flex items-center gap-4">
        <span className="grid size-14 place-items-center rounded-2xl bg-surface-2 text-lg font-bold" aria-hidden="true">
          {name.slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-extrabold tracking-tight">{name}</h1>
          <p className="truncate text-sm text-muted-foreground">{userLabel(user)}</p>
        </div>
        <form action={signOutAction}>
          <input type="hidden" name="next" value={`/s/${slug}`} />
          <button className="inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-muted-foreground hover:bg-surface-2 hover:text-foreground">
            <LogOut className="size-4" aria-hidden="true" /> Sign out
          </button>
        </form>
      </div>

      <section aria-labelledby="passport">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 id="passport" className="text-lg font-bold tracking-tight">
              Memory Passport
            </h2>
            <p className="text-sm text-muted-foreground">What Nia remembers about you at {merchant.name}.</p>
          </div>
          {store?.backend === "walrus" ? <WalrusChip /> : !store ? <span className="text-xs font-semibold text-warning">Walrus Memory not configured</span> : null}
        </div>
        <div className="mt-4">
          <MemoryPassport slug={slug} entries={entries} backend={store?.backend ?? null} />
        </div>
      </section>

      <Card>
        <CardBody className="space-y-4">
          <MemoryToggle slug={slug} enabled={customer.memoryEnabled} />
          <p className="flex gap-2 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">
            <ShieldCheck className="size-4 shrink-0 text-accent-strong" aria-hidden="true" />
            Memories are encrypted and stored with Walrus Memory in a space that belongs only to you at this shop. Nia never stores passwords, card numbers, codes or keys. Other shops can’t see this.
          </p>
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <h2 className="font-bold">Telegram</h2>
          <p className="mt-1 mb-4 text-sm text-muted-foreground">
            {user.telegramUserId
              ? `This account and your Telegram chat are one profile — the same memory, cart and conversation at ${merchant.name} and every other shop.`
              : `Connect Telegram to carry on in ${merchant.name}’s Telegram chat with the same memory, cart and conversation — and sign in with one tap next time.`}
          </p>
          <TelegramConnect
            slug={slug}
            botUsername={telegramBotUsername()}
            connectedAs={user.telegramUserId ? (user.telegramUsername ? `@${user.telegramUsername}` : (user.name ?? "Telegram")) : null}
            openUrl={merchant.telegramEnabled ? botLink(`s_${slug}`) : null}
            canDisconnect={Boolean(user.email)}
          />
        </CardBody>
      </Card>
    </main>
  );
}
