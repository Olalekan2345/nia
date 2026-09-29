import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Mascot } from "@nia/ui";
import { NiaLogo } from "@/components/brand";
import { SignInForm } from "@/components/auth/sign-in-form";
import { getSessionUser } from "@/lib/auth";
import { telegramBotUsername } from "@/lib/telegram";
import { emailSignInAvailable } from "@/lib/email";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  // Signing in lands in Walrus Market unless a page asked to come back (onboarding, a dashboard link…).
  const safe = next && next.startsWith("/") && !next.startsWith("//") ? next : "/market";
  if (await getSessionUser()) redirect(safe);

  return (
    <div className="nia-wash flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <NiaLogo />
        <Link href="/market" className="text-sm font-medium text-muted-foreground hover:text-foreground">
          Browse Walrus Market
        </Link>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pt-6 pb-16 sm:pt-16">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center text-center">
            <span className="relative inline-grid place-items-center">
              <span aria-hidden="true" className="nia-breathe absolute -inset-7 rounded-full" style={{ background: "radial-gradient(closest-side, rgb(107 222 230 / 0.42), rgb(159 184 252 / 0.2) 60%, transparent)" }} />
              <Mascot size={88} state="greeting" decorative className="relative" />
            </span>
            <h1 className="mt-5 text-[clamp(1.75rem,3vw,2.35rem)] leading-tight font-extrabold tracking-[-0.035em] text-balance">Sign in to Nia</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {safe.startsWith("/onboarding")
                ? "Create your business workspace in a few minutes."
                : safe.startsWith("/dashboard")
                  ? "Manage your business, catalog and customer memory."
                  : "Shop every store in Walrus Market with Nia — she remembers what you like."}
            </p>
          </div>
          <div className="mt-8 rounded-3xl border border-ink-900/[0.06] bg-surface p-6 shadow-soft sm:p-8">
            <SignInForm next={safe} telegramBot={telegramBotUsername()} email={emailSignInAvailable()} />
          </div>
          <p className="mt-6 text-center text-xs leading-relaxed text-muted-foreground">
            New here? Signing in creates your account. Shopping at a store? Sign in from that store’s page so Nia can remember you there.
          </p>
        </div>
      </main>
    </div>
  );
}
