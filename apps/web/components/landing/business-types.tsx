"use client";

import { useRef } from "react";
import { m, useScroll } from "motion/react";
import { Briefcase, CakeSlice, CalendarCheck, Headphones, Shirt, Sparkles, Wrench, type LucideIcon } from "lucide-react";
import { cn } from "@nia/ui";
import { EASE_OUT } from "./motion";
import { MaskLines, Reveal } from "./primitives";
import { Container, Cta, SceneArt, SectionLabel, WalrusMark, displayClass } from "./ui";
import { useRange } from "./use-range";
import { usePrefersReducedMotion } from "./use-reduced-motion";

type Kind = {
  icon: LucideIcon;
  name: string;
  line: string;
  memory: string;
  tile: string;
  span?: string;
  visual?: React.ReactNode;
};

const Swatches = (
  <div className="relative mt-8 h-28 w-[250px]" aria-hidden="true">
    {[
      { bg: "repeating-radial-gradient(circle at 30% 30%, #0f7a55 0 6px, #1fa37a 6px 11px, #f5c542 11px 13px)", r: -8, x: 0 },
      { bg: "repeating-linear-gradient(45deg, #1e3a8a 0 7px, #3b5bdb 7px 10px, #dbe4ff 10px 12px)", r: 2, x: 72 },
      { bg: "linear-gradient(135deg, #1b1a4b, #0f0e26 60%, #2a2670)", r: 10, x: 144 },
    ].map((s, i) => (
      <span key={i} className="absolute top-0 h-28 w-24 rounded-2xl border-4 border-white shadow-soft" style={{ background: s.bg, rotate: `${s.r}deg`, left: s.x }} />
    ))}
  </div>
);

const Shades = (
  <div className="mt-6 flex gap-2" aria-hidden="true">
    {["#7b3f2e", "#a0522d", "#c6865a", "#e3a98a", "#b2455b"].map((c) => (
      <span key={c} className="size-8 rounded-full border-2 border-white shadow-soft" style={{ background: c }} />
    ))}
  </div>
);

const Notes = (
  <div className="mt-8 space-y-2" aria-hidden="true">
    {["Last visit · contract review", "Prefers morning calls", "Follow up in March"].map((n, i) => (
      <span key={n} className="flex w-fit items-center gap-2.5 rounded-2xl border border-ink-900/[0.06] bg-paper px-3.5 py-2.5 text-sm font-medium text-ink-900/80" style={{ marginLeft: i * 18 }}>
        <span className="size-1.5 rounded-full bg-aqua-400" /> {n}
      </span>
    ))}
  </div>
);

const KINDS: Kind[] = [
  { icon: Shirt, name: "Fashion", line: "Find the right size and style.", memory: "Medium · darker tones", tile: "from-aqua-100 to-periwinkle-100", span: "lg:col-span-2", visual: Swatches },
  { icon: Sparkles, name: "Beauty", line: "Remember colours and preferences.", memory: "Shade: warm mocha", tile: "from-blush-100 to-lavender-100", visual: Shades },
  { icon: Headphones, name: "Electronics", line: "Help compare and reorder accessories.", memory: "iPhone 13 · USB-C", tile: "from-periwinkle-50 to-aqua-50" },
  { icon: CakeSlice, name: "Food", line: "Remember favourites and repeat orders.", memory: "No nuts · mum’s 60th", tile: "from-blush-100 to-aqua-50" },
  { icon: CalendarCheck, name: "Services", line: "Book the usual appointment.", memory: "Silk press · Saturdays", tile: "from-lavender-100 to-periwinkle-50" },
  { icon: Wrench, name: "Repairs", line: "Remember previous service history.", memory: "Screen repair, 3 weeks ago", tile: "from-aqua-50 to-lavender-100" },
  { icon: Briefcase, name: "Professional services", line: "Keep customer context across visits.", memory: "Prefers morning calls", tile: "from-periwinkle-100 to-blush-100", span: "lg:col-span-2", visual: Notes },
];

