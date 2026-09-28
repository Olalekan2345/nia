"use server";

import { revalidatePath } from "next/cache";
import { and, eq, inArray, ne } from "drizzle-orm";
import { z } from "zod";
import {
  audit,
  customers,
  memoryRecords,
  merchantInvites,
  merchantKnowledge,
  merchantMembers,
  merchants,
  orders,
  products,
  productVariants,
  services,
  users,
  type NiaSettings,
} from "@nia/database";
import { transitionBooking, transitionOrder } from "@nia/commerce";
import { archiveMerchantMemory, customerNamespace, persistMemory, refreshRecords, rememberMerchantFact, retryFailed } from "@nia/memory";
import { walrusConfig } from "@nia/config";
import {
  AppError,
  BOOKING_STATUSES,
  INVENTORY_STATUSES,
  isAppError,
  ORDER_STATUSES,
  PAYMENT_MODES,
  slugify,
  toMinorUnits,
  WEEKDAYS,
  type MemberRole,
} from "@nia/shared";
import { requireMerchant } from "@/lib/access";
import { db, memoryStore } from "@/lib/server";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };

async function run<T extends object>(merchantId: string, min: MemberRole, fn: (ctx: Awaited<ReturnType<typeof requireMerchant>>) => Promise<T>): Promise<Result<T>> {
  try {
    const ctx = await requireMerchant(merchantId, min);
    const out = await fn(ctx);
    revalidatePath(`/dashboard/${merchantId}`, "layout");
    return { ok: true, ...out };
  } catch (err) {
    if (isAppError(err)) return { ok: false, error: err.message };
    if (err instanceof z.ZodError) return { ok: false, error: err.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`).join("; ") };
    // Re-throw Next.js control-flow errors (redirect/notFound).
    if ((err as { digest?: string })?.digest) throw err;
    console.error("[dashboard action]", err);
    return { ok: false, error: "Something went wrong. Please try again." };
  }
}

const money = z.number().nonnegative().max(1e9).nullable();
const HEX = /^#[0-9a-fA-F]{6}$/;

/* ─────────────────────────────── Business profile ─────────────────────────────── */

const ProfileInput = z.object({
  name: z.string().trim().min(2).max(80),
  tagline: z.string().trim().max(160).nullable(),
  description: z.string().trim().max(1000).nullable(),
  logoUrl: z.string().trim().url().max(500).nullable().or(z.literal("").transform(() => null)),
  accentColor: z.string().regex(HEX),
  welcomeMessage: z.string().trim().max(300).nullable(),
  currency: z.string().length(3).toUpperCase(),
  locale: z.string().min(2).max(20),
  timezone: z.string().min(3).max(64),
  city: z.string().trim().max(80).nullable(),
  country: z.string().trim().max(2).nullable(),
  businessType: z.string().max(40),
});

export async function updateProfileAction(merchantId: string, input: z.input<typeof ProfileInput>) {
  return run(merchantId, "ADMIN", async ({ user }) => {
    const data = ProfileInput.parse(input);
    try {
      new Intl.DateTimeFormat("en", { timeZone: data.timezone });
      new Intl.NumberFormat(data.locale, { style: "currency", currency: data.currency });
    } catch {
      throw new AppError("VALIDATION", "Unknown time zone, locale or currency");
    }
    await db().update(merchants).set(data).where(eq(merchants.id, merchantId));
    await audit(db(), { merchantId, actorType: "user", actorId: user.id, action: "merchant.profile_updated" });
    return {};
  });
}

const NiaInput = z.object({
  tone: z.enum(["warm", "polished", "playful", "concise"]),
  memoryEnabled: z.boolean(),
  recommendationsEnabled: z.boolean(),
  instructions: z.string().trim().max(800).nullable(),
});

export async function updateNiaSettingsAction(merchantId: string, input: z.input<typeof NiaInput>) {
  return run(merchantId, "ADMIN", async () => {
    const data = NiaInput.parse(input) satisfies NiaSettings;
    await db().update(merchants).set({ niaSettings: data }).where(eq(merchants.id, merchantId));
    return {};
  });
}

const FulfilmentInput = z.object({
  delivery: z.boolean(),
  pickup: z.boolean(),
  pickupAddress: z.string().trim().max(300).nullable(),
  areas: z
    .array(z.object({ name: z.string().trim().min(1).max(60), fee: money, etaDays: z.number().int().min(0).max(60).nullable(), sameDay: z.boolean() }))
    .max(50),
});

export async function updateFulfilmentAction(merchantId: string, input: z.input<typeof FulfilmentInput>) {
  return run(merchantId, "ADMIN", async ({ merchant }) => {
    const d = FulfilmentInput.parse(input);
    if (!d.delivery && !d.pickup) throw new AppError("VALIDATION", "Offer at least delivery or pickup");
    await db()
      .update(merchants)
      .set({
        fulfillment: { delivery: d.delivery, pickup: d.pickup, pickupAddress: d.pickupAddress },
        deliveryAreas: d.areas.map((a) => ({ name: a.name, fee: a.fee == null ? null : toMinorUnits(a.fee, merchant.currency), etaDays: a.etaDays, sameDay: a.sameDay })),
      })
      .where(eq(merchants.id, merchantId));
    return {};
  });
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const HoursInput = z.record(z.enum(WEEKDAYS as unknown as [string, ...string[]]), z.array(z.tuple([z.string().regex(TIME), z.string().regex(TIME)])).max(3));

export async function updateOpeningHoursAction(merchantId: string, input: z.input<typeof HoursInput>) {
  return run(merchantId, "ADMIN", async () => {
    const hours = HoursInput.parse(input);
    await db().update(merchants).set({ openingHours: hours }).where(eq(merchants.id, merchantId));
    return {};
  });
}

const PaymentInput = z.object({
  paymentMode: z.enum(PAYMENT_MODES),
  paymentInstructions: z.string().trim().max(600).nullable(),
  paymentLinkUrl: z.string().trim().url().max(500).nullable().or(z.literal("").transform(() => null)),
});

export async function updatePaymentsAction(merchantId: string, input: z.input<typeof PaymentInput>) {
  return run(merchantId, "OWNER", async () => {
    const d = PaymentInput.parse(input);
    if (d.paymentMode === "payment_link" && !d.paymentLinkUrl) throw new AppError("VALIDATION", "Add your payment link URL");
    await db().update(merchants).set(d).where(eq(merchants.id, merchantId));
    return {};
  });
}

export async function setStoreStatusAction(merchantId: string, status: "live" | "paused") {
  return run(merchantId, "OWNER", async ({ user }) => {
    await db().update(merchants).set({ status: status === "live" ? "live" : "paused" }).where(eq(merchants.id, merchantId));
    await audit(db(), { merchantId, actorType: "user", actorId: user.id, action: `merchant.${status}` });
    return {};
  });
}

export async function setTelegramEnabledAction(merchantId: string, enabled: boolean) {
  return run(merchantId, "ADMIN", async () => {
    await db().update(merchants).set({ telegramEnabled: Boolean(enabled) }).where(eq(merchants.id, merchantId));
    return {};
  });
}

/* ─────────────────────────────── Knowledge & merchant memory ─────────────────────────────── */

const KnowledgeInput = z.object({
  id: z.string().uuid().optional(),
  category: z.enum(["shipping", "returns", "hours", "service_policy", "stock_note", "product_guidance", "faq", "special_instructions"]),
  title: z.string().trim().min(2).max(120),
  body: z.string().trim().min(2).max(2000),
  rememberInWalrus: z.boolean(),
});

export async function saveKnowledgeAction(merchantId: string, input: z.input<typeof KnowledgeInput>) {
  return run(merchantId, "ADMIN", async ({ user }) => {
    const d = KnowledgeInput.parse(input);
    let id = d.id;
    if (id) {
      const [existing] = await db().select().from(merchantKnowledge).where(and(eq(merchantKnowledge.id, id), eq(merchantKnowledge.merchantId, merchantId)));
      if (!existing) throw new AppError("NOT_FOUND", "Entry not found");
      if (existing.memoryRecordId && (!d.rememberInWalrus || existing.body !== d.body)) {
        await archiveMerchantMemory(db(), { merchantId, recordId: existing.memoryRecordId });
      }
      await db().update(merchantKnowledge).set({ category: d.category, title: d.title, body: d.body, rememberInWalrus: d.rememberInWalrus, ...(existing.body !== d.body || !d.rememberInWalrus ? { memoryRecordId: null } : {}) }).where(eq(merchantKnowledge.id, id));
    } else {
      const [row] = await db().insert(merchantKnowledge).values({ merchantId, category: d.category, title: d.title, body: d.body, rememberInWalrus: d.rememberInWalrus }).returning({ id: merchantKnowledge.id });
      id = row!.id;
    }
    let receipt = null;
    if (d.rememberInWalrus) {
      const [row] = await db().select().from(merchantKnowledge).where(eq(merchantKnowledge.id, id!));
      if (!row!.memoryRecordId) {
        receipt = await rememberMerchantFact(db(), memoryStore(), { merchantId, kind: "knowledge", text: `${d.title}: ${d.body}`, label: d.title, subject: `knowledge_${id!.slice(0, 8)}`, actorUserId: user.id });
        if (receipt.recordId) await db().update(merchantKnowledge).set({ memoryRecordId: receipt.recordId }).where(eq(merchantKnowledge.id, id!));
      }
    }
    return { id: id!, receipt };
  });
}

export async function deleteKnowledgeAction(merchantId: string, id: string) {
  return run(merchantId, "ADMIN", async () => {
    const [row] = await db().select().from(merchantKnowledge).where(and(eq(merchantKnowledge.id, z.string().uuid().parse(id)), eq(merchantKnowledge.merchantId, merchantId)));
    if (!row) throw new AppError("NOT_FOUND", "Entry not found");
    if (row.memoryRecordId) await archiveMerchantMemory(db(), { merchantId, recordId: row.memoryRecordId });
    await db().delete(merchantKnowledge).where(eq(merchantKnowledge.id, row.id));
    return {};
  });
}

export async function addOperationsNoteAction(merchantId: string, text: string) {
  return run(merchantId, "STAFF", async ({ user }) => {
    const clean = z.string().trim().min(4).max(500).parse(text);
    const receipt = await rememberMerchantFact(db(), memoryStore(), { merchantId, kind: "operations", text: clean, label: clean.slice(0, 80), actorUserId: user.id });
    if (receipt.status === "skipped") throw new AppError("NOT_CONFIGURED", receipt.reason ?? "Walrus Memory is not configured");
    return { receipt };
  });
}

export async function archiveMerchantMemoryAction(merchantId: string, recordId: string) {
  return run(merchantId, "ADMIN", async () => {
    if (!(await archiveMerchantMemory(db(), { merchantId, recordId: z.string().uuid().parse(recordId) }))) throw new AppError("NOT_FOUND", "Memory not found");
    return {};
  });
}

export async function refreshMemoryStatusAction(merchantId: string) {
  return run(merchantId, "STAFF", async () => {
    const pending = await db().select({ id: memoryRecords.id }).from(memoryRecords).where(and(eq(memoryRecords.merchantId, merchantId), eq(memoryRecords.persistStatus, "pending"))).limit(50);
    const receipts = await refreshRecords(db(), memoryStore(), pending.map((p) => p.id), { merchantId });
    return { refreshed: receipts.length, stored: receipts.filter((r) => r.status === "stored").length };
  });
}

export async function retryFailedMemoryAction(merchantId: string) {
  return run(merchantId, "ADMIN", async () => {
    const receipts = await retryFailed(db(), memoryStore(), { merchantId, limit: 20 });
    return { retried: receipts.length };
  });
}

export async function restoreNamespaceAction(merchantId: string, customerId: string) {
  return run(merchantId, "OWNER", async ({ user }) => {
    const store = memoryStore();
    if (!store) throw new AppError("NOT_CONFIGURED", "Walrus Memory is not configured");
    const [c] = await db().select({ id: customers.id }).from(customers).where(and(eq(customers.id, z.string().uuid().parse(customerId)), eq(customers.merchantId, merchantId)));
    if (!c) throw new AppError("NOT_FOUND", "Customer not found");
    const ns = customerNamespace(walrusConfig().namespacePrefix, merchantId, c.id);
    const res = await store.restore(ns, 20);
    await audit(db(), { merchantId, actorType: "user", actorId: user.id, action: "memory.restore", targetType: "customer", targetId: c.id, metadata: { ...res } });
    return { restored: res.restored, skipped: res.skipped, failed: res.failed, total: res.total, truncated: res.truncated };
  });
}

/* ─────────────────────────────── Catalog ─────────────────────────────── */

const VariantInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(80),
  options: z.record(z.string().max(30), z.string().max(60)),
  price: money,
  inventoryStatus: z.enum(INVENTORY_STATUSES),
  stockQuantity: z.number().int().min(0).max(1e6).nullable(),
  active: z.boolean(),
});

/** An uploaded photo (/api/media/<id>), a bundled stock photo (/stock/…), or an https:// link. */
const imageRef = z
  .string()
  .trim()
  .max(500)
  .refine((s) => /^https:\/\//.test(s) || /^\/api\/media\/[0-9a-f-]{36}$/i.test(s) || /^\/stock\/[a-z0-9-]+\.(jpg|jpeg|png|webp)$/.test(s), "Use an uploaded photo or an https:// link.");

const ProductInput = z.object({
  id: z.string().uuid().optional(),
  kind: z.enum(["PRODUCT", "CUSTOM_ORDER", "PACKAGE"]),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).nullable(),
  category: z.string().trim().max(60).nullable(),
  sku: z.string().trim().max(60).nullable(),
  price: money,
  unit: z.string().trim().max(30).nullable(),
  inventoryStatus: z.enum(INVENTORY_STATUSES),
  stockQuantity: z.number().int().min(0).max(1e6).nullable(),
  tags: z.array(z.string().trim().min(1).max(30)).max(20),
  images: z.array(imageRef).max(8),
  active: z.boolean(),
  variants: z.array(VariantInput).max(60),
});

export async function saveProductAction(merchantId: string, input: z.input<typeof ProductInput>) {
  return run(merchantId, "STAFF", async ({ merchant, user }) => {
    const d = ProductInput.parse(input);
    const price = d.price == null ? null : toMinorUnits(d.price, merchant.currency);
    const values = {
      kind: d.kind,
      name: d.name,
      description: d.description,
      category: d.category,
      sku: d.sku,
      price,
      currency: merchant.currency,
      unit: d.unit,
      inventoryStatus: d.inventoryStatus,
      stockQuantity: d.stockQuantity,
      tags: d.tags,
      images: d.images,
      active: d.active,
    };
    let productId = d.id;
    await db().transaction(async (tx) => {
      if (productId) {
        const updated = await tx.update(products).set(values).where(and(eq(products.id, productId), eq(products.merchantId, merchantId))).returning({ id: products.id });
        if (!updated.length) throw new AppError("NOT_FOUND", "Product not found");
      } else {
        let slug = slugify(d.name) || "item";
        const taken = new Set((await tx.select({ slug: products.slug }).from(products).where(eq(products.merchantId, merchantId))).map((r) => r.slug));
        for (let i = 2; taken.has(slug); i++) slug = `${slugify(d.name)}-${i}`;
        const [row] = await tx.insert(products).values({ ...values, merchantId, slug }).returning({ id: products.id });
        productId = row!.id;
      }
      const existing = await tx.select({ id: productVariants.id }).from(productVariants).where(and(eq(productVariants.productId, productId!), eq(productVariants.merchantId, merchantId)));
      const keep = new Set(d.variants.map((v) => v.id).filter(Boolean));
      const remove = existing.filter((e) => !keep.has(e.id)).map((e) => e.id);
      // Variants referenced by past orders are deactivated, not deleted (order snapshots keep names).
      if (remove.length) await tx.update(productVariants).set({ active: false }).where(inArray(productVariants.id, remove));
      for (const [i, v] of d.variants.entries()) {
        const vals = { name: v.name, options: v.options, price: v.price == null ? null : toMinorUnits(v.price, merchant.currency), inventoryStatus: v.inventoryStatus, stockQuantity: v.stockQuantity, active: v.active, sortOrder: i };
        if (v.id && existing.some((e) => e.id === v.id)) await tx.update(productVariants).set(vals).where(eq(productVariants.id, v.id));
        else await tx.insert(productVariants).values({ ...vals, productId: productId!, merchantId });
      }
    });
    await audit(db(), { merchantId, actorType: "user", actorId: user.id, action: d.id ? "product.updated" : "product.created", targetType: "product", targetId: productId });
    return { id: productId! };
  });
}

export async function setProductActiveAction(merchantId: string, productId: string, active: boolean) {
  return run(merchantId, "STAFF", async () => {
    await db().update(products).set({ active }).where(and(eq(products.id, z.string().uuid().parse(productId)), eq(products.merchantId, merchantId)));
    return {};
  });
}

const ServiceInput = z.object({
  id: z.string().uuid().optional(),
  kind: z.enum(["SERVICE", "APPOINTMENT"]),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(2000).nullable(),
  category: z.string().trim().max(60).nullable(),
  priceMin: money,
  priceMax: money,
  durationMinutes: z.number().int().min(5).max(24 * 60).nullable(),
  locationType: z.enum(["in_store", "at_customer", "online"]),
  depositAmount: money,
  bookingRequirements: z.string().trim().max(500).nullable(),
  options: z.array(z.object({ name: z.string().trim().min(1).max(60), priceDelta: money, durationDelta: z.number().int().min(0).max(600).nullable() })).max(20),
  availability: z
    .object({
      days: z.array(z.enum(WEEKDAYS as unknown as [string, ...string[]])).min(1),
      open: z.string().regex(TIME),
      close: z.string().regex(TIME),
      slotIntervalMinutes: z.number().int().min(5).max(480),
      capacityPerSlot: z.number().int().min(1).max(50),
      leadTimeHours: z.number().int().min(0).max(24 * 14),
      advanceDays: z.number().int().min(1).max(365),
    })
    .nullable(),
  active: z.boolean(),
});

export async function saveServiceAction(merchantId: string, input: z.input<typeof ServiceInput>) {
  return run(merchantId, "STAFF", async ({ merchant, user }) => {
    const d = ServiceInput.parse(input);
    const cur = (v: number | null) => (v == null ? null : toMinorUnits(v, merchant.currency));
    if (d.availability && d.availability.open >= d.availability.close) throw new AppError("VALIDATION", "Closing time must be after opening time");
    const values = {
      kind: d.kind,
      name: d.name,
      description: d.description,
      category: d.category,
      priceMin: cur(d.priceMin),
      priceMax: cur(d.priceMax),
      currency: merchant.currency,
      durationMinutes: d.durationMinutes,
      locationType: d.locationType,
      depositAmount: cur(d.depositAmount),
      bookingRequirements: d.bookingRequirements,
      options: d.options.map((o) => ({ name: o.name, priceDelta: cur(o.priceDelta), durationDelta: o.durationDelta })),
      availability: d.availability
        ? {
            weekly: Object.fromEntries(d.availability.days.map((day) => [day, [[d.availability!.open, d.availability!.close]]])),
            slotIntervalMinutes: d.availability.slotIntervalMinutes,
            capacityPerSlot: d.availability.capacityPerSlot,
            leadTimeHours: d.availability.leadTimeHours,
            advanceDays: d.availability.advanceDays,
          }
        : null,
      active: d.active,
    };
    let id = d.id;
    if (id) {
      const updated = await db().update(services).set(values).where(and(eq(services.id, id), eq(services.merchantId, merchantId))).returning({ id: services.id });
      if (!updated.length) throw new AppError("NOT_FOUND", "Service not found");
    } else {
      let slug = slugify(d.name) || "service";
      const taken = new Set((await db().select({ slug: services.slug }).from(services).where(eq(services.merchantId, merchantId))).map((r) => r.slug));
      for (let i = 2; taken.has(slug); i++) slug = `${slugify(d.name)}-${i}`;
      const [row] = await db().insert(services).values({ ...values, merchantId, slug }).returning({ id: services.id });
      id = row!.id;
    }
    await audit(db(), { merchantId, actorType: "user", actorId: user.id, action: d.id ? "service.updated" : "service.created", targetType: "service", targetId: id });
    return { id: id! };
  });
}

/* ─────────────────────────────── Orders & bookings ─────────────────────────────── */

export async function transitionOrderAction(merchantId: string, orderId: string, to: string, note?: string) {
  return run(merchantId, "STAFF", async ({ user, merchant }) => {
    const target = z.enum(ORDER_STATUSES).parse(to);
    const summary = await transitionOrder(db(), { merchantId, orderId: z.string().uuid().parse(orderId), to: target, actor: { type: "merchant", id: user.id }, note: note?.slice(0, 300) });
    // Outcomes that matter next time become customer memory (cancellations, refunds).
    if (target === "cancelled" || target === "refunded") {
      const [o] = await db().select({ customerId: orders.customerId }).from(orders).where(eq(orders.id, summary.id));
      const [c] = o ? await db().select().from(customers).where(eq(customers.id, o.customerId)) : [];
      if (c && c.memoryEnabled && merchant.niaSettings.memoryEnabled) {
        await persistMemory(db(), memoryStore(), {
          merchantId,
          customerId: c.id,
          scope: "customer",
          type: target === "refunded" ? "RETURN_OR_REFUND_CONTEXT" : "OUTCOME",
          subject: `order_${summary.number}_${target}`,
          value: target,
          statement: `Order #${summary.number} was ${target} by the shop on ${new Date().toISOString().slice(0, 10)}${note ? ` (reason: ${note.slice(0, 160)})` : ""}.`,
          label: `Order #${summary.number} ${target}`,
          confirmation: "merchant_entered",
          explicit: true,
          confidence: 1,
          importance: 0.7,
          durability: "long_term",
          score: 0.8,
          significant: true,
          sourceKind: "order",
          orderId: summary.id,
          supersede: false,
        }).catch((err) => console.error("[memory] outcome memory failed", (err as Error).message));
      }
    }
    return { status: summary.status };
  });
}

