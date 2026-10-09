"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarCheck, Check, ExternalLink, Loader2, Minus, PackageCheck, Plus, Search, ShoppingCart } from "lucide-react";
import { Button, Select, buttonClasses, cn } from "@nia/ui";
import { DEMO_PAYMENT_NOTE, formatMoney, formatPriceRange, namedProduct, orderProgress, type InventoryStatus } from "@nia/shared";
import type { BookingSummaryData, OrderSummaryData, PaymentStart, ProductCardData, ServiceCardData, SlotData } from "@nia/commerce";
import type { MemoryReceiptView } from "@nia/ai";
import { BookingCard, OrderSummaryCard, ProductCard, ServiceCard, productPriceLabel } from "@/components/commerce/cards";
import { bookingOutcome, CheckoutCelebration, orderOutcome, withMinimumWait } from "@/components/commerce/checkout-celebration";
import { ProductVisual } from "@/components/commerce/product-visual";
import { CompareToggle } from "@/components/market/compare-controls";
import { MarketProductCard } from "@/components/market/market-card";
import { CompareTable, type CompareProduct } from "@/components/market/compare-table";
import { ReceiptList } from "./memory-parts";
import { useReceiptPoll } from "./use-receipt-poll";
import { Alternatives, BasketCard, MemoryProfileCard, SavedNote, ShoppingListCard, WhyLine, type AlternativeView, type BasketView, type MemoryProfileView } from "./agent-parts";

export interface ChatActions {
  slug: string;
  /** Sign-in page for this chat (a shop's, or Walrus Market's). */
  signInHref: string;
  /** Where the customer reviews and corrects their memory (Memory Passport / market profile). */
  profileHref: string;
  shopName: string;
  locale: string;
  timeZone: string;
  signedIn: boolean;
  busy: boolean;
  send: (text: string) => void;
  addToCart: (productId: string, variantId: string | null, quantity: number) => Promise<{ ok: boolean; error?: string }>;
  /** Add to a specific shop's cart (baskets and alternatives can span shops in Walrus Market). */
  addToShopCart: (shopSlug: string, productId: string, variantId: string | null, quantity: number) => Promise<{ ok: boolean; error?: string }>;
  confirmOrder: (orderId: string) => Promise<{ ok: true; summary: OrderSummaryData; payment: PaymentStart | null; receipt: MemoryReceiptView | null } | { ok: false; error: string }>;
  confirmBooking: (bookingId: string) => Promise<{ ok: true; booking: BookingSummaryData; receipt: MemoryReceiptView | null } | { ok: false; error: string }>;
  cancelBooking: (bookingId: string) => Promise<{ ok: boolean; error?: string }>;
}

export interface ToolPart {
  type: string;
  toolCallId: string;
  state: "input-streaming" | "input-available" | "output-available" | "output-error" | string;
  input?: Record<string, unknown>;
  output?: Record<string, unknown> & { ok?: boolean; code?: string; error?: string };
  errorText?: string;
}

const PENDING_LABEL: Record<string, string> = {
  searchProducts: "Searching the catalog",
  getProduct: "Checking the product",
  searchServices: "Looking at services",
  getService: "Checking the service",
  getCustomerRecentOrders: "Looking up your orders",
  getOrder: "Finding your order",
  createDraftOrder: "Preparing your cart",
  addItemToDraft: "Adding to your cart",
  updateDraftItem: "Updating your cart",
  removeDraftItem: "Updating your cart",
  setFulfillment: "Setting delivery",
  showOrderSummary: "Preparing your order summary",
  getAvailableBookingSlots: "Checking available times",
  createBookingDraft: "Preparing your booking",
  getMerchantPolicy: "Checking the shop’s policies",
  recallCustomerMemory: "Recalling from memory",
  recallMerchantMemory: "Checking the shop’s notes",
  forgetCustomerMemory: "Forgetting that",
  searchMarket: "Searching Walrus Market",
  searchMarketServices: "Looking at services across shops",
  compareProducts: "Comparing",
  askDecision: "Thinking of a question",
  planBasket: "Building your basket",
  showMyMemory: "Checking what I remember",
  saveForLater: "Saving those",
  updateShoppingList: "Updating your list",
};

export function ToolStatus({ name }: { name: string }) {
  return (
    <p className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground" aria-live="polite">
      {name === "searchProducts" || name === "searchServices" || name === "searchMarket" || name === "searchMarketServices" ? <Search className="size-3.5" aria-hidden="true" /> : <Loader2 className="size-3.5 motion-safe:animate-spin" aria-hidden="true" />}
      {PENDING_LABEL[name] ?? "Working"}…
    </p>
  );
}

/* ─────────────────────────────── Products ─────────────────────────────── */

