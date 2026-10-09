import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { applyDemoTemplate, productVariants, products, services, type Database } from "@nia/database";
import { setupTestDb, createMerchant, createCustomer, createUser } from "@nia/database/testing";
import {
  addItemToDraft,
  availableSlots,
  confirmBookingRequest,
  createBookingDraft,
  getAvailableBookingSlots,
  getCustomerRecentOrders,
  merchantMetrics,
  removeDraftItem,
  reorderToDraft,
  searchProducts,
  searchServices,
  setDraftFulfillment,
  submitDraft,
  transitionOrder,
  updateDraftItem,
  zonedToUtc,
  verifyPaystackSignature,
} from "../src";
import { createHmac } from "node:crypto";

let db: Database;
let close: () => Promise<void>;
let fabricShop: Awaited<ReturnType<typeof createMerchant>>;
let salon: Awaited<ReturnType<typeof createMerchant>>;

beforeAll(async () => {
  ({ db, close } = await setupTestDb());
  fabricShop = await createMerchant(db, { name: "Adire Lane", timezone: "Africa/Lagos" });
  await applyDemoTemplate(db, fabricShop.id, "fabric");
  salon = await createMerchant(db, { name: "Glow Theory", timezone: "Africa/Lagos" });
  await applyDemoTemplate(db, salon.id, "beauty");
});
afterAll(async () => close());

async function variantId(merchantId: string, productSlug: string, name: string) {
  const [p] = await db.select().from(products).where(and(eq(products.merchantId, merchantId), eq(products.slug, productSlug)));
  const [v] = await db.select().from(productVariants).where(and(eq(productVariants.productId, p!.id), eq(productVariants.name, name)));
  return { productId: p!.id, variantId: v!.id };
}

describe("catalog search", () => {
  it("finds real products by keyword", async () => {
    const results = await searchProducts(db, fabricShop.id, { query: "ankara" });
    expect(results[0]?.name).toBe("Classic Ankara Wax Print");
  });

  it("filters variants by colour family and size", async () => {
    const dark = await searchProducts(db, fabricShop.id, { query: "kaftan", colour: "darker", size: "M" });
    expect(dark).toHaveLength(1);
    const matched = dark[0]!.variants.filter((v) => dark[0]!.matchedVariantIds?.includes(v.id));
    expect(matched.map((v) => v.name).sort()).toEqual(["Black / M", "Navy / M"]);
    const blue = await searchProducts(db, fabricShop.id, { query: "ankara", colour: "blue" });
    expect(blue[0]!.variants.find((v) => blue[0]!.matchedVariantIds?.includes(v.id))?.name).toBe("Cobalt Blue");
  });

  it("respects budget constraints", async () => {
    const cheap = await searchProducts(db, fabricShop.id, { maxPrice: 1_000_000, limit: 24 });
    expect(cheap.every((p) => p.price != null && p.price <= 1_000_000)).toBe(true);
    expect(cheap.some((p) => p.name === "Corded French Lace")).toBe(false);
  });

  it("returns nothing rather than inventing products", async () => {
    expect(await searchProducts(db, fabricShop.id, { query: "iphone charger" })).toEqual([]);
  });

  it("is tenant-isolated", async () => {
    expect(await searchProducts(db, salon.id, { query: "ankara" })).toEqual([]);
    expect((await searchProducts(db, salon.id, { query: "shea" }))[0]?.name).toBe("Whipped Shea Body Butter");
  });

  it("marks unknown availability honestly", async () => {
    const [custom] = await searchProducts(db, fabricShop.id, { query: "made-to-measure" });
    expect(custom?.price).toBeNull();
    expect(custom?.inventoryStatus).toBe("made_to_order");
  });

  it("searches services with next availability", async () => {
    const [svc] = await searchServices(db, salon.id, "Africa/Lagos", { query: "braids" });
    expect(svc?.name).toBe("Knotless Braids");
    expect(svc?.depositAmount).toBe(1_500_000);
    expect(svc?.nextAvailable).toBeTruthy();
  });
});

