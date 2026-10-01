import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, asc, eq } from "drizzle-orm";
import { applyDemoShopPolicies, applyDemoTemplate, merchantKnowledge, merchants, orderEvents, productVariants, products, services, type Database } from "@nia/database";
import { setupTestDb, createMerchant, createCustomer, createUser } from "@nia/database/testing";
import { orderProgress } from "@nia/shared";
import {
  accountForCustomer,
  addItemToDraft,
  availableSlots,
  confirmBookingRequest,
  createBookingDraft,
  deliveryEstimate,
  isOverdue,
  recentOrdersForAccount,
  setDraftFulfillment,
  settleDemoBooking,
  settleDemoOrder,
  submitDraft,
} from "../src";

let db: Database;
let close: () => Promise<void>;
let demo: Awaited<ReturnType<typeof createMerchant>>;
let real: Awaited<ReturnType<typeof createMerchant>>;

beforeAll(async () => {
  ({ db, close } = await setupTestDb());
  demo = await createMerchant(db, { name: "Adire Lane", timezone: "Africa/Lagos", isDemo: true });
  await applyDemoTemplate(db, demo.id, "fabric");
  real = await createMerchant(db, { name: "Real Fabrics", timezone: "Africa/Lagos" });
  await applyDemoTemplate(db, real.id, "fabric");
  // Re-read: the template set its delivery areas and pickup address.
  demo = (await db.select().from(merchants).where(eq(merchants.id, demo.id)))[0]!;
});
afterAll(async () => close());

async function emerald(merchantId: string) {
  const [p] = await db.select().from(products).where(and(eq(products.merchantId, merchantId), eq(products.slug, "classic-ankara-wax-print")));
  const [v] = await db.select().from(productVariants).where(and(eq(productVariants.productId, p!.id), eq(productVariants.name, "Emerald")));
  return { productId: p!.id, variantId: v!.id };
}

async function placed(merchantId: string, fulfil: { method: "delivery" | "pickup"; deliveryArea?: string }) {
  const customer = await createCustomer(db, merchantId);
  await addItemToDraft(db, { merchantId, customerId: customer.id, ...(await emerald(merchantId)), quantity: 6, channel: "web" });
  await setDraftFulfillment(db, { merchantId, customerId: customer.id, ...fulfil, channel: "web" });
  return { customer, order: await submitDraft(db, { merchantId, customerId: customer.id }) };
}

