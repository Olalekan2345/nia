/**
 * Landing-page motion vocabulary. One easing family, a few durations, and
 * helpers for scroll-linked scenes, so every section moves the same way.
 */
import type { Variants } from "motion/react";

type Bezier = [number, number, number, number];

/** Long, soft deceleration: things arrive and settle. */
export const EASE_OUT: Bezier = [0.22, 1, 0.36, 1];
const BASE = 0.8;

/** Reveal once, when a fair part of the element is on screen. */
export const VIEW_ONCE = { once: true, amount: 0.35 } as const;

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 28 },
  show: { opacity: 1, y: 0, transition: { duration: BASE, ease: EASE_OUT } },
};

export function staggered(step = 0.08, delay = 0): Variants {
  return { hidden: {}, show: { transition: { staggerChildren: step, delayChildren: delay } } };
}
