/**
 * What the MODEL sees of a tool result. The full result still goes to the UI
 * cards and Telegram (AI SDK `toModelOutput` only changes the copy re-sent to
 * the model at the next step) — so images, urls, raw minor-unit numbers and
 * repeated shop details are dropped here. Prices stay as the ready-made
 * "…Label" strings the prompt tells Nia to quote. Every tool result is re-sent
 * on each later step, so this is the biggest token saving per reply.
 */
import type { OrderSummaryData } from "@nia/commerce";
import { orderProgress } from "@nia/shared";

type R = Record<string, unknown>;
const s = (v: unknown, max = 120) => (typeof v === "string" ? v.slice(0, max) : undefined);
const arr = <T = R>(v: unknown) => (Array.isArray(v) ? (v as T[]) : []);
const drop = (o: R) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== null && !(Array.isArray(v) && v.length === 0)));

function price(o: R): string | undefined {
  const lo = s(o.priceLabel);
  const hi = s(o.priceMaxLabel);
  if (!lo) return o.price == null ? "price on request" : undefined;
  return hi && hi !== lo ? `${lo} – ${hi}` : lo;
}

/** A market search / compare result. */
export function compactMarketProduct(p: R): R {
  const shop = (p.shop ?? {}) as R;
  return drop({
    id: p.id,
    name: p.name,
    category: p.category,
    priceLabel: price(p),
    unit: p.unit,
    stock: p.inventoryStatus,
    specs: s(p.specs, 140),
    why: p.why,
    options: arr<string>(p.options).slice(0, 5),
    matching: p.matching,
    shop: s(shop.name),
    delivery: shop.delivery ? arr<string>(shop.deliveryAreas).slice(0, 3).join(", ") || "yes" : "pickup only",
  });
}

/** A shop's product (variants keep their ids — the model needs them to add to the cart). */
export function compactProduct(p: R): R {
  const variants = arr(p.variants);
  return drop({
    id: p.id,
    name: p.name,
    category: p.category,
    about: s(p.description, 80),
    priceLabel: price(p),
    unit: p.unit,
    stock: p.inventoryStatus,
    specs: s(p.specs, 140),
    why: p.why,
    options: variants.slice(0, 8).map((v) => drop({ id: v.id, name: v.name, priceLabel: s(v.priceLabel), ...(v.available === false ? { unavailable: true } : {}) })),
    matching: arr<string>(p.matchedVariantIds).length ? variants.filter((v) => arr<string>(p.matchedVariantIds).includes(String(v.id))).map((v) => v.name) : undefined,
  });
}

/** A cart / order summary. */
export function compactCart(c: R): R {
  const placed = typeof c.status === "string" && c.status !== "draft";
  const progress = placed ? orderProgress(c as unknown as OrderSummaryData) : null;
  const estimate = (c.estimate ?? null) as OrderSummaryData["estimate"];
  return drop({
    id: c.id,
    number: c.number,
    status: c.status,
    progress: progress ? `${progress.headline}${progress.detail ? ` — ${progress.detail}` : ""}` : undefined,
    paid: c.paymentStatus === "paid" ? (c.paymentMode === "demo" ? "yes (demo payment)" : "yes") : undefined,
    expectedBy: estimate ? s(estimate.expectedBy, 16) : undefined,
    overdue: c.overdue === true ? true : undefined,
    items: arr(c.items).map((i) => drop({ id: i.id, line: `${i.quantity} × ${i.name}${i.variantLabel ? ` (${i.variantLabel})` : ""}`, lineTotalLabel: s(i.lineTotalLabel) ?? "price to be quoted" })),
    fulfilment: c.fulfillmentMethod === "delivery" ? `delivery to ${c.deliveryArea ?? "(area not chosen)"}` : c.fulfillmentMethod ?? "not chosen",
    deliveryFeeLabel: s(c.deliveryFeeLabel),
    totalLabel: c.hasUnpricedItems ? "to be confirmed" : s(c.totalLabel),
    stillNeeded: arr<string>(c.blockers),
    date: s(c.submittedAt ?? c.createdAt, 10),
  });
}

