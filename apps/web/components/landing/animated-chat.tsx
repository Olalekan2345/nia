"use client";

import { useEffect, useRef, useState } from "react";
import { m, useInView } from "motion/react";
import { Mascot, cn } from "@nia/ui";
import { EASE_OUT } from "./motion";
import { ExampleTag, WalrusMark } from "./ui";
import { usePrefersReducedMotion } from "./use-reduced-motion";

/**
 * The hero's mini-conversation, played once when it comes into view:
 * customer message → Nia thinking → memory ripple → reply → memory label.
 * An illustration (labelled "Example"), not a live event.
 */
export function AnimatedChat({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.5 });
  const reduce = usePrefersReducedMotion();
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!inView || reduce) return;
    const timers = [900, 1700, 2900, 3500].map((ms, i) => setTimeout(() => setStep(i + 1), ms));
    return () => timers.forEach(clearTimeout);
  }, [inView, reduce]);

  const shown = reduce ? 4 : step;
  const appear = (on: boolean, y = 10) => ({ opacity: on ? 1 : 0, y: on ? 0 : y });
  const t = { duration: 0.55, ease: EASE_OUT };

  return (
    <div ref={ref} className={cn("rounded-[28px] border border-ink-900/[0.07] bg-white/95 p-4 shadow-lift sm:p-5", className)}>
      <div className="flex items-center gap-3">
        <Mascot size={36} state={shown === 2 ? "recalling" : "idle"} decorative />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-ink-900">Nia</p>
          <p className="text-xs text-muted-foreground">Adire Lane · demo shop</p>
        </div>
        <ExampleTag />
      </div>

      <div className="mt-4 space-y-3 text-[15px] leading-snug" aria-live="off">
        <m.p initial={false} animate={appear(shown >= 1)} transition={t} className="ml-auto w-fit max-w-[80%] rounded-[20px] rounded-br-md bg-ink-900 px-4 py-2.5 text-white">
          Same as last time.
        </m.p>

        <div className="relative flex items-end gap-2.5">
          <span className="relative mb-1 size-5 shrink-0" aria-hidden="true">
            <span className="nia-orb absolute inset-0" />
            {shown >= 3 && !reduce
              ? [0, 0.35].map((delay) => (
                  <m.span
                    key={delay}
                    className="absolute inset-0 rounded-full border-2 border-aqua-400"
                    initial={{ opacity: 0.7, scale: 0.8 }}
                    animate={{ opacity: 0, scale: 3 }}
                    transition={{ duration: 1.2, ease: "easeOut", delay }}
                  />
                ))
              : null}
          </span>
          <div className="relative min-w-0 flex-1">
            {/* Thinking dots sit where the reply will appear, so nothing shifts. */}
            <m.span initial={false} animate={{ opacity: shown === 2 ? 1 : 0 }} transition={{ duration: 0.25 }} className="absolute top-0 left-0 inline-flex gap-1 rounded-[20px] rounded-bl-md bg-surface-2 px-4 py-3.5" aria-hidden="true">
              {[0, 1, 2].map((d) => (
                <m.span key={d} className="size-1.5 rounded-full bg-ink-900/40" animate={shown === 2 && !reduce ? { opacity: [0.3, 1, 0.3] } : { opacity: 0.4 }} transition={{ duration: 0.9, repeat: Infinity, delay: d * 0.15 }} />
              ))}
            </m.span>
            <m.p initial={false} animate={appear(shown >= 3, 8)} transition={t} className="w-fit rounded-[20px] rounded-bl-md bg-surface-2 px-4 py-2.5 text-ink-900">
              Your last order was <strong className="font-bold">6 yards of emerald Ankara</strong>. Same quantity?
            </m.p>
          </div>
        </div>

        <m.p
          initial={false}
          animate={shown >= 4 ? { opacity: 1, y: 0, boxShadow: reduce ? "0 0 0 0 rgb(81 224 246 / 0)" : ["0 0 0 0 rgb(81 224 246 / 0.55)", "0 0 0 10px rgb(81 224 246 / 0)"] } : { opacity: 0, y: 6 }}
          transition={{ duration: 0.9, ease: "easeOut" }}
          className="ml-7.5 inline-flex items-center gap-1.5 rounded-full bg-memory-soft px-2.5 py-1 text-xs font-semibold text-memory"
        >
          <WalrusMark /> Remembered with Walrus Memory
        </m.p>
      </div>
    </div>
  );
}
