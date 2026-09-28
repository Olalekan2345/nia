"use client";

import { useRef } from "react";
import { m, useInView } from "motion/react";
import { ArrowUpRight, Fingerprint, Globe, History, Search, Send, Store, UserRound, Waypoints } from "lucide-react";
import { Mascot, cn } from "@nia/ui";
import { EASE_OUT, VIEW_ONCE } from "./motion";
import { MaskLines, RevealGroup, RevealItem } from "./primitives";
import { Container, SectionLabel, displayClass } from "./ui";

const DOCS_URL = "https://github.com/Olalekan2345/nia/blob/main/docs/WALRUS.md";

/* Node positions in the 1000×560 scene, and the curve from the core (500, 280) to each. */
const NODES = [
  { icon: Globe, label: "Web chat", note: "Where it’s shared", pos: "left-[3%] top-[10%]", path: "M500 280 C 380 250, 300 150, 175 95" },
  { icon: Send, label: "Telegram", note: "Same memory", pos: "right-[3%] top-[10%]", path: "M500 280 C 620 250, 700 150, 825 95" },
  { icon: UserRound, label: "Customer", note: "Sees and corrects it", pos: "left-[3%] bottom-[10%]", path: "M500 280 C 380 310, 300 410, 175 465" },
  { icon: Store, label: "Merchant", note: "Gets the context", pos: "right-[3%] bottom-[10%]", path: "M500 280 C 620 310, 700 410, 825 465" },
] as const;

const FACTS = [
  { icon: Waypoints, label: "Walrus Mainnet" },
  { icon: Search, label: "Semantic recall" },
  { icon: Fingerprint, label: "Isolated customer memory" },
  { icon: History, label: "Cross-session persistence" },
] as const;

const PARTICLES = [
  ["18%", "30%", 5, 9],
  ["30%", "72%", 4, 11],
  ["44%", "18%", 3, 8],
  ["58%", "82%", 5, 10],
  ["70%", "26%", 4, 12],
  ["82%", "64%", 3, 9],
  ["36%", "48%", 3, 13],
  ["64%", "46%", 4, 10],
] as const;

function MemoryCore() {
  return (
    <div className="relative grid size-[min(56vw,260px)] place-items-center" aria-hidden="true">
      <div className="nia-breathe absolute -inset-[40%] rounded-full" style={{ background: "radial-gradient(closest-side, rgb(81 224 246 / 0.32), rgb(11 127 156 / 0.16) 55%, transparent)" }} />
      <div
        className="absolute inset-0 rounded-full"
        style={{
          background: "radial-gradient(circle at 35% 30%, rgb(255 255 255 / 0.35), transparent 35%), radial-gradient(circle at 55% 60%, #8cf0f7 0%, #3fd2e8 30%, #0b9bb8 62%, #0b5f78 84%, #0d2f3b 100%)",
          boxShadow: "0 0 80px -10px rgb(81 224 246 / 0.65), inset 0 -20px 50px rgb(15 14 38 / 0.45)",
        }}
      />
      <div className="absolute inset-[7%] rounded-full border border-white/20" />
      <Mascot size={104} state="remembering" decorative className="relative shadow-[0_0_40px_rgb(81_224_246/0.6)]" />
    </div>
  );
}

