"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ExternalLink, Send } from "lucide-react";
import { Button, buttonClasses } from "@nia/ui";
import { TelegramSignIn } from "@/components/auth/telegram-sign-in";
import { disconnectTelegramAction } from "@/app/actions/store";

/**
 * Account-level Telegram connection: once connected, this account is the same
 * customer in the shop's bot — same memory, cart, orders and conversation.
 */
export function TelegramConnect({
  slug,
  botUsername,
  connectedAs,
  openUrl,
  canDisconnect,
}: {
  slug: string;
  /** Null when the bot isn't configured on this deployment. */
  botUsername: string | null;
  /** "@username" / name when this account is connected to Telegram. */
  connectedAs: string | null;
  /** Deep link that opens this shop in the bot (null when the shop has Telegram off). */
  openUrl: string | null;
  /** Email accounts can disconnect; Telegram-only accounts can't (it's how they sign in). */
  canDisconnect: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (!botUsername) return <p className="text-sm text-muted-foreground">The Telegram bot isn’t configured on this deployment yet.</p>;

  if (connectedAs) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-success">
          <Check className="size-4" aria-hidden="true" /> Connected · {connectedAs}
        </span>
        {openUrl ? (
          <a href={openUrl} target="_blank" rel="noopener noreferrer" className={buttonClasses({ size: "sm", variant: "secondary" })}>
            <Send className="size-4" aria-hidden="true" /> Open in Telegram <ExternalLink className="size-3.5" aria-hidden="true" />
          </a>
        ) : null}
        {canDisconnect ? (
          <Button
            size="sm"
            variant="ghost"
            loading={pending}
            onClick={() =>
              start(async () => {
                setError(null);
                const res = await disconnectTelegramAction(slug);
                if (!res.ok) setError(res.error);
                router.refresh();
              })
            }
          >
            Disconnect
          </Button>
        ) : null}
        {error ? (
          <p className="w-full text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return <TelegramSignIn purpose="connect" next={`/s/${slug}/profile`} shop={slug} botUsername={botUsername} onConnected={() => router.refresh()} />;
}