describe("cart and orders", () => {
  it("runs the full cart → confirmation → merchant lifecycle", async () => {
    const customer = await createCustomer(db, fabricShop.id, { userId: (await createUser(db)).id });
    const emerald = await variantId(fabricShop.id, "classic-ankara-wax-print", "Emerald");

    await expect(
      addItemToDraft(db, { merchantId: fabricShop.id, customerId: customer.id, productId: emerald.productId, quantity: 6, channel: "web" }),
    ).rejects.toThrow(/choose an option/);

    let cart = await addItemToDraft(db, { merchantId: fabricShop.id, customerId: customer.id, ...emerald, quantity: 4, channel: "web" });
    cart = await addItemToDraft(db, { merchantId: fabricShop.id, customerId: customer.id, ...emerald, quantity: 2, channel: "web" });
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0]!.quantity).toBe(6);
    expect(cart.subtotal).toBe(6 * 750_000);
    expect(cart.blockers).toContain("Choose delivery or pickup");

    await expect(
      setDraftFulfillment(db, { merchantId: fabricShop.id, customerId: customer.id, method: "delivery", deliveryArea: "Abuja", channel: "web" }),
    ).rejects.toThrow(/doesn't list "Abuja"/);
    cart = await setDraftFulfillment(db, { merchantId: fabricShop.id, customerId: customer.id, method: "delivery", deliveryArea: "lekki", channel: "web" });
    expect(cart.deliveryArea).toBe("Lekki");
    expect(cart.total).toBe(6 * 750_000 + 350_000);
    expect(cart.blockers).toEqual([]);

    const submitted = await submitDraft(db, { merchantId: fabricShop.id, customerId: customer.id });
    expect(submitted.status).toBe("awaiting_confirmation");
    expect(submitted.number).toBeGreaterThanOrEqual(1001);

    const [v] = await db.select().from(productVariants).where(eq(productVariants.id, emerald.variantId));
    expect(v!.stockQuantity).toBe(54); // stock reserved

    await expect(transitionOrder(db, { merchantId: fabricShop.id, orderId: submitted.id, to: "delivered", actor: { type: "merchant" } })).rejects.toThrow(/Cannot move/);
    await expect(transitionOrder(db, { merchantId: fabricShop.id, orderId: submitted.id, to: "confirmed", actor: { type: "customer", id: customer.id } })).rejects.toThrow(/only cancel/);
    const confirmed = await transitionOrder(db, { merchantId: fabricShop.id, orderId: submitted.id, to: "confirmed", actor: { type: "merchant" } });
    expect(confirmed.status).toBe("confirmed");
    // Another merchant cannot touch it.
    await expect(transitionOrder(db, { merchantId: salon.id, orderId: submitted.id, to: "paid", actor: { type: "merchant" } })).rejects.toThrow(/not found/);

    const recent = await getCustomerRecentOrders(db, fabricShop.id, customer.id);
    expect(recent[0]?.id).toBe(submitted.id);
  });

  it("rejects out-of-stock and over-stock quantities", async () => {
    const customer = await createCustomer(db, fabricShop.id);
    const wine = await variantId(fabricShop.id, "corded-french-lace", "Wine");
    await expect(addItemToDraft(db, { merchantId: fabricShop.id, customerId: customer.id, ...wine, quantity: 1, channel: "web" })).rejects.toThrow(/out of stock/);
    const terracotta = await variantId(fabricShop.id, "classic-ankara-wax-print", "Terracotta");
    await expect(addItemToDraft(db, { merchantId: fabricShop.id, customerId: customer.id, ...terracotta, quantity: 7, channel: "web" })).rejects.toThrow(/Only 6/);
  });

  it("prevents editing another customer's cart (IDOR)", async () => {
    const owner = await createCustomer(db, fabricShop.id);
    const intruder = await createCustomer(db, fabricShop.id);
    const emerald = await variantId(fabricShop.id, "classic-ankara-wax-print", "Emerald");
    const cart = await addItemToDraft(db, { merchantId: fabricShop.id, customerId: owner.id, ...emerald, quantity: 1, channel: "web" });
    const itemId = cart.items[0]!.id;
    await expect(removeDraftItem(db, { merchantId: fabricShop.id, customerId: intruder.id, itemId })).rejects.toThrow();
    await expect(updateDraftItem(db, { merchantId: fabricShop.id, customerId: intruder.id, itemId, quantity: 50 })).rejects.toThrow();
  });

  it("reorders 'same as last time' at today's prices", async () => {
    const customer = await createCustomer(db, fabricShop.id);
    const black = await variantId(fabricShop.id, "midnight-linen-kaftan", "Black / M");
    await addItemToDraft(db, { merchantId: fabricShop.id, customerId: customer.id, ...black, quantity: 1, channel: "web" });
    await setDraftFulfillment(db, { merchantId: fabricShop.id, customerId: customer.id, method: "pickup", channel: "web" });
    const first = await submitDraft(db, { merchantId: fabricShop.id, customerId: customer.id });

    const again = await reorderToDraft(db, { merchantId: fabricShop.id, customerId: customer.id, orderId: first.id, channel: "telegram" });
    expect(again.added).toEqual(["1 × Midnight Linen Kaftan (Black / M)"]);
    expect(again.summary.memoryAssisted).toBe(true);
    expect(again.summary.status).toBe("draft");

    // Repeating the same order again ("Same quantity" after the cart was started) never doubles it.
    const twice = await reorderToDraft(db, { merchantId: fabricShop.id, customerId: customer.id, orderId: first.id, channel: "web" });
    expect(twice.alreadyInCart).toBe(true);
    expect(twice.added).toEqual([]);
    expect(twice.summary.items.map((i) => i.quantity)).toEqual([1]);
  });
});

