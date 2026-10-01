"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { customers, memoryRecords, type Customer } from "@nia/database";
import {
  addItemToDraft,
  disconnectTelegram,
  removeDraftItem,
  setDraftFulfillment,
  updateDraftItem,
  type BookingSummaryData,
  type OrderSummaryData,
  type PaymentStart,
} from "@nia/commerce";
import { cancelCustomerBooking, cancelCustomerOrder, confirmCustomerBooking, confirmCustomerOrder } from "@nia/ai";
import { forgetMemory, persistMemory, resolveCandidate, type MemoryReceipt } from "@nia/memory";
import { AppError, isAppError, normalizeSubject } from "@nia/shared";
import { ensureCustomer, getStorefront, type Storefront } from "@/lib/storefront";
import { limit } from "@/lib/security";
import { db, memoryStore } from "@/lib/server";

export type ActionResult<T = object> = ({ ok: true } & T) | { ok: false; error: string; code?: "SIGN_IN" };

const uuid = z.string().uuid();

async function withCustomer<T>(slug: string, fn: (sf: Storefront, customer: Customer) => Promise<T>): Promise<ActionResult<T extends object ? T : { value: T }>> {
  try {
    const sf = await getStorefront(slug);
    const customer = await ensureCustomer(sf);
    if (!customer) return { ok: false, error: "Sign in to continue.", code: "SIGN_IN" };
    const value = await fn(sf, customer);
    return { ok: true, ...(value as object) } as never;
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    console.error("[store action]", err);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

function touch(slug: string) {
  revalidatePath(`/s/${slug}`, "layout");
}

/* ─────────────────────────────── Cart ─────────────────────────────── */

export async function addToCartAction(slug: string, input: { productId: string; variantId?: string | null; quantity: number }) {
  const parsed = z.object({ productId: uuid, variantId: uuid.nullish(), quantity: z.number().int().min(1).max(999) }).safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Choose an option and quantity." };
  const res = await withCustomer(slug, async (sf, customer) => {
    await limit(`cart:${customer.id}`, 60, 60);
    const cart = await addItemToDraft(db(), { merchantId: sf.merchant.id, customerId: customer.id, productId: parsed.data.productId, variantId: parsed.data.variantId ?? null, quantity: parsed.data.quantity, channel: "web" });
    return { cart };
  });
  touch(slug);
  return res;
}

export async function updateCartItemAction(slug: string, itemId: string, quantity: number) {
  if (!uuid.safeParse(itemId).success) return { ok: false as const, error: "Invalid item" };
  const res = await withCustomer(slug, async (sf, customer) => ({ cart: await updateDraftItem(db(), { merchantId: sf.merchant.id, customerId: customer.id, itemId, quantity }) }));
  touch(slug);
  return res;
}

export async function removeCartItemAction(slug: string, itemId: string) {
  if (!uuid.safeParse(itemId).success) return { ok: false as const, error: "Invalid item" };
  const res = await withCustomer(slug, async (sf, customer) => ({ cart: await removeDraftItem(db(), { merchantId: sf.merchant.id, customerId: customer.id, itemId }) }));
  touch(slug);
  return res;
}

export async function setFulfillmentAction(slug: string, method: "delivery" | "pickup", deliveryArea?: string | null, deliveryAddress?: string | null) {
  const res = await withCustomer(slug, async (sf, customer) => ({
    cart: await setDraftFulfillment(db(), {
      merchantId: sf.merchant.id,
      customerId: customer.id,
      method: method === "pickup" ? "pickup" : "delivery",
      deliveryArea: deliveryArea?.slice(0, 80) ?? null,
      deliveryAddress: deliveryAddress?.slice(0, 300) ?? null,
      channel: "web",
    }),
  }));
  touch(slug);
  return res;
}

/* ─────────────────────────────── Orders & bookings ─────────────────────────────── */

export async function confirmOrderAction(slug: string, orderId: string): Promise<ActionResult<{ summary: OrderSummaryData; payment: PaymentStart | null; receipt: MemoryReceipt | null }>> {
  if (!uuid.safeParse(orderId).success) return { ok: false, error: "Invalid order" };
  const res = await withCustomer(slug, async (sf, customer) => {
    await limit(`order:${customer.id}`, 10, 600);
    return confirmCustomerOrder({ db: db(), store: memoryStore(), merchant: sf.merchant, customer, channel: "web" }, orderId);
  });
  // No revalidation here: it would refresh the page under the checkout pop-up (the cart
  // disappears and the pop-up with it). Every caller refreshes the route itself afterwards.
  return res as ActionResult<{ summary: OrderSummaryData; payment: PaymentStart | null; receipt: MemoryReceipt | null }>;
}

export async function cancelOrderAction(slug: string, orderId: string) {
  if (!uuid.safeParse(orderId).success) return { ok: false as const, error: "Invalid order" };
  const res = await withCustomer(slug, async (sf, customer) => ({
    summary: await cancelCustomerOrder({ db: db(), store: memoryStore(), merchant: sf.merchant, customer, channel: "web" }, orderId),
  }));
  touch(slug);
  return res;
}

export async function confirmBookingAction(slug: string, bookingId: string): Promise<ActionResult<{ booking: BookingSummaryData; receipt: MemoryReceipt | null }>> {
  if (!uuid.safeParse(bookingId).success) return { ok: false, error: "Invalid booking" };
  const res = await withCustomer(slug, async (sf, customer) => confirmCustomerBooking({ db: db(), store: memoryStore(), merchant: sf.merchant, customer, channel: "web" }, bookingId));
  touch(slug);
  return res as ActionResult<{ booking: BookingSummaryData; receipt: MemoryReceipt | null }>;
}

export async function cancelBookingAction(slug: string, bookingId: string) {
  if (!uuid.safeParse(bookingId).success) return { ok: false as const, error: "Invalid booking" };
  const res = await withCustomer(slug, async (sf, customer) => ({
    booking: await cancelCustomerBooking({ db: db(), store: memoryStore(), merchant: sf.merchant, customer, channel: "web" }, bookingId),
  }));
  touch(slug);
  return res;
}

/* ─────────────────────────────── Memory Passport ─────────────────────────────── */

export async function forgetMemoryAction(slug: string, recordId: string) {
  if (!uuid.safeParse(recordId).success) return { ok: false as const, error: "Invalid memory" };
  const res = await withCustomer(slug, async (sf, customer) => {
    const ok = await forgetMemory(db(), { merchantId: sf.merchant.id, customerId: customer.id, recordId, actor: { type: "customer", id: customer.id } });
    if (!ok) throw new AppError("NOT_FOUND", "Memory not found");
    return { forgotten: recordId };
  });
  touch(slug);
  return res;
}

export async function correctMemoryAction(slug: string, recordId: string, rawValue: string) {
  const value = rawValue.trim().slice(0, 120);
  if (!uuid.safeParse(recordId).success || value.length < 1) return { ok: false as const, error: "Enter the correct value." };
  const res = await withCustomer(slug, async (sf, customer) => {
    await limit(`passport:${customer.id}`, 20, 3600);
    const [record] = await db()
      .select()
      .from(memoryRecords)
      .where(and(eq(memoryRecords.id, recordId), eq(memoryRecords.merchantId, sf.merchant.id), eq(memoryRecords.customerId, customer.id)));
    if (!record) throw new AppError("NOT_FOUND", "Memory not found");
    const [prefix, ...rest] = record.label.split(":");
    const topic = rest.length ? prefix!.trim() : record.type.replace(/_/g, " ").toLowerCase();
    const previous = rest.length ? rest.join(":").trim() : null;
    const receipt = await persistMemory(db(), memoryStore(), {
      merchantId: sf.merchant.id,
      customerId: customer.id,
      scope: "customer",
      type: record.type === "PAST_ORDER" || record.type === "PAST_SERVICE" ? "CORRECTION" : record.type,
      subject: record.type === "PAST_ORDER" ? normalizeSubject(`correction_${record.subjectKey}`) : record.subjectKey,
      value,
      statement: `The customer corrected their ${topic.toLowerCase()} in their Memory Passport: it is now "${value}".`,
      label: `${topic}: ${value}`,
      confirmation: "customer_corrected",
      explicit: true,
      confidence: 1,
      importance: 0.85,
      durability: "long_term",
      score: 0.95,
      significant: true,
      previousValue: previous,
      sourceKind: "passport",
      channel: "web",
      supersede: true,
    });
    if (record.type === "PAST_ORDER") {
      await forgetMemory(db(), { merchantId: sf.merchant.id, customerId: customer.id, recordId: record.id, actor: { type: "customer", id: customer.id } });
    }
    return { receipt };
  });
  touch(slug);
  return res;
}

export async function setMemoryEnabledAction(slug: string, enabled: boolean) {
  const res = await withCustomer(slug, async (_sf, customer) => {
    await db().update(customers).set({ memoryEnabled: Boolean(enabled) }).where(eq(customers.id, customer.id));
    return { enabled: Boolean(enabled) };
  });
  touch(slug);
  return res;
}

export async function resolveConsentAction(slug: string, candidateId: string, accept: boolean) {
  if (!uuid.safeParse(candidateId).success) return { ok: false as const, error: "Invalid request" };
  return withCustomer(slug, async (sf, customer) => ({
    receipt: await resolveCandidate(db(), memoryStore(), { merchantId: sf.merchant.id, customerId: customer.id, candidateId, accept }),
  }));
}

/* ─────────────────────────────── Telegram ─────────────────────────────── */

/** Detach Telegram from this account (email accounts only — Telegram-only accounts sign in with it). */
export async function disconnectTelegramAction(slug: string): Promise<ActionResult> {
  const res = await withCustomer(slug, async (sf) => {
    if (!(await disconnectTelegram(db(), sf.user!.id))) throw new AppError("VALIDATION", "This account signs in with Telegram, so it can’t be disconnected.");
    return {};
  });
  touch(slug);
  return res;
}
