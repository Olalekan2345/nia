"use client";

import { useMemo, useState } from "react";
import { formatMoney, formatMoneyCompact } from "@nia/shared";
import { cn } from "@nia/ui";

interface Day {
  day: string;
  revenue: number;
  orders: number;
}

/**
 * Daily revenue (single series, validated chart-1 colour). Hover/focus shows
 * a tooltip per bar; a table view carries the same data for screen readers.
 */
export function RevenueChart({ data, days, currency, locale }: { data: Day[]; days: number; currency: string; locale: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);

  const series = useMemo(() => {
    const byDay = new Map(data.map((d) => [d.day, d]));
    const out: Day[] = [];
    const today = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - i));
      const key = d.toISOString().slice(0, 10);
      out.push(byDay.get(key) ?? { day: key, revenue: 0, orders: 0 });
    }
    return out;
  }, [data, days]);

  const max = Math.max(...series.map((s) => s.revenue), 0);
  const H = 160;
  const label = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
  const total = series.reduce((a, s) => a + s.revenue, 0);

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Revenue from paid orders · last {days} days</p>
          <p className="mt-1 text-2xl font-bold tabular">{formatMoney(total, currency, { locale })}</p>
        </div>
        <button type="button" onClick={() => setTable((t) => !t)} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-surface-2 hover:text-foreground" aria-pressed={table}>
          {table ? "Chart view" : "Table view"}
        </button>
      </div>

      {table ? (
        <div className="mt-4 max-h-64 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th scope="col" className="py-1.5 text-left font-semibold">Day</th>
                <th scope="col" className="py-1.5 text-right font-semibold">Orders</th>
                <th scope="col" className="py-1.5 text-right font-semibold">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {series.filter((s) => s.orders > 0).map((s) => (
                <tr key={s.day}>
                  <td className="py-1.5">{label(s.day)}</td>
                  <td className="py-1.5 text-right tabular">{s.orders}</td>
                  <td className="py-1.5 text-right tabular">{formatMoney(s.revenue, currency, { locale })}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {series.every((s) => s.orders === 0) ? <p className="py-6 text-center text-sm text-muted-foreground">No orders in this period yet.</p> : null}
        </div>
      ) : (
        <div className="relative mt-5" onMouseLeave={() => setHover(null)}>
          {max === 0 ? <p className="absolute inset-x-0 top-12 text-center text-sm text-muted-foreground">No paid orders yet — revenue will appear here.</p> : null}
          <div className="flex items-end gap-[2px] border-b border-border" style={{ height: H }} role="img" aria-label={`Daily revenue for the last ${days} days. Use table view for values.`}>
            {series.map((s, i) => {
              const h = max ? Math.max(s.revenue > 0 ? 3 : 0, (s.revenue / max) * (H - 8)) : 0;
              return (
                <button
                  key={s.day}
                  type="button"
                  className="group relative flex h-full flex-1 items-end focus-visible:outline-none"
                  onMouseEnter={() => setHover(i)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                  aria-label={`${label(s.day)}: ${formatMoney(s.revenue, currency, { locale })}, ${s.orders} orders`}
                >
                  <span className={cn("block w-full rounded-t-[4px] bg-chart-1 transition-opacity duration-100", hover !== null && hover !== i && "opacity-45", "group-focus-visible:ring-2 group-focus-visible:ring-ring")} style={{ height: h }} />
                </button>
              );
            })}
          </div>
          <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
            <span>{label(series[0]!.day)}</span>
            {max ? <span className="tabular">peak {formatMoneyCompact(max, currency, locale)}</span> : null}
            <span>{label(series[series.length - 1]!.day)}</span>
          </div>
          {hover !== null ? (
            <div
              className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full rounded-xl border border-border bg-surface px-3 py-2 text-xs shadow-float"
              style={{ left: `${((hover + 0.5) / series.length) * 100}%` }}
              role="status"
            >
              <p className="font-semibold">{label(series[hover]!.day)}</p>
              <p className="tabular">{formatMoney(series[hover]!.revenue, currency, { locale })}</p>
              <p className="text-muted-foreground tabular">
                {series[hover]!.orders} order{series[hover]!.orders === 1 ? "" : "s"}
              </p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
