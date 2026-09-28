"use client";

import { useState } from "react";
import { Brain, Check, ChevronDown, CircleAlert, Clock, History, Loader2, ShieldOff } from "lucide-react";
import { Button, cn } from "@nia/ui";
import type { MemoryReceiptView, NiaDataParts, RecalledMemoryView } from "@nia/ai";
import { WalrusChip } from "@/components/brand";
import { useReceiptPoll } from "./use-receipt-poll";

const TYPE_LABEL: Record<string, string> = {
  CUSTOMER_PREFERENCE: "Preference",
  PAST_ORDER: "Past order",
  PAST_SERVICE: "Past service",
  PRODUCT_INTEREST: "Product interest",
  SIZE_OR_VARIANT: "Size preference",
  DELIVERY_PREFERENCE: "Delivery preference",
  LOCATION_PREFERENCE: "Location",
  BUDGET: "Budget",
  OCCASION: "Occasion",
  RELATIONSHIP_CONTEXT: "Who they shop for",
  COMPLAINT: "Past issue",
  CORRECTION: "Correction",
  MERCHANT_COMMITMENT: "Shop promise",
  CUSTOMER_COMMITMENT: "Customer commitment",
  UNRESOLVED_REQUEST: "Open request",
  OUTCOME: "Outcome",
  NOTE: "Note",
  RETURN_OR_REFUND_CONTEXT: "Return / refund",
  RECOMMENDATION_RESPONSE: "Recommendation feedback",
};

function short(id: string | null | undefined, n = 10) {
  if (!id) return "—";
  return id.length > n * 2 ? `${id.slice(0, n)}…${id.slice(-6)}` : id;
}

function stripMeta(text: string) {
  // Memory text ends with "(type; source; recorded YYYY-MM-DD)" — show it separately.
  return text.replace(/\s*\([^()]*recorded \d{4}-\d{2}-\d{2}\)\s*$/, "");
}

