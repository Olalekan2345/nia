"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ArrowUp } from "lucide-react";
import { AnimatePresence, m, useAnimationControls, useMotionValueEvent, useScroll, type Variants } from "motion/react";
import { EASE_OUT } from "./motion";
import { useRange } from "./use-range";
import { usePrefersReducedMotion } from "./use-reduced-motion";

/** Viewports scrolled before Nia offers the lift back up. */
const SHOW_AFTER = 1.1;

/** A little hop and head-tilt: "up here!" */
const HOP = { y: [0, -12, 0, -6, 0], rotate: [0, -8, 6, -2, 0], transition: { duration: 1.1, ease: "easeOut" as const } };

/** Arrives by popping up from below; leaves downward, or zips upward when she was clicked. */
const SHELL: Variants = {
  hidden: { opacity: 0, y: 36, scale: 0.8 },
  shown: { opacity: 1, y: 0, scale: 1, transition: { type: "spring", stiffness: 420, damping: 24 } },
  gone: (launched: boolean) => (launched ? { opacity: 0, y: -90, scale: 0.85, transition: { duration: 0.45, ease: EASE_OUT } } : { opacity: 0, y: 30, scale: 0.9, transition: { duration: 0.3 } }),
};

/**
 * Nia pointing the way back up: her raised peace-sign paw, a ring that fills
 * as the page is read, and a nudge (hop + speech bubble) when she first shows
 * up and again at the end of the page. Clicking scrolls to the top and moves
 * focus to the page heading (`targetId`, else the page's first `main h1`), so
 * keyboard users land there too. `lift` raises her above a bottom bar (e.g.
 * Walrus Market's compare tray) while one is showing.
 */
export function BackToTop({ targetId, lift = false }: { targetId?: string; lift?: boolean }) {
  const reduce = usePrefersReducedMotion();
  const { scrollY, scrollYProgress } = useScroll();
  const ring = useRange(scrollYProgress, [0, 1], [0, 1]);
  const hop = useAnimationControls();

  const [visible, setVisible] = useState(false);
  const [atEnd, setAtEnd] = useState(false);
  const [greeting, setGreeting] = useState<string | null>(null);
  const [pointer, setPointer] = useState(false);
  const [launched, setLaunched] = useState(false);
  const greeted = useRef(false);

  useMotionValueEvent(scrollY, "change", (y) => setVisible(y > window.innerHeight * SHOW_AFTER));
  useMotionValueEvent(scrollYProgress, "change", (p) => setAtEnd(p > 0.97));
  // A page restored mid-scroll should show her straight away.
  useEffect(() => {
    const initial = () => setVisible(window.scrollY > window.innerHeight * SHOW_AFTER);
    initial();
  }, []);

  // First appearance: say hello once.
  useEffect(() => {
    if (!visible || greeted.current) return;
    greeted.current = true;
    const hello = setTimeout(() => {
      setGreeting("Need a lift back up?");
      if (!reduce) void hop.start(HOP);
    }, 700);
    const bye = setTimeout(() => setGreeting(null), 3800);
    return () => {
      clearTimeout(hello);
      clearTimeout(bye);
    };
  }, [visible, reduce, hop]);

  // End of the page: offer again.
  useEffect(() => {
    if (atEnd && visible && !reduce) void hop.start(HOP);
  }, [atEnd, visible, reduce, hop]);

  const bubble = pointer ? "Back to the top" : atEnd ? "Back to the top?" : greeting;

  const goTop = () => {
    setLaunched(true);
    const heading = (targetId ? document.getElementById(targetId) : null) ?? document.querySelector<HTMLElement>("main h1");
    if (heading) {
      if (!heading.hasAttribute("tabindex")) heading.setAttribute("tabindex", "-1");
      heading.focus({ preventScroll: true });
    }
    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
  };

  return (
    <AnimatePresence custom={launched} onExitComplete={() => setLaunched(false)}>
      {visible ? (
        <m.div
          key="back-to-top"
          custom={launched}
          variants={SHELL}
          initial="hidden"
          animate="shown"
          exit="gone"
          className={
            lift
              ? "fixed right-4 bottom-[calc(max(1rem,env(safe-area-inset-bottom))_+_4.75rem)] z-40 flex items-center gap-3 transition-[bottom] duration-300 motion-reduce:transition-none sm:right-6 sm:bottom-[6.25rem]"
              : "fixed right-4 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 flex items-center gap-3 transition-[bottom] duration-300 motion-reduce:transition-none sm:right-6 sm:bottom-6"
          }
        >
          <AnimatePresence mode="wait">
            {bubble ? (
              <m.p
                key={bubble}
                aria-hidden="true"
                initial={{ opacity: 0, x: 10, scale: 0.9 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 6, scale: 0.95 }}
                transition={{ duration: 0.25, ease: EASE_OUT }}
                className="relative origin-right rounded-2xl border border-ink-900/[0.07] bg-white px-3.5 py-2 text-sm font-semibold whitespace-nowrap text-ink-900 shadow-lift"
              >
                {bubble}
                <span className="absolute top-1/2 -right-[7px] size-3 -translate-y-1/2 rotate-45 border-t border-r border-ink-900/[0.07] bg-white" />
              </m.p>
            ) : null}
          </AnimatePresence>

          <m.button
            type="button"
            aria-label="Back to the top"
            onClick={goTop}
            onHoverStart={() => setPointer(true)}
            onHoverEnd={() => setPointer(false)}
            onFocus={() => setPointer(true)}
            onBlur={() => setPointer(false)}
            whileHover={{ y: -3 }}
            whileTap={{ scale: 0.9 }}
            className="group relative grid size-14 shrink-0 place-items-center rounded-full focus-visible:outline-offset-4 sm:size-16"
          >
            {/* Reading progress: the ring fills as the page scrolls. */}
            <svg viewBox="0 0 72 72" className="absolute -inset-1 size-[calc(100%+0.5rem)] -rotate-90" aria-hidden="true">
              <defs>
                <linearGradient id="back-to-top-ring" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0" stopColor="#51e0f6" />
                  <stop offset="0.55" stopColor="#9fb8fc" />
                  <stop offset="1" stopColor="#ce93e3" />
                </linearGradient>
              </defs>
              <circle cx="36" cy="36" r="33.5" fill="none" stroke="rgb(27 26 75 / 0.1)" strokeWidth="3" />
              <m.circle cx="36" cy="36" r="33.5" fill="none" stroke="url(#back-to-top-ring)" strokeWidth="3" strokeLinecap="round" style={{ pathLength: ring }} />
            </svg>

            <m.span animate={hop} className="relative block size-full">
              <span className="absolute inset-0 overflow-hidden rounded-full border-2 border-white bg-surface-2 shadow-lift">
                <Image src="/landing/nia-back-to-top.webp" alt="" fill sizes="64px" className="object-cover" draggable={false} />
              </span>
              <span className="absolute -top-1 -right-1 grid size-6 place-items-center rounded-full bg-ink-900 text-white shadow-soft ring-2 ring-white" aria-hidden="true">
                <ArrowUp className="size-3.5 transition-transform duration-200 group-hover:-translate-y-0.5 motion-reduce:transition-none" strokeWidth={2.75} />
              </span>
            </m.span>
          </m.button>
        </m.div>
      ) : null}
    </AnimatePresence>
  );
}
