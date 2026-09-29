import type { ReactNode } from "react";
import { CalendarClock, Clock, MapPin, Store, Truck } from "lucide-react";
import { Badge, cn, type BadgeTone } from "@nia/ui";
import { formatMoney, formatPriceRange, INVENTORY_LABELS, type InventoryStatus } from "@nia/shared";
import type { BookingSummaryData, OrderSummaryData, ProductCardData, ServiceCardData } from "@nia/commerce";
import { ProductVisual, colourHex } from "./product-visual";

const AVAIL_TONE: Record<InventoryStatus, BadgeTone> = {
  in_stock: "success",
  low_stock: "warning",
  out_of_stock: "danger",
  made_to_order: "info",
  unknown: "neutral",
};

export function AvailabilityBadge({ status }: { status: InventoryStatus }) {
  return (
    <Badge tone={AVAIL_TONE[status]} dot>
      {INVENTORY_LABELS[status]}
    </Badge>
  );
}

export function productPriceLabel(p: Pick<ProductCardData, "price" | "priceMax" | "currency" | "unit">, locale: string): string {
  if (p.price == null) return "Price on request";
  const range = p.priceMax != null && p.priceMax !== p.price ? formatPriceRange(p.price, p.priceMax, p.currency, { locale }) : formatMoney(p.price, p.currency, { locale });
  return p.unit && !["piece", "item"].includes(p.unit) ? `${range} / ${p.unit}` : range;
}

/** Summarise variant options as colour swatches + sizes instead of every combination. */
function OptionSummary({ variants }: { variants: ProductCardData["variants"] }) {
  const available = variants.filter((v) => v.available);
  const colours = [...new Set(available.map((v) => v.options.colour).filter(Boolean))] as string[];
  const sizes = [...new Set(available.map((v) => v.options.size).filter(Boolean))] as string[];
  if (colours.length === 0 && sizes.length === 0) return null;
  return (
    <div className="mt-2.5 space-y-1.5">
      {colours.length ? (
        <p className="flex flex-wrap items-center gap-1.5">
          {colours.slice(0, 6).map((c) => (
            <span key={c} title={c} className="size-4 rounded-full border border-black/10" style={{ background: colourHex(c) ?? "var(--surface-2)" }}>
              <span className="sr-only">{c}</span>
            </span>
          ))}
          <span className="text-xs text-muted-foreground">
            {colours.length} colour{colours.length === 1 ? "" : "s"}
          </span>
        </p>
      ) : null}
      {sizes.length ? <p className="text-xs font-medium text-muted-foreground">Sizes {sizes.join(" · ")}</p> : null}
    </div>
  );
}

