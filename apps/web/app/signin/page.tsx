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
  const safe = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  if (await getSessionUser()) redirect(safe);

  return (
    <div className="nia-wash flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-5 sm:px-6">
        <NiaLogo />
        <Link href="/try" className="text-sm font-medium text-muted-foreground hover:text-foreground">
          Try a demo shop
        </Link>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pt-6 pb-16 sm:pt-16">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center text-center">
            <Mascot size={88} state="greeting" decorative />
            <h1 className="mt-4 text-2xl font-extrabold tracking-tight">Sign in to Nia</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {safe.startsWith("/onboarding") ? "Create your business workspace in a few minutes." : "Manage your business, catalog and customer memory."}
            </p>
          </div>
          <div className="mt-8 rounded-2xl border border-border bg-surface p-6 shadow-float">
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