describe("demo checkout", () => {
  it("pays a demo-shop delivery at once and sends it out, with the shop's own estimate", async () => {
    const { order } = await placed(demo.id, { method: "delivery", deliveryArea: "Lekki" });
    expect(order.checkout).toBe("demo");
    const settled = await settleDemoOrder(db, { merchantId: demo.id, orderId: order.id });
    expect(settled.status).toBe("dispatched");
    expect(settled.paymentStatus).toBe("paid");
    expect(settled.paymentMode).toBe("demo");
    expect(settled.paidAt).not.toBeNull();
    // Lekki is a same-day area for this shop.
    expect(settled.estimate?.expectedBy).toBeTruthy();
    expect(settled.overdue).toBe(false);
    expect(orderProgress(settled).headline).toBe("On its way to Lekki");

    const events = await db.select().from(orderEvents).where(eq(orderEvents.orderId, order.id)).orderBy(asc(orderEvents.createdAt));
    expect(events.map((e) => e.toStatus)).toEqual(["awaiting_confirmation", "confirmed", "paid", "processing", "ready", "dispatched"]);
    expect(events.slice(1).every((e) => e.actorType === "system")).toBe(true);

    // Running it again changes nothing.
    await settleDemoOrder(db, { merchantId: demo.id, orderId: order.id });
    expect(await db.select().from(orderEvents).where(eq(orderEvents.orderId, order.id))).toHaveLength(6);
  });

  it("makes a pickup order ready to collect at the shop's address", async () => {
    const { order } = await placed(demo.id, { method: "pickup" });
    const settled = await settleDemoOrder(db, { merchantId: demo.id, orderId: order.id });
    expect(settled.status).toBe("ready");
    expect(settled.pickupAddress).toMatch(/Lekki Phase 1/);
    const p = orderProgress(settled);
    expect(p.headline).toBe("Ready for pickup");
    expect(p.detail).toContain("7 Demo Close");
  });

  it("never touches a real shop's order", async () => {
    const { order } = await placed(real.id, { method: "delivery", deliveryArea: "Lekki" });
    expect(order.checkout).toBe("shop");
    const after = await settleDemoOrder(db, { merchantId: real.id, orderId: order.id });
    expect(after.status).toBe("awaiting_confirmation");
    expect(after.paymentStatus).toBe("unpaid");
  });

  it("leaves a demo order that still needs a quote for the shop", async () => {
    const customer = await createCustomer(db, demo.id);
    const [custom] = await db.select().from(products).where(and(eq(products.merchantId, demo.id), eq(products.slug, "made-to-measure-outfit")));
    await addItemToDraft(db, { merchantId: demo.id, customerId: customer.id, productId: custom!.id, variantId: null, quantity: 1, channel: "web" });
    await setDraftFulfillment(db, { merchantId: demo.id, customerId: customer.id, method: "pickup", channel: "web" });
    const order = await submitDraft(db, { merchantId: demo.id, customerId: customer.id });
    expect(order.checkout).toBe("shop");
    expect((await settleDemoOrder(db, { merchantId: demo.id, orderId: order.id })).status).toBe("awaiting_confirmation");
  });

  it("estimates only from listed areas, and flags a delivery 24 hours past its estimate", () => {
    const from = new Date("2026-10-01T09:00:00Z");
    expect(deliveryEstimate(demo, "Lekki", from)).toEqual({ label: "today", expectedBy: "2026-10-01T15:00:00.000Z" });
    expect(deliveryEstimate(demo, "Lekki", new Date("2026-10-01T20:30:00Z"))?.label).toBe("by Fri 2 Oct");
    expect(deliveryEstimate(demo, "yaba", from)?.label).toBe("by Fri 2 Oct");
    expect(deliveryEstimate(demo, "Abuja", from)).toBeNull();
    const estimate = { expectedBy: "2026-10-01T15:00:00.000Z" };
    expect(isOverdue("dispatched", estimate, new Date("2026-10-02T14:00:00Z"))).toBe(false);
    expect(isOverdue("dispatched", estimate, new Date("2026-10-02T16:00:00Z"))).toBe(true);
    expect(isOverdue("delivered", estimate, new Date("2026-10-09T00:00:00Z"))).toBe(false);
  });

  it("confirms a demo shop's booking request straight away (real shops confirm it themselves)", async () => {
    for (const [shop, expected] of [
      [demo, "confirmed"],
      [real, null],
    ] as const) {
      const customer = await createCustomer(db, shop.id);
      const [service] = await db.select().from(services).where(and(eq(services.merchantId, shop.id), eq(services.slug, "measurement-style-consultation")));
      const [slot] = await availableSlots(db, service!, "Africa/Lagos", { limit: 1 });
      const draft = await createBookingDraft(db, { merchantId: shop.id, customerId: customer.id, serviceId: service!.id, startAt: slot!.startAt, channel: "web" });
      const requested = await confirmBookingRequest(db, { merchantId: shop.id, customerId: customer.id, bookingId: draft.id });
      expect(requested.status).toBe("pending");
      expect((await settleDemoBooking(db, { merchantId: shop.id, bookingId: draft.id }))?.status ?? null).toBe(expected);
    }
  });

  it("gives demo shops the demo-payment and late-delivery policies, and retires their old payment note", async () => {
    await db.insert(merchantKnowledge).values({ merchantId: demo.id, category: "faq", title: "Payment", body: "We confirm availability first, then share bank-transfer details." }).onConflictDoNothing();
    expect(await applyDemoShopPolicies(db, demo.id)).toBe(2);
    expect(await applyDemoShopPolicies(db, demo.id)).toBe(0);
    expect(await applyDemoShopPolicies(db, real.id)).toBe(0);
    const rows = await db.select().from(merchantKnowledge).where(eq(merchantKnowledge.merchantId, demo.id));
    expect(rows.find((k) => k.title === "Payment")?.active).toBe(false);
    expect(rows.find((k) => k.title === "Late or missing delivery")?.body).toMatch(/within 24 hours of the estimated time/);
  });

  it("lists an account's orders across shops with that shop's delivery policy", async () => {
    const user = await createUser(db);
    const customer = await createCustomer(db, demo.id, { userId: user.id });
    await addItemToDraft(db, { merchantId: demo.id, customerId: customer.id, ...(await emerald(demo.id)), quantity: 6, channel: "web" });
    await setDraftFulfillment(db, { merchantId: demo.id, customerId: customer.id, method: "delivery", deliveryArea: "Yaba", channel: "web" });
    const order = await submitDraft(db, { merchantId: demo.id, customerId: customer.id });
    await settleDemoOrder(db, { merchantId: demo.id, orderId: order.id });
    await applyDemoShopPolicies(db, demo.id);

    const account = await accountForCustomer(db, customer.id);
    expect(account.userId).toBe(user.id);
    const [mine, ...rest] = await recentOrdersForAccount(db, account);
    expect(rest).toEqual([]);
    expect(mine!.id).toBe(order.id);
    expect(mine!.shop.name).toBe("Adire Lane");
    expect(mine!.status).toBe("dispatched");
    expect(mine!.deliveryPolicy).toMatch(/^Late or missing delivery: /);
    // Someone else's account sees none of it.
    expect(await recentOrdersForAccount(db, { userId: (await createUser(db)).id })).toEqual([]);
  });
});
