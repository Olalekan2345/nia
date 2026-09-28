import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { buttonClasses } from "@nia/ui";
import { getProduct } from "@nia/commerce";
import { ProductVisual } from "@/components/commerce/product-visual";
import { ProductPurchase } from "@/components/store/product-purchase";
import { getStorefront } from "@/lib/storefront";
import { db } from "@/lib/server";

export async function generateMetadata({ params }: { params: Promise<{ slug: string; productSlug: string }> }): Promise<Metadata> {
  const { slug, productSlug } = await params;
  const { merchant } = await getStorefront(slug);
  const product = await getProduct(db(), merchant.id, productSlug);
  return { title: product?.name ?? "Product" };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string; productSlug: string }> }) {
  const { slug, productSlug } = await params;
  const { merchant, user } = await getStorefront(slug);
  const product = await getProduct(db(), merchant.id, productSlug);
  if (!product) notFound();
  const attrs = Object.entries(product.attributes);

  return (
    <main className="mx-auto max-w-5xl px-4 pt-4 md:px-6 md:pt-8">
      <Link href={`/s/${slug}/shop`} className="inline-flex h-10 items-center gap-1.5 rounded-xl text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden="true" /> Shop
      </Link>
      <div className="mt-2 grid gap-8 md:grid-cols-2">
        <ProductVisual name={product.name} category={product.category} colours={product.variants.map((v) => v.options.colour ?? v.name)} image={product.image} rounded="rounded-3xl" />
        <div>
          {product.category ? <p className="text-sm font-semibold text-accent-strong">{product.category}</p> : null}
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-balance">{product.name}</h1>
          {product.description ? <p className="mt-3 leading-relaxed text-muted-foreground">{product.description}</p> : null}
          <div className="mt-6">
            <ProductPurchase slug={slug} product={product} locale={merchant.locale} signedIn={Boolean(user)} />
          </div>
          {attrs.length ? (
            <dl className="mt-8 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 border-t border-border pt-5 text-sm">
              {attrs.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-muted-foreground capitalize">{k}</dt>
                  <dd>{Array.isArray(v) ? v.join(", ") : v}</dd>
                </div>
              ))}
            </dl>
          ) : null}
          <Link href={`/s/${slug}/chat?q=${encodeURIComponent(`Tell me more about the ${product.name}`)}&send=1`} className={buttonClasses({ variant: "secondary", className: "mt-6" })}>
            <MessageCircle className="size-4" aria-hidden="true" /> Ask Nia about this
          </Link>
        </div>
      </div>
    </main>
  );
}
