"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { Button, Card, CardBody, CardHeader, Field, Input, Select, Switch, Textarea } from "@nia/ui";
import { INVENTORY_LABELS, INVENTORY_STATUSES, type InventoryStatus } from "@nia/shared";
import { saveProductAction } from "@/app/actions/dashboard";
import { ImagesField } from "./images-field";

export interface ProductFormValue {
  id?: string;
  kind: "PRODUCT" | "CUSTOM_ORDER" | "PACKAGE";
  name: string;
  description: string;
  category: string;
  sku: string;
  price: string;
  unit: string;
  inventoryStatus: InventoryStatus;
  stockQuantity: string;
  tags: string;
  images: string;
  active: boolean;
  variants: { id?: string; name: string; options: string; price: string; inventoryStatus: InventoryStatus; stockQuantity: string; active: boolean }[];
}

const num = (s: string) => (s.trim() === "" ? null : Number(s));

/** "colour=Black, size=M" ⇄ { colour: "Black", size: "M" } */
function parseOptions(s: string): Record<string, string> {
  return Object.fromEntries(
    s
      .split(",")
      .map((p) => p.split("=").map((x) => x.trim()))
      .filter((kv) => kv.length === 2 && kv[0] && kv[1]) as [string, string][],
  );
}

export function ProductForm({ merchantId, initial, currency }: { merchantId: string; initial: ProductFormValue; currency: string }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof ProductFormValue>(k: K, val: ProductFormValue[K]) => setV((p) => ({ ...p, [k]: val }));

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          setError(null);
          const res = await saveProductAction(merchantId, {
            id: v.id,
            kind: v.kind,
            name: v.name,
            description: v.description || null,
            category: v.category || null,
            sku: v.sku || null,
            price: num(v.price),
            unit: v.unit || null,
            inventoryStatus: v.inventoryStatus,
            stockQuantity: num(v.stockQuantity),
            tags: v.tags.split(",").map((t) => t.trim()).filter(Boolean),
            images: v.images.split(/\s+/).map((t) => t.trim()).filter(Boolean),
            active: v.active,
            variants: v.variants.map((x) => ({ id: x.id, name: x.name, options: parseOptions(x.options), price: num(x.price), inventoryStatus: x.inventoryStatus, stockQuantity: num(x.stockQuantity), active: x.active })),
          });
          if (!res.ok) return setError(res.error);
          router.push(`/dashboard/${merchantId}/catalog`);
          router.refresh();
        });
      }}
    >
      <Card>
        <CardHeader title="Basics" />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" htmlFor="name" className="sm:col-span-2">
            <Input id="name" value={v.name} onChange={(e) => set("name", e.target.value)} required maxLength={120} />
          </Field>
          <Field label="Type" htmlFor="kind" hint="Custom orders are quoted; packages are sold as one bundle.">
            <Select id="kind" value={v.kind} onChange={(e) => set("kind", e.target.value as ProductFormValue["kind"])}>
              <option value="PRODUCT">Product</option>
              <option value="CUSTOM_ORDER">Custom order</option>
              <option value="PACKAGE">Package</option>
            </Select>
          </Field>
          <Field label="Category" htmlFor="category">
            <Input id="category" value={v.category} onChange={(e) => set("category", e.target.value)} maxLength={60} placeholder="e.g. Ankara" />
          </Field>
          <Field label="Description" htmlFor="description" className="sm:col-span-2" hint="Nia uses this to answer questions — be specific and honest.">
            <Textarea id="description" value={v.description} onChange={(e) => set("description", e.target.value)} maxLength={2000} />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Price & stock" description={`Prices in ${currency}. Leave price empty for “price on request” — Nia will never invent one.`} />
        <CardBody className="grid gap-4 sm:grid-cols-4">
          <Field label="Price" htmlFor="price">
            <Input id="price" inputMode="decimal" value={v.price} onChange={(e) => set("price", e.target.value.replace(/[^\d.]/g, ""))} placeholder="7500" />
          </Field>
          <Field label="Selling unit" htmlFor="unit" hint="yard, piece, set, jar…">
            <Input id="unit" value={v.unit} onChange={(e) => set("unit", e.target.value)} maxLength={30} />
          </Field>
          <Field label="Availability" htmlFor="inv">
            <Select id="inv" value={v.inventoryStatus} onChange={(e) => set("inventoryStatus", e.target.value as InventoryStatus)}>
              {INVENTORY_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {INVENTORY_LABELS[s]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Stock quantity" htmlFor="stock" hint="Optional">
            <Input id="stock" inputMode="numeric" value={v.stockQuantity} onChange={(e) => set("stockQuantity", e.target.value.replace(/\D/g, ""))} />
          </Field>
          <Field label="SKU" htmlFor="sku">
            <Input id="sku" value={v.sku} onChange={(e) => set("sku", e.target.value)} maxLength={60} />
          </Field>
          <Field label="Tags" htmlFor="tags" className="sm:col-span-3" hint="Comma separated — helps Nia find it (e.g. wedding, cotton)">
            <Input id="tags" value={v.tags} onChange={(e) => set("tags", e.target.value)} />
          </Field>
          <div className="sm:col-span-4">
            <p className="mb-2 text-sm font-semibold">Photos</p>
            <ImagesField merchantId={merchantId} value={v.images.split(/\s+/).filter(Boolean)} onChange={(next) => set("images", next.join("\n"))} />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Options / variants"
          description="For colours, sizes or volumes. Write options as key=value pairs, e.g. “colour=Black, size=M”."
          action={
            <Button type="button" size="sm" variant="secondary" onClick={() => set("variants", [...v.variants, { name: "", options: "", price: "", inventoryStatus: "in_stock", stockQuantity: "", active: true }])}>
              <Plus className="size-4" aria-hidden="true" /> Add option
            </Button>
          }
        />
        <CardBody>
          {v.variants.length === 0 ? (
            <p className="text-sm text-muted-foreground">No options — the product is sold as one item.</p>
          ) : (
            <ul className="space-y-3">
              {v.variants.map((x, i) => {
                const upd = (patch: Partial<typeof x>) => set("variants", v.variants.map((y, j) => (j === i ? { ...y, ...patch } : y)));
                return (
                  <li key={x.id ?? i} className="grid gap-2 rounded-xl border border-border p-3 sm:grid-cols-[1.2fr_1.6fr_0.8fr_1fr_0.7fr_auto_auto] sm:items-end">
                    <Field label="Name" htmlFor={`vn-${i}`}>
                      <Input id={`vn-${i}`} value={x.name} onChange={(e) => upd({ name: e.target.value })} placeholder="Black / M" />
                    </Field>
                    <Field label="Options" htmlFor={`vo-${i}`}>
                      <Input id={`vo-${i}`} value={x.options} onChange={(e) => upd({ options: e.target.value })} placeholder="colour=Black, size=M" />
                    </Field>
                    <Field label="Price" htmlFor={`vp-${i}`}>
                      <Input id={`vp-${i}`} inputMode="decimal" value={x.price} onChange={(e) => upd({ price: e.target.value.replace(/[^\d.]/g, "") })} placeholder="same" />
                    </Field>
                    <Field label="Availability" htmlFor={`vi-${i}`}>
                      <Select id={`vi-${i}`} value={x.inventoryStatus} onChange={(e) => upd({ inventoryStatus: e.target.value as InventoryStatus })}>
                        {INVENTORY_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {INVENTORY_LABELS[s]}
                          </option>
                        ))}
                      </Select>
                    </Field>
                    <Field label="Stock" htmlFor={`vs-${i}`}>
                      <Input id={`vs-${i}`} inputMode="numeric" value={x.stockQuantity} onChange={(e) => upd({ stockQuantity: e.target.value.replace(/\D/g, "") })} />
                    </Field>
                    <div className="flex h-11 items-center">
                      <Switch checked={x.active} onChange={(on) => upd({ active: on })} label={`Option ${x.name || i + 1} active`} />
                    </div>
                    <button type="button" onClick={() => set("variants", v.variants.filter((_, j) => j !== i))} className="grid size-11 place-items-center rounded-xl text-muted-foreground hover:bg-danger-soft hover:text-danger" aria-label={`Remove option ${x.name || i + 1}`}>
                      <Trash2 className="size-4" aria-hidden="true" />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardBody>
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
            Save product
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