/** "2 memories used" chip with a disclosure explaining what informed the answer. */
export function RecallChip({ data }: { data: NiaDataParts["recall"] }) {
  const [open, setOpen] = useState(false);
  if (data.mode === "off") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2 px-2.5 py-1 text-xs font-semibold text-muted-foreground">
        <ShieldOff className="size-3.5" aria-hidden="true" /> Memory off for this chat
      </span>
    );
  }
  const customer = data.customer;
  const merchant = data.merchant;
  const total = customer.length + merchant.length;
  if (total === 0) {
    return data.error ? (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-soft px-2.5 py-1 text-xs font-semibold text-warning">
        <CircleAlert className="size-3.5" aria-hidden="true" /> Memory unavailable right now
      </span>
    ) : null;
  }
  const label = customer.length === 1 && merchant.length === 0 ? "Remembered from a previous visit" : `${total} ${total === 1 ? "memory" : "memories"} used`;
  const source = data.backend === "walrus" ? "Recalled from Walrus" : "Recalled";
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-memory-soft px-2.5 py-1 text-xs font-semibold text-memory transition-colors duration-100 hover:bg-memory-soft/70"
      >
        <Brain className="size-3.5" aria-hidden="true" />
        {label}
        <ChevronDown className={cn("size-3.5 transition-transform duration-150", open && "rotate-180")} aria-hidden="true" />
      </button>
      {open ? (
        <div className="nia-enter mt-2 rounded-2xl border border-border bg-surface p-3 text-sm">
          <div className="flex items-center justify-between gap-2">
            <p className="font-semibold">Why Nia said this</p>
            {data.backend === "walrus" ? <WalrusChip label={source} /> : <span className="text-xs text-muted-foreground">{source}</span>}
          </div>
          <ul className="mt-2 space-y-2">
            {[...customer, ...merchant].map((m) => (
              <RecalledItem key={m.blobId} m={m} network={data.network} />
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function RecalledItem({ m, network }: { m: RecalledMemoryView; network: string | null }) {
  const [details, setDetails] = useState(false);
  return (
    <li className="rounded-xl bg-surface-2 p-3">
      <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <span>{m.scope === "customer" ? (m.type ? TYPE_LABEL[m.type] ?? m.type : "Your memory") : "From the shop"}</span>
        {m.historical ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-surface px-1.5 py-0.5 text-[11px]">
            <History className="size-3" aria-hidden="true" /> Earlier value
          </span>
        ) : null}
      </div>
      <p className="mt-1 leading-relaxed">{stripMeta(m.text)}</p>
      <button type="button" onClick={() => setDetails((d) => !d)} className="mt-1 text-xs font-semibold text-accent-strong hover:underline" aria-expanded={details}>
        {details ? "Hide details" : "Details"}
      </button>
      {details ? (
        <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          <dt className="text-muted-foreground">Network</dt>
          <dd>{network ?? "—"}</dd>
          <dt className="text-muted-foreground">Blob ID</dt>
          <dd className="truncate font-mono" title={m.blobId}>
            {short(m.blobId)}
          </dd>
          <dt className="text-muted-foreground">Similarity</dt>
          <dd className="tabular">{Math.max(0, Math.round((1 - m.distance) * 100))}%</dd>
          {m.storedAt ? (
            <>
              <dt className="text-muted-foreground">Stored</dt>
              <dd>{new Date(m.storedAt).toLocaleString()}</dd>
            </>
          ) : null}
        </dl>
      ) : null}
    </li>
  );
}

export function ReceiptList({ receipts, compact = false }: { receipts: MemoryReceiptView[]; compact?: boolean }) {
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface">
      {receipts.map((r) => (
        <ReceiptRow key={r.recordId ?? r.label} r={r} compact={compact} />
      ))}
    </ul>
  );
}

function ReceiptRow({ r, compact }: { r: MemoryReceiptView; compact: boolean }) {
  const [open, setOpen] = useState(false);
  const icon =
    r.status === "stored" || r.status === "duplicate" ? (
      <Check className="size-3.5" aria-hidden="true" />
    ) : r.status === "pending" ? (
      <Loader2 className="size-3.5 motion-safe:animate-spin" aria-hidden="true" />
    ) : r.status === "failed" ? (
      <CircleAlert className="size-3.5" aria-hidden="true" />
    ) : (
      <Clock className="size-3.5" aria-hidden="true" />
    );
  const statusText =
    r.status === "stored"
      ? r.backend === "walrus"
        ? "Saved securely with Walrus Memory"
        : "Saved"
      : r.status === "duplicate"
        ? "Already remembered"
        : r.status === "pending"
          ? "Saving…"
          : r.status === "failed"
            ? "Couldn’t save yet — will retry"
            : (r.reason ?? "Not saved");
  return (
    <li className={cn("px-3 py-2.5", r.status === "stored" && "nia-stored-ripple")}>
      <div className="flex items-start gap-2">
        <span className={cn("mt-0.5 grid size-5 shrink-0 place-items-center rounded-full", r.status === "stored" || r.status === "duplicate" ? "bg-memory text-white" : r.status === "failed" ? "bg-danger-soft text-danger" : "bg-surface-2 text-muted-foreground")}>
          {icon}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{r.label}</p>
          <p className="text-xs text-muted-foreground">
            {statusText}
            {r.supersededCount ? " · replaces an earlier value" : ""}
          </p>
          {!compact && (r.status === "stored" || r.blobId) ? (
            <>
              <button type="button" onClick={() => setOpen((o) => !o)} className="mt-0.5 text-xs font-semibold text-accent-strong hover:underline" aria-expanded={open}>
                {open ? "Hide advanced details" : "Advanced details"}
              </button>
              {open ? (
                <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                  <dt className="text-muted-foreground">Network</dt>
                  <dd>{r.network ?? "—"}</dd>
                  <dt className="text-muted-foreground">Memory type</dt>
                  <dd>{TYPE_LABEL[r.type] ?? r.type}</dd>
                  <dt className="text-muted-foreground">Blob ID</dt>
                  <dd className="truncate font-mono" title={r.blobId ?? undefined}>
                    {short(r.blobId)}
                  </dd>
                  <dt className="text-muted-foreground">Job</dt>
                  <dd className="truncate font-mono">{short(r.jobId, 8)}</dd>
                  <dt className="text-muted-foreground">Stored</dt>
                  <dd>{r.storedAt ? new Date(r.storedAt).toLocaleString() : "—"}</dd>
                </dl>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </li>
  );
}

/** Memory receipts for one assistant turn. */
export function MemoryPanel({
  slug,
  data,
  showDecisions,
  onConsent,
}: {
  slug: string;
  data: NiaDataParts["memory"];
  showDecisions: boolean;
  onConsent: (candidateId: string, accept: boolean) => Promise<MemoryReceiptView | null>;
}) {
  const [answered, setAnswered] = useState<Record<string, boolean>>({});
  const [consentReceipts, setConsentReceipts] = useState<MemoryReceiptView[]>([]);
  // Keep polling if the durable wait outlasted the stream.
  const live = useReceiptPoll(slug, [...data.receipts, ...consentReceipts]);
  const stored = live.filter((r) => r.status === "stored");
  const visible = live.filter((r) => r.status !== "skipped" || r.reason);
  if (data.phase === "extracting") {
    return (
      <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" aria-live="polite">
        <Loader2 className="size-3.5 motion-safe:animate-spin" aria-hidden="true" /> Checking what’s worth remembering…
      </p>
    );
  }
  if (data.phase === "none" && !data.consent.length && !consentReceipts.length && !(showDecisions && data.decisions.length)) return null;
  return (
    <div className="space-y-2" aria-live="polite">
      {stored.length ? (
        <p className="text-sm font-semibold text-memory">
          {stored.length === 1 ? "Got it — I’ll remember that." : `Got it — ${stored.length} things remembered.`}
        </p>
      ) : live.some((r) => r.status === "pending") ? (
        <p className="text-xs font-medium text-muted-foreground">Saving to memory…</p>
      ) : null}
      {visible.length ? <ReceiptList receipts={visible} /> : null}
      {data.consent.filter((c) => !(c.candidateId in answered)).map((c) => (
        <div key={c.candidateId} className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2">
          <p className="min-w-0 flex-1 text-sm">
            Should I remember this? <span className="font-semibold">{c.label}</span>
          </p>
          <Button
            size="sm"
            variant="secondary"
            onClick={async () => {
              setAnswered((a) => ({ ...a, [c.candidateId]: true }));
              const receipt = await onConsent(c.candidateId, true);
              if (receipt) setConsentReceipts((prev) => [...prev, receipt]);
            }}
          >
            Yes
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={async () => {
              setAnswered((a) => ({ ...a, [c.candidateId]: false }));
              await onConsent(c.candidateId, false);
            }}
          >
            No thanks
          </Button>
        </div>
      ))}
      {showDecisions && data.decisions.length ? (
        <details className="rounded-xl border border-dashed border-border px-3 py-2 text-xs">
          <summary className="cursor-pointer font-semibold text-muted-foreground">Extraction ({data.decisions.length} candidates)</summary>
          <ul className="mt-2 space-y-2">
            {data.decisions.map((d, i) => (
              <li key={i} className="rounded-lg bg-surface-2 p-2">
                <p className="font-semibold">
                  {d.label} · <span className="uppercase">{d.decision.replace("_", " ")}</span>
                </p>
                <p className="text-muted-foreground">
                  {TYPE_LABEL[d.type] ?? d.type} · score {d.score} · confidence {d.confidence} · {d.explicit ? "explicit" : "inferred"}
                </p>
                <p className="text-muted-foreground">{d.reasons.join("; ")}</p>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
