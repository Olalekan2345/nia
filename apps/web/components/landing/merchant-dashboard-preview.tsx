"use client";

import { useRef } from "react";
import { m, useScroll } from "motion/react";
import { Brain, CalendarDays, LayoutGrid, MessageSquare, Package, Repeat, Send, Globe, Users } from "lucide-react";
import { cn } from "@nia/ui";
import { EASE_OUT, VIEW_ONCE } from "./motion";
import { MaskLines, Reveal } from "./primitives";
import { Container, ExampleTag, SceneArt, SectionLabel, WalrusMark, displayClass } from "./ui";
import { useRange } from "./use-range";
import { usePrefersReducedMotion } from "./use-reduced-motion";

const NAV = [
  { icon: LayoutGrid, label: "Overview" },
  { icon: MessageSquare, label: "Conversations" },
  { icon: Users, label: "Customers", active: true },
  { icon: Package, label: "Orders" },
  { icon: CalendarDays, label: "Bookings" },
  { icon: Brain, label: "Memory" },
];

function Panel({ title, icon: Icon, children, className }: { title: string; icon: typeof Users; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-[22px] border border-ink-900/[0.06] bg-white p-4 sm:p-5", className)}>
      <p className="flex items-center gap-2 text-[13px] font-semibold text-muted-foreground">
        <Icon className="size-4" aria-hidden="true" /> {title}
      </p>
      <div className="mt-3.5">{children}</div>
    </div>
  );
}

function Person({ initial, name, note, tone }: { initial: string; name: string; note: string; tone: string }) {
  return (
    <li className="flex items-center gap-3 py-2">
      <span className={cn("grid size-8 place-items-center rounded-full text-xs font-bold text-ink-900", tone)} aria-hidden="true">
        {initial}
      </span>
      <span className="min-w-0 flex-1 text-sm leading-tight">
        <span className="block font-semibold text-ink-900">{name}</span>
        <span className="text-muted-foreground">{note}</span>
      </span>
    </li>
  );
}