function KindCard({ kind, index }: { kind: Kind; index: number }) {
  const Icon = kind.icon;
  return (
    <m.li
      initial={{ opacity: 0, y: 48 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.8, ease: EASE_OUT, delay: (index % 3) * 0.08 }}
      className={cn(
        "group flex w-[84%] shrink-0 snap-start flex-col justify-between rounded-[30px] sm:w-auto border border-ink-900/[0.06] bg-white p-7 shadow-soft transition-shadow duration-300 hover:shadow-lift sm:p-8",
        // Wide cards: copy and memory on the left, the visual on the right.
        kind.span && "lg:grid lg:grid-cols-[1fr_auto] lg:grid-rows-[1fr_auto] lg:gap-x-10",
        kind.span,
      )}
    >
      <div className={kind.span ? "lg:col-start-1 lg:row-start-1" : undefined}>
        <span className={cn("grid size-14 place-items-center rounded-[18px] bg-linear-to-br text-ink-900 shadow-[inset_0_1px_0_rgb(255_255_255/0.9),0_10px_24px_-14px_rgb(27_26_75/0.45)]", kind.tile)} aria-hidden="true">
          <Icon className="size-6" />
        </span>
        <h3 className="mt-6 text-2xl font-extrabold tracking-tight text-ink-900">{kind.name}</h3>
        <p className="mt-2 text-[17px] text-muted-foreground">{kind.line}</p>
      </div>
      {kind.visual ? <div className={kind.span ? "lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-center lg:[&>*]:mt-0" : undefined}>{kind.visual}</div> : null}
      <p
        className={cn(
          "mt-8 inline-flex w-fit items-center gap-1.5 rounded-full bg-memory-soft px-3 py-1.5 text-[13px] font-semibold text-memory",
          kind.span && "lg:col-start-1 lg:row-start-2 lg:self-end",
        )}
      >
        <WalrusMark /> <span className="sr-only">Example memory: </span>
        {kind.memory}
      </p>
    </m.li>
  );
}

/** Walrus Market: every shop on Nia, browsable in one place. */
function MarketBand() {
  return (
    <Reveal className="mt-24 sm:mt-28">
      <div className="grid items-center gap-8 overflow-hidden rounded-[40px] border border-ink-900/[0.06] bg-white p-4 shadow-soft sm:p-6 lg:grid-cols-[0.85fr_1.15fr] lg:gap-14 lg:p-8">
        <SceneArt scene="market" sizes="(min-width: 1024px) 460px, 90vw" alt="Nia in a shop, carrying bags from Walrus Market" className="rounded-[30px] shadow-none" />
        <div className="px-2 pb-4 sm:px-4 lg:px-0 lg:pb-0">
          <p className="inline-flex items-center gap-2 rounded-full bg-memory-soft px-3 py-1 text-[13px] font-semibold text-memory">
            <WalrusMark /> Walrus Market
          </p>
          <h3 className={displayClass("md") + " mt-5 text-foreground"}>Every shop. One guide.</h3>
          <p className="mt-5 max-w-md text-lg leading-relaxed text-muted-foreground">
            Browse independent shops in one place, compare side by side, and let Nia ask a quick question or two to find the right one. Your answers are remembered for next time.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Cta href="/market" arrow>
              Browse Walrus Market
            </Cta>
            <Cta href="/signin?next=/onboarding" variant="secondary">
              Set up your business
            </Cta>
          </div>
        </div>
      </div>
    </Reveal>
  );
}

export function BusinessTypes() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = usePrefersReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  // The grid drifts a touch against the page, so the section feels layered.
  const drift = useRange(scrollYProgress, [0, 1], [reduce ? 0 : 40, reduce ? 0 : -40]);

  return (
    <section id="business" aria-labelledby="business-title" className="relative scroll-mt-16 bg-paper py-28 sm:py-36">
      <Container>
        <div className="grid items-center gap-12 lg:grid-cols-[1fr_1.05fr] lg:gap-16">
          <div>
            <SectionLabel index="05">For businesses</SectionLabel>
            <h2 id="business-title" className={displayClass("lg") + " mt-6 text-foreground"}>
              <MaskLines lines={["Nia sells more", "than products."]} />
            </h2>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-muted-foreground">
              Products, services, bookings and custom orders — for any business whose customers come back.
            </p>
          </div>
          <Reveal y={40}>
            <SceneArt
              scene="businesses"
              sizes="(min-width: 1024px) 620px, 92vw"
              alt="Nia with shopping bags, surrounded by fashion, beauty, electronics, food, home goods and a booking calendar"
            />
          </Reveal>
        </div>

        <div ref={ref}>
          {/* Phones: a swipeable row. Wider screens: an uneven grid. */}
          <m.ul
            style={{ y: drift }}
            aria-label="Business types"
            tabIndex={0}
            className="scrollbar-none -mx-5 mt-16 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-6 sm:mx-0 sm:grid sm:snap-none sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-3 lg:gap-5"
          >
            {KINDS.map((kind, i) => (
              <KindCard key={kind.name} kind={kind} index={i} />
            ))}
          </m.ul>
        </div>

        <MarketBand />
      </Container>
    </section>
  );
}
