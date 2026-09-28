"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Button, Card, CardBody, CardHeader, Field, Input, Select, Switch, Textarea, cn } from "@nia/ui";
import { WEEKDAYS, type WeekdayKey } from "@nia/shared";
import { saveServiceAction } from "@/app/actions/dashboard";

export interface ServiceFormValue {
  id?: string;
  kind: "SERVICE" | "APPOINTMENT";
  name: string;
  description: string;
  category: string;
  priceMin: string;
  priceMax: string;
  durationMinutes: string;
  locationType: "in_store" | "at_customer" | "online";
  depositAmount: string;
  bookingRequirements: string;
  options: { name: string; priceDelta: string; durationDelta: string }[];
  bookable: boolean;
  days: WeekdayKey[];
  open: string;
  close: string;
  slotIntervalMinutes: string;
  capacityPerSlot: string;
  leadTimeHours: string;
  advanceDays: string;
  active: boolean;
}

const num = (s: string) => (s.trim() === "" ? null : Number(s));
const DAY_LABEL: Record<WeekdayKey, string> = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" };

export function ServiceForm({ merchantId, initial, currency }: { merchantId: string; initial: ServiceFormValue; currency: string }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof ServiceFormValue>(k: K, val: ServiceFormValue[K]) => setV((p) => ({ ...p, [k]: val }));
  const digits = (s: string) => s.replace(/[^\d.]/g, "");

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          setError(null);
          const res = await saveServiceAction(merchantId, {
            id: v.id,
            kind: v.kind,
            name: v.name,
            description: v.description || null,
            category: v.category || null,
            priceMin: num(v.priceMin),
            priceMax: num(v.priceMax),
            durationMinutes: num(v.durationMinutes),
            locationType: v.locationType,
            depositAmount: num(v.depositAmount),
            bookingRequirements: v.bookingRequirements || null,
            options: v.options.filter((o) => o.name.trim()).map((o) => ({ name: o.name, priceDelta: num(o.priceDelta), durationDelta: num(o.durationDelta) })),
            availability: v.bookable
              ? {
                  days: v.days,
                  open: v.open,
                  close: v.close,
                  slotIntervalMinutes: Number(v.slotIntervalMinutes) || 60,
                  capacityPerSlot: Number(v.capacityPerSlot) || 1,
                  leadTimeHours: Number(v.leadTimeHours) || 0,
                  advanceDays: Number(v.advanceDays) || 30,
                }
              : null,
            active: v.active,
          });
          if (!res.ok) return setError(res.error);
          router.push(`/dashboard/${merchantId}/catalog`);
          router.refresh();
        });
      }}
    >
      <Card>
        <CardHeader title="Service" />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="sname" className="sm:col-span-2">
            <Input id="sname" value={v.name} onChange={(e) => set("name", e.target.value)} required maxLength={120} />
          </Field>
          <Field label="Type" htmlFor="skind">
            <Select id="skind" value={v.kind} onChange={(e) => set("kind", e.target.value as ServiceFormValue["kind"])}>
              <option value="APPOINTMENT">Appointment (timed slot)</option>
              <option value="SERVICE">Service (drop-off / job)</option>
            </Select>
          </Field>
          <Field label="Category" htmlFor="scat">
            <Input id="scat" value={v.category} onChange={(e) => set("category", e.target.value)} maxLength={60} />
          </Field>
          <Field label="Description" htmlFor="sdesc" className="sm:col-span-2">
            <Textarea id="sdesc" value={v.description} onChange={(e) => set("description", e.target.value)} maxLength={2000} />
          </Field>
          <Field label="Where" htmlFor="sloc">
            <Select id="sloc" value={v.locationType} onChange={(e) => set("locationType", e.target.value as ServiceFormValue["locationType"])}>
              <option value="in_store">At the shop</option>
              <option value="at_customer">At the customer’s location</option>
              <option value="online">Online</option>
            </Select>
          </Field>
          <Field label="Booking requirements" htmlFor="sreq" hint="Shown before customers confirm">
            <Input id="sreq" value={v.bookingRequirements} onChange={(e) => set("bookingRequirements", e.target.value)} maxLength={500} />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Price & duration" description={`Amounts in ${currency}. Use a range when price depends on the job.`} />
        <CardBody className="grid gap-4 sm:grid-cols-4">
          <Field label="Price from" htmlFor="pmin">
            <Input id="pmin" inputMode="decimal" value={v.priceMin} onChange={(e) => set("priceMin", digits(e.target.value))} />
          </Field>
          <Field label="Price up to" htmlFor="pmax" hint="Optional">
            <Input id="pmax" inputMode="decimal" value={v.priceMax} onChange={(e) => set("priceMax", digits(e.target.value))} />
          </Field>
          <Field label="Duration (min)" htmlFor="dur">
            <Input id="dur" inputMode="numeric" value={v.durationMinutes} onChange={(e) => set("durationMinutes", e.target.value.replace(/\D/g, ""))} />
          </Field>
          <Field label="Deposit" htmlFor="dep" hint="Optional">
            <Input id="dep" inputMode="decimal" value={v.depositAmount} onChange={(e) => set("depositAmount", digits(e.target.value))} />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Add-ons"
          action={
            <Button type="button" size="sm" variant="secondary" onClick={() => set("options", [...v.options, { name: "", priceDelta: "", durationDelta: "" }])}>
              <Plus className="size-4" aria-hidden="true" /> Add
            </Button>
          }
        />
        <CardBody>
          {v.options.length === 0 ? (
            <p className="text-sm text-muted-foreground">No add-ons.</p>
          ) : (
            <ul className="space-y-2">
              {v.options.map((o, i) => {
                const upd = (patch: Partial<typeof o>) => set("options", v.options.map((y, j) => (j === i ? { ...y, ...patch } : y)));
                return (
                  <li key={i} className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr_auto] sm:items-end">
                    <Field label="Add-on" htmlFor={`on-${i}`}>
                      <Input id={`on-${i}`} value={o.name} onChange={(e) => upd({ name: e.target.value })} />
                    </Field>
                    <Field label="Extra price" htmlFor={`op-${i}`}>
                      <Input id={`op-${i}`} inputMode="decimal" value={o.priceDelta} onChange={(e) => upd({ priceDelta: digits(e.target.value) })} />
                    </Field>
                    <Field label="Extra minutes" htmlFor={`od-${i}`}>
                      <Input id={`od-${i}`} inputMode="numeric" value={o.durationDelta} onChange={(e) => upd({ durationDelta: e.target.value.replace(/\D/g, "") })} />
                    </Field>
                    <button type="button" onClick={() => set("options", v.options.filter((_, j) => j !== i))} className="grid size-11 place-items-center rounded-xl text-muted-foreground hover:bg-danger-soft hover:text-danger" aria-label="Remove add-on">
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Availability"
          description="Nia offers open slots from this schedule and never double-books beyond capacity."
          action={<Switch checked={v.bookable} onChange={(on) => set("bookable", on)} label="Bookable online" />}
        />
        {v.bookable ? (
          <CardBody className="space-y-4">
            <fieldset>
              <legend className="text-sm font-semibold">Days</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {WEEKDAYS.map((d) => {
                  const on = v.days.includes(d);
                  return (
                    <button key={d} type="button" aria-pressed={on} onClick={() => set("days", on ? v.days.filter((x) => x !== d) : [...v.days, d])} className={cn("min-h-10 min-w-12 rounded-xl border px-3 text-sm font-semibold", on ? "border-accent bg-accent-soft text-accent-strong" : "border-border")}>
                      {DAY_LABEL[d]}
                    </button>
                  );
                })}
              </div>
            </fieldset>
            <div className="grid gap-4 sm:grid-cols-6">
              <Field label="Opens" htmlFor="open">
                <Input id="open" type="time" value={v.open} onChange={(e) => set("open", e.target.value)} />
              </Field>
              <Field label="Closes" htmlFor="close">
                <Input id="close" type="time" value={v.close} onChange={(e) => set("close", e.target.value)} />
              </Field>
              <Field label="Slot every (min)" htmlFor="int">
                <Input id="int" inputMode="numeric" value={v.slotIntervalMinutes} onChange={(e) => set("slotIntervalMinutes", e.target.value.replace(/\D/g, ""))} />
              </Field>
              <Field label="Per slot" htmlFor="cap">
                <Input id="cap" inputMode="numeric" value={v.capacityPerSlot} onChange={(e) => set("capacityPerSlot", e.target.value.replace(/\D/g, ""))} />
              </Field>
              <Field label="Notice (hours)" htmlFor="lead">
                <Input id="lead" inputMode="numeric" value={v.leadTimeHours} onChange={(e) => set("leadTimeHours", e.target.value.replace(/\D/g, ""))} />
              </Field>
              <Field label="Book ahead (days)" htmlFor="adv">
                <Input id="adv" inputMode="numeric" value={v.advanceDays} onChange={(e) => set("advanceDays", e.target.value.replace(/\D/g, ""))} />
              </Field>
            </div>
          </CardBody>
        ) : (
          <CardBody className="text-sm text-muted-foreground">Customers can ask about this service; Nia won’t offer times.</CardBody>
        )}
      </Card>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-3">
          <Switch checked={v.active} onChange={(on) => set("active", on)} label="Visible to customers" />
          <span className="text-sm font-medium">Visible to customers</span>
        </div>
        <div className="ml-auto flex gap-2">
          <Button type="button" variant="ghost" onClick={() => router.back()}>
            Cancel
          </Button>
          <Button type="submit" loading={busy}>
            Save service
          </Button>
        </div>
        {error ? (
          <p className="w-full text-sm text-danger" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </form>
  );
}
