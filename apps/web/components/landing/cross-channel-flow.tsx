"use client";

import { useRef } from "react";
import Image from "next/image";
import { m, useMotionValue, useScroll, useTransform, type MotionValue } from "motion/react";
import { Globe } from "lucide-react";
import { Mascot, cn } from "@nia/ui";
import { EASE_OUT, VIEW_ONCE } from "./motion";
import { MaskLines, Reveal } from "./primitives";
import { Container, SectionLabel, WalrusMark, displayClass } from "./ui";
import { useRange } from "./use-range";
import { usePrefersReducedMotion } from "./use-reduced-motion";

type MotionStyle = React.ComponentProps<typeof m.div>["style"];

/* ── Pieces shared by the desktop scene and the mobile sequence ── */

function WebCard({ show }: { show: [MotionStyle?, MotionStyle?, MotionStyle?] }) {
  return (
    <div className="rounded-[28px] border border-ink-900/[0.07] bg-white p-5 shadow-soft">
      <p className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        <Globe className="size-4" aria-hidden="true" /> Web chat · Monday
      </p>
      <div className="mt-5 space-y-2.5 text-[15px]">
        <m.p style={show[0]} className="ml-auto w-fit max-w-[85%] rounded-[20px] rounded-br-md bg-ink-900 px-4 py-2.5 text-white">
          I usually prefer darker colours.
        </m.p>
        <m.div style={show[1]} className="flex items-end gap-2">
          <Mascot size={28} decorative />
          <p className="w-fit rounded-[20px] rounded-bl-md bg-surface-2 px-4 py-2.5 text-ink-900">Noted — darker colours it is.</p>
        </m.div>
        <m.p style={show[2]} className="ml-9 inline-flex items-center gap-1.5 rounded-full bg-memory-soft px-2.5 py-1 text-xs font-semibold text-memory">
          <WalrusMark /> Remembered · colour preference
        </m.p>
      </div>
    </div>
  );
}

function TelegramCard({ show }: { show: [MotionStyle?, MotionStyle?] }) {
  return (
    <div className="overflow-hidden rounded-[28px] border border-ink-900/[0.07] bg-white shadow-soft">
      <div className="flex items-center gap-3 border-b border-ink-900/[0.06] px-5 py-3.5">
        <Image src="/brand/nia-telegram-avatar.jpg" alt="" width={36} height={36} className="size-9 rounded-full" />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="text-sm font-bold text-ink-900">Nia</p>
          <p className="text-xs text-[#2AABEE]">bot</p>
        </div>
        <p className="text-xs font-semibold text-muted-foreground">Telegram · Friday</p>
      </div>
      <div className="space-y-2.5 px-5 py-5 text-[15px]" style={{ background: "linear-gradient(160deg, #eaf4fb, #f3f0fb)" }}>
        <m.p style={show[0]} className="ml-auto w-fit max-w-[85%] rounded-[18px] rounded-br-md bg-[#e1f7cf] px-4 py-2.5 text-ink-900">
          What colours do I usually like?
        </m.p>
        <m.div style={show[1]} className="w-fit max-w-[90%] rounded-[18px] rounded-bl-md bg-white px-4 py-2.5 text-ink-900 shadow-[0_1px_1px_rgb(0_0_0/0.06)]">
          You’ve told me you prefer darker colours.
          <span className="mt-1.5 flex items-center gap-1.5 text-xs font-semibold text-memory">
            <WalrusMark /> Recalled from Walrus Memory
          </span>
        </m.div>
      </div>
    </div>
  );
}

function MemoryNode({ glow, scale, size = 160 }: { glow?: MotionValue<number>; scale?: MotionValue<number>; size?: number }) {
  return (
    <m.div style={{ scale }} className="relative grid place-items-center" aria-hidden="true">
      <m.div style={{ opacity: glow }} className="absolute -inset-[45%] rounded-full" >
        <div className="size-full rounded-full" style={{ background: "radial-gradient(closest-side, rgb(81 224 246 / 0.45), transparent)" }} />
      </m.div>
      <div className="absolute -inset-[14%] rounded-full border border-aqua-300/50" />
      <div className="nia-orb relative grid place-items-center" style={{ width: size, height: size }}>
        <WalrusMark className="size-9 text-white drop-shadow-[0_2px_6px_rgb(27_26_75/0.35)]" />
      </div>
    </m.div>
  );
}

/* ── Desktop: sticky scene ── */

const HEADLINE = ["One memory.", <span key="every" className="text-memory">Every conversation.</span>];

function useAppear(p: MotionValue<number>, start: number, len = 0.06): MotionStyle {
  const opacity = useRange(p, [start, start + len], [0, 1]);
  const y = useRange(p, [start, start + len], [14, 0]);
  return { opacity, y };
}

