import type { Metadata } from "next";
import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { Plus } from "lucide-react";
import { Badge, buttonClasses } from "@nia/ui";
import { products, productVariants, services } from "@nia/database";
import { INVENTORY_LABELS, formatMoney, formatPriceRange } from "@nia/shared";
import { EmptyPanel, PageHeader, Table, Td } from "@/components/dashboard/ui";
import { requireMerchant } from "@/lib/access";
import { db } from "@/lib/server";

export const metadata: Metadata = { title: "Catalog" };

export default async function CatalogPage({ params }: { params: Promise<{ merchantId: string }> }) {
  const { merchantId } = await params;
  const { merchant } = await requireMerchant(merchantId);
  const base = `/dashboard/${merchant.id}/catalog`;
  const [prods, variants, svcs] = await Promise.all([
    db().select().from(products).where(eq(products.merchantId, merchant.id)).orderBy(asc(products.name)),
    db().select().from(productVariants).where(eq(productVariants.merchantId, merchant.id)),
    db().select().from(services).where(eq(services.merchantId, merchant.id)).orderBy(asc(services.name)),
  ]);
  const vcount = new Map<string, number>();
  for (const v of variants) if (v.active) vcount.set(v.productId, (vcount.get(v.productId) ?? 0) + 1);
  const money = (v: number | null) => (v == null ? "On request" : formatMoney(v, merchant.currency, { locale: merchant.locale }));

  return (
    <>
      <PageHeader
        title="Catalog"
        description="Nia only ever recommends what is listed here, at these prices and availabilities."
        actions={
          <>
            <Link href={`${base}/services/new`} className={buttonClasses({ variant: "secondary" })}>
              <Plus className="size-4" aria-hidden="true" /> Service
            </Link>
            <Link href={`${base}/products/new`} className={buttonClasses()}>
              <Plus className="size-4" aria-hidden="true" /> Product
            </Link>
          </>
        }
      />
      <section aria-labelledby="products-h" className="space-y-3">
        <h2 id="products-h" className="font-bold">
          Products ({prods.length})
        </h2>
        {prods.length === 0 ? (
          <EmptyPanel
            title="No products yet"
            body="Add what you sell — with options like colour and size — and Nia can recommend and reorder it."
            action={
              <Link href={`${base}/products/new`} className={buttonClasses()}>
                Add a product
              </Link>
            }
          />
        ) : (
          <Table head={["Product", "Type", "Price", "Options", "Availability", "Status"]}>
            {prods.map((p) => (
              <tr key={p.id} className="hover:bg-surface-2/60">
                <Td>
                  <Link href={`${base}/products/${p.id}`} className="font-medium hover:underline">
                    {p.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">{p.category ?? "—"}</p>
                </Td>
                <Td className="text-muted-foreground">{p.kind === "CUSTOM_ORDER" ? "Custom order" : p.kind === "PACKAGE" ? "Package" : "Product"}</Td>
                <Td className="tabular">
                  {money(p.price)}
                  {p.unit ? <span className="text-muted-foreground"> / {p.unit}</span> : null}
                </Td>
                <Td className="tabular">{vcount.get(p.id) ?? "—"}</Td>
                <Td>{INVENTORY_LABELS[p.inventoryStatus]}</Td>
                <Td>{p.active ? <Badge tone="success">Visible</Badge> : <Badge>Hidden</Badge>}</Td>
              </tr>
            ))}
          </Table>
        )}
      </section>
      <section aria-labelledby="services-h" className="mt-10 space-y-3">
        <h2 id="services-h" className="font-bold">
          Services ({svcs.length})
        </h2>
        {svcs.length === 0 ? (
          <EmptyPanel
            title="No services yet"
            body="Add appointments or jobs with availability and Nia can book them."
            action={
              <Link href={`${base}/services/new`} className={buttonClasses({ variant: "secondary" })}>
                Add a service
              </Link>
            }
          />
        ) : (
          <Table head={["Service", "Price", "Duration", "Bookable", "Status"]}>
            {svcs.map((s) => (
              <tr key={s.id} className="hover:bg-surface-2/60">
                <Td>
                  <Link href={`${base}/services/${s.id}`} className="font-medium hover:underline">
                    {s.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">{s.category ?? "—"}</p>
                </Td>
                <Td className="tabular">{formatPriceRange(s.priceMin, s.priceMax, s.currency, { locale: merchant.locale })}</Td>
                <Td>{s.durationMinutes ? `${s.durationMinutes} min` : "—"}</Td>
                <Td>{s.availability ? "Yes" : "No"}</Td>
                <Td>{s.active ? <Badge tone="success">Visible</Badge> : <Badge>Hidden</Badge>}</Td>
              </tr>
            ))}
          </Table>
        )}
      </section>
    </>
  );
}