function AmaraCard() {
  return (
    <m.div
      initial={{ boxShadow: "0 0 0 0 rgb(81 224 246 / 0)" }}
      whileInView={{ boxShadow: ["0 0 0 0 rgb(81 224 246 / 0)", "0 0 0 6px rgb(81 224 246 / 0.28)", "0 0 0 3px rgb(81 224 246 / 0.18)"] }}
      viewport={VIEW_ONCE}
      transition={{ duration: 1.4, delay: 0.9 }}
      className="rounded-[22px] border border-aqua-300 bg-white p-5"
    >
      <div className="flex items-center gap-3">
        <span className="grid size-12 place-items-center rounded-full bg-linear-to-br from-aqua-200 via-periwinkle-200 to-lavender-200 text-lg font-extrabold text-ink-900" aria-hidden="true">
          A
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-lg font-extrabold tracking-tight text-ink-900">Amara</p>
          <p className="text-sm font-semibold text-memory">Returning customer</p>
        </div>
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
        {[
          ["Preferred size", "Medium"],
          ["Usual area", "Yaba"],
          ["Last order", "Black kaftan"],
          ["Channel", "Web + Telegram"],
        ].map(([k, v]) => (
          <div key={k} className="rounded-2xl bg-paper px-3.5 py-2.5">
            <dt className="text-xs text-muted-foreground">{k}</dt>
            <dd className="mt-0.5 font-bold text-ink-900">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-memory-soft px-2.5 py-1 text-xs font-semibold text-memory">
        <WalrusMark /> 6 memories on Walrus
      </p>
    </m.div>
  );
}

export function MerchantDashboardPreview() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = usePrefersReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "center center"] });
  const rotateX = useRange(scrollYProgress, [0, 1], [reduce ? 0 : 16, 0]);
  const y = useRange(scrollYProgress, [0, 1], [reduce ? 0 : 80, 0]);
  const scale = useRange(scrollYProgress, [0, 1], [reduce ? 1 : 0.94, 1]);

  return (
    <section aria-labelledby="merchant-title" className="relative overflow-x-clip bg-paper py-28 sm:py-36">
      <Container>
        <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
        <div>
          <SectionLabel index="07">For merchants</SectionLabel>
          <h2 id="merchant-title" className={displayClass("md") + " mt-6 text-foreground"}>
            <MaskLines lines={["Your best customers", "shouldn’t feel", "like strangers."]} />
          </h2>
          <Reveal delay={0.15}>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-muted-foreground">
              See who’s coming back, what they talked about and what Nia remembers — before you reply.
            </p>
          </Reveal>
        </div>
        <Reveal y={40} className="mx-auto w-full max-w-[560px]">
          <SceneArt scene="dashboard" sizes="(min-width: 1024px) 540px, 92vw" alt="Nia beside a laptop showing a shop dashboard and a phone with a customer profile" />
        </Reveal>
        </div>

        <div ref={ref} className="mt-16 [perspective:1600px] lg:mt-20">
          <m.div style={{ rotateX, y, scale }} className="origin-top rounded-[32px] border border-ink-900/[0.07] bg-surface-2/70 p-2 shadow-lift sm:p-3">
            <div className="flex items-center gap-2 px-3 py-2.5">
              <span className="size-2.5 rounded-full bg-ink-900/15" />
              <span className="size-2.5 rounded-full bg-ink-900/15" />
              <span className="size-2.5 rounded-full bg-ink-900/15" />
              <p className="ml-3 truncate text-xs font-semibold text-muted-foreground">Adire Lane · Dashboard</p>
              <ExampleTag className="ml-auto bg-white">Sample data</ExampleTag>
            </div>
            <div className="grid gap-3 rounded-[26px] bg-paper p-3 sm:p-4 lg:grid-cols-[200px_1fr]">
              <nav aria-label="Dashboard preview" className="hidden lg:block">
                <ul className="space-y-1 p-2">
                  {NAV.map(({ icon: Icon, label, active }) => (
                    <li key={label} className={cn("flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm", active ? "bg-white font-semibold text-ink-900 shadow-soft" : "text-muted-foreground")}>
                      <Icon className="size-4" aria-hidden="true" /> {label}
                    </li>
                  ))}
                </ul>
              </nav>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-[1.1fr_1fr_1fr]">
                <div className="md:row-span-2">
                  <AmaraCard />
                </div>
                <Panel title="Returning customers" icon={Users}>
                  <ul className="-my-2 divide-y divide-ink-900/[0.05]">
                    <Person initial="T" name="Tolu" note="Gift shopper · bakery orders" tone="bg-blush-100" />
                    <Person initial="C" name="Chidi" note="Monthly fitting" tone="bg-periwinkle-100" />
                  </ul>
                </Panel>
                <Panel title="Recent conversations" icon={MessageSquare}>
                  <ul className="space-y-2.5 text-sm">
                    <li className="flex items-start gap-2">
                      <Send className="mt-0.5 size-3.5 shrink-0 text-[#2AABEE]" aria-label="Telegram" />
                      <span>
                        <span className="font-semibold text-ink-900">Amara</span> <span className="text-muted-foreground">“Can I get the usual?”</span>
                      </span>
                    </li>
                    <li className="flex items-start gap-2">
                      <Globe className="mt-0.5 size-3.5 shrink-0 text-ink-900/50" aria-label="Web chat" />
                      <span>
                        <span className="font-semibold text-ink-900">Tolu</span> <span className="text-muted-foreground">“Is the cake nut-free?”</span>
                      </span>
                    </li>
                  </ul>
                </Panel>
                <Panel title="Repeat orders" icon={Repeat}>
                  <p className="text-sm text-ink-900">
                    <span className="font-semibold">Amara</span> <span className="text-muted-foreground">· “Same as last time”</span>
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">Midnight Linen Kaftan · Medium · Yaba</p>
                  <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-memory-soft px-2.5 py-1 text-xs font-semibold text-memory">
                    <WalrusMark /> Memory-powered reorder
                  </p>
                </Panel>
                <Panel title="Bookings" icon={CalendarDays}>
                  <p className="text-sm font-semibold text-ink-900">Sat · 10:00 — Fitting</p>
                  <p className="mt-1 text-sm text-muted-foreground">Chidi · the usual Saturday slot</p>
                </Panel>
              </div>
            </div>
          </m.div>
        </div>
        <m.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={VIEW_ONCE} transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.4 }} className="mt-5 text-center text-sm text-muted-foreground">
          Dashboard preview with sample data. Your dashboard shows only your shop’s real activity.
        </m.p>
      </Container>
    </section>
  );
}
