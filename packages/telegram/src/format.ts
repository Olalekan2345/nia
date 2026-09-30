/**
 * Native Telegram rendering: HTML-safe text, product/service cards and
 * summaries with inline keyboards. Callback data stays under Telegram's
 * 64-byte limit.
 */
import { formatMoney, formatPriceRange, INVENTORY_LABELS } from "@nia/shared";
import type { BookingSummaryData, OrderSummaryData, ProductCardData, ServiceCardData } from "@nia/commerce";
import type { Merchant } from "@nia/database";
import type { InlineKeyboardMarkup } from "./types";

export function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** A short, escaped, quoted excerpt of a chat message. */
export function quote(text: string, max = 160): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return `“${escapeHtml(flat.length > max ? `${flat.slice(0, max - 1)}…` : flat)}”`;
}

/** Model output → Telegram HTML: escape everything, then allow **bold** / *bold* only. */
export function toTelegramHtml(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*([^*\n]+)\*\*/g, "<b>$1</b>")
    .replace(/(^|[\s(])\*([^*\n]+)\*(?=[\s).,!?:;]|$)/g, "$1<b>$2</b>")
    .replace(/^#{1,6}\s+/gm, "")
    .trim();
}

export const CB = {
  confirmOrder: (orderId: string) => `oc:${orderId}`,
  editOrder: (orderId: string) => `oe:${orderId}`,
  confirmBooking: (bookingId: string) => `bc:${bookingId}`,
  cancelBooking: (bookingId: string) => `bx:${bookingId}`,
  repeat: (orderId: string) => `rp:${orderId}`,
  consentYes: (candidateId: string) => `my:${candidateId}`,
  consentNo: (candidateId: string) => `mn:${candidateId}`,
  action: (name: "browse" | "book" | "last" | "link" | "memory" | "change_qty" | "similar" | "cheaper") => `a:${name}`,
  shop: (slug: string) => `s:${slug.slice(0, 60)}`,
  /** Tap the i-th option of Nia's last decision question. */
  decision: (i: number) => `ad:${i}`,
  /** Add the proposed basket to each shop's cart. */
  basket: () => "pb",
  /** Switch to a shop and review its cart. */
  reviewCart: (slug: string) => `cs:${slug.slice(0, 60)}`,
  loginPick: (requestId: string, n: number) => `gl:${requestId}:${n}`,
  loginDeny: (requestId: string) => `gx:${requestId}`,
  signOutEverywhere: () => "so",
};

/** Sent to the connected Telegram chat when the account signs in on the web some other way. */
export function newSignInText(device: string | null, method: "email"): string {
  return [
    `🔐 <b>New sign-in to your Nia account</b> with ${method}.`,
    device ? `Browser: ${escapeHtml(device)}` : null,
    "",
    "Not you? Sign out everywhere, then check who can read your email.",
  ]
    .filter((l) => l !== null)
    .join("\n");
}

export function storefrontUrl(appUrl: string, merchant: Pick<Merchant, "slug">, path = ""): string {
  return `${appUrl}/s/${merchant.slug}${path}`;
}

/** Walrus Market: where signing in lands on the web. */
export function marketUrl(appUrl: string): string {
  return `${appUrl}/market`;
}

/** The customer's memory page on the web: a shop's Memory Passport, or the market profile. */
export function profileUrl(appUrl: string, merchant: Pick<Merchant, "slug" | "kind">): string {
  return merchant.kind === "market" ? `${appUrl}/market/profile` : storefrontUrl(appUrl, merchant, "/profile");
}

export function welcomeText(merchant: Merchant, linked: boolean): string {
  if (merchant.kind === "market") {
    return [
      "👋 <b>Hi, I'm Nia</b> — your Walrus Market shopping guide, across every shop.",
      "",
      "I can help you:",
      "• find and compare products and services in every shop",
      "• build a basket for a party, an outfit or a set-up within your budget",
      "• keep a list and the things you save — here and on the website",
      `• remember your sizes, budget and who you shop for${linked ? " — shared with your web account" : " (sign in on the website with Telegram to share it with the web too)"}`,
      "",
      "Just tell me what you need.",
    ].join("\n");
  }
  return [
    `👋 <b>Hi, I'm Nia</b> — ${escapeHtml(merchant.name)}'s shopping assistant.`,
    "",
    "I can help you:",
    "• find products and check what's in stock",
    "• reorder what you bought last time",
    "• book a service or appointment",
    `• remember useful things like your size or usual delivery area${linked ? " — shared with your web account" : " (sign in on the website with Telegram to share it with the web too)"}`,
    "",
    "Just type what you need.",
  ].join("\n");
}

