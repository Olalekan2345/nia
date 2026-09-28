/**
 * Booking slot computation from weekly availability — deliberately simple:
 * fixed slot interval, per-slot capacity, lead time and booking horizon, all
 * in the merchant's time zone. No external calendar.
 */
import { and, eq, gte, inArray, lt } from "drizzle-orm";
import { bookings, type Db, type Service } from "@nia/database";
import type { WeekdayKey } from "@nia/shared";
import type { SlotData } from "./types";

const WEEKDAY_KEYS: WeekdayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

/** Offset (ms) of `timeZone` from UTC at the given instant. */
export function tzOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour") % 24, get("minute"), get("second"));
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** Convert a wall-clock time in `timeZone` to a UTC Date. */
export function zonedToUtc(ymd: string, hhmm: string, timeZone: string): Date {
  const [y, m, d] = ymd.split("-").map(Number) as [number, number, number];
  const [hh, mm] = hhmm.split(":").map(Number) as [number, number];
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const offset = tzOffsetMs(new Date(guess), timeZone);
  const result = new Date(guess - offset);
  // Re-check across DST boundaries.
  const offset2 = tzOffsetMs(result, timeZone);
  return offset2 === offset ? result : new Date(guess - offset2);
}

/** Local calendar date (YYYY-MM-DD) and weekday of an instant in `timeZone`. */
export function localDay(instant: Date, timeZone: string): { ymd: string; weekday: WeekdayKey } {
  const shifted = new Date(instant.getTime() + tzOffsetMs(instant, timeZone));
  return { ymd: shifted.toISOString().slice(0, 10), weekday: WEEKDAY_KEYS[shifted.getUTCDay()]! };
}

function addDays(ymd: string, days: number): string {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function minutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number) as [number, number];
  return h * 60 + m;
}

function hhmmOf(total: number): string {
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

export function formatSlotLabel(start: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone }).format(start);
}

export interface SlotQuery {
  from?: Date;
  days?: number;
  limit?: number;
  /** Only slots on this local date (YYYY-MM-DD). */
  date?: string;
  /** Prefer times at/after this local time (e.g. "16:00" for "after 4pm"). */
  after?: string;
  before?: string;
}

export async function availableSlots(db: Db, service: Service, timeZone: string, q: SlotQuery = {}): Promise<SlotData[]> {
  const a = service.availability;
  if (!a || !service.active) return [];
  const now = q.from ?? new Date();
  const earliest = new Date(now.getTime() + a.leadTimeHours * 3600_000);
  const horizonDays = Math.min(q.days ?? a.advanceDays, a.advanceDays);
  const duration = service.durationMinutes ?? a.slotIntervalMinutes;
  const limit = q.limit ?? 12;

  const startDay = q.date ?? localDay(now, timeZone).ymd;
  const dayCount = q.date ? 1 : horizonDays + 1;
  const horizonEnd = new Date(now.getTime() + (a.advanceDays + 1) * 86400_000);

  // Existing bookings that consume capacity.
  const rangeStart = zonedToUtc(startDay, "00:00", timeZone);
  const rangeEnd = zonedToUtc(addDays(startDay, dayCount), "00:00", timeZone);
  const taken = await db
    .select({ startAt: bookings.startAt })
    .from(bookings)
    .where(
      and(
        eq(bookings.merchantId, service.merchantId),
        eq(bookings.serviceId, service.id),
        inArray(bookings.status, ["pending", "confirmed"]),
        gte(bookings.startAt, rangeStart),
        lt(bookings.startAt, rangeEnd),
      ),
    );
  const takenCount = new Map<number, number>();
  for (const t of taken) takenCount.set(t.startAt.getTime(), (takenCount.get(t.startAt.getTime()) ?? 0) + 1);

  const out: SlotData[] = [];
  for (let i = 0; i < dayCount && out.length < limit; i++) {
    const ymd = addDays(startDay, i);
    const weekday = WEEKDAY_KEYS[new Date(`${ymd}T12:00:00Z`).getUTCDay()]!;
    const windows = a.weekly[weekday] ?? [];
    for (const [open, close] of windows) {
      const lo = Math.max(minutes(open), q.after ? minutes(q.after) : 0);
      const hi = Math.min(minutes(close), q.before ? minutes(q.before) : 24 * 60);
      // Align to the interval grid starting at opening time.
      let t = minutes(open);
      while (t < lo) t += a.slotIntervalMinutes;
      for (; t + duration <= hi && t + duration <= minutes(close); t += a.slotIntervalMinutes) {
        const start = zonedToUtc(ymd, hhmmOf(t), timeZone);
        if (start < earliest || start > horizonEnd) continue;
        const remaining = a.capacityPerSlot - (takenCount.get(start.getTime()) ?? 0);
        if (remaining <= 0) continue;
        out.push({
          startAt: start.toISOString(),
          endAt: new Date(start.getTime() + duration * 60_000).toISOString(),
          label: formatSlotLabel(start, timeZone),
          remaining,
        });
        if (out.length >= limit) break;
      }
    }
  }
  return out;
}

export async function nextAvailableSlot(db: Db, service: Service, timeZone: string, now = new Date()): Promise<SlotData | null> {
  const slots = await availableSlots(db, service, timeZone, { from: now, limit: 1 });
  return slots[0] ?? null;
}
