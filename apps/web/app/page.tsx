import { BackToTop } from "@/components/landing/back-to-top";
import { BusinessTypes } from "@/components/landing/business-types";
import { CrossChannelFlow } from "@/components/landing/cross-channel-flow";
import { FinalCTA } from "@/components/landing/final-cta";
import { Hero } from "@/components/landing/hero";
import { HowItWorks } from "@/components/landing/how-it-works";
import { MemoryPassport } from "@/components/landing/memory-passport";
import { MemoryStory } from "@/components/landing/memory-story";
import { MerchantDashboardPreview } from "@/components/landing/merchant-dashboard-preview";
import { LandingMotion } from "@/components/landing/primitives";
import { Privacy } from "@/components/landing/privacy";
import { ProblemScene } from "@/components/landing/problem-scene";
import { SameAsLastTime } from "@/components/landing/same-as-last-time";
import { SiteFooter } from "@/components/landing/site-footer";
import { SiteHeader } from "@/components/landing/site-header";
import { TelegramDemo } from "@/components/landing/telegram-demo";
import { WalrusMemoryScene } from "@/components/landing/walrus-memory-scene";
import { botLink } from "@/lib/telegram";

/**
 * The landing page is a presentation layer: illustrative examples are labelled
 * as such, and the only live values are real links (the Telegram bot, the docs).
 */
export default function LandingPage() {
  const telegramUrl = botLink();
  return (
    <LandingMotion>
      <div className="nia-light nia-landing min-h-dvh overflow-x-clip bg-white text-foreground">
        <a href="#main" className="sr-only z-[60] rounded-full bg-ink-900 px-4 py-2 font-semibold text-white focus:not-sr-only focus:fixed focus:top-3 focus:left-3">
          Skip to content
        </a>
        <SiteHeader />
        <main id="main">
          <Hero />
          <ProblemScene />
          <MemoryStory />
          <SameAsLastTime />
          <CrossChannelFlow />
          <BusinessTypes />
          <MemoryPassport />
          <MerchantDashboardPreview />
          <WalrusMemoryScene />
          <TelegramDemo telegramUrl={telegramUrl} />
          <HowItWorks />
          <Privacy />
          <FinalCTA />
        </main>
        <SiteFooter telegramUrl={telegramUrl} />
        <BackToTop targetId="hero-title" />
      </div>
    </LandingMotion>
  );
}
