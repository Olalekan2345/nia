"use client";

import { BackToTop } from "@/components/landing/back-to-top";
import { LandingMotion } from "@/components/landing/primitives";
import { useCompare } from "./compare-store";

/** The landing page's back-to-top Nia, for Walrus Market: sits above the compare tray while it's open. */
export function MarketBackToTop() {
  const compare = useCompare();
  return (
    <LandingMotion>
      <BackToTop lift={compare.ids.length > 0} />
    </LandingMotion>
  );
}
