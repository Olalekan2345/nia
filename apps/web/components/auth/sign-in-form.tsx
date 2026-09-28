"use client";

import { useActionState, useEffect, useRef } from "react";
import { ArrowLeft, Mail } from "lucide-react";
import { Button, Field, Input } from "@nia/ui";
import { signInAction, type SignInState } from "@/app/actions/auth";
import { TelegramSignIn } from "./telegram-sign-in";

/** Telegram first (when the bot is configured), email code as the alternative (when email can be delivered). */
export function SignInForm({
  next,
  shop,
  submitLabel = "Continue",
  telegramBot,
  email = true,
}: {
  next?: string;
  shop?: string;
  submitLabel?: string;
  telegramBot?: string | null;
  email?: boolean;
}) {
  const [state, action, pending] = useActionState<SignInState, FormData>(signInAction, { step: "email" });
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state.step === "code") codeRef.current?.focus();
  }, [state.step]);

  if (!email) {
    return telegramBot ? (
      <TelegramSignIn next={next} shop={shop} botUsername={telegramBot} />
    ) : (
      <p className="text-sm text-muted-foreground">Sign-in isn’t set up on this deployment yet (Telegram bot or email).</p>
    );
  }

  return (
    <div className="space-y-5">
      {telegramBot && state.step === "email" ? (
        <>
          <TelegramSignIn next={next} shop={shop} botUsername={telegramBot} />
          <p className="flex items-center gap-3 text-xs font-medium text-muted-foreground">
            <span className="h-px flex-1 bg-border" aria-hidden="true" />
            or use email
            <span className="h-px flex-1 bg-border" aria-hidden="true" />
          </p>
        </>
      ) : null}
      <form action={action} className="space-y-5" noValidate>
        {next ? <input type="hidden" name="next" value={next} /> : null}
        {shop ? <input type="hidden" name="shop" value={shop} /> : null}

        {state.step === "email" ? (
          <>
            <Field label="Email" htmlFor="email" error={state.error} hint="We'll email you a 6-digit code. No password needed.">
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                inputMode="email"
                required
                defaultValue={state.email}
                placeholder="you@example.com"
                aria-invalid={Boolean(state.error) || undefined}
                autoFocus
              />
            </Field>
            <Button type="submit" name="intent" value="send" size="lg" variant={telegramBot ? "secondary" : "primary"} className="w-full" loading={pending}>
              <Mail className="size-4" aria-hidden="true" />
              Email me a code
            </Button>
          </>
        ) : (
          <>
            <input type="hidden" name="email" value={state.email} />
            <div className="rounded-xl bg-surface-2 px-4 py-3 text-sm">
              Code sent to <span className="font-semibold">{state.email}</span>. It expires in 10 minutes.
              {state.devLogged ? (
                <p className="mt-1 text-warning">Development mode: email isn’t configured, so the code was printed in the server console.</p>
              ) : null}
            </div>
            <Field label="6-digit code" htmlFor="code" error={state.error}>
              <Input
                ref={codeRef}
                id="code"
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={6}
                required
                placeholder="••••••"
                className="text-center font-mono text-2xl tracking-[0.5em] tabular"
                aria-invalid={Boolean(state.error) || undefined}
              />
            </Field>
            <Button type="submit" name="intent" value="verify" size="lg" className="w-full" loading={pending}>
              {submitLabel}
            </Button>
            <button
              type="submit"
              name="intent"
              value="send"
              formNoValidate
              className="mx-auto flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-4" aria-hidden="true" /> Send a new code
            </button>
          </>
        )}
      </form>
    </div>
  );
}
