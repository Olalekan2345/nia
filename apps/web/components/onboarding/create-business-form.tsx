"use client";

import { useActionState, useState } from "react";
import { Button, Field, Input, Select, cn } from "@nia/ui";
import { BUSINESS_TYPES, SUPPORTED_CURRENCIES } from "@nia/shared";
import { createBusinessAction, type CreateBusinessState } from "@/app/actions/onboarding";

const TEMPLATES = [
  { value: "none", label: "Start empty", body: "Add your own products and services." },
  { value: "fabric", label: "Fabric & tailoring sample", body: "8 fabric/ready-to-wear items and 2 services." },
  { value: "beauty", label: "Salon & beauty sample", body: "4 bookable services and 3 products." },
  { value: "bakery", label: "Bakery sample", body: "Bread, pastries and a custom cake." },
] as const;

export function CreateBusinessForm() {
  const [state, action, pending] = useActionState<CreateBusinessState, FormData>(createBusinessAction, {});
  const [tz, setTz] = useState("Africa/Lagos");
  const [template, setTemplate] = useState<string>("none");

  return (
    <form action={action} className="space-y-5">
      <Field label="Business name" htmlFor="name">
        <Input id="name" name="name" required maxLength={80} placeholder="e.g. Adunni Fabrics" autoFocus />
      </Field>
      <Field label="What kind of business?" htmlFor="businessType">
        <Select id="businessType" name="businessType" defaultValue="fashion">
          {BUSINESS_TYPES.map((b) => (
            <option key={b.value} value={b.value}>
              {b.label}
            </option>
          ))}
        </Select>
      </Field>
      <div className="grid grid-cols-[1fr_6rem] gap-3">
        <Field label="City" htmlFor="city">
          <Input id="city" name="city" maxLength={80} autoComplete="address-level2" />
        </Field>
        <Field label="Country" htmlFor="country" hint="e.g. NG">
          <Input id="country" name="country" maxLength={2} defaultValue="NG" autoComplete="country" />
        </Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Currency" htmlFor="currency">
          <Select id="currency" name="currency" defaultValue="NGN">
            {SUPPORTED_CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Time zone" htmlFor="timezone">
          <Input id="timezone" name="timezone" value={tz} onChange={(e) => setTz(e.target.value)} />
          <button type="button" className="self-start text-xs font-semibold text-accent-strong hover:underline" onClick={() => setTz(Intl.DateTimeFormat().resolvedOptions().timeZone || tz)}>
            Use my time zone
          </button>
        </Field>
        <Field label="Locale" htmlFor="locale">
          <Input id="locale" name="locale" defaultValue="en-NG" />
        </Field>
      </div>
      <fieldset>
        <legend className="text-sm font-semibold">Catalog to start with</legend>
        <input type="hidden" name="template" value={template} />
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {TEMPLATES.map((t) => (
            <button
              key={t.value}
              type="button"
              aria-pressed={template === t.value}
              onClick={() => setTemplate(t.value)}
              className={cn("rounded-xl border p-3 text-left transition-colors duration-100", template === t.value ? "border-accent bg-accent-soft" : "border-border hover:bg-surface-2")}
            >
              <span className="block text-sm font-semibold">{t.label}</span>
              <span className="block text-xs text-muted-foreground">{t.body}</span>
            </button>
          ))}
        </div>
        {template !== "none" ? <p className="mt-2 text-xs text-warning">Sample items are fictional — edit or remove them before you publish.</p> : null}
      </fieldset>
      {state.error ? (
        <p className="rounded-xl bg-danger-soft px-3 py-2 text-sm text-danger" role="alert">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" size="lg" className="w-full" loading={pending}>
        Create my business
      </Button>
    </form>
  );
}
