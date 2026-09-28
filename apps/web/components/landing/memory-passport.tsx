"use client";

import { m } from "motion/react";
import { ArrowRight, History, MapPin, Palette, Ruler, Scissors } from "lucide-react";
import { cn } from "@nia/ui";
import { EASE_OUT, VIEW_ONCE, fadeUp, staggered } from "./motion";
import { MaskLines } from "./primitives";
import { Container, ExampleTag, SectionLabel, WalrusMark, displayClass } from "./ui";

const TAGS = {
  confirmed: { label: "Confirmed", className: "bg-success-soft text-success", hint: "You told Nia" },
  observed: { label: "Observed", className: "bg-info-soft text-info", hint: "From real orders" },
  likely: { label: "Likely", className: "bg-warning-soft text-warning", hint: "Nia checks before relying on it" },
} as const;

const ROWS = [
  { icon: Ruler, label: "Size", value: "Medium", tag: "confirmed", source: "Confirmed by you" },
  { icon: Scissors, label: "Usually orders", value: "6 yards", tag: "observed", source: "Observed from orders" },
  { icon: Palette, label: "Colours", value: "Darker tones", tag: "likely", source: "Likely preference" },
  { icon: MapPin, label: "Usual delivery", value: "Yaba", tag: "confirmed", source: "Confirmed by you" },
] as const;

function Tag({ kind }: { kind: keyof typeof TAGS }) {
  return <span className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-bold tracking-wide uppercase", TAGS[kind].className)}>{TAGS[kind].label}</span>;
}

function PassportCard() {
  return (
    <m.div
      initial={{ opacity: 0, y: 70, rotateX: 14 }}
      whileInView={{ opacity: 1, y: 0, rotateX: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 1.1, ease: EASE_OUT }}
      style={{ transformPerspective: 1200 }}
      className="relative w-full max-w-[560px] rounded-[32px] border border-ink-900/[0.07] bg-white p-5 shadow-lift sm:p-7"
    >
      <div className="flex items-center gap-3.5">
        <span className="grid size-12 place-items-center rounded-full bg-linear-to-br from-aqua-200 via-periwinkle-200 to-lavender-200 text-lg font-extrabold text-ink-900" aria-hidden="true">
          A
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-extrabold tracking-tight text-ink-900">Amara</p>
          <p className="text-sm text-muted-foreground">Memory Passport</p>
        </div>
        <ExampleTag />
      </div>

      <p className="mt-7 text-sm font-semibold text-muted-foreground">What Nia remembers about you</p>

      <m.ul className="mt-3 divide-y divide-ink-900/[0.06]" initial="hidden" whileInView="show" viewport={VIEW_ONCE} variants={staggered(0.09, 0.35)}>
        {ROWS.map(({ icon: Icon, label, value, tag, source }) => (
          <m.li key={label} variants={fadeUp} className="flex items-center gap-3.5 py-3.5">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-ink-900/70" aria-hidden="true">
              <Icon className="size-[18px]" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold text-ink-900">
                {label}: <span className="font-bold">{value}</span>
              </p>
              <p className="text-xs text-muted-foreground">{source}</p>
            </div>
            <Tag kind={tag} />
          </m.li>
        ))}
        <m.li variants={fadeUp} className="flex items-center gap-3.5 py-3.5">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-strong" aria-hidden="true">
            <History className="size-[18px]" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-1.5 text-[15px] font-semibold text-ink-900">
              Delivery area <span className="text-muted-foreground line-through decoration-ink-900/30">Lekki</span>
              <ArrowRight className="size-3.5 text-muted-foreground" aria-label="changed to" />
              <span className="font-bold">Yaba</span>
            </p>
            <p className="text-xs text-muted-foreground">Recent correction · the old area is kept as history</p>
          </div>
          <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-[11px] font-bold tracking-wide text-accent-strong uppercase">Corrected</span>
        </m.li>
      </m.ul>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-paper px-4 py-3">
        <p className="inline-flex items-center gap-2 text-sm font-semibold text-memory">
          <WalrusMark className="size-4" /> Stored with Walrus Memory
        </p>
        <div className="flex gap-2 text-sm font-semibold text-ink-900">
          <span className="rounded-full border border-ink-900/10 bg-white px-3 py-1">Correct</span>
          <span className="inline-flex items-center gap-2 rounded-full border border-ink-900/10 bg-white px-3 py-1">
            Memory
            <span className="relative h-4 w-7 rounded-full bg-success" aria-hidden="true">
              <span className="absolute top-0.5 right-0.5 size-3 rounded-full bg-white" />
            </span>
          </span>
        </div>
      </div>
    </m.div>
  );
}

export function MemoryPassport() {
  return (
    <section id="passport" aria-labelledby="passport-title" className="relative overflow-x-clip bg-white py-28 sm:py-36">
      <div aria-hidden="true" className="absolute top-1/2 left-1/2 size-[900px] -translate-x-1/2 -translate-y-1/3 rounded-full" style={{ background: "radial-gradient(closest-side, rgb(159 184 252 / 0.18), rgb(107 222 230 / 0.1) 50%, transparent)" }} />
      <Container className="relative">
        <div className="flex flex-col items-center text-center">
          <SectionLabel index="06">Transparency</SectionLabel>
          <h2 id="passport-title" className={displayClass("lg") + " mt-6 text-foreground"}>
            <MaskLines lines={["Memory should help you.", <span key="not" className="text-muted-foreground">Not surprise you.</span>]} />
          </h2>
          <p className="mt-6 max-w-md text-lg text-muted-foreground">Customers can see and correct what Nia remembers — and why.</p>
        </div>

        <div className="relative mt-16 flex justify-center lg:mt-20">
          <PassportCard />
          {/* Legend chips beside the card on wide screens. */}
          <ul className="pointer-events-none absolute inset-0 hidden xl:block" aria-hidden="true">
            {(Object.keys(TAGS) as (keyof typeof TAGS)[]).map((k, i) => (
              <m.li
                key={k}
                initial={{ opacity: 0, x: i === 1 ? 30 : -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={VIEW_ONCE}
                transition={{ duration: 0.8, ease: EASE_OUT, delay: 0.8 + i * 0.15 }}
                className={cn("absolute flex items-center gap-2.5 rounded-2xl border border-ink-900/[0.06] bg-white/95 px-4 py-3 shadow-soft", ["top-[14%] left-[3%]", "top-[44%] right-[2%]", "bottom-[12%] left-[6%]"][i])}
              >
                <Tag kind={k} />
                <span className="text-sm text-muted-foreground">{TAGS[k].hint}</span>
              </m.li>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  );
}