function compactAlternatives(v: unknown): R[] | undefined {
  const list = arr(v);
  return list.length ? list.map((a) => drop({ productId: a.productId, variantId: a.variantId, name: a.name, option: a.variantName, priceLabel: s(a.priceLabel), reason: a.reason })) : undefined;
}

/** Give every tool in a set the compact model view (UI and Telegram still get the full result). */
export function withCompactOutputs<T extends Record<string, object>>(tools: T): T {
  return Object.fromEntries(
    Object.entries(tools).map(([name, t]) => [name, { ...t, toModelOutput: ({ output }: { output: unknown }) => ({ type: "json" as const, value: modelOutput(name, output) as never }) }]),
  ) as T;
}

/** Tool name → compact result for the model. Failures pass through unchanged (they're small). */
export function modelOutput(tool: string, output: unknown): R {
  const o = (output ?? {}) as R;
  if (o.ok === false) return drop({ ok: false, error: o.error, code: o.code, alternatives: compactAlternatives(o.alternatives) });
  switch (tool) {
    case "searchMarket":
      return { ok: true, count: o.count, products: arr(o.products).map(compactMarketProduct) };
    case "compareProducts": {
      const products = arr(o.products).map((p) => ("url" in p ? compactMarketProduct(p) : compactProduct(p)));
      return drop({ ok: true, products, specs: arr(o.rows).map((r) => ({ spec: r.label, values: r.values })), notListed: o.notListed });
    }
    case "searchProducts":
      return { ok: true, count: o.count, products: arr(o.products).map(compactProduct) };
    case "getProduct":
      return drop({ ok: true, product: compactProduct((o.product ?? {}) as R), priceChanges: arr(((o.priceHistory ?? {}) as R).changes).length ? (o.priceHistory as R).changes : undefined, priceTrackedSince: s(((o.priceHistory ?? {}) as R).trackedSince, 10), alternatives: compactAlternatives(o.alternatives) });
    case "planBasket":
      return drop({
        ok: true,
        goal: o.goal,
        lines: arr(o.lines).map((l) => `${l.slot}: ${l.quantity} × ${l.name}${l.variantName ? ` (${l.variantName})` : ""} · ${((l.shop ?? {}) as R).name} · ${l.lineTotalLabel}`),
        missing: arr(o.missing).map((m) => `${m.slot}: ${m.reason}`),
        totalLabel: o.totalLabel,
        budgetLabel: o.budgetLabel,
        remainingLabel: o.remainingLabel,
        overBudgetByLabel: o.overBudgetByLabel,
        notes: o.notes,
      });
    case "getMyOrders":
      return { ok: true, orders: arr(o.orders).map((x) => drop({ shop: ((x.shop ?? {}) as R).name, ...compactCart(x), deliveryPolicy: s(x.deliveryPolicy, 300) })) };
    case "getCustomerRecentOrders":
      return drop({ ok: true, orders: arr(o.orders).slice(0, 5).map(compactCart), repeat: o.repeat, deliveryNow: o.deliveryNow, bookings: o.bookings, repeatBooking: o.repeatBooking });
    case "getOrder":
      return { ok: true, order: compactCart((o.order ?? {}) as R) };
    case "createDraftOrder":
      return drop({ ok: true, cart: compactCart((o.cart ?? {}) as R), added: o.added, unavailable: o.unavailable, note: o.note, alternatives: arr(o.alternatives).length ? arr(o.alternatives).map((a) => ({ for: a.for, options: compactAlternatives(a.options) })) : undefined });
    case "addItemToDraft":
    case "updateDraftItem":
    case "removeDraftItem":
    case "setFulfillment":
      return { ok: true, cart: compactCart((o.cart ?? {}) as R) };
    case "showOrderSummary":
      return drop({ ok: true, summary: compactCart((o.summary ?? {}) as R), needsConfirmation: o.needsConfirmation });
    case "showMyMemory":
      // The model answers from Walrus-recalled text; the grouped labels are for the card.
      return drop({ ok: true, count: o.count, memories: o.memories, note: o.note });
    default:
      return o;
  }
}
