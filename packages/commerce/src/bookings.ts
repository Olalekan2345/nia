/**
 * Booking engine: draft (proposal shown to the customer) → pending (customer
 * confirmed) → confirmed (merchant) → completed; plus cancelled / no_show.
 */
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { bookings, merchants, services, type Booking, type Db } from "@nia/database";
import { AppError, BOOKING_STATUS_LABELS, BOOKING_TRANSITIONS, type BookingStatus, type Channel } from "@nia/shared";
import { availableSlots, type SlotQuery } from "./slots";
import type { BookingSummaryData, SlotData } from "./types";

async function merchantTz(db: Db, merchantId: string): Promise<string> {
  const [m] = await db.select({ tz: merchants.timezone }).from(merchants).where(eq(merchants.id, merchantId));
  if (!m) throw new AppError("NOT_FOUND", "Merchant not found");
  return m.tz;
}

export function bookingSummary(b: Booking, timeZone: string): BookingSummaryData {
  return {
    kind: "booking",
    id: b.id,
    status: b.status,
    statusLabel: BOOKING_STATUS_LABELS[b.status],
    serviceId: b.serviceId,
    serviceName: b.serviceName,
    startAt: b.startAt.toISOString(),
    endAt: b.endAt.toISOString(),
    timeZone,
    selectedOptions: b.selectedOptions,
    price: b.price,
    depositAmount: b.depositAmount,
    currency: b.currency,
    notes: b.notes,
    memoryAssisted: b.memoryAssisted,
  };
}

export async function getAvailableBookingSlots(
  db: Db,
  { merchantId, serviceId, query }: { merchantId: string; serviceId: string; query?: SlotQuery },
): Promise<{ service: string; timeZone: string; slots: SlotData[] }> {
  const [service] = await db.select().from(services).where(and(eq(services.id, serviceId), eq(services.merchantId, merchantId)));
  if (!service || !service.active) throw new AppError("NOT_FOUND", "That service is not offered by this shop");
  const tz = await merchantTz(db, merchantId);
  if (!service.availability) return { service: service.name, timeZone: tz, slots: [] };
  return { service: service.name, timeZone: tz, slots: await availableSlots(db, service, tz, query) };
}

export async function createBookingDraft(
  db: Db,
  input: {
    merchantId: string;
    customerId: string;
    serviceId: string;
    startAt: string;
    options?: string[];
    notes?: string | null;
    channel: Channel;
    conversationId?: string | null;
    memoryAssisted?: boolean;
  },
): Promise<BookingSummaryData> {
  const [service] = await db.select().from(services).where(and(eq(services.id, input.serviceId), eq(services.merchantId, input.merchantId)));
  if (!service || !service.active) throw new AppError("NOT_FOUND", "That service is not offered by this shop");
  const tz = await merchantTz(db, input.merchantId);
  const start = new Date(input.startAt);
  if (Number.isNaN(start.getTime())) throw new AppError("VALIDATION", "Invalid time");

  if (service.availability) {
    const slots = await availableSlots(db, service, tz, { limit: 500 });
    if (!slots.some((s) => new Date(s.startAt).getTime() === start.getTime())) {
      throw new AppError("CONFLICT", "That time is not available — please pick one of the open slots");
    }
  } else if (start.getTime() < Date.now()) {
    throw new AppError("VALIDATION", "That time is in the past");
  }

  const chosen = (input.options ?? []).filter((o) => service.options.some((so) => so.name.toLowerCase() === o.toLowerCase()));
  const extras = service.options.filter((so) => chosen.some((c) => c.toLowerCase() === so.name.toLowerCase()));
  const duration = (service.durationMinutes ?? 60) + extras.reduce((a, o) => a + (o.durationDelta ?? 0), 0);
  const price = service.priceMin != null ? service.priceMin + extras.reduce((a, o) => a + (o.priceDelta ?? 0), 0) : null;

  // Replace any earlier unconfirmed draft from the same customer for this service.
  await db
    .delete(bookings)
    .where(and(eq(bookings.merchantId, input.merchantId), eq(bookings.customerId, input.customerId), eq(bookings.serviceId, service.id), eq(bookings.status, "draft")));

  const [b] = await db
    .insert(bookings)
    .values({
      merchantId: input.merchantId,
      customerId: input.customerId,
      serviceId: service.id,
      serviceName: service.name,
      status: "draft",
      startAt: start,
      endAt: new Date(start.getTime() + duration * 60_000),
      notes: input.notes?.slice(0, 1000) ?? null,
      selectedOptions: extras.map((e) => e.name),
      price,
      depositAmount: service.depositAmount,
      currency: service.currency,
      channel: input.channel,
      conversationId: input.conversationId ?? null,
      memoryAssisted: Boolean(input.memoryAssisted),
    })
    .returning();
  return bookingSummary(b!, tz);
}

