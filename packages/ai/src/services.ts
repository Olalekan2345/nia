/**
 * Customer-confirmed commerce actions. These run only on an explicit
 * customer action (web Confirm button, Telegram inline button) — never from
 * a model tool call. Placing an order also records it as Walrus memory.
 */
import { and, eq } from "drizzle-orm";
import { audit, orders, type Customer, type Db, type Merchant } from "@nia/database";
import {
  bookingSummary,
  confirmBookingRequest,
  orderSummary,
  getCustomerRecentOrders,
  startPayment,
  submitDraft,
  transitionBooking,
  transitionOrder,
  type BookingSummaryData,
  type OrderSummaryData,
  type PaymentStart,
} from "@nia/commerce";
import { rememberOrderPatterns, rememberPastOrder, rememberPastService, type MemoryReceipt, type MemoryStore } from "@nia/memory";
import { AppError, type Channel } from "@nia/shared";
import { bookings } from "@nia/database";

export interface ActionContext {
  db: Db;
  store: MemoryStore | null;
  merchant: Merchant;
  customer: Customer;
  channel: Channel;
}

function memoryAllowed(ctx: ActionContext): boolean {
  return Boolean(ctx.store) && ctx.merchant.niaSettings.memoryEnabled && ctx.customer.memoryEnabled;
}

export async function confirmCustomerOrder(
  ctx: ActionContext,
  orderId?: string,
): Promise<{ summary: OrderSummaryData; payment: PaymentStart | null; receipt: MemoryReceipt | null }> {
  const { db, merchant, customer } = ctx;
  const submitted = await submitDraft(db, { merchantId: merchant.id, customerId: customer.id, orderId });
  const [order] = await db.select().from(orders).where(and(eq(orders.id, submitted.id), eq(orders.merchantId, merchant.id)));

  let payment: PaymentStart | null = null;
  try {
    payment = await startPayment(db, order!, merchant, customer.email);
  } catch (err) {
    console.error("[payments] could not start payment", (err as Error).message);
  }

  let receipt: MemoryReceipt | null = null;
  if (memoryAllowed(ctx)) {
    try {
      receipt = await rememberPastOrder(db, ctx.store, {
        merchantId: merchant.id,
        customerId: customer.id,
        orderId: submitted.id,
        orderNumber: submitted.number!,
        placedAt: new Date(submitted.submittedAt ?? Date.now()),
        channel: ctx.channel,
        currency: submitted.currency,
        locale: merchant.locale,
        items: submitted.items.map((i) => ({ name: i.name, variantLabel: i.variantLabel, quantity: i.quantity, unit: i.unit, unitPrice: i.unitPrice })),
        fulfillmentMethod: submitted.fulfillmentMethod,
        deliveryArea: submitted.deliveryArea,
        total: submitted.total,
        hasUnpricedItems: submitted.hasUnpricedItems,
      });
      // Repeated choices across real orders become evidence-sized observations.
      const history = await getCustomerRecentOrders(db, merchant.id, customer.id, 20);
      await rememberOrderPatterns(db, ctx.store, { merchantId: merchant.id, customerId: customer.id, channel: ctx.channel, orders: history });
    } catch (err) {
      console.error("[memory] could not record order memory", (err as Error).message);
    }
  }
  await audit(db, { merchantId: merchant.id, actorType: "customer", actorId: customer.id, action: "order.submitted", targetType: "order", targetId: submitted.id, metadata: { channel: ctx.channel } });
  return { summary: await orderSummary(db, merchant.id, submitted.id), payment, receipt };
}

export async function cancelCustomerOrder(ctx: ActionContext, orderId: string): Promise<OrderSummaryData> {
  const [order] = await ctx.db.select().from(orders).where(and(eq(orders.id, orderId), eq(orders.merchantId, ctx.merchant.id), eq(orders.customerId, ctx.customer.id)));
  if (!order) throw new AppError("NOT_FOUND", "Order not found");
  return transitionOrder(ctx.db, { merchantId: ctx.merchant.id, orderId, to: "cancelled", actor: { type: "customer", id: ctx.customer.id } });
}

export async function confirmCustomerBooking(
  ctx: ActionContext,
  bookingId: string,
): Promise<{ booking: BookingSummaryData; receipt: MemoryReceipt | null }> {
  const { db, merchant, customer } = ctx;
  const booking = await confirmBookingRequest(db, { merchantId: merchant.id, customerId: customer.id, bookingId });
  let receipt: MemoryReceipt | null = null;
  if (memoryAllowed(ctx)) {
    try {
      receipt = await rememberPastService(db, ctx.store, {
        merchantId: merchant.id,
        customerId: customer.id,
        bookingId: booking.id,
        serviceName: booking.serviceName,
        startAt: new Date(booking.startAt),
        timeZone: merchant.timezone,
        options: booking.selectedOptions,
        notes: booking.notes,
        channel: ctx.channel,
      });
    } catch (err) {
      console.error("[memory] could not record booking memory", (err as Error).message);
    }
  }
  await audit(db, { merchantId: merchant.id, actorType: "customer", actorId: customer.id, action: "booking.requested", targetType: "booking", targetId: booking.id });
  return { booking, receipt };
}

export async function cancelCustomerBooking(ctx: ActionContext, bookingId: string): Promise<BookingSummaryData> {
  const [b] = await ctx.db.select().from(bookings).where(and(eq(bookings.id, bookingId), eq(bookings.merchantId, ctx.merchant.id), eq(bookings.customerId, ctx.customer.id)));
  if (!b) throw new AppError("NOT_FOUND", "Booking not found");
  if (b.status === "draft") {
    await ctx.db.delete(bookings).where(eq(bookings.id, b.id));
    return bookingSummary({ ...b, status: "cancelled" }, ctx.merchant.timezone);
  }
  return transitionBooking(ctx.db, { merchantId: ctx.merchant.id, bookingId, to: "cancelled", actor: { type: "customer" } });
}
