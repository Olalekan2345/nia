"use client";

import { useTransform, type MotionValue } from "motion/react";

/** Piecewise-linear map from input keyframes to output keyframes, clamped at both ends. */
export function mapRange(v: number, input: number[], output: number[]): number {
  if (v <= input[0]!) return output[0]!;
  for (let i = 1; i < input.length; i++) {
    if (v <= input[i]!) {
      const a = input[i - 1]!;
      const b = input[i]!;
      const t = b === a ? 1 : (v - a) / (b - a);
      return output[i - 1]! + (output[i]! - output[i - 1]!) * t;
    }
  }
  return output[output.length - 1]!;
}

/**
 * Scroll-linked value for a scene. A function transform keeps it on the main
 * thread: motion's hardware-accelerated scroll timelines map sticky-scene
 * offsets wrongly for opacity, so every scene value goes through here.
 */
export function useRange(progress: MotionValue<number>, input: number[], output: number[]): MotionValue<number> {
  return useTransform(progress, (v) => mapRange(v, input, output));
}
