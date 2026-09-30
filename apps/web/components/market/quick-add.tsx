"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ShoppingCart } from "lucide-react";
import { Button, buttonClasses, cn } from "@nia/ui";
import { addToCartAction } from "@/app/actions/store";

/**
 * Add from any shop straight into the one cart. Items with options (size,
 * colour, storage) open their page to choose; the server re-checks the product
 * belongs to that shop and adds it for the signed-in shopper.
 */
export function QuickAdd({ shopSlug, productId, url, hasOptions, available, signedIn, className }: { shopSlug: string; productId: string; url: string; hasOptions: boolean; available: boolean; signedIn: boolean; className?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [state, setState] = useState<"idle" | "added" | "error">("idle");
  if (!available) return null;
  const cls = cn("flex-1 justify-center", className);
  if (!signedIn) {
    return (
      <Link href={`/market/signin?next=${encodeURIComponent(url)}`} className={buttonClasses({ size: "sm", className: cls })}>
        <ShoppingCart className="size-4" aria-hidden="true" /> Add
      </Link>
    );
  }
  if (hasOptions) {
    return (
      <Link href={url} className={buttonClasses({ size: "sm", className: cls })}>
        Choose options
      </Link>
    );
  }
  if (state === "added") {
    return (
      <Link href="/market/cart" className={buttonClasses({ size: "sm", variant: "secondary", className: cls })}>
        <Check className="size-4 text-success" aria-hidden="true" /> In cart
      </Link>
    );
  }
  return (
    <Button
      size="sm"
      className={cls}
      loading={pending}
      onClick={() =>
        start(async () => {
          const res = await addToCartAction(shopSlug, { productId, quantity: 1 });
          setState(res.ok ? "added" : "error");
          router.refresh();
        })
      }
      aria-label={state === "error" ? "Couldn't add — try again" : undefined}
    >
      <ShoppingCart className="size-4" aria-hidden="true" /> {state === "error" ? "Try again" : "Add"}
    </Button>
  );
}
