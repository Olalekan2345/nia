"use client";

import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Badge, Button, Card, CardBody, CardHeader, Field, Input, Select, Switch, Textarea, cn } from "@nia/ui";
import { BUSINESS_TYPES, SUPPORTED_CURRENCIES, WEEKDAYS, type WeekdayKey } from "@nia/shared";
import {
  deleteKnowledgeAction,
  inviteMemberAction,
  removeMemberAction,
  saveKnowledgeAction,
  setStoreStatusAction,
  setTelegramEnabledAction,
  updateFulfilmentAction,
  updateNiaSettingsAction,
  updateOpeningHoursAction,
  updatePaymentsAction,
  updateProfileAction,
} from "@/app/actions/dashboard";
import { CopyText } from "./memory-tools";

type Res = { ok: boolean; error?: string };

function useSave() {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const save = (fn: () => Promise<Res>, okText = "Saved") =>
    start(async () => {
      const r = await fn();
      setMsg(r.ok ? { ok: true, text: okText } : { ok: false, text: r.error ?? "Failed" });
      router.refresh();
    });
  const status = msg ? (
    <p className={cn("text-sm", msg.ok ? "text-success" : "text-danger")} role="status">
      {msg.text}
    </p>
  ) : null;
  return { busy, save, status };
}

function Section({ id, title, description, children, footer }: { id: string; title: string; description?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <Card id={id} className="scroll-mt-24">
      <CardHeader title={title} description={description} />
      <CardBody className="space-y-4">{children}</CardBody>
      {footer ? <div className="flex flex-wrap items-center gap-3 border-t border-border px-5 py-3">{footer}</div> : null}
    </Card>
  );
}

/* ─────────────────────────────── Publish ─────────────────────────────── */

export function PublishCard({ merchantId, status, storeUrl, canPublish }: { merchantId: string; status: string; storeUrl: string; canPublish: boolean }) {
  const { busy, save, status: s } = useSave();
  const live = status === "live";
  return (
    <Section id="publish" title="Store status" description={live ? "Your store is live — customers can chat, order and book." : "Your store is hidden from customers."}>
      <div className="flex flex-wrap items-center gap-3">
        <Badge tone={live ? "success" : "warning"} dot>
          {live ? "Live" : status === "paused" ? "Paused" : "Not published"}
        </Badge>
        <code className="truncate rounded-lg bg-surface-2 px-2 py-1 font-mono text-xs">{storeUrl}</code>
        <CopyText value={storeUrl} label="Copy store link" />
        <div className="ml-auto">
          {canPublish ? (
            <Button variant={live ? "secondary" : "primary"} loading={busy} onClick={() => save(() => setStoreStatusAction(merchantId, live ? "paused" : "live"), live ? "Store paused" : "Store is live")}>
              {live ? "Pause store" : "Publish store"}
            </Button>
          ) : (
            <p className="text-sm text-muted-foreground">Only the owner can publish.</p>
          )}
        </div>
      </div>
      {s}
    </Section>
  );
}

/* ─────────────────────────────── Profile ─────────────────────────────── */

export interface ProfileValue {
  name: string;
  tagline: string;
  description: string;
  logoUrl: string;
  accentColor: string;
  welcomeMessage: string;
  currency: string;
  locale: string;
  timezone: string;
  city: string;
  country: string;
  businessType: string;
}