describe("bookings", () => {
  it("computes slots in the merchant time zone with lead time", async () => {
    const [svc] = await db.select().from(services).where(and(eq(services.merchantId, salon.id), eq(services.slug, "gel-manicure")));
    // Monday 2026-09-28 08:00 Lagos → Tuesday is the first open day (Tue–Sat).
    const from = zonedToUtc("2026-09-28", "08:00", "Africa/Lagos");
    const slots = await availableSlots(db, svc!, "Africa/Lagos", { from, limit: 3 });
    expect(slots[0]!.startAt).toBe(zonedToUtc("2026-09-29", "10:00", "Africa/Lagos").toISOString());
    expect(slots[0]!.startAt).toBe("2026-09-29T09:00:00.000Z"); // Lagos is UTC+1
  });

  it("holds a draft until the customer confirms, and enforces capacity", async () => {
    const [svc] = await db.select().from(services).where(and(eq(services.merchantId, salon.id), eq(services.slug, "brow-lamination")));
    const { slots } = await getAvailableBookingSlots(db, { merchantId: salon.id, serviceId: svc!.id });
    const slot = slots[0]!;
    const a = await createCustomer(db, salon.id);
    const b = await createCustomer(db, salon.id);

    const draftA = await createBookingDraft(db, { merchantId: salon.id, customerId: a.id, serviceId: svc!.id, startAt: slot.startAt, channel: "web" });
    expect(draftA.status).toBe("draft");
    const pendingA = await confirmBookingRequest(db, { merchantId: salon.id, customerId: a.id, bookingId: draftA.id });
    expect(pendingA.status).toBe("pending");

    // capacity 1 → the same slot is gone for customer B
    await expect(createBookingDraft(db, { merchantId: salon.id, customerId: b.id, serviceId: svc!.id, startAt: slot.startAt, channel: "web" })).rejects.toThrow(/not available/);
    // B cannot confirm A's booking
    await expect(confirmBookingRequest(db, { merchantId: salon.id, customerId: b.id, bookingId: draftA.id })).rejects.toThrow(/not found/);
  });
});

describe("metrics and payments", () => {
  it("computes metrics only from real rows", async () => {
    const fresh = await createMerchant(db);
    const m = await merchantMetrics(db, fresh.id);
    expect(m).toMatchObject({ revenue: 0, orders: 0, repeatCustomers: 0, revenuePrevious: null, memoryAssistedOrders: 0 });
  });

  it("verifies Paystack webhook signatures", () => {
    const body = JSON.stringify({ event: "charge.success" });
    const sig = createHmac("sha512", "sk_test_x").update(body).digest("hex");
    expect(verifyPaystackSignature(body, sig, "sk_test_x")).toBe(true);
    expect(verifyPaystackSignature(body, sig, "sk_test_y")).toBe(false);
    expect(verifyPaystackSignature(body, null, "sk_test_x")).toBe(false);
  });
});
