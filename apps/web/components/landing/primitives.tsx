"use client";

import { LazyMotion, MotionConfig, domAnimation, m } from "motion/react";
import { cn } from "@nia/ui";
import { VIEW_ONCE, fadeUp, staggered } from "./motion";

/** Motion for the whole landing page: small feature bundle, and OS reduced-motion respected. */
export function LandingMotion({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user">
      <LazyMotion features={domAnimation} strict>
        {children}
      </LazyMotion>
    </MotionConfig>
  );
}

/** Fade + rise into place once visible. */
export function Reveal({ children, className, delay = 0, y = 28 }: { children: React.ReactNode; className?: string; delay?: number; y?: number }) {
  return (
    <m.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={VIEW_ONCE}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay }}
    >
      {children}
    </m.div>
  );
}

/** A group whose RevealItem children arrive one after another. */
export function RevealGroup({ children, className, step = 0.08, delay = 0, as = "div" }: { children: React.ReactNode; className?: string; step?: number; delay?: number; as?: "div" | "ul" | "ol" }) {
  const props = { className, initial: "hidden", whileInView: "show", viewport: VIEW_ONCE, variants: staggered(step, delay) } as const;
  if (as === "ul") return <m.ul {...props}>{children}</m.ul>;
  if (as === "ol") return <m.ol {...props}>{children}</m.ol>;
  return <m.div {...props}>{children}</m.div>;
}

export function RevealItem({ children, className, as = "div" }: { children: React.ReactNode; className?: string; as?: "div" | "li" }) {
  if (as === "li") return <m.li className={className} variants={fadeUp}>{children}</m.li>;
  return (
    <m.div className={className} variants={fadeUp}>
      {children}
    </m.div>
  );
}

/** Headline lines that slide up out of a mask, one after another. */
export function MaskLines({ lines, className, lineClassName, delay = 0, step = 0.09 }: { lines: React.ReactNode[]; className?: string; lineClassName?: string[]; delay?: number; step?: number }) {
  return (
    <m.span className={cn("block", className)} initial="hidden" whileInView="show" viewport={{ once: true, amount: 0.6 }} variants={staggered(step, delay)}>
      {lines.map((line, i) => (
        <span key={i} className="-mb-[0.1em] block overflow-hidden pb-[0.1em]">
          <m.span
            className={cn("block", lineClassName?.[i])}
            variants={{ hidden: { y: "105%", opacity: 0 }, show: { y: "0%", opacity: 1, transition: { duration: 0.9, ease: [0.22, 1, 0.36, 1] } } }}
          >
            {line}
            {i < lines.length - 1 ? " " : null}
          </m.span>
        </span>
      ))}
    </m.span>
  );
}
