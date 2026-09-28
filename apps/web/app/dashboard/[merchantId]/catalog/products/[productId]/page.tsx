import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { products, productVariants } from "@nia/database";
import { fromMinorUnits } from "@nia/shared";
import { ProductForm } from "@/components/dashboard/product-form";
import { PageHeader } from "@/components/dashboard/ui";
import { requireMerchant } from "@/lib/access";
import { db } from "@/lib/server";

export const metadata: Metadata = { title: "Edit product" };

export default async function EditProduct({ params }: { params: Promise<{ merchantId: string; productId: string }> }) {
  const { merchantId, productId } = await params;
  const { merchant } = await requireMerchant(merchantId, "STAFF");
  if (!/^[0-9a-f-]{36}$/i.test(productId)) notFound();
  const [p] = await db().select().from(products).where(and(eq(products.id, productId), eq(products.merchantId, merchant.id)));
  if (!p) notFound();
  const vs = await db()
    .select()
    .from(productVariants)
    .where(and(eq(productVariants.productId, p.id), eq(productVariants.active, true)))
    .orderBy(asc(productVariants.sortOrder));
  const major = (v: number | null) => (v == null ? "" : String(fromMinorUnits(v, p.currency)));
  return (
    <>
      <PageHeader title={p.name} description={`/${p.slug}`} />
      <ProductForm
        merchantId={merchant.id}
        currency={merchant.currency}
        initial={{
          id: p.id,
          kind: p.kind,
          name: p.name,
          description: p.description ?? "",
          category: p.category ?? "",
          sku: p.sku ?? "",
          price: major(p.price),
          unit: p.unit ?? "",
          inventoryStatus: p.inventoryStatus,
          stockQuantity: p.stockQuantity == null ? "" : String(p.stockQuantity),
          tags: p.tags.join(", "),
          images: p.images.join("\n"),
          active: p.active,
          variants: vs.map((v) => ({
            id: v.id,
            name: v.name,
            options: Object.entries(v.options)
              .map(([k, val]) => `${k}=${val}`)
              .join(", "),
            price: major(v.price),
            inventoryStatus: v.inventoryStatus,
            stockQuantity: v.stockQuantity == null ? "" : String(v.stockQuantity),
            active: v.active,
          })),
        }}
      />
    </>
  );
}
