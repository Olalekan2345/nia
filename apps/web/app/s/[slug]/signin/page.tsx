import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Brain, Lock, MessageCircle } from "lucide-react";
import { Mascot } from "@nia/ui";
import { SignInForm } from "@/components/auth/sign-in-form";
import { getStorefront } from "@/lib/storefront";
import { telegramBotUsername } from "@/lib/telegram";
import { emailSignInAvailable } from "@/lib/email";

export const metadata: Metadata = { title: "Sign in" };

export default async function StoreSignIn({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ next?: string }> }) {
  const [{ slug }, { next }] = await Promise.all([params, searchParams]);
  const { merchant, user } = await getStorefront(slug);
  const dest = next && next.startsWith(`/s/${slug}`) ? next : `/s/${slug}`;
  if (user) redirect(dest);

  return (
    <main className="mx-auto max-w-sm px-4 pt-8 pb-16">
      <div className="flex flex-col items-center text-center">
        <span className="relative inline-grid place-items-center">
              <span aria-hidden="true" className="nia-breathe absolute -inset-7 rounded-full" style={{ background: "radial-gradient(closest-side, rgb(107 222 230 / 0.42), rgb(159 184 252 / 0.2) 60%, transparent)" }} />
              <Mascot size={84} state="greeting" decorative className="relative" />
            </span>
        <h1 className="mt-5 text-[clamp(1.75rem,3vw,2.35rem)] leading-tight font-extrabold tracking-[-0.035em] text-balance">Sign in to {merchant.name}</h1>
        <p className="mt-2 text-sm text-muted-foreground">No password. Signing in lets Nia remember you next time — here and in Telegram.</p>
      </div>
      <div className="mt-7 rounded-3xl border border-ink-900/[0.06] bg-surface shadow-soft p-5 shadow-float">
        <SignInForm next={dest} shop={slug} telegramBot={telegramBotUsername()} email={emailSignInAvailable()} />
      </div>
      <ul className="mt-6 space-y-3 text-sm text-muted-foreground">
        <li className="flex gap-3">
          <Brain className="mt-0.5 size-4 shrink-0 text-memory" aria-hidden="true" />
          Nia remembers helpful things like your size and usual delivery area — only at this shop.
        </li>
        <li className="flex gap-3">
          <Lock className="mt-0.5 size-4 shrink-0 text-accent-strong" aria-hidden="true" />
          You can see, correct or forget anything in your Memory Passport.
        </li>
        <li className="flex gap-3">
          <MessageCircle className="mt-0.5 size-4 shrink-0 text-accent-strong" aria-hidden="true" />
          Signed in with Telegram? Carry on the same conversation in the Nia bot, with the same memory and cart.
        </li>
      </ul>
    </main>
  );
}