export async function markOrderPaidAction(merchantId: string, orderId: string) {
  return run(merchantId, "ADMIN", async ({ user }) => {
    const id = z.string().uuid().parse(orderId);
    const [o] = await db().select().from(orders).where(and(eq(orders.id, id), eq(orders.merchantId, merchantId)));
    if (!o) throw new AppError("NOT_FOUND", "Order not found");
    if (o.status === "confirmed") await transitionOrder(db(), { merchantId, orderId: id, to: "paid", actor: { type: "merchant", id: user.id }, note: "Payment confirmed by the shop" });
    else if (["processing", "ready", "dispatched", "delivered"].includes(o.status)) await db().update(orders).set({ paymentStatus: "paid", paidAt: new Date() }).where(eq(orders.id, id));
    else throw new AppError("CONFLICT", "Confirm the order before recording payment");
    await audit(db(), { merchantId, actorType: "user", actorId: user.id, action: "order.payment_confirmed", targetType: "order", targetId: id });
    return {};
  });
}

export async function transitionBookingAction(merchantId: string, bookingId: string, to: string) {
  return run(merchantId, "STAFF", async () => {
    const target = z.enum(BOOKING_STATUSES).parse(to);
    const b = await transitionBooking(db(), { merchantId, bookingId: z.string().uuid().parse(bookingId), to: target, actor: { type: "merchant" } });
    return { status: b.status };
  });
}

