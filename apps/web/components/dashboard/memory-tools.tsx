"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, RefreshCw, RotateCcw, Send } from "lucide-react";
import { Button, Field, Textarea } from "@nia/ui";
import { addOperationsNoteAction, archiveMerchantMemoryAction, refreshMemoryStatusAction, retryFailedMemoryAction } from "@/app/actions/dashboard";

export function CopyText({ value, label = "Copy" }: { value: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setDone(true);
        setTimeout(() => setDone(false), 1500);
      }}
      className="inline-grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-surface-2 hover:text-foreground"
      aria-label={label}
      title={label}
    >
      {done ? <Check className="size-4 text-success" aria-hidden="true" /> : <Copy className="size-4" aria-hidden="true" />}
    </button>
  );
}

export function MemoryActions({ merchantId, pending, failed }: { merchantId: string; pending: number; failed: number }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        variant="secondary"
        size="sm"
        loading={busy}
        disabled={pending === 0}
        onClick={() =>
          start(async () => {
            const r = await refreshMemoryStatusAction(merchantId);
            setMsg(r.ok ? `Checked ${r.refreshed} pending job${r.refreshed === 1 ? "" : "s"} — ${r.stored} now stored` : r.error);
            router.refresh();
          })
        }
      >
        <RefreshCw className="size-4" aria-hidden="true" /> Check pending ({pending})
      </Button>
      <Button
        variant="secondary"
        size="sm"
        loading={busy}
        disabled={failed === 0}
        onClick={() =>
          start(async () => {
            const r = await retryFailedMemoryAction(merchantId);
            setMsg(r.ok ? `Resubmitted ${r.retried} write${r.retried === 1 ? "" : "s"}` : r.error);
            router.refresh();
          })
        }
      >
        <RotateCcw className="size-4" aria-hidden="true" /> Retry failed ({failed})
      </Button>
      {msg ? (
        <p className="text-sm text-muted-foreground" role="status">
          {msg}
        </p>
      ) : null}
    </div>
  );
}

export function OpsNoteForm({ merchantId }: { merchantId: string }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await addOperationsNoteAction(merchantId, text);
          if (r.ok) {
            setText("");
            setMsg({ ok: true, text: r.receipt.status === "stored" ? "Saved to Walrus." : "Submitted to Walrus — confirming…" });
          } else setMsg({ ok: false, text: r.error });
          router.refresh();
        });
      }}
    >
      <Field label="Tell Nia something about the shop" htmlFor="ops-note" hint="e.g. “We’re out of the navy chair until Friday” or “Saturday bookings need a deposit”. Nia recalls these when relevant.">
        <Textarea id="ops-note" value={text} onChange={(e) => setText(e.target.value)} maxLength={500} rows={3} />
      </Field>
      <div className="flex items-center gap-3">
        <Button type="submit" loading={busy} disabled={text.trim().length < 4}>
          <Send className="size-4" aria-hidden="true" /> Remember this
        </Button>
        {msg ? (
          <p className={msg.ok ? "text-sm text-success" : "text-sm text-danger"} role="status">
            {msg.text}
          </p>
        ) : null}
      </div>
    </form>
  );
}

export function ArchiveNoteButton({ merchantId, recordId }: { merchantId: string; recordId: string }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="ghost"
      loading={busy}
      onClick={() =>
        start(async () => {
          await archiveMerchantMemoryAction(merchantId, recordId);
          router.refresh();
        })
      }
    >
      Archive
    </Button>
  );
}
