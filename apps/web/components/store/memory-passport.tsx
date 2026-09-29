"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, CircleAlert, History, Loader2, PenLine, Trash2 } from "lucide-react";
import { Badge, Button, Input, Mascot, cn, type BadgeTone } from "@nia/ui";
import { CONFIRMATION_LABELS, MEMORY_TYPE_META, PASSPORT_SECTION_LABELS, PASSPORT_SECTIONS, type MemoryConfirmation, type PassportSection } from "@nia/shared";
import type { PassportEntry } from "@nia/memory";
import { correctMemoryAction, forgetMemoryAction } from "@/app/actions/store";

const CONF_TONE: Record<MemoryConfirmation, BadgeTone> = {
  customer_stated: "success",
  customer_confirmed: "success",
  customer_corrected: "info",
  observed_from_orders: "neutral",
  inferred: "warning",
  merchant_entered: "neutral",
};

const SOURCE: Record<PassportEntry["sourceKind"], string> = {
  conversation: "From a conversation",
  order: "From an order you placed",
  booking: "From a booking",
  merchant_entry: "Added by the shop",
  customer_correction: "Your correction",
  passport: "Edited in your Memory Passport",
  confirmation: "You confirmed it",
};

function when(iso: string) {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
}

export function MemoryPassport({ slug, entries, backend }: { slug: string; entries: PassportEntry[]; backend: "walrus" | "mock" | null }) {
  const active = entries.filter((e) => e.lifecycle === "active");
  const history = entries.filter((e) => e.lifecycle === "superseded");
  const bySection = new Map<PassportSection, PassportEntry[]>();
  for (const e of active) {
    const section = e.confirmation === "customer_corrected" ? "corrections" : MEMORY_TYPE_META[e.type].section;
    bySection.set(section, [...(bySection.get(section) ?? []), e]);
  }
  if (active.length === 0) {
    return (
      <div className="relative flex flex-col items-center overflow-hidden rounded-3xl border border-dashed border-ink-900/10 bg-surface/70 px-6 py-10 text-center">
        <div aria-hidden="true" className="absolute top-4 left-1/2 size-36 -translate-x-1/2 rounded-full" style={{ background: "radial-gradient(closest-side, rgb(107 222 230 / 0.25), transparent)" }} />
        <Mascot size={64} state="remembering" decorative className="relative" />
        <p className="relative mt-4 font-bold tracking-tight">Nia will keep useful preferences here</p>
        <p className="relative mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">
          Nothing yet. Tell Nia your size, favourite colours or usual delivery area in chat — it’ll show up here, and you can correct or remove it any time.
        </p>
      </div>
    );
  }
  return (
    <div className="space-y-7">
      {PASSPORT_SECTIONS.filter((s) => bySection.has(s)).map((section) => (
        <section key={section} aria-labelledby={`sec-${section}`}>
          <h3 id={`sec-${section}`} className="flex items-center gap-2 text-xs font-bold tracking-[0.12em] text-muted-foreground uppercase">
            <span className="nia-orb size-2.5" aria-hidden="true" />
            {PASSPORT_SECTION_LABELS[section]}
          </h3>
          <ul className="mt-3 divide-y divide-ink-900/[0.06] overflow-hidden rounded-3xl border border-aqua-200/60 bg-surface shadow-memory">
            {bySection.get(section)!.map((e) => (
              <PassportRow key={e.id} slug={slug} entry={e} previous={history.filter((h) => h.subjectKey === e.subjectKey && h.namespace === e.namespace)} backend={backend} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function PassportRow({ slug, entry, previous, backend }: { slug: string; entry: PassportEntry; previous: PassportEntry[]; backend: "walrus" | "mock" | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [mode, setMode] = useState<"view" | "why" | "correct" | "forget">("view");
  const [value, setValue] = useState(entry.label.includes(":") ? entry.label.split(":").slice(1).join(":").trim() : "");
  const [error, setError] = useState<string | null>(null);
  const canCorrect = entry.type !== "PAST_ORDER" && entry.type !== "PAST_SERVICE";

  const stored = entry.persistStatus === "stored";
  return (
    <li className="px-4 py-4 sm:px-5">
      <div className="flex items-start gap-3.5">
        <span aria-hidden="true" className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-2xl bg-linear-to-br from-aqua-50 to-periwinkle-50">
          <span className="nia-orb size-3.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold tracking-tight">{entry.label}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <Badge tone={CONF_TONE[entry.confirmation]}>{CONFIRMATION_LABELS[entry.confirmation]}</Badge>
            {stored ? (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Check className="size-3.5 text-memory" aria-hidden="true" /> {backend === "walrus" ? "Stored with Walrus" : "Stored"}
              </span>
            ) : entry.persistStatus === "pending" ? (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Loader2 className="size-3.5 motion-safe:animate-spin" aria-hidden="true" /> Saving
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs text-danger">
                <CircleAlert className="size-3.5" aria-hidden="true" /> Not saved yet
              </span>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center">
          <button type="button" onClick={() => setMode(mode === "why" ? "view" : "why")} className="inline-flex h-10 items-center gap-1 rounded-full px-3 text-sm font-semibold text-muted-foreground transition-colors duration-150 hover:bg-ink-900/[0.05] hover:text-foreground" aria-expanded={mode === "why"}>
            Why? <ChevronDown className={cn("size-4 transition-transform duration-150", mode === "why" && "rotate-180")} aria-hidden="true" />
          </button>
          {canCorrect ? (
            <button type="button" onClick={() => setMode("correct")} className="grid size-10 place-items-center rounded-full text-muted-foreground transition-colors duration-150 hover:bg-ink-900/[0.05] hover:text-foreground" aria-label={`Correct “${entry.label}”`}>
              <PenLine className="size-4" aria-hidden="true" />
            </button>
          ) : null}
          <button type="button" onClick={() => setMode("forget")} className="grid size-10 place-items-center rounded-full text-muted-foreground transition-colors duration-150 hover:bg-danger-soft hover:text-danger" aria-label={`Forget “${entry.label}”`}>
            <Trash2 className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {mode === "why" ? (
        <dl className="nia-enter mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 rounded-2xl border border-ink-900/[0.05] bg-paper p-4 text-sm sm:ml-[3.375rem]">
          <dt className="text-muted-foreground">Source</dt>
          <dd>
            {SOURCE[entry.sourceKind]}
            {entry.channel ? ` · ${entry.channel === "telegram" ? "Telegram" : "web"}` : ""}
          </dd>
          <dt className="text-muted-foreground">Since</dt>
          <dd>{when(entry.validFrom)}</dd>
          {entry.evidence ? (
            <>
              <dt className="text-muted-foreground">You said</dt>
              <dd>“{entry.evidence}”</dd>
            </>
          ) : null}
          {previous.length ? (
            <>
              <dt className="text-muted-foreground">Earlier</dt>
              <dd className="flex flex-col gap-0.5">
                {previous.map((p) => (
                  <span key={p.id} className="inline-flex items-center gap-1.5">
                    <History className="size-3.5 text-muted-foreground" aria-hidden="true" />
                    {p.label} <span className="text-muted-foreground">(until {when(p.validTo ?? p.validFrom)})</span>
                  </span>
                ))}
              </dd>
            </>
          ) : null}
          {entry.blobId ? (
            <>
              <dt className="text-muted-foreground">Blob ID</dt>
              <dd className="truncate font-mono text-xs leading-5" title={entry.blobId}>
                {entry.blobId}
              </dd>
            </>
          ) : null}
        </dl>
      ) : null}

      {mode === "correct" ? (
        <form
          className="nia-enter mt-3 flex flex-wrap items-end gap-2"
          onSubmit={(ev) => {
            ev.preventDefault();
            start(async () => {
              setError(null);
              const res = await correctMemoryAction(slug, entry.id, value);
              if (!res.ok) setError(res.error);
              else setMode("view");
              router.refresh();
            });
          }}
        >
          <div className="min-w-40 flex-1">
            <label htmlFor={`fix-${entry.id}`} className="text-xs font-semibold text-muted-foreground">
              Correct value
            </label>
            <Input id={`fix-${entry.id}`} value={value} onChange={(e) => setValue(e.target.value)} maxLength={120} autoFocus />
          </div>
          <Button type="submit" loading={pending}>
            Save
          </Button>
          <Button type="button" variant="ghost" onClick={() => setMode("view")}>
            Cancel
          </Button>
          <p className="w-full text-xs text-muted-foreground">The old value is kept as history so past orders still make sense.</p>
        </form>
      ) : null}

      {mode === "forget" ? (
        <div className="nia-enter mt-3 rounded-2xl border border-danger/15 bg-danger-soft p-4 text-sm sm:ml-[3.375rem]">
          <p className="font-semibold text-danger">Forget this?</p>
          <p className="mt-1 text-foreground/80">
            Nia will stop using it immediately, in every channel. The encrypted copy on Walrus can’t be deleted instantly — it stays unreadable to Nia and expires with its storage period.
          </p>
          <div className="mt-3 flex gap-2">
            <Button
              size="sm"
              variant="danger"
              loading={pending}
              onClick={() =>
                start(async () => {
                  const res = await forgetMemoryAction(slug, entry.id);
                  if (!res.ok) setError(res.error);
                  router.refresh();
                })
              }
            >
              Forget
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setMode("view")}>
              Keep
            </Button>
          </div>
        </div>
      ) : null}
      {error ? (
        <p className="mt-2 text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </li>
  );
}