function AddToCart({ product, actions }: { product: ProductCardData; actions: ChatActions }) {
  const purchasable = product.variants.filter((v) => v.available);
  const preferred = product.matchedVariantIds?.find((id) => purchasable.some((v) => v.id === id)) ?? purchasable[0]?.id ?? null;
  const [open, setOpen] = useState(false);
  const [variant, setVariant] = useState<string | null>(preferred);
  const [qty, setQty] = useState(1);
  const [state, setState] = useState<"idle" | "saving" | "done">("idle");
  const [error, setError] = useState<string | null>(null);
  const hasVariants = product.variants.length > 0;
  if (!product.available || (hasVariants && purchasable.length === 0)) return null;

  if (!actions.signedIn) {
    return (
      <Link href={actions.signInHref} className={buttonClasses({ size: "sm" })}>
        Sign in to add
      </Link>
    );
  }
  if (state === "done") {
    return (
      <span className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-success-soft px-3 text-sm font-semibold text-success">
        <Check className="size-4" aria-hidden="true" /> Added
      </span>
    );
  }
  if (!open) {
    return (
      <Button size="sm" onClick={() => setOpen(true)}>
        <ShoppingCart className="size-4" aria-hidden="true" /> Add
      </Button>
    );
  }
  return (
    <div className="flex w-full flex-wrap items-center gap-2">
      {hasVariants ? (
        <Select aria-label="Option" value={variant ?? ""} onChange={(e) => setVariant(e.target.value)} className="h-9 min-w-0 flex-1 text-sm">
          {purchasable.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
              {v.price != null && v.price !== product.price ? ` — ${formatMoney(v.price, product.currency, { locale: actions.locale })}` : ""}
            </option>
          ))}
        </Select>
      ) : null}
      <div className="flex items-center rounded-xl border border-border">
        <button type="button" className="grid size-9 place-items-center" onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease quantity">
          <Minus className="size-4" aria-hidden="true" />
        </button>
        <span className="min-w-8 text-center text-sm font-semibold tabular" aria-live="polite">
          {qty}
          <span className="sr-only"> {product.unit ?? "units"}</span>
        </span>
        <button type="button" className="grid size-9 place-items-center" onClick={() => setQty((q) => Math.min(999, q + 1))} aria-label="Increase quantity">
          <Plus className="size-4" aria-hidden="true" />
        </button>
      </div>
      <Button
        size="sm"
        loading={state === "saving"}
        onClick={async () => {
          setState("saving");
          setError(null);
          const res = await actions.addToCart(product.id, hasVariants ? variant : null, qty);
          if (res.ok) setState("done");
          else {
            setState("idle");
            setError(res.error ?? "Couldn’t add that");
          }
        }}
      >
        Add{product.unit && !["piece", "item"].includes(product.unit) ? ` ${qty} ${product.unit}${qty === 1 ? "" : "s"}` : ""}
      </Button>
      {error ? (
        <p className="w-full text-xs text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function ProductResults({ products, actions }: { products: ProductCardData[]; actions: ChatActions }) {
  if (products.length === 0) return null;
  return (
    <ul className="space-y-2.5">
      {products.slice(0, 4).map((p) => (
        <li key={p.id} className="nia-enter">
          <ProductCard
            product={p}
            locale={actions.locale}
            compact
            actions={
              <>
                <WhyLine why={(p as ProductCardData & { why?: string[] }).why} />
                <AddToCart product={p} actions={actions} />
                <Link href={`/s/${actions.slug}/shop/${p.slug}`} className={buttonClasses({ variant: "secondary", size: "sm" })}>
                  View
                </Link>
                <Button size="sm" variant="ghost" disabled={actions.busy} onClick={() => actions.send(`Tell me more about the ${p.name}`)}>
                  Ask Nia
                </Button>
              </>
            }
          />
        </li>
      ))}
    </ul>
  );
}

interface SimilarItem {
  id: string;
  name: string;
  category: string | null;
  image: string | null;
  price: string;
  href: string;
  /** What tapping the tile asks Nia. */
  ask: string;
  shop?: string;
}

/**
 * When the customer asked about one product, the others found alongside it are
 * only suggestions: a small row under the main card, never cards of their own.
 */
function SimilarItems({ items, actions }: { items: SimilarItem[]; actions: ChatActions }) {
  if (items.length === 0) return null;
  return (
    <section aria-label="Similar items" className="rounded-3xl border border-ink-900/[0.06] bg-surface/70 p-3">
      <p className="px-1 text-xs font-semibold text-muted-foreground">Not quite right? Similar items</p>
      <ul className="mt-2 flex gap-2 overflow-x-auto pb-1">
        {items.slice(0, 4).map((i) => (
          <li key={i.id} className="flex w-32 shrink-0 flex-col gap-1">
            <button
              type="button"
              disabled={actions.busy}
              onClick={() => actions.send(i.ask)}
              aria-label={`Ask Nia about ${i.name}`}
              className="flex w-full flex-col gap-1.5 rounded-2xl p-1.5 text-left transition-colors duration-100 hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-60"
            >
              <ProductVisual name={i.name} category={i.category} image={i.image} className="w-full" />
              <span className="line-clamp-2 text-xs leading-snug font-semibold">{i.name}</span>
              <span className="text-xs text-muted-foreground tabular">{i.price}</span>
              {i.shop ? <span className="truncate text-[11px] text-muted-foreground">{i.shop}</span> : null}
            </button>
            <Link href={i.href} className="px-1.5 text-xs font-semibold text-accent-strong hover:underline">
              View
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

const ok = (p: ToolPart) => p.state === "output-available" && p.output && p.output.ok !== false;
const uniqueById = <T extends { id: string }>(list: T[]) => list.filter((x, i) => list.findIndex((y) => y.id === x.id) === i);

/* ─────────────────────────────── Services & booking ─────────────────────────────── */

function ServiceResults({ services, actions }: { services: ServiceCardData[]; actions: ChatActions }) {
  return (
    <ul className="space-y-2.5">
      {services.slice(0, 4).map((s) => (
        <li key={s.id} className="nia-enter">
          <ServiceCard
            service={s}
            locale={actions.locale}
            timeZone={actions.timeZone}
            actions={
              <Button size="sm" disabled={actions.busy} onClick={() => actions.send(`I'd like to book ${s.name}. What times are available?`)}>
                <CalendarCheck className="size-4" aria-hidden="true" /> Book
              </Button>
            }
          />
        </li>
      ))}
    </ul>
  );
}

function SlotPicker({ service, slots, actions }: { service: string; slots: SlotData[]; actions: ChatActions }) {
  if (slots.length === 0) return <p className="text-sm text-muted-foreground">No open times in that window.</p>;
  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground">Open times · {service}</p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {slots.slice(0, 8).map((s) => (
          <li key={s.startAt}>
            <button
              type="button"
              disabled={actions.busy}
              onClick={() => actions.send(`Please book ${service} for ${s.label} (start ${s.startAt}).`)}
              className="min-h-10 rounded-2xl border border-ink-900/[0.06] bg-surface px-3 py-2 text-sm font-semibold transition-colors duration-100 hover:border-accent hover:bg-accent-soft disabled:opacity-50"
            >
              {s.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BookingDraft({ booking, actions }: { booking: BookingSummaryData; actions: ChatActions }) {
  const [current, setCurrent] = useState(booking);
  const [state, setState] = useState<"idle" | "saving" | "done" | "cancelled">(booking.status === "draft" ? "idle" : "done");
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<MemoryReceiptView | null>(null);
  const [popup, setPopup] = useState<"confirming" | "done" | null>(null);
  const receipts = useReceiptPoll(actions.slug, receipt ? [receipt] : []);
  const confirmed = current.status === "confirmed";
  if (state === "cancelled") return <p className="text-sm text-muted-foreground">Booking proposal withdrawn.</p>;
  return (
    <div className="space-y-2">
      <BookingCard
        booking={current}
        locale={actions.locale}
        title={state === "done" ? (confirmed ? "Booking confirmed" : "Booking requested") : "Please confirm"}
        actions={
          state === "done" ? null : (
            <>
              <Button
                size="sm"
                loading={state === "saving"}
                onClick={async () => {
                  setState("saving");
                  setError(null);
                  setPopup("confirming");
                  const res = await withMinimumWait(actions.confirmBooking(current.id));
                  if (res.ok) {
                    setCurrent(res.booking);
                    setReceipt(res.receipt);
                    setState("done");
                    setPopup("done");
                  } else {
                    setPopup(null);
                    setError(res.error);
                    setState("idle");
                  }
                }}
              >
                Confirm booking
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={async () => {
                  await actions.cancelBooking(current.id);
                  setState("cancelled");
                  actions.send("I'd like a different time.");
                }}
              >
                Change time
              </Button>
            </>
          )
        }
      />
      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
      {popup ? (
        <CheckoutCelebration
          kind="booking"
          phase={popup}
          demo={confirmed}
          shops={[actions.shopName]}
          outcomes={popup === "done" ? [bookingOutcome(current, { slug: actions.slug, name: actions.shopName }, receipt, actions.locale)] : []}
          onClose={() => setPopup(null)}
        />
      ) : null}
      {state === "done" ? (
        <p className="text-sm text-muted-foreground">{confirmed ? "You're booked in — see it under Orders." : "The shop will confirm your appointment. You can see it under Orders."}</p>
      ) : null}
      {receipts.length ? <ReceiptList receipts={receipts} compact /> : null}
    </div>
  );
}

/* ─────────────────────────────── Cart & order ─────────────────────────────── */

function OrderConfirm({ summary, actions }: { summary: OrderSummaryData; actions: ChatActions }) {
  const [order, setOrder] = useState(summary);
  const [state, setState] = useState<"idle" | "saving" | "done">(summary.status === "draft" ? "idle" : "done");
  const [payment, setPayment] = useState<PaymentStart | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<MemoryReceiptView | null>(null);
  const [popup, setPopup] = useState<"confirming" | "done" | null>(null);
  const receipts = useReceiptPoll(actions.slug, receipt ? [receipt] : []);
  const demo = order.checkout === "demo";
  const paid = order.paymentMode === "demo" && order.paymentStatus === "paid";
  const progress = order.status !== "draft" ? orderProgress(order) : null;
  const shop = { slug: actions.slug, name: actions.shopName };
  return (
    <div className="space-y-2">
      <OrderSummaryCard
        order={order}
        locale={actions.locale}
        title={state === "done" ? `Order #${order.number} ${paid ? "paid" : "placed"}` : "Order summary"}
        actions={
          state === "done" ? null : (
            <>
              <Button
                loading={state === "saving"}
                disabled={order.blockers.length > 0}
                onClick={async () => {
                  setState("saving");
                  setError(null);
                  if (demo) setPopup("confirming");
                  const res = demo ? await withMinimumWait(actions.confirmOrder(order.id)) : await actions.confirmOrder(order.id);
                  if (res.ok) {
                    setOrder(res.summary);
                    setPayment(res.payment);
                    setReceipt(res.receipt);
                    setState("done");
                    if (demo) setPopup("done");
                  } else {
                    setPopup(null);
                    setError(res.error);
                    setState("idle");
                  }
                }}
              >
                <PackageCheck className="size-4" aria-hidden="true" />{" "}
                {demo ? `Pay ${formatMoney(order.total, order.currency, { locale: actions.locale })} (demo)` : "Confirm order"}
              </Button>
              <Button variant="secondary" disabled={actions.busy} onClick={() => actions.send("I'd like to change something in my order.")}>
                Edit
              </Button>
            </>
          )
        }
      />
      {demo && state !== "done" ? <p className="px-1 text-xs text-muted-foreground">{DEMO_PAYMENT_NOTE}</p> : null}
      {popup ? (
        <CheckoutCelebration
          kind="order"
          phase={popup}
          demo
          shops={[actions.shopName]}
          outcomes={popup === "done" ? [orderOutcome(order, shop, receipt)] : []}
          onClose={() => setPopup(null)}
        />
      ) : null}
      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
      {state === "done" && paid && progress ? (
        <div className="rounded-3xl border border-success/20 bg-success-soft p-3 text-sm" role="status">
          <p className="font-semibold text-success">{progress.headline}</p>
          {progress.detail ? <p className="mt-1">{progress.detail}</p> : null}
          <p className="mt-1 text-xs text-muted-foreground">{payment?.instructions ?? DEMO_PAYMENT_NOTE}</p>
        </div>
      ) : state === "done" ? (
        <div className="rounded-3xl border border-ink-900/[0.06] bg-surface shadow-soft-2 p-3 text-sm">
          <p className="font-semibold">What happens next</p>
          <p className="mt-1 text-muted-foreground">{payment?.instructions ?? "The shop will confirm availability and how to pay."}</p>
          {payment?.url ? (
            <a href={payment.url} target="_blank" rel="noopener noreferrer" className={buttonClasses({ size: "sm", className: "mt-2" })}>
              Pay securely <ExternalLink className="size-3.5" aria-hidden="true" />
            </a>
          ) : null}
        </div>
      ) : null}
      {receipts.length ? <ReceiptList receipts={receipts.map((r) => ({ ...r, label: r.status === "stored" ? `Added to your order history · ${r.label}` : r.label }))} compact /> : null}
    </div>
  );
}

function CartStrip({ cart, actions }: { cart: OrderSummaryData; actions: ChatActions }) {
  const count = cart.items.length;
  return (
    <div className="flex items-center gap-3 rounded-3xl border border-ink-900/[0.06] bg-surface shadow-soft px-3 py-2.5">
      <span className="grid size-9 place-items-center rounded-xl bg-accent-soft text-accent-strong">
        <ShoppingCart className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold">
          Cart · {count} item{count === 1 ? "" : "s"}
        </p>
        <p className="truncate text-muted-foreground">
          {cart.items.map((i) => `${i.quantity} × ${i.name}${i.variantLabel ? ` (${i.variantLabel})` : ""}`).join(", ")}
        </p>
      </div>
      <Link href={`/s/${actions.slug}/orders`} className="text-sm font-semibold text-accent-strong hover:underline">
        View
      </Link>
    </div>
  );
}

function RepeatChoices({ order, actions }: { order: OrderSummaryData; actions: ChatActions }) {
  const first = order.items[0];
  return (
    <div className="rounded-3xl border border-ink-900/[0.06] bg-surface shadow-soft p-3">
      <p className="text-xs font-semibold text-muted-foreground">Your last order · #{order.number}</p>
      <p className="mt-1 text-sm font-semibold">
        {first ? `${first.quantity}${first.unit && !["piece", "item"].includes(first.unit) ? ` ${first.unit}${first.quantity === 1 ? "" : "s"}` : " ×"} ${first.name}${first.variantLabel ? ` — ${first.variantLabel}` : ""}` : "—"}
        {order.items.length > 1 ? ` + ${order.items.length - 1} more` : ""}
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" disabled={actions.busy} onClick={() => actions.send(`Yes — repeat order #${order.number} with the same quantity.`)}>
          Same quantity
        </Button>
        <Button size="sm" variant="secondary" disabled={actions.busy} onClick={() => actions.send(`Repeat order #${order.number}, but I'd like to change the quantity.`)}>
          Change quantity
        </Button>
        <Button size="sm" variant="ghost" disabled={actions.busy} onClick={() => actions.send("Show me options similar to my last order.")}>
          View similar options
        </Button>
      </div>
    </div>
  );
}

function SignInPrompt({ actions }: { actions: ChatActions }) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-ink-900/[0.06] bg-surface shadow-soft p-3">
      <p className="min-w-0 flex-1 text-sm">Sign in to use a cart, place orders or book — and so Nia can remember you.</p>
      <Link href={actions.signInHref} className={buttonClasses({ size: "sm" })}>
        Sign in
      </Link>
    </div>
  );
}

/* ─────────────────────────────── Walrus Market ─────────────────────────────── */

interface MarketToolProduct {
  id: string;
  name: string;
  image: string | null;
  category: string | null;
  price: number | null;
  priceMax: number | null;
  currency: string;
  unit: string | null;
  inventoryStatus: InventoryStatus;
  url: string;
  options?: string[];
  why?: string[];
  shop: { name: string; slug?: string; type: string; city: string | null; demo: boolean; delivery?: boolean; pickup?: boolean; deliveryAreas?: string[] };
}

function fromMarketTool(p: MarketToolProduct): CompareProduct {
  return {
    ...p,
    shop: { name: p.shop.name, slug: p.shop.slug ?? p.url.split("/")[2] ?? "", label: p.shop.type, city: p.shop.city, demo: p.shop.demo },
    variants: (p.options ?? []).map((name) => ({ name, available: true })),
    delivery: Boolean(p.shop.delivery),
    pickup: Boolean(p.shop.pickup),
    deliveryAreas: p.shop.deliveryAreas ?? [],
  };
}

function MarketResults({ products, actions }: { products: MarketToolProduct[]; actions: ChatActions }) {
  if (products.length === 0) return null;
  return (
    <ul className="space-y-2.5">
      {products.slice(0, 4).map((raw) => {
        const p = fromMarketTool(raw);
        return (
          <li key={p.id} className="nia-enter">
            <MarketProductCard
              product={p}
              locale={actions.locale}
              layout="row"
              actions={
                <>
                  <WhyLine why={raw.why} />
                  <Link href={p.url} className={buttonClasses({ size: "sm" })}>
                    View at {p.shop.name}
                  </Link>
                  <CompareToggle productId={p.id} />
                  <Button size="sm" variant="ghost" disabled={actions.busy} onClick={() => actions.send(`Tell me more about the ${p.name} from ${p.shop.name}`)}>
                    Ask Nia
                  </Button>
                </>
              }
            />
          </li>
        );
      })}
    </ul>
  );
}

interface MarketToolService {
  id: string;
  name: string;
  category: string | null;
  priceMin: number | null;
  priceMax: number | null;
  currency: string;
  durationMinutes: number | null;
  nextAvailable: string | null;
  image?: string | null;
  url: string;
  shop: { name: string; city: string | null };
}

type AccountOrder = OrderSummaryData & { shop: { name: string; slug: string } };

/** "What did I buy last?" in Walrus Market: the shopper's real orders, newest first, from every shop. */
function MyOrders({ orders, actions }: { orders: AccountOrder[]; actions: ChatActions }) {
  if (orders.length === 0) return null;
  return (
    <ul className="space-y-2.5" aria-label="Your recent orders">
      {orders.slice(0, 3).map((o) => {
        const p = orderProgress(o);
        const first = o.items[0];
        const more = o.items.length > 1 ? ` + ${o.items.length - 1} more` : "";
        const when = o.submittedAt ? new Intl.DateTimeFormat(actions.locale, { day: "numeric", month: "short", timeZone: actions.timeZone }).format(new Date(o.submittedAt)) : null;
        return (
          <li key={o.id} className="nia-enter rounded-3xl border border-ink-900/[0.06] bg-surface p-3.5 shadow-soft">
            <p className="text-xs font-semibold text-muted-foreground">
              {o.shop.name} · Order #{o.number}
              {when ? ` · ${when}` : ""}
            </p>
            <p className="mt-1 text-sm font-semibold">{first ? `${first.quantity} × ${first.name}${first.variantLabel ? ` (${first.variantLabel})` : ""}${more}` : "—"}</p>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
              <span className="rounded-full bg-surface-2 px-2 py-0.5 font-semibold">{p.headline}</span>
              {o.paymentStatus === "paid" ? <span className="rounded-full bg-success-soft px-2 py-0.5 font-semibold text-success">{o.paymentMode === "demo" ? "Paid (demo)" : "Paid"}</span> : null}
              <span className="ml-auto font-semibold tabular">{o.hasUnpricedItems ? "Quote" : formatMoney(o.total, o.currency, { locale: actions.locale })}</span>
            </div>
            {p.detail ? <p className="mt-1 text-xs text-muted-foreground">{p.detail}</p> : null}
            <div className="mt-2.5 flex flex-wrap gap-2">
              <Link href={`/s/${o.shop.slug}/orders`} className={buttonClasses({ size: "sm", variant: "secondary" })}>
                View order
              </Link>
              <Link href={`/s/${o.shop.slug}/chat?q=${encodeURIComponent(`Same as my order #${o.number}, please`)}&send=1`} className={buttonClasses({ size: "sm", variant: "ghost" })}>
                Order again
              </Link>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function MarketServiceResults({ services, actions }: { services: MarketToolService[]; actions: ChatActions }) {
  if (services.length === 0) return null;
  return (
    <ul className="space-y-2.5">
      {services.slice(0, 4).map((s) => (
        <li key={s.id} className="nia-enter flex gap-3 rounded-3xl border border-ink-900/[0.06] bg-surface shadow-soft p-3">
          <div className="w-20 shrink-0 sm:w-24">
            <ProductVisual name={s.name} category={s.category} image={s.image ?? null} kind="SERVICE" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-muted-foreground">
              {s.shop.name}
              {s.shop.city ? ` · ${s.shop.city}` : ""}
            </p>
            <h3 className="mt-0.5 font-semibold leading-snug">{s.name}</h3>
            <p className="mt-0.5 text-sm font-bold tabular">
              {s.priceMin == null && s.priceMax == null ? "Price on consultation" : formatPriceRange(s.priceMin, s.priceMax, s.currency, { locale: actions.locale })}
              {s.durationMinutes ? <span className="font-normal text-muted-foreground"> · {s.durationMinutes} min</span> : null}
            </p>
            <div className="mt-2.5">
              <Link href={s.url} className={buttonClasses({ size: "sm" })}>
                Book at {s.shop.name}
              </Link>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

type SpecRow = { label: string; values: (string | null)[]; differs: boolean };

/** A shop's own product as a comparison column (same shop for every column). */
function fromShopProduct(p: ProductCardData, actions: ChatActions): CompareProduct {
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
    url: `/s/${actions.slug}/shop/${p.slug}`,
    shop: { name: actions.shopName, slug: actions.slug, label: "", city: null, demo: false },
    variants: p.variants.map((v) => ({ name: v.name, available: v.available })),
    delivery: false,
    pickup: false,
    deliveryAreas: [],
  };
}

function CompareResult({ products, specs, actions }: { products: (MarketToolProduct | ProductCardData)[]; specs: SpecRow[]; actions: ChatActions }) {
  if (products.length < 2) return null;
  const columns = products.map((p) => ("url" in p ? fromMarketTool(p) : fromShopProduct(p, actions)));
  return (
    <div className="nia-enter rounded-3xl border border-ink-900/[0.06] bg-surface shadow-soft p-3">
      <CompareTable products={columns} locale={actions.locale} specs={specs} />
    </div>
  );
}

/** One decision question as tap-to-answer buttons (the answer is sent as the shopper's message). */
function DecisionChips({ question, options, actions, latest }: { question: string; options: string[]; actions: ChatActions; latest: boolean }) {
  const [picked, setPicked] = useState<string | null>(null);
  const closed = picked !== null || !latest;
  return (
    <div className="nia-enter nia-holo-border rounded-2xl p-3.5" role="group" aria-label={question}>
      <p className="text-sm font-semibold">{question}</p>
      <div className="mt-2.5 flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            disabled={closed || actions.busy}
            aria-pressed={picked === o}
            onClick={() => {
              setPicked(o);
              actions.send(o);
            }}
            className={cn(
              "min-h-10 rounded-full border px-4 text-sm font-semibold transition-colors duration-100 disabled:cursor-default",
              picked === o ? "border-accent bg-accent text-accent-foreground" : "border-border bg-background hover:border-accent hover:bg-accent-soft disabled:opacity-60 disabled:hover:border-border disabled:hover:bg-background",
            )}
          >
            {o}
          </button>
        ))}
      </div>
      {!closed ? <p className="mt-2 text-xs text-muted-foreground">Tap an answer or type your own.</p> : null}
    </div>
  );
}

/* ─────────────────────────────── Dispatcher ─────────────────────────────── */

const CART_TOOLS = new Set(["createDraftOrder", "addItemToDraft", "updateDraftItem", "removeDraftItem", "setFulfillment"]);

/** Render all tool parts of one assistant message. Cart updates collapse into the latest state. */
export function ToolParts({ parts, actions, latest = true, asked }: { parts: ToolPart[]; actions: ChatActions; latest?: boolean; asked?: string }) {
  const nodes: React.ReactNode[] = [];
  const hasSummary = parts.some((p) => p.type === "tool-showOrderSummary" && p.state === "output-available" && p.output?.ok);
  const lastCart = [...parts].reverse().find((p) => CART_TOOLS.has(p.type.slice(5)) && p.state === "output-available" && p.output?.ok);
  // Once this reply has started the cart from the order, "Same quantity?" has already been answered.
  const reordered = parts.some((p) => p.type === "tool-createDraftOrder" && p.state === "output-available" && p.output?.ok && p.input?.fromOrderId);
  // If the model re-planned within one reply, only its final basket is shown.
  const lastBasket = [...parts].reverse().find((p) => p.type === "tool-planBasket" && p.state === "output-available" && p.output?.ok);
  let signInShown = false;

  // Asked about one product by name ("Tell me more about the Vanilla Celebration Cake")?
  // Then it gets the card, and anything else found alongside is a suggestion below it.
  const texts = [asked, ...parts.map((p) => (typeof p.input?.query === "string" ? p.input.query : null))];
  const looked = parts.find((p) => p.type === "tool-getProduct" && ok(p))?.output?.product as ProductCardData | undefined;
  const shopHits = uniqueById(parts.filter((p) => p.type === "tool-searchProducts" && ok(p)).flatMap((p) => (p.output?.products as ProductCardData[]) ?? []));
  const marketHits = uniqueById(parts.filter((p) => p.type === "tool-searchMarket" && ok(p)).flatMap((p) => (p.output?.products as MarketToolProduct[]) ?? []));
  const shopFocus = looked ?? namedProduct(shopHits, texts);
  const marketFocus = namedProduct(marketHits, texts);
  const similarShop: SimilarItem[] = shopFocus
    ? shopHits
        .filter((p) => p.id !== shopFocus.id)
        .map((p) => ({ id: p.id, name: p.name, category: p.category, image: p.image, price: productPriceLabel(p, actions.locale), href: `/s/${actions.slug}/shop/${p.slug}`, ask: `Tell me more about the ${p.name}` }))
    : [];
  const similarMarket: SimilarItem[] = marketFocus
    ? marketHits
        .filter((p) => p.id !== marketFocus.id)
        .map((p) => ({ id: p.id, name: p.name, category: p.category, image: p.image, price: productPriceLabel(p, actions.locale), href: p.url, ask: `Tell me more about the ${p.name} from ${p.shop.name}`, shop: p.shop.name }))
    : [];
  let focusShown = false;
  const showShopFocus = (key: string) => {
    if (focusShown || !shopFocus) return;
    focusShown = true;
    nodes.push(<ProductResults key={key} products={[shopFocus]} actions={actions} />);
    if (similarShop.length) nodes.push(<SimilarItems key={`${key}-similar`} items={similarShop} actions={actions} />);
  };

  for (const p of parts) {
    const name = p.type.slice(5);
    if (p.state === "input-streaming" || p.state === "input-available") {
      nodes.push(<ToolStatus key={p.toolCallId} name={name} />);
      continue;
    }
    if (p.state === "output-error") continue;
    const o = p.output;
    if (!o) continue;
    if (o.ok === false) {
      if (o.code === "SIGN_IN_REQUIRED" && !signInShown) {
        signInShown = true;
        nodes.push(<SignInPrompt key={p.toolCallId} actions={actions} />);
      }
      // Couldn't add (out of stock / not enough): real alternatives instead of a dead end.
      const alts = (o.alternatives as AlternativeView[] | undefined) ?? [];
      if (alts.length) nodes.push(<Alternatives key={p.toolCallId} title={`${String(o.error ?? "Unavailable")} — alternatives`} options={alts} quantity={Number(p.input?.quantity ?? 1)} actions={actions} />);
      continue;
    }
    switch (name) {
      case "searchMarket":
        if (marketFocus) {
          if (focusShown) break;
          focusShown = true;
          nodes.push(<MarketResults key={p.toolCallId} products={[marketFocus]} actions={actions} />);
          if (similarMarket.length) nodes.push(<SimilarItems key={`${p.toolCallId}-similar`} items={similarMarket} actions={actions} />);
          break;
        }
        nodes.push(<MarketResults key={p.toolCallId} products={(o.products as MarketToolProduct[]) ?? []} actions={actions} />);
        break;
      case "getMyOrders":
        nodes.push(<MyOrders key={p.toolCallId} orders={(o.orders as AccountOrder[]) ?? []} actions={actions} />);
        break;
      case "searchMarketServices":
        nodes.push(<MarketServiceResults key={p.toolCallId} services={(o.services as MarketToolService[]) ?? []} actions={actions} />);
        break;
      case "compareProducts":
        nodes.push(<CompareResult key={p.toolCallId} products={(o.products as MarketToolProduct[]) ?? []} specs={(o.rows as SpecRow[]) ?? []} actions={actions} />);
        break;
      case "planBasket":
        if (p === lastBasket) nodes.push(<BasketCard key={p.toolCallId} basket={o as unknown as BasketView} actions={actions} latest={latest} />);
        break;
      case "showMyMemory":
        nodes.push(<MemoryProfileCard key={p.toolCallId} profile={o as unknown as MemoryProfileView} actions={actions} />);
        break;
      case "saveForLater":
        nodes.push(<SavedNote key={p.toolCallId} saved={(o.saved as string[]) ?? []} />);
        break;
      case "updateShoppingList":
        nodes.push(<ShoppingListCard key={p.toolCallId} list={(o.list as string[]) ?? []} actions={actions} latest={latest} />);
        break;
      case "askDecision":
        nodes.push(<DecisionChips key={p.toolCallId} question={String(o.question)} options={(o.options as string[]) ?? []} actions={actions} latest={latest} />);
        break;
      case "searchProducts":
        if (shopFocus) showShopFocus(p.toolCallId);
        else nodes.push(<ProductResults key={p.toolCallId} products={(o.products as ProductCardData[]) ?? []} actions={actions} />);
        break;
      case "getProduct": {
        showShopFocus(p.toolCallId);
        const alts = (o.alternatives as AlternativeView[] | undefined) ?? [];
        if (alts.length) nodes.push(<Alternatives key={`${p.toolCallId}-alt`} title="Not available right now — alternatives" options={alts} actions={actions} />);
        break;
      }
      case "searchServices":
        nodes.push(<ServiceResults key={p.toolCallId} services={(o.services as ServiceCardData[]) ?? []} actions={actions} />);
        break;
      case "getService":
        nodes.push(<ServiceResults key={p.toolCallId} services={[o.service as ServiceCardData]} actions={actions} />);
        break;
      case "getAvailableBookingSlots":
        nodes.push(<SlotPicker key={p.toolCallId} service={String(o.service)} slots={(o.slots as SlotData[]) ?? []} actions={actions} />);
        break;
      case "createBookingDraft":
        nodes.push(<BookingDraft key={p.toolCallId} booking={o.booking as BookingSummaryData} actions={actions} />);
        break;
      case "showOrderSummary":
        nodes.push(<OrderConfirm key={p.toolCallId} summary={o.summary as OrderSummaryData} actions={actions} />);
        break;
      case "getCustomerRecentOrders": {
        const repeat = o.repeat as { status: string; orderId?: string } | undefined;
        const orders = (o.orders as OrderSummaryData[]) ?? [];
        const target = repeat?.status === "single" ? orders.find((x) => x.id === repeat.orderId) : null;
        if (target && !hasSummary && !reordered) nodes.push(<RepeatChoices key={p.toolCallId} order={target} actions={actions} />);
        break;
      }
      default:
        if (CART_TOOLS.has(name) && p === lastCart && !hasSummary) {
          nodes.push(<CartStrip key={p.toolCallId} cart={o.cart as OrderSummaryData} actions={actions} />);
        }
        // Reorder: anything no longer available comes with real alternatives.
        if (name === "createDraftOrder") {
          for (const [i, a] of ((o.alternatives as { for: string; quantity: number; options: AlternativeView[] }[] | undefined) ?? []).entries()) {
            nodes.push(<Alternatives key={`${p.toolCallId}-alt-${i}`} title={`${a.for} isn't available — alternatives`} options={a.options} quantity={a.quantity} actions={actions} />);
          }
        }
    }
  }
  if (nodes.length === 0) return null;
  return <div className={cn("space-y-2.5")}>{nodes}</div>;
}
