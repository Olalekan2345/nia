"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ExternalLink, Loader2, Send } from "lucide-react";
import { Button, buttonClasses, cn } from "@nia/ui";

type Pending = { id: string; url: string; number: number; expiresAt: string };
type State = { step: "idle"; error?: string } | { step: "starting" } | ({ step: "waiting" } & Pending) | { step: "done"; message: string };

const TELEGRAM_BLUE = "bg-[#229ED9] text-white hover:bg-[#1c8fc4] focus-visible:ring-[#229ED9]"; // Telegram brand colour

/**
 * "Continue with Telegram": shows a number, opens the bot, and finishes when the
 * Telegram user taps that number there. `purpose="connect"` attaches Telegram to
 * the signed-in account instead of signing in.
 */
export function TelegramSignIn({
  purpose = "signin",
  next,
  shop,
  botUsername,
  onConnected,
}: {
  purpose?: "signin" | "connect";
  next?: string;
  shop?: string;
  botUsername: string;
  onConnected?: () => void;
}) {
  const [state, setState] = useState<State>({ step: "idle" });
  const [now, setNow] = useState(() => Date.now());
  const polling = useRef(false);

  const start = async () => {
    setState({ step: "starting" });
    try {
      const res = await fetch("/api/auth/telegram", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ purpose, next, shop }) });
      const body = (await res.json()) as Partial<Pending> & { error?: string };
      if (!res.ok || !body.id) throw new Error(body.error ?? "Couldn't start Telegram sign-in.");
      setNow(Date.now());
      setState({ step: "waiting", id: body.id, url: body.url!, number: body.number!, expiresAt: body.expiresAt! });
    } catch (err) {
      setState({ step: "idle", error: (err as Error).message });
    }
  };

  const check = useCallback(
    async (id: string) => {
      if (polling.current) return;
      polling.current = true;
      try {
        const res = await fetch(`/api/auth/telegram?id=${id}`, { cache: "no-store" });
        const body = (await res.json()) as { status: string; next?: string; message?: string; error?: string };
        if (body.status === "signed_in") {
          setState({ step: "done", message: "Signed in — taking you back…" });
          window.location.assign(body.next ?? "/");
        } else if (body.status === "connected") {
          setState({ step: "done", message: "Telegram connected." });
          onConnected?.();
        } else if (body.status === "denied") {
          setState({ step: "idle", error: "That sign-in was cancelled in Telegram (wrong number or “Not me”). Try again if it was you." });
        } else if (body.status === "expired" || body.status === "invalid") {
          setState({ step: "idle", error: "That request expired. Start again." });
        } else if (body.status === "conflict") {
          setState({ step: "idle", error: body.message ?? "That Telegram account can’t be connected." });
        } else if (!res.ok) {
          setState({ step: "idle", error: body.error ?? "Couldn’t check Telegram. Try again." });
        }
      } catch {
        /* network blip — the next poll retries */
      } finally {
        polling.current = false;
      }
    },
    [onConnected],
  );

  const waitingId = state.step === "waiting" ? state.id : null;
  useEffect(() => {
    if (!waitingId) return;
    const poll = setInterval(() => void check(waitingId), 2000);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    // Coming back from the Telegram app: check straight away.
    const onVisible = () => document.visibilityState === "visible" && void check(waitingId);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [waitingId, check]);

  if (state.step === "waiting") {
    const remaining = Math.max(0, Math.floor((new Date(state.expiresAt).getTime() - now) / 1000));
    if (remaining === 0) {
      return (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground" role="status">
            That request expired.
          </p>
          <Button type="button" className={cn("w-full", TELEGRAM_BLUE)} size="lg" onClick={start}>
            <Send className="size-4" aria-hidden="true" /> Try again
          </Button>
        </div>
      );
    }
    return (
      <div className="space-y-4 text-center">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Your number</p>
          <p className="mt-1 font-mono text-5xl font-extrabold tracking-widest tabular" aria-live="polite">
            {state.number}
          </p>
        </div>
        <a href={state.url} target="_blank" rel="noopener noreferrer" className={buttonClasses({ size: "lg", className: cn("w-full", TELEGRAM_BLUE) })}>
          <Send className="size-4" aria-hidden="true" /> Open Telegram <ExternalLink className="size-3.5" aria-hidden="true" />
        </a>
        <ol className="space-y-1 text-left text-sm text-muted-foreground">
          <li>
            1. In the chat with <span className="font-semibold text-foreground">@{botUsername}</span>, tap <span className="font-semibold text-foreground">Start</span>.
          </li>
          <li>
            2. Tap <span className="font-semibold text-foreground">{state.number}</span>. This page {purpose === "connect" ? "updates" : "signs you in"} by itself.
          </li>
        </ol>
        <p className="flex items-center justify-center gap-2 text-xs text-muted-foreground" role="status">
          <Loader2 className="size-3.5 motion-safe:animate-spin" aria-hidden="true" />
          Waiting for Telegram · {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, "0")}
          <button type="button" className="rounded px-1 font-medium underline-offset-2 hover:text-foreground hover:underline" onClick={() => setState({ step: "idle" })}>
            Cancel
          </button>
        </p>
      </div>
    );
  }

  if (state.step === "done") {
    return (
      <p className="flex items-center justify-center gap-2 py-2 text-sm font-semibold" role="status">
        <Loader2 className="size-4 motion-safe:animate-spin" aria-hidden="true" /> {state.message}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <Button type="button" size="lg" className={cn("w-full", TELEGRAM_BLUE)} loading={state.step === "starting"} onClick={start}>
        <Send className="size-4" aria-hidden="true" />
        {purpose === "connect" ? "Connect Telegram" : "Continue with Telegram"}
      </Button>
      {state.step === "idle" && state.error ? (
        <p className="text-sm text-danger" role="alert">
          {state.error}
        </p>
      ) : null}
    </div>
  );
}