/* ─────────────────────────────── Team ─────────────────────────────── */

export async function inviteMemberAction(merchantId: string, email: string, role: "ADMIN" | "STAFF") {
  return run(merchantId, "OWNER", async ({ user }) => {
    const e = z.string().trim().toLowerCase().email().parse(email);
    const r = z.enum(["ADMIN", "STAFF"]).parse(role);
    const [existingUser] = await db().select().from(users).where(eq(users.email, e));
    if (existingUser) {
      await db().insert(merchantMembers).values({ merchantId, userId: existingUser.id, role: r }).onConflictDoNothing();
    } else {
      await db().insert(merchantInvites).values({ merchantId, email: e, role: r, invitedByUserId: user.id }).onConflictDoUpdate({ target: [merchantInvites.merchantId, merchantInvites.email], set: { role: r } });
    }
    await audit(db(), { merchantId, actorType: "user", actorId: user.id, action: "team.invited", metadata: { role: r } });
    return { joined: Boolean(existingUser) };
  });
}

export async function removeMemberAction(merchantId: string, memberUserId: string) {
  return run(merchantId, "OWNER", async ({ user }) => {
    const id = z.string().uuid().parse(memberUserId);
    if (id === user.id) throw new AppError("VALIDATION", "You can't remove yourself");
    await db().delete(merchantMembers).where(and(eq(merchantMembers.merchantId, merchantId), eq(merchantMembers.userId, id), ne(merchantMembers.role, "OWNER")));
    return {};
  });
}
