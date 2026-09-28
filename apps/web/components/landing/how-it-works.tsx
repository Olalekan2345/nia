"use client";

import { useRef } from "react";
import { m, useScroll, useTransform, type MotionValue } from "motion/react";
import { Brain, Database, MessageCircle, Sparkles } from "lucide-react";
import { cn } from "@nia/ui";
import { MaskLines } from "./primitives";
import { Container, SectionLabel, displayClass } from "./ui";
import { useRange } from "./use-range";
import { usePrefersReducedMotion } from "./use-reduced-motion";

const STEPS = [
  { icon: MessageCircle, title: "Customer chats", body: "On your website or in Telegram, in their own words." },
  { icon: Sparkles, title: "Nia understands useful preferences", body: "Sizes, habits and occasions — not every passing comment." },
  { icon: Database, title: "Walrus Memory stores long-term context", body: "Encrypted, in a space that belongs to that customer." },
  { icon: Brain, title: "Nia remembers next time", body: "Days later, on any channel. No introductions needed." },
] as const;

function Step({ progress, index }: { progress: MotionValue<number>; index: number }) {
  const s = STEPS[index]!;
  const at = index / (STEPS.length - 1);
  const reduce = usePrefersReducedMotion();
  const opacity = useRange(progress, [at - 0.25, at], [reduce ? 1 : 0.25, 1]);
  const y = useRange(progress, [at - 0.25, at], [reduce ? 0 : 24, 0]);
  const active = useRange(progress, [at - 0.05, at], [0, 1]);
  const idle = useTransform(active, (v) => 1 - v);
  const Icon = s.icon;
  return (
    <m.li style={{ opacity, y }} className="relative grid grid-cols-[3.5rem_1fr] gap-5 lg:block">
      <div className="relative z-10 grid size-14 place-items-center rounded-full border border-ink-900/10 bg-white text-lg font-extrabold text-ink-900 tabular shadow-soft">
        <m.span style={{ opacity: active }} className="absolute inset-0 rounded-full bg-ink-900" aria-hidden="true" />
        <m.span style={{ opacity: active }} className="absolute -inset-2 rounded-full border border-aqua-300" aria-hidden="true" />
        <m.span style={{ opacity: idle }} className="relative">
          {index + 1}
        </m.span>
        <m.span style={{ opacity: active }} className="absolute inset-0 grid place-items-center text-white" aria-hidden="true">
          {index + 1}
        </m.span>
      </div>
      <div className="lg:mt-8 lg:pr-6">
        <Icon className="size-5 text-memory" aria-hidden="true" />
        <h3 className="mt-3 text-xl font-extrabold tracking-tight text-ink-900 text-balance">{s.title}</h3>
        <p className="mt-2 text-muted-foreground">{s.body}</p>
      </div>
    </m.li>
  );
}

export function HowItWorks() {
  const ref = useRef<HTMLOListElement>(null);
  const reduce = usePrefersReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 0.85", "end 0.55"] });
  const fill = useRange(scrollYProgress, [0, 1], [reduce ? 1 : 0, 1]);

  return (
    <section id="how" aria-labelledby="how-title" className="relative scroll-mt-10 bg-paper py-28 sm:py-36">
      <Container>
        <SectionLabel index="10">How it works</SectionLabel>
        <h2 id="how-title" className={displayClass("md") + " mt-6 max-w-[18ch] text-foreground"}>
          <MaskLines lines={["Four steps.", <span key="k" className="text-muted-foreground">Then Nia just knows.</span>]} />
        </h2>

        <ol ref={ref} className="relative mt-16 grid gap-12 lg:mt-20 lg:grid-cols-4 lg:gap-6">
          {/* The track: vertical on mobile, horizontal on desktop; it fills as you scroll. */}
          <span aria-hidden="true" className="absolute top-7 bottom-7 left-7 w-px bg-ink-900/10 lg:top-7 lg:right-[12%] lg:bottom-auto lg:left-7 lg:h-px lg:w-auto" />
          <m.span aria-hidden="true" style={{ scaleY: fill }} className="absolute top-7 bottom-7 left-7 w-px origin-top bg-aqua-400 lg:hidden" />
          <m.span aria-hidden="true" style={{ scaleX: fill }} className={cn("absolute top-7 right-[12%] left-7 hidden h-px origin-left bg-aqua-400 lg:block")} />
          {STEPS.map((s, i) => (
            <Step key={s.title} progress={scrollYProgress} index={i} />
          ))}
        </ol>
      </Container>
    </section>
  );
}