export function ProfileForm({ merchantId, initial }: { merchantId: string; initial: ProfileValue }) {
  const [v, setV] = useState(initial);
  const { busy, save, status } = useSave();
  const set = (k: keyof ProfileValue, val: string) => setV((p) => ({ ...p, [k]: val }));
  return (
    <Section
      id="profile"
      title="Business profile"
      description="How your store and Nia introduce your business."
      footer={
        <>
          <Button
            loading={busy}
            onClick={() =>
              save(() =>
                updateProfileAction(merchantId, {
                  ...v,
                  tagline: v.tagline || null,
                  description: v.description || null,
                  logoUrl: v.logoUrl || null,
                  welcomeMessage: v.welcomeMessage || null,
                  city: v.city || null,
                  country: v.country || null,
                }),
              )
            }
          >
            Save profile
          </Button>
          {status}
        </>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Business name" htmlFor="p-name">
          <Input id="p-name" value={v.name} onChange={(e) => set("name", e.target.value)} maxLength={80} />
        </Field>
        <Field label="Business type" htmlFor="p-type">
          <Select id="p-type" value={v.businessType} onChange={(e) => set("businessType", e.target.value)}>
            {BUSINESS_TYPES.map((b) => (
              <option key={b.value} value={b.value}>
                {b.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Tagline" htmlFor="p-tag" className="sm:col-span-2">
          <Input id="p-tag" value={v.tagline} onChange={(e) => set("tagline", e.target.value)} maxLength={160} />
        </Field>
        <Field label="About" htmlFor="p-desc" className="sm:col-span-2">
          <Textarea id="p-desc" value={v.description} onChange={(e) => set("description", e.target.value)} maxLength={1000} />
        </Field>
        <Field label="Welcome message" htmlFor="p-wel" className="sm:col-span-2" hint="Shown on your store home under the greeting.">
          <Input id="p-wel" value={v.welcomeMessage} onChange={(e) => set("welcomeMessage", e.target.value)} maxLength={300} />
        </Field>
        <Field label="Logo URL" htmlFor="p-logo" hint="HTTPS image, square works best">
          <Input id="p-logo" type="url" value={v.logoUrl} onChange={(e) => set("logoUrl", e.target.value)} />
        </Field>
        <Field label="Brand colour" htmlFor="p-color" hint="Used for your logo mark — pick a darker shade for contrast.">
          <div className="flex gap-2">
            <input type="color" aria-label="Pick brand colour" value={v.accentColor} onChange={(e) => set("accentColor", e.target.value)} className="h-11 w-14 cursor-pointer rounded-2xl border border-ink-900/[0.06] bg-surface p-1" />
            <Input id="p-color" value={v.accentColor} onChange={(e) => set("accentColor", e.target.value)} maxLength={7} className="font-mono" />
          </div>
        </Field>
        <Field label="Currency" htmlFor="p-cur">
          <Select id="p-cur" value={v.currency} onChange={(e) => set("currency", e.target.value)}>
            {SUPPORTED_CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Locale" htmlFor="p-loc" hint="e.g. en-NG, en-GB, en-US">
          <Input id="p-loc" value={v.locale} onChange={(e) => set("locale", e.target.value)} maxLength={20} />
        </Field>
        <Field label="Time zone" htmlFor="p-tz" hint="IANA name, e.g. Africa/Lagos">
          <Input id="p-tz" value={v.timezone} onChange={(e) => set("timezone", e.target.value)} maxLength={64} />
        </Field>
        <div className="grid grid-cols-[1fr_6rem] gap-3">
          <Field label="City" htmlFor="p-city">
            <Input id="p-city" value={v.city} onChange={(e) => set("city", e.target.value)} maxLength={80} />
          </Field>
          <Field label="Country" htmlFor="p-cc" hint="2 letters">
            <Input id="p-cc" value={v.country} onChange={(e) => set("country", e.target.value.toUpperCase().slice(0, 2))} />
          </Field>
        </div>
      </div>
    </Section>
  );
}

/* ─────────────────────────────── Nia behaviour ─────────────────────────────── */

export function NiaSettingsForm({ merchantId, initial }: { merchantId: string; initial: { tone: string; memoryEnabled: boolean; recommendationsEnabled: boolean; instructions: string } }) {
  const [v, setV] = useState(initial);
  const { busy, save, status } = useSave();
  return (
    <Section
      id="nia"
      title="Nia’s behaviour"
      description="Tone and memory for your customers. Nia’s core rules (honesty, privacy, no invented products or prices) always apply."
      footer={
        <>
          <Button loading={busy} onClick={() => save(() => updateNiaSettingsAction(merchantId, { tone: v.tone as "warm", memoryEnabled: v.memoryEnabled, recommendationsEnabled: v.recommendationsEnabled, instructions: v.instructions || null }))}>
            Save
          </Button>
          {status}
        </>
      }
    >
      <Field label="Tone" htmlFor="tone">
        <Select id="tone" value={v.tone} onChange={(e) => setV({ ...v, tone: e.target.value })}>
          <option value="warm">Warm and personable</option>
          <option value="polished">Polished and professional</option>
          <option value="playful">Light and upbeat</option>
          <option value="concise">Brief and efficient</option>
        </Select>
      </Field>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-semibold">Customer memory</p>
          <p className="text-sm text-muted-foreground">Remember preferences, orders and context with Walrus Memory. Customers can still turn it off for themselves.</p>
        </div>
        <Switch checked={v.memoryEnabled} onChange={(on) => setV({ ...v, memoryEnabled: on })} label="Customer memory" />
      </div>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-semibold">Personalised recommendations</p>
          <p className="text-sm text-muted-foreground">Suggest items based on remembered preferences and history.</p>
        </div>
        <Switch checked={v.recommendationsEnabled} onChange={(on) => setV({ ...v, recommendationsEnabled: on })} label="Personalised recommendations" />
      </div>
      <Field label="Extra guidance for Nia" htmlFor="instr" hint="e.g. “Always mention we can do alterations” — treated as preference, never overriding honesty or privacy.">
        <Textarea id="instr" value={v.instructions} onChange={(e) => setV({ ...v, instructions: e.target.value })} maxLength={800} />
      </Field>
    </Section>
  );
}

/* ─────────────────────────────── Fulfilment ─────────────────────────────── */

export function FulfilmentForm({
  merchantId,
  currency,
  initial,
}: {
  merchantId: string;
  currency: string;
  initial: { delivery: boolean; pickup: boolean; pickupAddress: string; areas: { name: string; fee: string; etaDays: string; sameDay: boolean }[] };
}) {
  const [v, setV] = useState(initial);
  const { busy, save, status } = useSave();
  return (
    <Section
      id="fulfilment"
      title="Delivery & pickup"
      description={`Nia only offers these areas and fees (${currency}). Leave a fee blank to have it quoted per order.`}
      footer={
        <>
          <Button
            loading={busy}
            onClick={() =>
              save(() =>
                updateFulfilmentAction(merchantId, {
                  delivery: v.delivery,
                  pickup: v.pickup,
                  pickupAddress: v.pickupAddress || null,
                  areas: v.areas.filter((a) => a.name.trim()).map((a) => ({ name: a.name, fee: a.fee.trim() === "" ? null : Number(a.fee), etaDays: a.etaDays.trim() === "" ? null : Number(a.etaDays), sameDay: a.sameDay })),
                }),
              )
            }
          >
            Save
          </Button>
          {status}
        </>
      }
    >
      <div className="flex flex-wrap gap-6">
        <label className="flex items-center gap-3 text-sm font-semibold">
          <Switch checked={v.delivery} onChange={(on) => setV({ ...v, delivery: on })} label="Offer delivery" /> Delivery
        </label>
        <label className="flex items-center gap-3 text-sm font-semibold">
          <Switch checked={v.pickup} onChange={(on) => setV({ ...v, pickup: on })} label="Offer pickup" /> Pickup
        </label>
      </div>
      {v.pickup ? (
        <Field label="Pickup address / instructions" htmlFor="pickup">
          <Input id="pickup" value={v.pickupAddress} onChange={(e) => setV({ ...v, pickupAddress: e.target.value })} maxLength={300} />
        </Field>
      ) : null}
      {v.delivery ? (
        <div className="space-y-2">
          <p className="text-sm font-semibold">Delivery areas</p>
          {v.areas.map((a, i) => {
            const upd = (patch: Partial<typeof a>) => setV({ ...v, areas: v.areas.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
            return (
              <div key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto] items-end gap-2 rounded-2xl border border-ink-900/[0.06] bg-paper p-3 sm:grid-cols-[1.5fr_1fr_0.8fr_auto_auto] sm:rounded-none sm:border-0 sm:bg-transparent sm:p-0">
                <Field label={i === 0 ? "Area" : ""} htmlFor={`a-n-${i}`} className="col-span-4 sm:col-span-1">
                  <Input id={`a-n-${i}`} aria-label="Area name" placeholder="Area" value={a.name} onChange={(e) => upd({ name: e.target.value })} />
                </Field>
                <Field label={i === 0 ? "Fee" : ""} htmlFor={`a-f-${i}`}>
                  <Input id={`a-f-${i}`} aria-label="Delivery fee" inputMode="decimal" value={a.fee} onChange={(e) => upd({ fee: e.target.value.replace(/[^\d.]/g, "") })} placeholder="quote" />
                </Field>
                <Field label={i === 0 ? "Days" : ""} htmlFor={`a-d-${i}`}>
                  <Input id={`a-d-${i}`} aria-label="Delivery days" inputMode="numeric" value={a.etaDays} onChange={(e) => upd({ etaDays: e.target.value.replace(/\D/g, "") })} />
                </Field>
                <label className="flex h-11 items-center gap-2 text-xs font-semibold">
                  <Switch checked={a.sameDay} onChange={(on) => upd({ sameDay: on })} label={`Same day for ${a.name || "area"}`} /> Same day
                </label>
                <button type="button" onClick={() => setV({ ...v, areas: v.areas.filter((_, j) => j !== i) })} className="grid size-11 place-items-center rounded-full text-muted-foreground transition-colors duration-150 hover:bg-danger-soft hover:text-danger" aria-label={`Remove ${a.name || "area"}`}>
                  <Trash2 className="size-4" aria-hidden="true" />
                </button>
              </div>
            );
          })}
          <Button size="sm" variant="secondary" onClick={() => setV({ ...v, areas: [...v.areas, { name: "", fee: "", etaDays: "", sameDay: false }] })}>
            <Plus className="size-4" aria-hidden="true" /> Add area
          </Button>
        </div>
      ) : null}
    </Section>
  );
}

/* ─────────────────────────────── Hours ─────────────────────────────── */

const DAY: Record<WeekdayKey, string> = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday", sat: "Saturday", sun: "Sunday" };

export function HoursForm({ merchantId, initial }: { merchantId: string; initial: Partial<Record<WeekdayKey, [string, string] | null>> }) {
  const [v, setV] = useState(initial);
  const { busy, save, status } = useSave();
  return (
    <Section
      id="hours"
      title="Opening hours"
      footer={
        <>
          <Button loading={busy} onClick={() => save(() => updateOpeningHoursAction(merchantId, Object.fromEntries(Object.entries(v).filter(([, w]) => w).map(([d, w]) => [d, [w!]]))))}>
            Save hours
          </Button>
          {status}
        </>
      }
    >
      <ul className="space-y-2">
        {WEEKDAYS.map((d) => {
          const w = v[d];
          return (
            <li key={d} className="grid grid-cols-[3.25rem_auto_minmax(0,1fr)_minmax(0,1fr)] items-center gap-2 sm:grid-cols-[7rem_auto_1fr_1fr] sm:gap-3 [&_input]:min-w-0 [&_input]:px-2.5 sm:[&_input]:px-4">
              <span className="text-sm font-semibold">
                <span className="sm:hidden" aria-hidden="true">
                  {DAY[d].slice(0, 3)}
                </span>
                <span className="max-sm:sr-only">{DAY[d]}</span>
              </span>
              <Switch checked={Boolean(w)} onChange={(on) => setV({ ...v, [d]: on ? ["09:00", "18:00"] : null })} label={`Open on ${DAY[d]}`} />
              {w ? (
                <>
                  <Input type="time" aria-label={`${DAY[d]} opens`} value={w[0]} onChange={(e) => setV({ ...v, [d]: [e.target.value, w[1]] })} />
                  <Input type="time" aria-label={`${DAY[d]} closes`} value={w[1]} onChange={(e) => setV({ ...v, [d]: [w[0], e.target.value] })} />
                </>
              ) : (
                <span className="col-span-2 text-sm text-muted-foreground">Closed</span>
              )}
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

/* ─────────────────────────────── Payments ─────────────────────────────── */

export function PaymentsForm({ merchantId, initial, paystackAvailable }: { merchantId: string; initial: { paymentMode: string; paymentInstructions: string; paymentLinkUrl: string }; paystackAvailable: boolean }) {
  const [v, setV] = useState(initial);
  const { busy, save, status } = useSave();
  return (
    <Section
      id="payments"
      title="Payments"
      description="Nia never takes card details and never marks an order paid by itself."
      footer={
        <>
          <Button loading={busy} onClick={() => save(() => updatePaymentsAction(merchantId, { paymentMode: v.paymentMode as "merchant_confirmed", paymentInstructions: v.paymentInstructions || null, paymentLinkUrl: v.paymentLinkUrl || null }))}>
            Save
          </Button>
          {status}
        </>
      }
    >
      <Field label="How customers pay" htmlFor="pm">
        <Select id="pm" value={v.paymentMode} onChange={(e) => setV({ ...v, paymentMode: e.target.value })}>
          <option value="merchant_confirmed">I confirm availability, then share payment details</option>
          <option value="payment_link">My own payment link</option>
          <option value="paystack" disabled={!paystackAvailable}>
            Paystack checkout{paystackAvailable ? "" : " (server not configured)"}
          </option>
        </Select>
      </Field>
      {v.paymentMode === "payment_link" ? (
        <Field label="Payment link" htmlFor="plink">
          <Input id="plink" type="url" value={v.paymentLinkUrl} onChange={(e) => setV({ ...v, paymentLinkUrl: e.target.value })} />
        </Field>
      ) : null}
      <Field label="Payment instructions" htmlFor="pinst" hint="Shown after a customer confirms an order.">
        <Textarea id="pinst" value={v.paymentInstructions} onChange={(e) => setV({ ...v, paymentInstructions: e.target.value })} maxLength={600} />
      </Field>
    </Section>
  );
}

/* ─────────────────────────────── Knowledge ─────────────────────────────── */

const CATEGORIES = [
  ["shipping", "Shipping"],
  ["returns", "Returns"],
  ["hours", "Hours"],
  ["service_policy", "Service policy"],
  ["stock_note", "Stock note"],
  ["product_guidance", "Product guidance"],
  ["faq", "FAQ"],
  ["special_instructions", "Special instructions"],
] as const;

export function KnowledgeManager({
  merchantId,
  entries,
  walrusReady,
}: {
  merchantId: string;
  entries: { id: string; category: string; title: string; body: string; rememberInWalrus: boolean; memoryStatus: string | null }[];
  walrusReady: boolean;
}) {
  const empty = { id: undefined as string | undefined, category: "faq", title: "", body: "", rememberInWalrus: false };
  const [draft, setDraft] = useState(empty);
  const { busy, save, status } = useSave();
  return (
    <Section id="knowledge" title="Knowledge base" description="Policies and FAQs Nia can quote. Tick “Remember in Walrus” to also store an entry in your shop’s Walrus memory for semantic recall.">
      <ul className="divide-y divide-ink-900/[0.06] rounded-xl border border-border">
        {entries.length === 0 ? <li className="px-4 py-6 text-center text-sm text-muted-foreground">No entries yet.</li> : null}
        {entries.map((e) => (
          <li key={e.id} className="flex items-start gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="font-medium">
                {e.title} <span className="text-xs font-normal text-muted-foreground">· {CATEGORIES.find((c) => c[0] === e.category)?.[1]}</span>
              </p>
              <p className="line-clamp-2 text-sm text-muted-foreground">{e.body}</p>
              {e.rememberInWalrus ? (
                <Badge tone={e.memoryStatus === "stored" ? "success" : "warning"} className="mt-1">
                  Walrus: {e.memoryStatus ?? "not saved"}
                </Badge>
              ) : null}
            </div>
            <Button size="sm" variant="ghost" onClick={() => setDraft({ id: e.id, category: e.category, title: e.title, body: e.body, rememberInWalrus: e.rememberInWalrus })}>
              Edit
            </Button>
            <Button size="sm" variant="ghost" onClick={() => save(() => deleteKnowledgeAction(merchantId, e.id), "Deleted")}>
              Delete
            </Button>
          </li>
        ))}
      </ul>
      <div className="space-y-3 rounded-2xl border border-ink-900/[0.05] bg-paper p-5">
        <p className="text-sm font-semibold">{draft.id ? "Edit entry" : "New entry"}</p>
        <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
          <Field label="Category" htmlFor="k-cat">
            <Select id="k-cat" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
              {CATEGORIES.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Title" htmlFor="k-title">
            <Input id="k-title" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} maxLength={120} />
          </Field>
        </div>
        <Field label="Details" htmlFor="k-body">
          <Textarea id="k-body" value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} maxLength={2000} />
        </Field>
        <label className="flex items-center gap-3 text-sm">
          <Switch checked={draft.rememberInWalrus} disabled={!walrusReady} onChange={(on) => setDraft({ ...draft, rememberInWalrus: on })} label="Remember in Walrus" />
          Remember in Walrus {walrusReady ? null : <span className="text-muted-foreground">(Walrus Memory not configured)</span>}
        </label>
        <div className="flex items-center gap-2">
          <Button
            loading={busy}
            disabled={draft.title.trim().length < 2 || draft.body.trim().length < 2}
            onClick={() => {
              save(() => saveKnowledgeAction(merchantId, { id: draft.id, category: draft.category as "faq", title: draft.title, body: draft.body, rememberInWalrus: draft.rememberInWalrus }));
              setDraft(empty);
            }}
          >
            {draft.id ? "Save changes" : "Add entry"}
          </Button>
          {draft.id ? (
            <Button variant="ghost" onClick={() => setDraft(empty)}>
              Cancel
            </Button>
          ) : null}
          {status}
        </div>
      </div>
    </Section>
  );
}

/* ─────────────────────────────── Telegram ─────────────────────────────── */

export function TelegramSettings({
  merchantId,
  enabled,
  botUsername,
  deepLink,
  configured,
  webhook,
}: {
  merchantId: string;
  enabled: boolean;
  botUsername: string | null;
  deepLink: string | null;
  configured: boolean;
  webhook: { url: string | null; pending: number; lastError: string | null } | null;
}) {
  const { busy, save, status } = useSave();
  return (
    <Section id="telegram" title="Telegram" description="Customers chat with Nia in Telegram with the same memory as your web store once they link their account.">
      {!configured ? (
        <p className="rounded-xl bg-warning-soft px-3 py-2 text-sm text-warning">
          The Telegram bot isn’t configured on this server. Set TELEGRAM_BOT_TOKEN, TELEGRAM_BOT_USERNAME and TELEGRAM_WEBHOOK_SECRET, then run <code className="font-mono">pnpm telegram:webhook -- set</code>.
        </p>
      ) : (
        <>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-semibold">Chat on Telegram</p>
              <p className="text-sm text-muted-foreground">Bot: @{botUsername}</p>
            </div>
            <Switch checked={enabled} disabled={busy} onChange={(on) => save(() => setTelegramEnabledAction(merchantId, on))} label="Enable Telegram" />
          </div>
          {deepLink ? (
            <div>
              <p className="text-sm font-semibold">Your shop’s Telegram link</p>
              <div className="mt-1 flex items-center gap-2">
                <code className="truncate rounded-lg bg-surface-2 px-2 py-1 font-mono text-xs">{deepLink}</code>
                <CopyText value={deepLink} label="Copy Telegram link" />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Share it — it opens the bot straight into your store.</p>
            </div>
          ) : null}
          {webhook ? (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-muted-foreground">Webhook</dt>
              <dd className="truncate">{webhook.url ?? "Not set (polling or not registered)"}</dd>
              <dt className="text-muted-foreground">Pending updates</dt>
              <dd>{webhook.pending}</dd>
              {webhook.lastError ? (
                <>
                  <dt className="text-muted-foreground">Last error</dt>
                  <dd className="text-danger">{webhook.lastError}</dd>
                </>
              ) : null}
            </dl>
          ) : null}
        </>
      )}
      {status}
    </Section>
  );
}

/* ─────────────────────────────── Team ─────────────────────────────── */

export function TeamManager({ merchantId, members, invites, isOwner }: { merchantId: string; members: { userId: string; email: string; role: string }[]; invites: { email: string; role: string }[]; isOwner: boolean }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"ADMIN" | "STAFF">("STAFF");
  const { busy, save, status } = useSave();
  return (
    <Section id="team" title="Team" description="Owners manage everything; admins manage settings and catalog; staff handle orders, bookings and catalog.">
      <ul className="divide-y divide-ink-900/[0.06] rounded-xl border border-border">
        {members.map((m) => (
          <li key={m.userId} className="flex items-center gap-3 px-4 py-2.5 text-sm">
            <span className="min-w-0 flex-1 truncate">{m.email}</span>
            <Badge>{m.role.toLowerCase()}</Badge>
            {isOwner && m.role !== "OWNER" ? (
              <Button size="sm" variant="ghost" onClick={() => save(() => removeMemberAction(merchantId, m.userId), "Removed")}>
                Remove
              </Button>
            ) : null}
          </li>
        ))}
        {invites.map((i) => (
          <li key={i.email} className="flex items-center gap-3 px-4 py-2.5 text-sm text-muted-foreground">
            <span className="min-w-0 flex-1 truncate">{i.email}</span>
            <Badge tone="warning">invited · {i.role.toLowerCase()}</Badge>
          </li>
        ))}
      </ul>
      {isOwner ? (
        <form
          className="flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            save(() => inviteMemberAction(merchantId, email, role), "Invited — they’ll join when they sign in");
            setEmail("");
          }}
        >
          <Field label="Invite by email" htmlFor="inv-email" className="min-w-56 flex-1">
            <Input id="inv-email" type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </Field>
          <Field label="Role" htmlFor="inv-role">
            <Select id="inv-role" value={role} onChange={(e) => setRole(e.target.value as "ADMIN" | "STAFF")}>
              <option value="STAFF">Staff</option>
              <option value="ADMIN">Admin</option>
            </Select>
          </Field>
          <Button type="submit" loading={busy}>
            Invite
          </Button>
        </form>
      ) : null}
      {status}
    </Section>
  );
}
