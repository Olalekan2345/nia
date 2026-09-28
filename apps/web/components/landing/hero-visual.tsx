"use client";

import { m, useScroll, type MotionValue } from "motion/react";
import { CalendarCheck, Send, ShoppingBag } from "lucide-react";
import { cn } from "@nia/ui";
import { AnimatedChat } from "./animated-chat";
import { SceneArt } from "./ui";
import { useRange } from "./use-range";
import { usePrefersReducedMotion } from "./use-reduced-motion";

/** Scroll depth for one floating layer: nearer layers drift further. */
function useDepth(scrollY: MotionValue<number>, distance: number, reduce: boolean | null) {
  return useRange(scrollY, [0, 800], [0, reduce ? 0 : -distance]);
}

/**
 * Three nested layers per floating object, each owning one kind of motion:
 * scroll depth (motion value) → entrance (CSS, runs before hydration) → idle float (CSS).
 */
function Floater({ y, className, delay, floatDur, children }: { y: MotionValue<number>; className: string; delay: number; floatDur: number; children: React.ReactNode }) {
  return (
    <m.div style={{ y }} className={cn("absolute", className)}>
      <div className="nia-in" style={{ ["--nia-anim" as string]: "nia-pop-in", ["--nia-delay" as string]: `${delay}s`, ["--nia-dur" as string]: "0.8s" }}>
        <div className="nia-float" style={{ ["--nia-float-dur" as string]: `${floatDur}s`, ["--nia-float-delay" as string]: `${-delay * 2}s` }}>
          {children}
        </div>
      </div>
    </m.div>
  );
}

export function HeroVisual() {
  const { scrollY } = useScroll();
  const reduce = usePrefersReducedMotion();
  const portalY = useDepth(scrollY, 30, reduce);
  const nearY = useDepth(scrollY, 110, reduce);
  const midY = useDepth(scrollY, 70, reduce);
  const farY = useDepth(scrollY, 45, reduce);
  const chatY = useDepth(scrollY, 55, reduce);

  return (
    <div className="relative mx-auto w-full max-w-[min(86vw,600px)] lg:max-w-[600px]">
      <div className="relative aspect-square">
        {/* Aura and orbit rings: static layers, only the aura breathes (opacity/transform). */}
        <div
          aria-hidden="true"
          className="nia-breathe absolute -inset-[14%] rounded-full"
          style={{ background: "radial-gradient(closest-side, rgb(107 222 230 / 0.5), rgb(159 184 252 / 0.3) 46%, rgb(206 147 227 / 0.16) 72%, transparent)" }}
        />
        <div aria-hidden="true" className="absolute inset-[1%] hidden rounded-[60px] border border-dashed border-aqua-300/70 sm:block" />
        <span aria-hidden="true" className="absolute top-[0.5%] left-[30%] size-2 rounded-full bg-aqua-300" />
        <span aria-hidden="true" className="absolute top-[64%] right-[0.4%] size-1.5 rounded-full bg-lavender-300" />
        <span aria-hidden="true" className="absolute bottom-[0.5%] left-[62%] size-1.5 rounded-full bg-blush-300" />

        <m.div style={{ y: portalY }} className="absolute inset-[7%]">
          <div className="nia-in size-full" style={{ ["--nia-anim" as string]: "nia-arrive", ["--nia-dur" as string]: "1.2s", ["--nia-delay" as string]: "0.15s" }}>
            <div className="nia-float size-full" style={{ ["--nia-float-dur" as string]: "8s" }}>
              <SceneArt
                scene="hero"
                priority
                sizes="(min-width: 1024px) 520px, 80vw"
                alt="Nia, the walrus shopping assistant, making a peace sign and holding a phone, with a memory orb floating nearby"
                className="size-full rounded-[44px]"
              />
            </div>
          </div>
        </m.div>

        <Floater y={midY} delay={0.7} floatDur={7} className="top-[3%] -left-[8%] hidden sm:block">
          <div className="flex items-center gap-3 rounded-2xl border border-ink-900/[0.06] bg-white/95 p-2 pr-4 shadow-soft">
            <span
              aria-hidden="true"
              className="size-10 rounded-xl"
              style={{ background: "repeating-radial-gradient(circle at 30% 30%, #0f7a55 0 5px, #1fa37a 5px 9px, #f5c542 9px 11px)" }}
            />
            <span className="text-sm leading-tight">
              <span className="block font-bold text-ink-900">Emerald Ankara</span>
              <span className="text-muted-foreground">6 yards · last order</span>
            </span>
          </div>
        </Floater>

        <Floater y={nearY} delay={0.85} floatDur={6} className="top-[1%] right-[5%]">
          <span className="grid size-11 place-items-center rounded-full bg-[#2AABEE] text-white shadow-[0_12px_30px_-10px_rgb(42_171_238/0.8)] sm:size-12" aria-hidden="true">
            <Send className="size-5 -translate-x-px translate-y-px" />
          </span>
        </Floater>

        <Floater y={farY} delay={1} floatDur={9} className="top-[44%] -left-[3%] sm:-left-[7%]">
          <span className="grid size-11 place-items-center rounded-2xl border border-ink-900/[0.06] bg-white/95 text-ink-900 shadow-soft sm:size-14" aria-hidden="true">
            <ShoppingBag className="size-5 sm:size-6" />
          </span>
        </Floater>

        <Floater y={midY} delay={1.1} floatDur={8} className="top-[70%] -right-[9%] hidden sm:block">
          <div className="flex items-center gap-2.5 rounded-2xl border border-ink-900/[0.06] bg-white/95 px-3.5 py-3 shadow-soft">
            <span className="grid size-9 place-items-center rounded-xl bg-lavender-100 text-ink-800" aria-hidden="true">
              <CalendarCheck className="size-5" />
            </span>
            <span className="text-sm leading-tight">
              <span className="block font-bold text-ink-900">Sat · 10:00</span>
              <span className="text-muted-foreground">The usual fitting</span>
            </span>
          </div>
        </Floater>

        <Floater y={nearY} delay={1.25} floatDur={6.5} className="right-[14%] -bottom-[2%]">
          <span className="nia-orb block size-10 sm:size-14" aria-hidden="true" />
        </Floater>
      </div>

      <m.div style={{ y: chatY }} className="relative z-10 mx-auto -mt-[14%] w-[94%] max-w-[380px] lg:absolute lg:-bottom-[13%] lg:-left-[19%] lg:mt-0 lg:w-[350px]">
        <div className="nia-in" style={{ ["--nia-delay" as string]: "0.55s", ["--nia-dur" as string]: "1s" }}>
          <AnimatedChat />
        </div>
      </m.div>
    </div>
  );
}
