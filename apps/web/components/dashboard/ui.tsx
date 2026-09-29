import type { ReactNode } from "react";
import { Mascot, cn } from "@nia/ui";

/** Page titles use the landing page's display treatment, scaled for a workspace. */
export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-[clamp(1.75rem,3vw,2.35rem)] leading-tight font-extrabold tracking-[-0.035em] text-balance">{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "memory" | "accent" }) {
  return (
    <div className="rounded-3xl border border-ink-900/[0.06] bg-surface p-5 shadow-soft">
      <p className="text-[13px] font-semibold text-muted-foreground">{label}</p>
      <p className={cn("mt-2 text-3xl font-extrabold tracking-[-0.03em] tabular", tone === "memory" && "text-memory", tone === "accent" && "text-accent-strong")}>{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function EmptyPanel({ title, body, action, state = "idle" }: { title: string; body: ReactNode; action?: ReactNode; state?: "idle" | "thinking" | "privacy" }) {
  return (
    <div className="relative flex flex-col items-center overflow-hidden rounded-3xl border border-dashed border-ink-900/10 bg-surface/70 px-6 py-14 text-center">
      <div aria-hidden="true" className="absolute top-6 left-1/2 size-40 -translate-x-1/2 rounded-full" style={{ background: "radial-gradient(closest-side, rgb(107 222 230 / 0.22), transparent)" }} />
      <Mascot size={72} state={state} decorative className="relative" />
      <p className="relative mt-5 text-lg font-bold tracking-tight">{title}</p>
      <p className="relative mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">{body}</p>
      {action ? <div className="relative mt-6">{action}</div> : null}
    </div>
  );
}

export function Table({ head, children, className }: { head: ReactNode[]; children: ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-x-auto rounded-3xl border border-ink-900/[0.06] bg-surface shadow-soft", className)}>
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="border-b border-ink-900/[0.06] bg-paper text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          <tr>
            {head.map((h, i) => (
              <th key={i} scope="col" className="px-5 py-3.5 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-900/[0.05] [&>tr]:transition-colors [&>tr]:duration-150 [&>tr:hover]:bg-paper">{children}</tbody>
      </table>
    </div>
  );
}

export function Td({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={cn("px-5 py-3.5 align-middle", className)}>{children}</td>;
}
