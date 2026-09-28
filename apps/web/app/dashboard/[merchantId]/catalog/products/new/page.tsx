import type { Metadata } from "next";
import { ProductForm } from "@/components/dashboard/product-form";
import { PageHeader } from "@/components/dashboard/ui";
import { requireMerchant } from "@/lib/access";

export const metadata: Metadata = { title: "New product" };

export default async function NewProduct({ params }: { params: Promise<{ merchantId: string }> }) {
  const { merchantId } = await params;
  const { merchant } = await requireMerchant(merchantId, "STAFF");
  return (
    <>
      <PageHeader title="New product" />
      <ProductForm
        merchantId={merchant.id}
        currency={merchant.currency}
        initial={{ kind: "PRODUCT", name: "", description: "", category: "", sku: "", price: "", unit: "", inventoryStatus: "in_stock", stockQuantity: "", tags: "", images: "", active: true, variants: [] }}
      />
    </>
  );
}
