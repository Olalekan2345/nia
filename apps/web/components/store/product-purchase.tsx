"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Minus, Plus, ShoppingCart } from "lucide-react";
import { Button, buttonClasses, cn } from "@nia/ui";
import { formatMoney, INVENTORY_LABELS } from "@nia/shared";
import type { ProductCardData } from "@nia/commerce";
import { addToCartAction } from "@/app/actions/store";

export function ProductPurchase({ slug, product, locale, signedIn }: { slug: string; product: ProductCardData; locale: string; signedIn: boolean }) {
  const router = useRouter();
  const axes = useMemo(() => {
    const keys = [...new Set(product.variants.flatMap((v) => Object.keys(v.options)))];
    return keys.map((k) => ({ key: k, values: [...new Set(product.variants.map((v) => v.options[k]).filter(Boolean))] as string[] }));
  }, [product.variants]);
  const firstAvailable = product.variants.find((v) => v.available) ?? product.variants[0];
  const [selected, setSelected] = useState<Record<string, string>>(firstAvailable?.options ?? {});
  const [qty, setQty] = useState(1);
  const [pending, start] = useTransition();
  const [state, setState] = useState<{ ok?: boolean; error?: string } | null>(null);

  const variant = product.variants.find((v) => axes.every((a) => v.options[a.key] === selected[a.key])) ?? null;
  const price = variant?.price ?? product.price;
  const available = product.variants.length ? Boolean(variant?.available) : product.available;
  const status = variant?.inventoryStatus ?? product.inventoryStatus;

  return (
    <div className="space-y-5">
      <div className="flex items-baseline gap-3">
        <p className="text-2xl font-bold tabular">{price != null ? formatMoney(price, product.currency, { locale }) : "Price on request"}</p>
        {product.unit && !["piece", "item"].includes(product.unit) ? <p className="text-sm text-muted-foreground">per {product.unit}</p> : null}
      </div>
      <p className={cn("text-sm font-semibold", status === "out_of_stock" ? "text-danger" : status === "unknown" ? "text-muted-foreground" : "text-success")}>{INVENTORY_LABELS[status]}</p>

      {axes.map((axis) => (
        <fieldset key={axis.key}>
          <legend className="text-sm font-semibold capitalize">{axis.key}</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {axis.values.map((value) => {
              const exists = product.variants.some((v) => v.available && v.options[axis.key] === value && axes.every((a) => a.key === axis.key || v.options[a.key] === selected[a.key]));
              const active = selected[axis.key] === value;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setSelected((s) => ({ ...s, [axis.key]: value }))}
                  className={cn(
                    "min-h-10 rounded-xl border px-3.5 text-sm font-semibold transition-colors duration-100",
                    active ? "border-accent bg-accent-soft text-accent-strong" : "border-border bg-surface hover:bg-surface-2",
                    !exists && "text-muted-foreground line-through",
                  )}
                >
                  {value}
                  {!exists ? <span className="sr-only"> (unavailable in this combination)</span> : null}
                </button>
              );
            })}
          </div>
        </fieldset>
      ))}

      <div className="flex items-center gap-3">
        <div className="flex items-center rounded-xl border border-border">
          <button type="button" className="grid size-11 place-items-center" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease quantity">
            <Minus className="size-4" aria-hidden="true" />
          </button>
          <span className="min-w-10 text-center font-semibold tabular" aria-live="polite">
            {qty}
          </span>
          <button type="button" className="grid size-11 place-items-center" onClick={() => setQty((q) => Math.min(999, q + 1))} aria-label="Increase quantity">
            <Plus className="size-4" aria-hidden="true" />
          </button>
        </div>
        {signedIn ? (
          <Button
            size="lg"
            className="flex-1"
            disabled={!available}
            loading={pending}
            onClick={() =>
              start(async () => {
                const res = await addToCartAction(slug, { productId: product.id, variantId: variant?.id ?? null, quantity: qty });
                setState(res.ok ? { ok: true } : { error: res.error });
                router.refresh();
              })
            }
          >
            {state?.ok ? <Check className="size-5" aria-hidden="true" /> : <ShoppingCart className="size-5" aria-hidden="true" />}
            {state?.ok ? "Added to cart" : available ? "Add to cart" : "Unavailable"}
          </Button>
        ) : (
          <Link href={`/s/${slug}/signin?next=${encodeURIComponent(`/s/${slug}/shop/${product.slug}`)}`} className={buttonClasses({ size: "lg", className: "flex-1" })}>
            Sign in to order
          </Link>
        )}
      </div>
      {state?.error ? (
        <p className="text-sm text-danger" role="alert">
          {state.error}
        </p>
      ) : null}
      {state?.ok ? (
        <Link href={`/s/${slug}/orders`} className="text-sm font-semibold text-accent-strong hover:underline">
          View cart →
        </Link>
      ) : null}
    </div>
  );
}
