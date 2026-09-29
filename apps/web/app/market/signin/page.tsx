import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Brain, Lock, Store } from "lucide-react";
import { Mascot } from "@nia/ui";
import { SignInForm } from "@/components/auth/sign-in-form";
import { getSessionUser } from "@/lib/auth";
import { emailSignInAvailable } from "@/lib/email";
import { MARKET_SLUG } from "@/lib/market";
import { telegramBotUsername } from "@/lib/telegram";
import { safeNext } from "@/lib/user";

export const metadata: Metadata = { title: "Sign in" };

export default async function MarketSignIn({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const dest = safeNext(next, "/market");
  if (await getSessionUser()) redirect(dest);

  return (
    <main className="mx-auto max-w-sm px-4 pt-8 pb-16">
      <div className="flex flex-col items-center text-center">
        <span className="relative inline-grid place-items-center">
              <span aria-hidden="true" className="nia-breathe absolute -inset-7 rounded-full" style={{ background: "radial-gradient(closest-side, rgb(107 222 230 / 0.42), rgb(159 184 252 / 0.2) 60%, transparent)" }} />
              <Mascot size={84} state="greeting" decorative className="relative" />
            </span>
        <h1 className="mt-5 text-[clamp(1.75rem,3vw,2.35rem)] leading-tight font-extrabold tracking-[-0.035em] text-balance">Sign in to Walrus Market</h1>
        <p className="mt-2 text-sm text-muted-foreground">No password. Nia remembers what you tell her, so the next visit starts where you left off.</p>
      </div>
      <div className="mt-7 rounded-3xl border border-ink-900/[0.06] bg-surface shadow-soft p-5 shadow-float">
        <SignInForm next={dest} shop={MARKET_SLUG} telegramBot={telegramBotUsername()} email={emailSignInAvailable()} />
      </div>
      <ul className="mt-6 space-y-3 text-sm text-muted-foreground">
        <li className="flex gap-3">
          <Brain className="mt-0.5 size-4 shrink-0 text-memory" aria-hidden="true" />
          Your market profile (budget, sizes, what you’re shopping for) is stored with Walrus Memory. You can see, correct or delete any of it.
        </li>
        <li className="flex gap-3">
          <Lock className="mt-0.5 size-4 shrink-0 text-accent-strong" aria-hidden="true" />
          Shops never see your market profile.
        </li>
        <li className="flex gap-3">
          <Store className="mt-0.5 size-4 shrink-0 text-accent-strong" aria-hidden="true" />
          The same account works in every shop and in the Nia bot on Telegram.
        </li>
      </ul>
    </main>
  );
}
