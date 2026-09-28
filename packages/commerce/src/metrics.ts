/**
 * Merchant dashboard metrics — computed only from real rows. No invented
 * growth percentages: comparisons are shown only when a previous period
 * actually has data.
 */
import { and, eq, gte, inArray, lt, ne, sql } from "drizzle-orm";
import { bookings, conversations, memoryRecords, orders, type Db } from "@nia/database";

const REVENUE_STATUSES = ["paid", "processing", "ready", "dispatched", "delivered"] as const;

export interface MerchantMetrics {
  periodDays: number;
  revenue: number;
  revenuePrevious: number | null;
  orders: number;
  ordersAwaiting: number;
  activeCustomers: number;
  repeatCustomers: number;
  conversations: number;
  bookingsUpcoming: number;
  memoryAssistedOrders: number;
  memoriesStored: number;
  memoriesPending: number;
  revenueByDay: { day: string; revenue: number; orders: number }[];
}

export async function merchantMetrics(db: Db, merchantId: string, periodDays = 30, now = new Date()): Promise<MerchantMetrics> {
  const since = new Date(now.getTime() - periodDays * 86400_000);
  const prevSince = new Date(since.getTime() - periodDays * 86400_000);

  const revenueRow = (from: Date, to: Date) =>
    db
      .select({ total: sql<number>`coalesce(sum(${orders.total}), 0)::bigint`, n: sql<number>`count(*)::int` })
      .from(orders)
      .where(and(eq(orders.merchantId, merchantId), inArray(orders.status, [...REVENUE_STATUSES]), gte(orders.submittedAt, from), lt(orders.submittedAt, to)));

  const [[rev], [prev], [ordersCount], [awaiting], [active], repeatRows, [convs], [upcoming], [assisted], memRows, daily] = await Promise.all([
    revenueRow(since, now),
    revenueRow(prevSince, since),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(orders)
      .where(and(eq(orders.merchantId, merchantId), ne(orders.status, "draft"), gte(orders.submittedAt, since))),
    db.select({ n: sql<number>`count(*)::int` }).from(orders).where(and(eq(orders.merchantId, merchantId), eq(orders.status, "awaiting_confirmation"))),
    db
      .select({ n: sql<number>`count(distinct ${conversations.customerId})::int` })
      .from(conversations)
      .where(and(eq(conversations.merchantId, merchantId), gte(conversations.lastMessageAt, since), sql`${conversations.customerId} is not null`)),
    db
      .select({ customerId: orders.customerId })
      .from(orders)
      .where(and(eq(orders.merchantId, merchantId), ne(orders.status, "draft"), ne(orders.status, "cancelled")))
      .groupBy(orders.customerId)
      .having(sql`count(*) >= 2`),
    db.select({ n: sql<number>`count(*)::int` }).from(conversations).where(and(eq(conversations.merchantId, merchantId), gte(conversations.createdAt, since))),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(bookings)
      .where(and(eq(bookings.merchantId, merchantId), inArray(bookings.status, ["pending", "confirmed"]), gte(bookings.startAt, now))),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(orders)
      .where(and(eq(orders.merchantId, merchantId), eq(orders.memoryAssisted, true), ne(orders.status, "draft"), gte(orders.submittedAt, since))),
    db
      .select({ status: memoryRecords.persistStatus, n: sql<number>`count(*)::int` })
      .from(memoryRecords)
      .where(and(eq(memoryRecords.merchantId, merchantId), ne(memoryRecords.lifecycle, "forgotten")))
      .groupBy(memoryRecords.persistStatus),
    db
      .select({
        day: sql<string>`to_char(date_trunc('day', ${orders.submittedAt}), 'YYYY-MM-DD')`,
        revenue: sql<number>`coalesce(sum(case when ${orders.status} in ('paid','processing','ready','dispatched','delivered') then ${orders.total} else 0 end), 0)::bigint`,
        orders: sql<number>`count(*)::int`,
      })
      .from(orders)
      .where(and(eq(orders.merchantId, merchantId), ne(orders.status, "draft"), gte(orders.submittedAt, since)))
      .groupBy(sql`date_trunc('day', ${orders.submittedAt})`)
      .orderBy(sql`date_trunc('day', ${orders.submittedAt})`),
  ]);

  const mem = Object.fromEntries(memRows.map((r) => [r.status, r.n])) as Record<string, number>;
  return {
    periodDays,
    revenue: Number(rev?.total ?? 0),
    revenuePrevious: prev && prev.n > 0 ? Number(prev.total) : null,
    orders: ordersCount?.n ?? 0,
    ordersAwaiting: awaiting?.n ?? 0,
    activeCustomers: active?.n ?? 0,
    repeatCustomers: repeatRows.length,
    conversations: convs?.n ?? 0,
    bookingsUpcoming: upcoming?.n ?? 0,
    memoryAssistedOrders: assisted?.n ?? 0,
    memoriesStored: mem.stored ?? 0,
    memoriesPending: mem.pending ?? 0,
    revenueByDay: daily.map((d) => ({ day: d.day, revenue: Number(d.revenue), orders: d.orders })),
  };
}
