"use client";

import { useRef } from "react";
import { m, useMotionValue, useScroll, type MotionValue } from "motion/react";
import { CircleAlert, Heart, MapPin, Palette, Ruler, Scissors } from "lucide-react";
import { cn } from "@nia/ui";
import { MaskLines, Reveal, RevealGroup, RevealItem } from "./primitives";
import { Container, SceneArt, SectionLabel, WalrusMark, displayClass } from "./ui";
import { useRange } from "./use-range";
import { usePrefersReducedMotion } from "./use-reduced-motion";

const MEMORIES = [
  { icon: Ruler, label: "Preferred size", value: "Medium", pos: "left-[-6%] top-[8%]", from: [60, 40] },
  { icon: Scissors, label: "Typical quantity", value: "6 yards", pos: "right-[-8%] top-[4%]", from: [-60, 40] },
  { icon: Palette, label: "Colour preference", value: "Darker tones", pos: "left-[-14%] top-[43%]", from: [70, 0] },
  { icon: MapPin, label: "Usual delivery", value: "Lekki", pos: "right-[-14%] top-[40%]", from: [-70, 0] },
  { icon: Heart, label: "Shops for", value: "Mother · Sister", pos: "left-[-2%] bottom-[4%]", from: [60, -40] },
  { icon: CircleAlert, label: "Last issue", value: "Late delivery", pos: "right-[-4%] bottom-[8%]", from: [-60, -40] },
] as const;

function MemoryCard({ icon: Icon, label, value, className, style }: { icon: (typeof MEMORIES)[number]["icon"]; label: string; value: string; className?: string; style?: React.ComponentProps<typeof m.div>["style"] }) {
  return (
    <m.div style={style} className={cn("flex items-center gap-3.5 rounded-[24px] border border-aqua-200/70 bg-white/95 py-3.5 pr-6 pl-3.5 shadow-memory", className)}>
      <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-linear-to-br from-aqua-50 to-periwinkle-50 text-memory" aria-hidden="true">
        <Icon className="size-5" />
      </span>
      <span className="leading-tight">
        <span className="block text-[13px] font-medium text-muted-foreground">{label}</span>
        <span className="mt-0.5 block text-lg font-bold tracking-tight text-ink-900">{value}</span>
      </span>
    </m.div>
  );
}

function OrbitingMemory({ progress, index }: { progress: MotionValue<number>; index: number }) {
  const mem = MEMORIES[index]!;
  const start = 0.1 + index * 0.1;
  const opacity = useRange(progress, [start, start + 0.07], [0, 1]);
  const x = useRange(progress, [start, start + 0.1], [mem.from[0], 0]);
  const y = useRange(progress, [start, start + 0.1], [mem.from[1], 0]);
  const scale = useRange(progress, [start, start + 0.1], [0.85, 1]);
  return (
    <div className={cn("absolute z-10", mem.pos)}>
      <MemoryCard icon={mem.icon} label={mem.label} value={mem.value} style={{ opacity, x, y, scale }} />
    </div>
  );
}

function Counter({ progress }: { progress: MotionValue<number> }) {
  return (
    <div className="mt-10 flex items-center gap-4">
      <div className="flex gap-1.5" aria-hidden="true">
        {MEMORIES.map((mem, i) => (
          <Pip key={mem.label} progress={progress} at={0.1 + i * 0.1 + 0.05} />
        ))}
      </div>
      <p className="text-sm font-semibold text-muted-foreground">Six small details. One customer who feels known.</p>
    </div>
  );
}

function Pip({ progress, at }: { progress: MotionValue<number>; at: number }) {
  const scaleX = useRange(progress, [at - 0.05, at], [0, 1]);
  return (
    <span className="relative h-1.5 w-6 overflow-hidden rounded-full bg-ink-900/10">
      <m.span style={{ scaleX }} className="absolute inset-0 origin-left rounded-full bg-aqua-400" />
    </span>
  );
}

const TITLE = ["Not just what they bought.", <span key="why" className="text-memory">Why they bought it.</span>];

function Copy({ children }: { children?: React.ReactNode }) {
  return (
    <div>
      <SectionLabel index="02">Memory</SectionLabel>
      <h2 className={displayClass("md") + " mt-6 text-foreground"}>
        <MaskLines lines={TITLE} />
      </h2>
      <p className="mt-6 max-w-md text-lg leading-relaxed text-muted-foreground">
        Nia keeps the small things a great shop assistant would remember — sizes, habits, the people they shop for, and what went wrong last time.
      </p>
      <p className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-memory">
        <WalrusMark className="size-4" /> Each one stored with Walrus Memory
      </p>
      {children}
    </div>
  );
}

/** `still`: the finished composition, without scroll choreography (reduced motion). */
function ScrollScene({ still = false }: { still?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const finished = useMotionValue(1);
  const p = still ? finished : scrollYProgress;
  const glow = useRange(p, [0.05, 0.75], [0.35, 1]);
  const portalScale = useRange(p, [0, 0.2], [0.94, 1]);

  return (
    <div ref={ref} className={still ? "relative py-28" : "relative h-[320vh]"}>
      <div className={still ? "flex items-center" : "sticky top-0 flex h-[100svh] items-center"}>
        <Container className="grid items-center gap-10 lg:grid-cols-[0.95fr_1.05fr]">
          <Copy>
            <Counter progress={p} />
          </Copy>
          <div className="relative mx-auto aspect-square w-full max-w-[min(64vh,560px)]">
            <m.div aria-hidden="true" style={{ opacity: glow }} className="absolute -inset-[16%] rounded-full" >
              <div className="size-full rounded-full" style={{ background: "radial-gradient(closest-side, rgb(107 222 230 / 0.45), rgb(159 184 252 / 0.2) 55%, transparent)" }} />
            </m.div>
            <m.div style={{ scale: portalScale }} className="absolute inset-[15%]">
              <SceneArt scene="memory-orb" sizes="(min-width: 1024px) 400px, 60vw" alt="Nia holding a glowing memory orb" className="size-full rounded-[40px]" />
            </m.div>
            {MEMORIES.map((mem, i) => (
              <OrbitingMemory key={mem.label} progress={p} index={i} />
            ))}
          </div>
        </Container>
      </div>
    </div>
  );
}

function StackedScene() {
  return (
    <Container className="py-24">
      <Copy />
      <Reveal className="relative mx-auto mt-14 w-[82%] max-w-[380px]">
        <div aria-hidden="true" className="absolute -inset-[18%] rounded-full" style={{ background: "radial-gradient(closest-side, rgb(107 222 230 / 0.4), transparent)" }} />
        <SceneArt scene="memory-orb" sizes="82vw" alt="Nia holding a glowing memory orb" className="relative rounded-[32px]" />
      </Reveal>
      <RevealGroup as="ul" className="mt-10 grid gap-3 sm:grid-cols-2" step={0.08}>
        {MEMORIES.map((mem) => (
          <RevealItem as="li" key={mem.label}>
            <MemoryCard icon={mem.icon} label={mem.label} value={mem.value} className="w-full" />
          </RevealItem>
        ))}
      </RevealGroup>
    </Container>
  );
}

export function MemoryStory() {
  const reduce = usePrefersReducedMotion();
  return (
    <section id="memory" aria-label="Memory" className="relative scroll-mt-10 bg-white">
      <div className="hidden lg:block">
        <ScrollScene still={reduce} />
      </div>
      <div className="lg:hidden">
        <StackedScene />
      </div>
    </section>
  );
}