export function WalrusMemoryScene() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.2 });

  return (
    <section id="walrus" aria-labelledby="walrus-title" className="relative isolate overflow-hidden bg-ink-950 py-28 text-white sm:py-36">
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10"
        style={{ background: "radial-gradient(50% 45% at 50% 55%, rgb(81 224 246 / 0.14), transparent 70%), radial-gradient(35% 30% at 85% 10%, rgb(206 147 227 / 0.12), transparent 70%), radial-gradient(30% 30% at 10% 90%, rgb(111 119 253 / 0.14), transparent 70%)" }}
      />
      <Container>
        <div className="flex flex-col items-center text-center">
          <SectionLabel index="08" tone="dark">
            Built on Walrus Memory
          </SectionLabel>
          <h2 id="walrus-title" className={displayClass("lg") + " mt-6 max-w-[16ch]"}>
            <MaskLines lines={["Memory that survives", <span key="c" className="text-aqua-300">the conversation.</span>]} />
          </h2>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-white/70">
            Nia uses Walrus Memory to keep useful customer context across sessions and channels — encrypted, and separate for every customer.
          </p>
        </div>

        {/* Desktop: the core with four connected places. */}
        <div ref={ref} className="relative mx-auto mt-16 hidden aspect-[1000/560] max-w-5xl lg:block">
          <svg viewBox="0 0 1000 560" className="absolute inset-0 size-full" aria-hidden="true">
            {NODES.map((n, i) => (
              <g key={n.label}>
                <m.path
                  d={n.path}
                  fill="none"
                  stroke="rgb(255 255 255 / 0.16)"
                  strokeWidth="1.2"
                  initial={{ pathLength: 0 }}
                  whileInView={{ pathLength: 1 }}
                  viewport={VIEW_ONCE}
                  transition={{ duration: 1.2, ease: EASE_OUT, delay: 0.2 + i * 0.12 }}
                />
                <m.path
                  d={n.path}
                  fill="none"
                  stroke="#6bdee6"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  className="nia-flow"
                  data-paused={!inView}
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 0.7 }}
                  viewport={VIEW_ONCE}
                  transition={{ duration: 0.8, delay: 1.3 + i * 0.12 }}
                />
              </g>
            ))}
          </svg>
          {PARTICLES.map(([left, top, size, dur]) => (
            <span
              key={`${left}${top}`}
              aria-hidden="true"
              className="nia-float absolute rounded-full bg-aqua-200/70"
              style={{ left, top, width: size, height: size, ["--nia-float-dur" as string]: `${dur}s`, animationPlayState: inView ? "running" : "paused" }}
            />
          ))}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <MemoryCore />
          </div>
          {NODES.map(({ icon: Icon, label, note, pos }, i) => (
            <m.div
              key={label}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={VIEW_ONCE}
              transition={{ duration: 0.7, ease: EASE_OUT, delay: 0.6 + i * 0.12 }}
              className={cn("absolute flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] py-3 pr-5 pl-3", pos)}
            >
              <span className="grid size-10 place-items-center rounded-xl bg-white/10 text-aqua-200" aria-hidden="true">
                <Icon className="size-5" />
              </span>
              <span className="text-left leading-tight">
                <span className="block font-bold">{label}</span>
                <span className="text-sm text-white/60">{note}</span>
              </span>
            </m.div>
          ))}
        </div>

        {/* Mobile: the core, then the four places. */}
        <div className="mt-14 lg:hidden">
          <div className="flex justify-center">
            <MemoryCore />
          </div>
          <RevealGroup as="ul" className="mt-12 grid grid-cols-2 gap-3">
            {NODES.map(({ icon: Icon, label, note }) => (
              <RevealItem as="li" key={label} className="rounded-2xl border border-white/10 bg-white/[0.06] p-4">
                <Icon className="size-5 text-aqua-200" aria-hidden="true" />
                <p className="mt-3 font-bold">{label}</p>
                <p className="text-sm text-white/60">{note}</p>
              </RevealItem>
            ))}
          </RevealGroup>
        </div>

        <RevealGroup as="ul" className="mx-auto mt-16 grid max-w-4xl gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {FACTS.map(({ icon: Icon, label }) => (
            <RevealItem as="li" key={label} className="flex items-center gap-3 rounded-2xl border border-white/10 px-4 py-3.5">
              <Icon className="size-4 shrink-0 text-aqua-300" aria-hidden="true" />
              <span className="text-sm font-semibold text-white/85">{label}</span>
            </RevealItem>
          ))}
        </RevealGroup>

        <div className="mt-10 flex justify-center">
          <a href={DOCS_URL} target="_blank" rel="noopener noreferrer" className="group inline-flex h-11 items-center gap-2 rounded-full border border-white/20 px-5 text-sm font-semibold text-white transition-colors duration-200 hover:border-white/45 hover:bg-white/5">
            How memory works
            <ArrowUpRight className="size-4 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transition-none" aria-hidden="true" />
          </a>
        </div>
      </Container>
    </section>
  );
}