export function ProductCard({ product, locale, actions, compact = false, highlightMatched = true }: { product: ProductCardData; locale: string; actions?: ReactNode; compact?: boolean; highlightMatched?: boolean }) {
  const matched = new Set(product.matchedVariantIds ?? []);
  const colours = product.variants.map((v) => v.options.colour ?? v.name);
  const multiAxis = product.variants.some((v) => Object.keys(v.options).length > 1);
  const pool = matched.size ? product.variants.filter((v) => matched.has(v.id)) : product.variants;
  const shown = multiAxis && !matched.size ? [] : pool.slice(0, compact ? 6 : 8);
  return (
    <article className={cn("overflow-hidden rounded-3xl border border-ink-900/[0.06] bg-surface shadow-soft", compact ? "flex gap-3 p-3" : "flex flex-col")}>
      <div className={cn(compact ? "w-24 shrink-0 sm:w-28" : "")}>
        <ProductVisual name={product.name} category={product.category} colours={colours} image={product.image} rounded={compact ? "rounded-xl" : "rounded-none"} />
      </div>
      <div className={cn("flex min-w-0 flex-1 flex-col", compact ? "" : "p-4")}>
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-semibold leading-snug">{product.name}</h3>
        </div>
        <p className="mt-0.5 text-sm font-semibold tabular text-foreground">{productPriceLabel(product, locale)}</p>
        <div className="mt-1.5">
          <AvailabilityBadge status={product.inventoryStatus} />
        </div>
        {shown.length > 0 ? (
          <ul className="mt-2.5 flex flex-wrap gap-1.5" aria-label="Options">
            {shown.map((v) => (
              <li
                key={v.id}
                className={cn(
                  "rounded-lg border px-2 py-0.5 text-xs font-medium",
                  !v.available && "text-muted-foreground line-through decoration-1",
                  highlightMatched && matched.has(v.id) ? "border-accent bg-accent-soft text-accent-strong" : "border-border",
                )}
                title={v.available ? undefined : INVENTORY_LABELS[v.inventoryStatus]}
              >
                {v.name}
                {!v.available ? <span className="sr-only"> (unavailable)</span> : null}
              </li>
            ))}
            {pool.length > shown.length ? <li className="px-1 text-xs text-muted-foreground">+{pool.length - shown.length} more</li> : null}
          </ul>
        ) : multiAxis ? (
          <OptionSummary variants={product.variants} />
        ) : null}
        {actions ? <div className="mt-3 flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </article>
  );
}

export function ServiceCard({ service, locale, timeZone, actions }: { service: ServiceCardData; locale: string; timeZone: string; actions?: ReactNode }) {
  const next = service.nextAvailable
    ? new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone }).format(new Date(service.nextAvailable))
    : null;
  return (
    <article className="flex gap-3 rounded-3xl border border-ink-900/[0.06] bg-surface shadow-soft p-3">
      <div className="w-20 shrink-0 sm:w-24">
        <ProductVisual name={service.name} category={service.category} kind={service.offeringKind} image={service.image} />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="font-semibold leading-snug">{service.name}</h3>
        <p className="mt-0.5 text-sm font-semibold tabular">{formatPriceRange(service.priceMin, service.priceMax, service.currency, { locale })}</p>
        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
          {service.durationMinutes ? (
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" aria-hidden="true" /> {service.durationMinutes} min
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1">
            <CalendarClock className="size-3.5" aria-hidden="true" /> {next ? `Next: ${next}` : "Availability on request"}
          </span>
          {service.depositAmount ? <span>Deposit {formatMoney(service.depositAmount, service.currency, { locale })}</span> : null}
        </div>
        {actions ? <div className="mt-3 flex flex-wrap gap-2">{actions}</div> : null}
      </div>
    </article>
  );
}

function lineQty(i: OrderSummaryData["items"][number]) {
  return i.unit && !["piece", "item"].includes(i.unit) ? `${i.quantity} ${i.unit}${i.quantity === 1 ? "" : "s"}` : `${i.quantity} ×`;
}

export function OrderSummaryCard({ order, locale, title, actions, footer }: { order: OrderSummaryData; locale: string; title?: string; actions?: ReactNode; footer?: ReactNode }) {
  const total = order.hasUnpricedItems ? "To be confirmed" : formatMoney(order.total, order.currency, { locale });
  return (
    <article className="rounded-3xl border border-ink-900/[0.06] bg-surface shadow-soft">
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <h3 className="font-semibold">{title ?? (order.number ? `Order #${order.number}` : "Order summary")}</h3>
        <Badge tone={order.status === "draft" ? "neutral" : order.status === "cancelled" ? "danger" : order.status === "delivered" ? "success" : "accent"}>{order.statusLabel}</Badge>
      </header>
      <ul className="divide-y divide-ink-900/[0.06] px-4">
        {order.items.map((i) => (
          <li key={i.id} className="flex items-start justify-between gap-3 py-3 text-sm">
            <div className="min-w-0">
              <p className="font-medium">{i.name}</p>
              <p className="text-muted-foreground">
                {lineQty(i)}
                {i.variantLabel ? ` · ${i.variantLabel}` : ""}
              </p>
            </div>
            <p className="shrink-0 font-medium tabular">{i.lineTotal != null ? formatMoney(i.lineTotal, order.currency, { locale }) : "Quote"}</p>
          </li>
        ))}
      </ul>
      <dl className="space-y-1.5 border-t border-border px-4 py-3 text-sm">
        <div className="flex items-center justify-between gap-3">
          <dt className="inline-flex items-center gap-1.5 text-muted-foreground">
            {order.fulfillmentMethod === "pickup" ? <Store className="size-4" aria-hidden="true" /> : <Truck className="size-4" aria-hidden="true" />}
            {order.fulfillmentMethod === "pickup" ? "Pickup" : "Delivery"}
          </dt>
          <dd className="text-right font-medium">
            {order.fulfillmentMethod === "pickup" ? (
              "At the shop"
            ) : order.deliveryArea ? (
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" aria-hidden="true" />
                {order.deliveryArea}
                {order.deliveryFee != null ? <span className="text-muted-foreground tabular"> · {formatMoney(order.deliveryFee, order.currency, { locale })}</span> : <span className="text-muted-foreground"> · fee quoted</span>}
              </span>
            ) : (
              <span className="text-muted-foreground">Not chosen</span>
            )}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 pt-1">
          <dt className="font-semibold">Total</dt>
          <dd className="text-lg font-bold tabular">{total}</dd>
        </div>
      </dl>
      {order.blockers.length ? (
        <p className="mx-4 mb-3 rounded-xl bg-warning-soft px-3 py-2 text-sm text-warning">Still needed: {order.blockers.join(" · ")}</p>
      ) : null}
      {actions ? <div className="flex flex-wrap gap-2 px-4 pb-4">{actions}</div> : null}
      {footer}
    </article>
  );
}

export function BookingCard({ booking, locale, actions, title }: { booking: BookingSummaryData; locale: string; actions?: ReactNode; title?: string }) {
  const when = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: booking.timeZone }).format(new Date(booking.startAt));
  return (
    <article className="rounded-3xl border border-ink-900/[0.06] bg-surface shadow-soft p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-muted-foreground">{title ?? "Booking"}</p>
          <h3 className="mt-0.5 font-semibold">{booking.serviceName}</h3>
        </div>
        <Badge tone={booking.status === "draft" ? "neutral" : booking.status === "confirmed" ? "success" : booking.status === "cancelled" ? "danger" : "accent"}>{booking.statusLabel}</Badge>
      </div>
      <p className="mt-2 inline-flex items-center gap-1.5 text-sm">
        <CalendarClock className="size-4 text-accent-strong" aria-hidden="true" /> {when}
      </p>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
        <div>
          <dt className="text-muted-foreground">Price</dt>
          <dd className="font-medium tabular">{booking.price != null ? formatMoney(booking.price, booking.currency, { locale }) : "Quoted at appointment"}</dd>
        </div>
        {booking.depositAmount ? (
          <div>
            <dt className="text-muted-foreground">Deposit</dt>
            <dd className="font-medium tabular">{formatMoney(booking.depositAmount, booking.currency, { locale })}</dd>
          </div>
        ) : null}
        {booking.selectedOptions.length ? (
          <div className="col-span-2">
            <dt className="text-muted-foreground">Options</dt>
            <dd>{booking.selectedOptions.join(", ")}</dd>
          </div>
        ) : null}
      </dl>
      {actions ? <div className="mt-4 flex flex-wrap gap-2">{actions}</div> : null}
    </article>
  );
}
