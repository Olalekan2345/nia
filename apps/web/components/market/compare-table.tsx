import Link from "next/link";
import { Check, Minus } from "lucide-react";
import { buttonClasses } from "@nia/ui";
import type { InventoryStatus } from "@nia/shared";
import type { MarketProduct } from "@nia/commerce";
import { AvailabilityBadge, productPriceLabel } from "@/components/commerce/cards";
import { ProductVisual } from "@/components/commerce/product-visual";
import type { MarketCardProduct } from "./market-card";

export interface CompareProduct extends MarketCardProduct {
  variants: { name: string; available: boolean }[];
  delivery: boolean;
  pickup: boolean;
  deliveryAreas: string[];
}

export function toCompareProduct(p: MarketProduct): CompareProduct {
  return {
    id: p.id,
    name: p.name,
    image: p.image,
    category: p.category,
    price: p.price,
    priceMax: p.priceMax,
    currency: p.currency,
    unit: p.unit,
    inventoryStatus: p.inventoryStatus,
    url: p.url,
    shop: { name: p.shop.name, slug: p.shop.slug, label: p.shop.businessLabel, city: p.shop.city, demo: p.shop.isDemo },
    variants: p.variants.map((v) => ({ name: v.name, available: v.available })),
    delivery: p.shop.delivery,
    pickup: p.shop.pickup,
    deliveryAreas: p.shop.deliveryAreas.map((a) => a.name),
  };
}

function Yes({ on }: { on: boolean }) {
  return on ? (
    <span className="inline-flex items-center gap-1 text-success">
      <Check className="size-4" aria-hidden="true" /> Yes
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-muted-foreground">
      <Minus className="size-4" aria-hidden="true" /> No
    </span>
  );
}

/** One spec row from the catalog: a value per product (null = not listed). */
export interface CompareSpecRow {
  label: string;
  values: (string | null)[];
  differs: boolean;
}

/** Side-by-side comparison; scrolls sideways on small screens. Spec rows come from real catalog attributes. */
export function CompareTable({ products, locale, specs = [] }: { products: CompareProduct[]; locale: string; specs?: CompareSpecRow[] }) {
  const specRows = specs.map((s) => ({
    label: s.label,
    differs: s.differs,
    cell: (_p: CompareProduct, i: number) => (s.values[i] != null ? <span className="text-sm">{s.values[i]}</span> : <span className="text-sm text-muted-foreground">Not listed</span>),
  }));
  const rows: { label: string; differs?: boolean; cell: (p: CompareProduct, i: number) => React.ReactNode }[] = [
    { label: "Price", cell: (p) => <span className="font-bold tabular">{productPriceLabel(p, locale)}</span> },
    { label: "Stock", cell: (p) => <AvailabilityBadge status={p.inventoryStatus as InventoryStatus} /> },
    ...specRows,
    { label: "Shop", cell: (p) => `${p.shop.name}${p.shop.city ? ` · ${p.shop.city}` : ""}` },
    {
      label: "Options",
      cell: (p) =>
        p.variants.length ? (
          <span className="text-sm">
            {p.variants
              .filter((v) => v.available)
              .slice(0, 6)
              .map((v) => v.name)
              .join(", ") || "None available"}
          </span>
        ) : (
          "One option"
        ),
    },
    { label: "Delivery", cell: (p) => (p.delivery ? (p.deliveryAreas.length ? p.deliveryAreas.slice(0, 5).join(", ") : "Yes") : <Yes on={false} />) },
    { label: "Pickup", cell: (p) => <Yes on={p.pickup} /> },
  ];
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <table className="w-full min-w-[520px] border-separate border-spacing-0 text-left text-sm">
        <thead>
          <tr>
            <th scope="col" className="w-28 p-2 align-bottom text-xs font-semibold text-muted-foreground">
              <span className="sr-only">Product</span>
            </th>
            {products.map((p) => (
              <th key={p.id} scope="col" className="p-2 align-top font-normal">
                <Link href={p.url} className="block">
                  <ProductVisual name={p.name} category={p.category} image={p.image} className="max-w-40" />
                  <span className="mt-2 block font-semibold leading-snug hover:underline">{p.name}</span>
                </Link>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <th scope="row" className="border-t border-border p-2 text-xs font-semibold text-muted-foreground">
                {r.label}
                {r.differs ? <span className="ml-1.5 inline-block size-1.5 rounded-full bg-accent align-middle" title="Differs" aria-label="(differs)" /> : null}
              </th>
              {products.map((p, i) => (
                <td key={p.id} className="border-t border-border p-2 align-top">
                  {r.cell(p, i)}
                </td>
              ))}
            </tr>
          ))}
          <tr>
            <td className="p-2" />
            {products.map((p) => (
              <td key={p.id} className="p-2">
                <Link href={p.url} className={buttonClasses({ size: "sm", variant: "secondary" })}>
                  View at {p.shop.name}
                </Link>
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