export function welcomeKeyboard(appUrl: string, merchant: Merchant, hasServices: boolean): InlineKeyboardMarkup {
  if (merchant.kind === "market") {
    return {
      inline_keyboard: [
        [{ text: "🛍 What's popular", callback_data: CB.action("browse") }],
        [
          { text: "🧠 What you remember", callback_data: CB.action("memory") },
          { text: "🔗 Link account", callback_data: CB.action("link") },
        ],
        [{ text: "Open Walrus Market", url: marketUrl(appUrl) }],
      ],
    };
  }
  const rows: InlineKeyboardMarkup["inline_keyboard"] = [
    [{ text: "🛍 Browse products", callback_data: CB.action("browse") }],
    ...(hasServices ? [[{ text: "📅 Book a service", callback_data: CB.action("book") }]] : []),
    [
      { text: "🧾 My last order", callback_data: CB.action("last") },
      { text: "🔗 Link account", callback_data: CB.action("link") },
    ],
    [
      { text: "Open the shop", url: storefrontUrl(appUrl, merchant) },
      { text: "🛍 Walrus Market", url: marketUrl(appUrl) },
    ],
  ];
  return { inline_keyboard: rows };
}

export function productCaption(p: ProductCardData, locale: string): string {
  const price =
    p.price == null
      ? "Price on request"
      : p.priceMax != null && p.priceMax !== p.price
        ? `${formatMoney(p.price, p.currency, { locale })} – ${formatMoney(p.priceMax, p.currency, { locale })}`
        : formatMoney(p.price, p.currency, { locale });
  const unit = p.unit ? ` / ${p.unit}` : "";
  const matched = p.matchedVariantIds?.length ? p.variants.filter((v) => p.matchedVariantIds!.includes(v.id)) : p.variants;
  const options = matched
    .slice(0, 8)
    .map((v) => `${v.available ? "•" : "×"} ${escapeHtml(v.name)}${v.available ? "" : " (unavailable)"}`)
    .join("\n");
  return [
    `<b>${escapeHtml(p.name)}</b>`,
    `${price}${unit} · ${INVENTORY_LABELS[p.inventoryStatus]}`,
    p.description ? escapeHtml(p.description.slice(0, 180)) : "",
    options ? `\n${options}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function serviceCaption(s: ServiceCardData, locale: string, timeZone: string): string {
  const next = s.nextAvailable
    ? new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone }).format(new Date(s.nextAvailable))
    : null;
  return [
    `<b>${escapeHtml(s.name)}</b>`,
    `${formatPriceRange(s.priceMin, s.priceMax, s.currency, { locale })}${s.durationMinutes ? ` · ${s.durationMinutes} min` : ""}`,
    s.depositAmount ? `Deposit: ${formatMoney(s.depositAmount, s.currency, { locale })}` : "",
    next ? `Next opening: ${next}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function orderSummaryText(o: OrderSummaryData, locale: string, title = "Order summary"): string {
  const lines = o.items.map(
    (i) =>
      `• ${i.quantity}${i.unit && !["piece", "item"].includes(i.unit) ? ` ${i.unit}${i.quantity === 1 ? "" : "s"}` : " ×"} ${escapeHtml(i.name)}${i.variantLabel ? ` — ${escapeHtml(i.variantLabel)}` : ""}${i.lineTotal != null ? ` · ${formatMoney(i.lineTotal, o.currency, { locale })}` : " · quote"}`,
  );
  const fulfil =
    o.fulfillmentMethod === "pickup"
      ? "Pickup"
      : o.fulfillmentMethod === "delivery"
        ? `Delivery · ${escapeHtml(o.deliveryArea ?? "area not chosen")}${o.deliveryFee != null ? ` (${formatMoney(o.deliveryFee, o.currency, { locale })})` : o.deliveryArea ? " (fee quoted)" : ""}`
        : "Delivery or pickup not chosen";
  const total = o.hasUnpricedItems ? "To be confirmed" : formatMoney(o.total, o.currency, { locale });
  return [
    `<b>${title}${o.number ? ` #${o.number}` : ""}</b>`,
    ...lines,
    "",
    fulfil,
    `<b>Total:</b> ${total}`,
    ...(o.blockers.length ? ["", `Still needed: ${escapeHtml(o.blockers.join("; "))}`] : []),
  ].join("\n");
}

export function bookingSummaryText(b: BookingSummaryData, locale: string, title = "Booking"): string {
  const when = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: b.timeZone }).format(new Date(b.startAt));
  return [
    `<b>${title}: ${escapeHtml(b.serviceName)}</b>`,
    when,
    b.selectedOptions.length ? `Options: ${escapeHtml(b.selectedOptions.join(", "))}` : "",
    b.price != null ? `Price: ${formatMoney(b.price, b.currency, { locale })}` : "Price: quoted at the appointment",
    b.depositAmount ? `Deposit: ${formatMoney(b.depositAmount, b.currency, { locale })}` : "",
    b.notes ? `Note: ${escapeHtml(b.notes)}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

/* ─────────────────────────────── Commerce agent ─────────────────────────────── */

/** A market search result as the tool returns it (prices already formatted). */
export interface MarketResultView {
  id: string;
  name: string;
  priceLabel?: string;
  priceMaxLabel?: string;
  unit: string | null;
  url: string;
  image: string | null;
  why?: string[];
  shop: { name: string; city: string | null };
}

export function marketCaption(p: MarketResultView): string {
  const price = p.priceLabel ? `${p.priceLabel}${p.priceMaxLabel && p.priceMaxLabel !== p.priceLabel ? ` – ${p.priceMaxLabel}` : ""}${p.unit ? ` / ${escapeHtml(p.unit)}` : ""}` : "Price on request";
  return [`<b>${escapeHtml(p.name)}</b>`, `${price} · ${escapeHtml(p.shop.name)}`, p.why?.length ? `<i>${escapeHtml(p.why.join(" · "))}</i>` : ""].filter(Boolean).join("\n");
}

export interface BasketTextView {
  goal: string;
  lines: { slot: string; name: string; variantName: string | null; quantity: number; lineTotalLabel?: string; shop: { name: string } }[];
  missing: { slot: string; reason: string }[];
  totalLabel?: string;
  budgetLabel?: string;
  remainingLabel?: string;
  overBudgetByLabel?: string;
  overBudgetBy: number | null;
  notes: string[];
}

export function basketText(b: BasketTextView): string {
  const lines = b.lines.map((l) => `• <b>${escapeHtml(l.slot)}</b>: ${l.quantity} × ${escapeHtml(l.name)}${l.variantName ? ` (${escapeHtml(l.variantName)})` : ""} · ${escapeHtml(l.shop.name)} — ${l.lineTotalLabel ?? ""}`);
  const missing = b.missing.map((m) => `• ${escapeHtml(m.slot)}: ${escapeHtml(m.reason)}`);
  const money = [
    `<b>Total: ${b.totalLabel ?? ""}</b>`,
    b.budgetLabel ? `Budget: ${b.budgetLabel} · ${b.overBudgetBy != null ? `over by ${b.overBudgetByLabel}` : `remaining ${b.remainingLabel}`}` : "",
  ].filter(Boolean);
  return [`🧺 <b>${escapeHtml(b.goal)}</b>`, ...lines, ...(missing.length ? ["", ...missing] : []), "", ...money, ...(b.notes.length ? ["", `<i>${escapeHtml(b.notes.join(" "))}</i>`] : [])].join("\n");
}

export interface MemorySectionView {
  title: string;
  items: { label: string; certainty: string; previousLabel: string | null }[];
}

export function memoryProfileText(sections: MemorySectionView[], shopName: string): string {
  if (!sections.length) return `Nia doesn't remember anything about you at ${escapeHtml(shopName)} yet. Tell me things like your size or usual delivery area and I'll keep them — you can review or remove them any time.`;
  const body = sections.flatMap((s) => [`<b>${escapeHtml(s.title)}</b>`, ...s.items.map((i) => `• ${escapeHtml(i.label)} — <i>${escapeHtml(i.certainty)}</i>${i.previousLabel ? ` (was ${escapeHtml(i.previousLabel)})` : ""}`), ""]);
  return ["🧠 <b>What Nia remembers</b> · stored with Walrus Memory", "", ...body, "Tell me if anything's wrong or has changed — or review it in your profile."].join("\n");
}

export function compareText(products: { name: string; priceLabel?: string; shop?: { name: string } }[], rows: { label: string; values: (string | null)[] }[]): string {
  const head = products.map((p, i) => `${i + 1}. <b>${escapeHtml(p.name)}</b> — ${p.priceLabel ?? "price on request"}${p.shop ? ` · ${escapeHtml(p.shop.name)}` : ""}`);
  const specs = rows.slice(0, 8).map((r) => `<b>${escapeHtml(r.label)}</b>: ${r.values.map((v, i) => `${i + 1}) ${escapeHtml(v ?? "not listed")}`).join("  ")}`);
  return ["⚖️ <b>Side by side</b>", ...head, ...(specs.length ? ["", ...specs] : [])].join("\n");
}

export function alternativesText(title: string, options: { name: string; variantName: string | null; reason: string; priceLabel?: string }[]): string {
  return [`🔁 <b>${escapeHtml(title)}</b>`, ...options.map((o) => `• ${escapeHtml(o.name)}${o.variantName ? ` (${escapeHtml(o.variantName)})` : ""} — ${escapeHtml(o.reason)}${o.priceLabel ? ` · ${o.priceLabel}` : ""}`)].join("\n");
}
