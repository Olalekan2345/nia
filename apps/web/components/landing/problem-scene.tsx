"use client";

import { useRef } from "react";
import { m, useScroll, type MotionValue } from "motion/react";
import { Bot } from "lucide-react";
import { cn } from "@nia/ui";
import { MaskLines, Reveal, RevealGroup, RevealItem } from "./primitives";
import { Container, SceneArt, SectionLabel, displayClass } from "./ui";
import { useRange } from "./use-range";
import { usePrefersReducedMotion } from "./use-reduced-motion";

const QUESTIONS = [
  { text: "Order number?", pos: "left-[7%] top-[16%]", rotate: -4, drift: [-90, -50] },
  { text: "What size?", pos: "right-[9%] top-[13%]", rotate: 3, drift: [90, -60] },
  { text: "Where should we deliver?", pos: "left-[4%] bottom-[20%]", rotate: 2, drift: [-100, 60] },
  { text: "What did you buy last time?", pos: "right-[5%] bottom-[16%]", rotate: -3, drift: [100, 50] },
  { text: "Can you remind me?", pos: "left-[39%] bottom-[6%]", rotate: 1.5, drift: [0, 90] },
] as const;

function QuestionBubble({ text, className, style }: { text: string; className?: string; style?: React.ComponentProps<typeof m.div>["style"] }) {
  return (
    <m.div style={style} className={cn("flex items-center gap-2.5 rounded-[22px] border border-ink-900/[0.07] bg-white py-2.5 pr-5 pl-2.5 shadow-soft", className)}>
      <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-2 text-ink-900/45" aria-hidden="true">
        <Bot className="size-4" />
      </span>
      <span className="text-[17px] font-semibold text-ink-900/75">{text}</span>
    </m.div>
  );
}

function ScatteredQuestion({ progress, index }: { progress: MotionValue<number>; index: number }) {
  const q = QUESTIONS[index]!;
  const start = 0.06 + index * 0.07;
  const opacity = useRange(progress, [start, start + 0.08, 0.44, 0.54], [0, 1, 1, 0]);
  const x = useRange(progress, [0.44, 0.56], [0, q.drift[0]]);
  const y = useRange(progress, [start, start + 0.1, 0.44, 0.56], [36, 0, 0, q.drift[1]]);
  const scale = useRange(progress, [start, start + 0.1], [0.92, 1]);
  return (
    <div className={cn("absolute", q.pos)} style={{ rotate: `${q.rotate}deg` }}>
      <QuestionBubble text={q.text} style={{ opacity, x, y, scale }} />
    </div>
  );
}

function Payoff({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col items-center text-center", className)}>
      {/* Height-led on desktop so the payoff always fits the sticky viewport. */}
      <SceneArt
        scene="remembers"
        sizes="(min-width: 1024px) 560px, 90vw"
        alt="A confused chatbot asking questions beside Nia, who already has the customer’s product ready"
        className="w-full max-w-[560px] rounded-[32px] lg:h-[min(46svh,420px)] lg:w-auto"
      />
      <p className={displayClass("xl") + " mt-8 text-foreground"}>
        Nia <span className="text-memory">remembers.</span>
      </p>
      <p className="mt-5 max-w-md text-lg text-muted-foreground">Sizes, habits, the last order, the last problem — so returning customers can just carry on.</p>
    </div>
  );
}

const HEADLINE = ["Most chatbots forget you", "the moment the", "conversation ends."];

/** Desktop: a sticky scene driven by scroll. */
function ScrollScene() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress: p } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const headOpacity = useRange(p, [0.44, 0.54], [1, 0]);
  const headY = useRange(p, [0.44, 0.56], [0, -70]);
  const payOpacity = useRange(p, [0.6, 0.72], [0, 1]);
  const payScale = useRange(p, [0.6, 0.78], [0.94, 1]);
  const glow = useRange(p, [0.58, 0.85], [0, 1]);

  return (
    <div ref={ref} className="relative h-[280vh]">
      <div className="sticky top-0 flex h-[100svh] items-center justify-center overflow-hidden">
        <m.div aria-hidden="true" style={{ opacity: glow }} className="absolute inset-0" >
          <div className="absolute top-1/2 left-1/2 size-[70vmin] -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: "radial-gradient(closest-side, rgb(107 222 230 / 0.35), transparent)" }} />
        </m.div>
        {QUESTIONS.map((q, i) => (
          <ScatteredQuestion key={q.text} progress={p} index={i} />
        ))}
        <m.h2 style={{ opacity: headOpacity, y: headY }} className={displayClass("lg") + " relative text-center text-foreground"}>
          <MaskLines lines={HEADLINE} />
        </m.h2>
        <m.div style={{ opacity: payOpacity, scale: payScale }} className="absolute inset-0 flex items-center justify-center">
          <Payoff />
        </m.div>
      </div>
    </div>
  );
}

/** Mobile and reduced motion: the same story, composed statically. */
function StackedScene() {
  return (
    <Container className="py-24">
      <h2 className={displayClass("lg") + " text-foreground"}>
        <MaskLines lines={HEADLINE} />
      </h2>
      <RevealGroup as="ul" className="mt-10 flex flex-col gap-3" step={0.07}>
        {QUESTIONS.map((q) => (
          <RevealItem as="li" key={q.text} className="odd:self-start even:self-end">
            <div style={{ rotate: `${q.rotate * 0.6}deg` }}>
              <QuestionBubble text={q.text} />
            </div>
          </RevealItem>
        ))}
      </RevealGroup>
      <Reveal className="mt-20">
        <Payoff />
      </Reveal>
    </Container>
  );
}

export function ProblemScene() {
  const reduce = usePrefersReducedMotion();
  return (
    <section aria-label="The problem" className="relative bg-paper">
      <Container className="pt-16 lg:pt-10">
        <SectionLabel index="01">The problem</SectionLabel>
      </Container>
      {reduce ? (
        <StackedScene />
      ) : (
        <>
          <div className="hidden lg:block">
            <ScrollScene />
          </div>
          <div className="lg:hidden">
            <StackedScene />
          </div>
        </>
      )}
    </section>
  );
}
