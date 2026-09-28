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
        <Mascot size={84} state="greeting" decorative />
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight">Sign in to Walrus Market</h1>
        <p className="mt-2 text-sm text-muted-foreground">No password. Nia remembers what you tell her, so the next visit starts where you left off.</p>
      </div>
      <div className="mt-7 rounded-2xl border border-border bg-surface p-5 shadow-float">
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