/** Customer explicitly confirmed the booking summary. */
export async function confirmBookingRequest(
  db: Db,
  { merchantId, customerId, bookingId }: { merchantId: string; customerId: string; bookingId: string },
): Promise<BookingSummaryData> {
  const [b] = await db
    .select()
    .from(bookings)
    .where(and(eq(bookings.id, bookingId), eq(bookings.merchantId, merchantId), eq(bookings.customerId, customerId)));
  if (!b) throw new AppError("NOT_FOUND", "Booking not found");
  if (b.status !== "draft") throw new AppError("CONFLICT", `This booking is already ${BOOKING_STATUS_LABELS[b.status].toLowerCase()}`);
  const tz = await merchantTz(db, merchantId);
  if (b.serviceId) {
    const [service] = await db.select().from(services).where(eq(services.id, b.serviceId));
    if (service?.availability) {
      const slots = await availableSlots(db, service, tz, { limit: 500 });
      if (!slots.some((s) => new Date(s.startAt).getTime() === b.startAt.getTime())) {
        throw new AppError("CONFLICT", "Sorry — that slot was just taken. Please choose another time.");
      }
    }
  }
  const [updated] = await db.update(bookings).set({ status: "pending", requestedAt: new Date() }).where(eq(bookings.id, b.id)).returning();
  return bookingSummary(updated!, tz);
}

export async function transitionBooking(
  db: Db,
  { merchantId, bookingId, to, actor }: { merchantId: string; bookingId: string; to: BookingStatus; actor: { type: "customer" | "merchant" } },
): Promise<BookingSummaryData> {
  const [b] = await db.select().from(bookings).where(and(eq(bookings.id, bookingId), eq(bookings.merchantId, merchantId)));
  if (!b) throw new AppError("NOT_FOUND", "Booking not found");
  if (!BOOKING_TRANSITIONS[b.status].includes(to)) {
    throw new AppError("CONFLICT", `Cannot move a booking from ${BOOKING_STATUS_LABELS[b.status]} to ${BOOKING_STATUS_LABELS[to]}`);
  }
  if (actor.type === "customer" && to !== "cancelled") throw new AppError("FORBIDDEN", "Customers can only cancel bookings");
  const now = new Date();
  const [updated] = await db
    .update(bookings)
    .set({
      status: to,
      ...(to === "confirmed" ? { confirmedAt: now } : {}),
      ...(to === "completed" ? { completedAt: now } : {}),
      ...(to === "cancelled" ? { cancelledAt: now } : {}),
    })
    .where(eq(bookings.id, b.id))
    .returning();
  return bookingSummary(updated!, await merchantTz(db, merchantId));
}

export async function getCustomerBookings(db: Db, merchantId: string, customerId: string, limit = 10): Promise<BookingSummaryData[]> {
  const tz = await merchantTz(db, merchantId);
  const rows = await db
    .select()
    .from(bookings)
    .where(and(eq(bookings.merchantId, merchantId), eq(bookings.customerId, customerId), ne(bookings.status, "draft")))
    .orderBy(desc(bookings.startAt))
    .limit(limit);
  return rows.map((b) => bookingSummary(b, tz));
}

export async function getCustomerBooking(db: Db, merchantId: string, customerId: string, bookingId: string): Promise<BookingSummaryData | null> {
  const tz = await merchantTz(db, merchantId);
  const [b] = await db.select().from(bookings).where(and(eq(bookings.id, bookingId), eq(bookings.merchantId, merchantId), eq(bookings.customerId, customerId)));
  return b ? bookingSummary(b, tz) : null;
}

export async function bookingsForMerchant(db: Db, merchantId: string, statuses?: BookingStatus[]) {
  const conditions = [eq(bookings.merchantId, merchantId), ne(bookings.status, "draft")];
  if (statuses?.length) conditions.push(inArray(bookings.status, statuses));
  return db.select().from(bookings).where(and(...conditions)).orderBy(desc(bookings.startAt)).limit(100);
}
