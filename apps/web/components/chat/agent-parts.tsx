"use client";

import { useState } from "react";
import Link from "next/link";
import { Bookmark, Brain, Check, ChevronDown, ListChecks, Replace, ShoppingBasket } from "lucide-react";
import { Button, buttonClasses, cn } from "@nia/ui";
import { ProductVisual } from "@/components/commerce/product-visual";
import type { ChatActions } from "./tool-parts";

/* ─────────────────────────────── Why this ─────────────────────────────── */

/** Short, factual reasons a result fits ("Within ₦800,000 · In stock"), from the server. */
export function WhyLine({ why }: { why?: string[] }) {
  if (!why?.length) return null;
  return <p className="w-full text-xs text-muted-foreground">{why.join(" · ")}</p>;
}

/* ─────────────────────────────── Basket ─────────────────────────────── */

export interface BasketLineView {
  slot: string;
  productId: string;
  variantId: string | null;
  name: string;
  variantName: string | null;
  shop: { name: string; slug: string };
  unit: string | null;
  quantity: number;
  unitPriceLabel?: string;
  lineTotalLabel?: string;
  image: string | null;
  url: string;
  otherOptions: number;
}

export interface BasketView {
  goal: string;
  lines: BasketLineView[];
  missing: { slot: string; reason: string }[];
  totalLabel?: string;
  budgetLabel?: string;
  remainingLabel?: string;
  overBudgetByLabel?: string;
  remaining: number | null;
  overBudgetBy: number | null;
  byShop: { shop: { name: string; slug: string }; subtotalLabel?: string; items: number }[];
  notes: string[];
}