/** `still`: the finished composition, without scroll choreography (reduced motion). */
function ScrollScene({ still = false }: { still?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const finished = useMotionValue(1);
  const p = still ? finished : scrollYProgress;

  const web = [useAppear(p, 0.04), useAppear(p, 0.1), useAppear(p, 0.16)] as [MotionStyle, MotionStyle, MotionStyle];
  const tg = [useAppear(p, 0.78), useAppear(p, 0.86)] as [MotionStyle, MotionStyle];

  // The orb follows the same two curves as the SVG paths below.
  const x = useTransform(p, [0.22, 0.46, 0.56, 0.76], ["-14%", "0%", "0%", "14%"]);
  const y = useTransform(p, (v) => {
    const leg = (a: number, b: number) => Math.min(1, Math.max(0, (v - a) / (b - a)));
    const t1 = leg(0.22, 0.46);
    const t2 = leg(0.56, 0.76);
    return v < 0.5 ? -50 * 4 * t1 * (1 - t1) : 45 * 4 * t2 * (1 - t2);
  });
  const orbOpacity = useRange(p, [0.18, 0.23, 0.45, 0.49, 0.55, 0.58, 0.75, 0.79], [0, 1, 1, 0, 0, 1, 1, 0]);
  const orbScale = useRange(p, [0.18, 0.23, 0.45, 0.49, 0.55, 0.58], [0.4, 1, 1, 0.5, 0.5, 1]);
  const legA = useRange(p, [0.22, 0.46], [0, 1]);
  const legB = useRange(p, [0.56, 0.76], [0, 1]);
  const nodeGlow = useRange(p, [0.4, 0.5, 0.62], [0.35, 1, 0.55]);
  const nodeScale = useRange(p, [0.44, 0.5, 0.56], [1, 1.1, 1]);

  const webLabel = { opacity: useRange(p, [0, 0.04], [0.45, 1]) };
  const nodeLabel = { opacity: useRange(p, [0.44, 0.5], [0.45, 1]) };
  const tgLabel = { opacity: useRange(p, [0.74, 0.8], [0.45, 1]) };

  return (
    <div ref={ref} className={still ? "relative py-28" : "relative h-[300vh]"}>
      <div className={still ? "flex flex-col justify-center" : "sticky top-0 flex h-[100svh] flex-col justify-center"}>
        <Container>
          <SectionLabel index="04">Across channels</SectionLabel>
          <h2 className={displayClass("md") + " mt-6 text-foreground"}>
            <MaskLines lines={HEADLINE} />
          </h2>
          <div className="relative mt-12 grid h-[360px] grid-cols-[36%_28%_36%] items-center">
            <svg aria-hidden="true" viewBox="0 0 1000 360" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 size-full">
              <path d="M360 180 Q430 80 500 180 Q570 270 640 180" fill="none" stroke="rgb(27 26 75 / 0.14)" strokeWidth="1.5" strokeDasharray="4 7" vectorEffect="non-scaling-stroke" />
              <m.path d="M360 180 Q430 80 500 180" fill="none" stroke="#51e0f6" strokeWidth="2.5" strokeLinecap="round" vectorEffect="non-scaling-stroke" style={{ pathLength: legA }} />
              <m.path d="M500 180 Q570 270 640 180" fill="none" stroke="#51e0f6" strokeWidth="2.5" strokeLinecap="round" vectorEffect="non-scaling-stroke" style={{ pathLength: legB }} />
            </svg>
            <div className="relative z-10 pr-4">
              <WebCard show={web} />
            </div>
            <div className="relative z-10 flex justify-center">
              <MemoryNode glow={nodeGlow} scale={nodeScale} size={140} />
            </div>
            <div className="relative z-10 pl-4">
              <TelegramCard show={tg} />
            </div>
            {/* The travelling memory: a full-width layer, so translateX % is a share of the stage. */}
            <m.div aria-hidden="true" style={{ x, y }} className="pointer-events-none absolute inset-x-0 top-1/2 z-20 h-0">
              <m.span style={{ opacity: orbOpacity, scale: orbScale }} className="nia-orb absolute top-0 left-1/2 -mt-4 -ml-4 block size-8" />
            </m.div>
          </div>
          <div className="mt-6 grid grid-cols-[36%_28%_36%] text-center text-sm font-semibold text-ink-900">
            <m.p style={webLabel}>Web</m.p>
            <m.p style={nodeLabel} className="text-memory">
              Walrus Memory
            </m.p>
            <m.p style={tgLabel}>Telegram</m.p>
          </div>
        </Container>
      </div>
    </div>
  );
}

/* ── Mobile and reduced motion: a vertical sequence ── */

function Connector({ reduce }: { reduce: boolean | null }) {
  return (
    <div className="relative mx-auto h-20 w-px bg-[repeating-linear-gradient(to_bottom,rgb(27_26_75/0.18)_0_4px,transparent_4px_10px)]" aria-hidden="true">
      {reduce ? null : (
        <m.span
          className="nia-orb absolute top-0 -left-2 block size-4"
          initial={{ y: 0, opacity: 0 }}
          whileInView={{ y: [0, 64], opacity: [0, 1, 1, 0] }}
          viewport={{ once: true, amount: 1 }}
          transition={{ duration: 1.2, ease: EASE_OUT, delay: 0.3 }}
        />
      )}
    </div>
  );
}

function StackedScene() {
  const reduce = usePrefersReducedMotion();
  return (
    <Container className="py-24">
      <SectionLabel index="04">Across channels</SectionLabel>
      <h2 className={displayClass("md") + " mt-6 text-foreground"}>
        <MaskLines lines={HEADLINE} />
      </h2>
      <div className="mx-auto mt-12 max-w-md">
        <Reveal>
          <WebCard show={[]} />
        </Reveal>
        <Connector reduce={reduce} />
        <Reveal className="flex flex-col items-center gap-4">
          <MemoryNode size={96} />
          <p className="text-sm font-semibold text-memory">Walrus Memory</p>
        </Reveal>
        <Connector reduce={reduce} />
        <m.div initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }} viewport={VIEW_ONCE} transition={{ duration: 0.8, ease: EASE_OUT }}>
          <TelegramCard show={[]} />
        </m.div>
      </div>
    </Container>
  );
}

export function CrossChannelFlow({ className }: { className?: string }) {
  const reduce = usePrefersReducedMotion();
  return (
    <section aria-label="One memory, every conversation" className={cn("relative bg-white", className)}>
      <div className="hidden lg:block">
        <ScrollScene still={reduce} />
      </div>
      <div className="lg:hidden">
        <StackedScene />
      </div>
    </section>
  );
}