/** A proposed basket from real products, with exact totals. Nothing is bought until the customer adds and confirms. */
export function BasketCard({ basket, actions, latest }: { basket: BasketView; actions: ChatActions; latest: boolean }) {
  const [state, setState] = useState<"idle" | "adding" | "done">("idle");
  const [errors, setErrors] = useState<string[]>([]);
  const slots = [...new Set(basket.lines.map((l) => l.slot))];
  const shops = basket.byShop;

  const addAll = async () => {
    setState("adding");
    const failed: string[] = [];
    for (const l of basket.lines) {
      const res = await actions.addToShopCart(l.shop.slug, l.productId, l.variantId, l.quantity);
      if (!res.ok) failed.push(`${l.name}: ${res.error ?? "couldn’t add"}`);
    }
    setErrors(failed);
    setState("done");
  };

  return (
    <div className="nia-enter overflow-hidden rounded-3xl border border-ink-900/[0.06] bg-surface shadow-soft">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <span className="grid size-9 place-items-center rounded-xl bg-accent-soft text-accent-strong">
          <ShoppingBasket className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-muted-foreground">Proposed basket</p>
          <p className="truncate font-semibold">{basket.goal}</p>
        </div>
        <p className="text-xs text-muted-foreground tabular">
          {basket.lines.length} item{basket.lines.length === 1 ? "" : "s"} · {shops.length} shop{shops.length === 1 ? "" : "s"}
        </p>
      </div>

      <div className="divide-y divide-border">
        {slots.map((slot) => (
          <section key={slot} className="px-4 py-3" aria-label={slot}>
            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{slot}</p>
            <ul className="mt-2 space-y-2">
              {basket.lines
                .filter((l) => l.slot === slot)
                .map((l) => (
                  <li key={`${l.productId}-${l.variantId ?? ""}`} className="flex items-center gap-3">
                    <Link href={l.url} className="w-12 shrink-0">
                      <ProductVisual name={l.name} image={l.image} rounded="rounded-xl" />
                    </Link>
                    <div className="min-w-0 flex-1 text-sm">
                      <Link href={l.url} className="font-semibold leading-snug hover:underline">
                        {l.name}
                        {l.variantName ? <span className="font-normal text-muted-foreground"> · {l.variantName}</span> : null}
                      </Link>
                      <p className="truncate text-xs text-muted-foreground">
                        {l.shop.name} · {l.quantity} × {l.unitPriceLabel}
                      </p>
                    </div>
                    <p className="text-sm font-semibold tabular">{l.lineTotalLabel}</p>
                  </li>
                ))}
            </ul>
          </section>
        ))}
        {basket.missing.map((m) => (
          <p key={m.slot} className="px-4 py-2.5 text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{m.slot}:</span> {m.reason}
          </p>
        ))}
      </div>

      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 border-t border-border bg-surface-2/60 px-4 py-3 text-sm">
        {shops.length > 1
          ? shops.map((s) => (
              <div key={s.shop.slug} className="contents text-muted-foreground">
                <dt>{s.shop.name}</dt>
                <dd className="text-right tabular">{s.subtotalLabel}</dd>
              </div>
            ))
          : null}
        <dt className="font-semibold">Total</dt>
        <dd className="text-right font-bold tabular">{basket.totalLabel}</dd>
        {basket.budgetLabel ? (
          <>
            <dt className="text-muted-foreground">Budget</dt>
            <dd className="text-right tabular text-muted-foreground">{basket.budgetLabel}</dd>
            {basket.overBudgetBy != null ? (
              <>
                <dt className="font-semibold text-danger">Over budget by</dt>
                <dd className="text-right font-semibold tabular text-danger">{basket.overBudgetByLabel}</dd>
              </>
            ) : (
              <>
                <dt className="text-muted-foreground">Remaining</dt>
                <dd className="text-right tabular text-success">{basket.remainingLabel}</dd>
              </>
            )}
          </>
        ) : null}
      </dl>
      {basket.notes.length ? <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">{basket.notes.join(" ")}</p> : null}

      <div className="flex flex-wrap items-center gap-2 border-t border-border px-4 py-3">
        {state === "done" ? (
          <>
            <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-success">
              <Check className="size-4" aria-hidden="true" /> {errors.length ? "Added what was still available" : "Added to your cart" + (shops.length > 1 ? "s" : "")}
            </p>
            {shops.map((s) => (
              <Link key={s.shop.slug} href={`/s/${s.shop.slug}/orders`} className={buttonClasses({ size: "sm", variant: "secondary" })}>
                Review cart{shops.length > 1 ? ` · ${s.shop.name}` : ""}
              </Link>
            ))}
          </>
        ) : actions.signedIn ? (
          <Button size="sm" loading={state === "adding"} disabled={!basket.lines.length} onClick={addAll}>
            <ShoppingBasket className="size-4" aria-hidden="true" /> Add all to cart{shops.length > 1 ? "s" : ""}
          </Button>
        ) : (
          <Link href={actions.signInHref} className={buttonClasses({ size: "sm" })}>
            Sign in to add
          </Link>
        )}
        {latest && state !== "done" ? (
          <>
            <Button size="sm" variant="secondary" disabled={actions.busy} onClick={() => actions.send("Make it cheaper")}>
              Make it cheaper
            </Button>
            <Button size="sm" variant="ghost" disabled={actions.busy} onClick={() => actions.send("I'd like to change something in the basket")}>
              Change something
            </Button>
          </>
        ) : null}
      </div>
      {errors.length ? (
        <ul className="border-t border-border px-4 py-2 text-xs text-danger" role="alert">
          {errors.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/* ─────────────────────────────── What Nia remembers ─────────────────────────────── */

export interface MemoryProfileView {
  sections: {
    key: string;
    title: string;
    items: { id: string; label: string; certainty: string; corrected: boolean; previousLabel: string | null; blobId: string | null; storedAt: string | null; channel: string | null }[];
  }[];
  count: number;
}

const CERTAINTY_TONE: Record<string, string> = {
  Confirmed: "bg-success-soft text-success",
  Observed: "bg-accent-soft text-accent-strong",
  Likely: "bg-surface-2 text-muted-foreground",
  "From the shop": "bg-surface-2 text-muted-foreground",
};

/** The customer's current memories, grouped, with how sure Nia is — every one stored on Walrus Memory. */
export function MemoryProfileCard({ profile, actions }: { profile: MemoryProfileView; actions: ChatActions }) {
  const date = (iso: string | null) => (iso ? new Intl.DateTimeFormat(actions.locale, { day: "numeric", month: "short", year: "numeric", timeZone: actions.timeZone }).format(new Date(iso)) : null);
  return (
    <div className="nia-enter rounded-3xl border border-memory/20 bg-surface shadow-soft">
      <div className="flex items-center gap-3 border-b border-border px-4 py-3">
        <span className="grid size-9 place-items-center rounded-xl bg-memory-soft text-memory">
          <Brain className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">What Nia remembers</p>
          <p className="text-xs text-muted-foreground">
            {profile.count} memor{profile.count === 1 ? "y" : "ies"} · stored with Walrus Memory
          </p>
        </div>
      </div>
      {profile.count === 0 ? (
        <p className="px-4 py-3 text-sm text-muted-foreground">Nothing yet. Tell Nia your size, colours or usual delivery area and it’s kept for next time.</p>
      ) : (
        <div className="divide-y divide-border">
          {profile.sections.map((s) => (
            <section key={s.key} className="px-4 py-3" aria-label={s.title}>
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{s.title}</p>
              <ul className="mt-2 space-y-2">
                {s.items.map((i) => (
                  <li key={i.id} className="text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{i.label}</span>
                      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", CERTAINTY_TONE[i.certainty] ?? CERTAINTY_TONE.Likely)}>{i.certainty}</span>
                      {i.previousLabel ? <span className="text-xs text-muted-foreground">updated · was “{i.previousLabel}”</span> : null}
                    </div>
                    <details className="group mt-0.5">
                      <summary className="inline-flex cursor-pointer list-none items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                        Walrus Memory{date(i.storedAt) ? ` · ${date(i.storedAt)}` : ""}
                        <ChevronDown className="size-3 transition-transform group-open:rotate-180" aria-hidden="true" />
                      </summary>
                      <p className="mt-1 font-mono text-[11px] break-all text-muted-foreground">
                        {i.blobId ? `Blob ${i.blobId}` : "Blob id pending"}
                        {i.channel ? ` · via ${i.channel}` : ""}
                      </p>
                    </details>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
      <div className="flex flex-wrap gap-2 border-t border-border px-4 py-3">
        <Link href={actions.profileHref} className={buttonClasses({ size: "sm", variant: "secondary" })}>
          Review or correct
        </Link>
        <Button size="sm" variant="ghost" disabled={actions.busy} onClick={() => actions.send("That's not right — let me correct something.")}>
          Something’s wrong
        </Button>
      </div>
    </div>
  );
}

/* ─────────────────────────────── Alternatives ─────────────────────────────── */

export interface AlternativeView {
  productId: string;
  variantId: string | null;
  slug: string;
  name: string;
  variantName: string | null;
  priceLabel?: string;
  image: string | null;
  sameProduct: boolean;
  reason: string;
}

/** Real alternatives for something unavailable, each with its reason. Adding one is the customer's choice. */
export function Alternatives({ title, options, quantity = 1, actions, shopSlug }: { title: string; options: AlternativeView[]; quantity?: number; actions: ChatActions; shopSlug?: string }) {
  const [added, setAdded] = useState<string | null>(null);
  if (!options.length) return null;
  return (
    <div className="nia-enter rounded-3xl border border-ink-900/[0.06] bg-surface p-3 shadow-soft">
      <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <Replace className="size-3.5" aria-hidden="true" /> {title}
      </p>
      <ul className="mt-2 space-y-2">
        {options.map((o) => {
          const key = `${o.productId}-${o.variantId ?? ""}`;
          return (
            <li key={key} className="flex items-center gap-3">
              <div className="w-11 shrink-0">
                <ProductVisual name={o.name} image={o.image} rounded="rounded-xl" />
              </div>
              <div className="min-w-0 flex-1 text-sm">
                <p className="font-semibold leading-snug">
                  {o.name}
                  {o.variantName ? <span className="font-normal text-muted-foreground"> · {o.variantName}</span> : null}
                </p>
                <p className="text-xs text-muted-foreground">
                  {o.reason}
                  {o.priceLabel ? ` · ${o.priceLabel}` : ""}
                </p>
              </div>
              {actions.signedIn ? (
                added === key ? (
                  <span className="inline-flex items-center gap-1 text-sm font-semibold text-success">
                    <Check className="size-4" aria-hidden="true" /> Added
                  </span>
                ) : (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={async () => {
                      const res = shopSlug ? await actions.addToShopCart(shopSlug, o.productId, o.variantId, quantity) : await actions.addToCart(o.productId, o.variantId, quantity);
                      if (res.ok) setAdded(key);
                    }}
                  >
                    Add
                  </Button>
                )
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ─────────────────────────────── Shortlist & list ─────────────────────────────── */

export function SavedNote({ saved }: { saved: string[] }) {
  if (!saved.length) return null;
  return (
    <p className="nia-enter inline-flex items-center gap-1.5 rounded-full border border-ink-900/[0.06] bg-surface px-3 py-1.5 text-xs font-semibold shadow-soft">
      <Bookmark className="size-3.5 text-accent-strong" aria-hidden="true" /> Saved: {saved.join(", ")} — pick them up here or on Telegram
    </p>
  );
}

export function ShoppingListCard({ list, actions, latest }: { list: string[]; actions: ChatActions; latest: boolean }) {
  return (
    <div className="nia-enter rounded-3xl border border-ink-900/[0.06] bg-surface p-3 shadow-soft">
      <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        <ListChecks className="size-3.5" aria-hidden="true" /> Your shopping list
      </p>
      {list.length ? (
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {list.map((i) => (
            <li key={i} className="rounded-full bg-surface-2 px-2.5 py-1 text-sm">
              {i}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-sm text-muted-foreground">Empty.</p>
      )}
      {latest && list.length ? (
        <Button size="sm" className="mt-3" disabled={actions.busy} onClick={() => actions.send("Get everything on my list")}>
          Find everything on the list
        </Button>
      ) : null}
    </div>
  );
}
