"use client";

import { MaskLines, Reveal } from "./primitives";
import { TelegramOrbitExperience } from "./telegram-orbit-experience";
import { Container, Cta, SectionLabel, displayClass } from "./ui";

export function TelegramDemo({ telegramUrl }: { telegramUrl: string | null }) {
  return (
    <section id="telegram" aria-labelledby="telegram-title" className="relative scroll-mt-10 overflow-x-clip bg-white pt-28 pb-16 sm:pt-36 sm:pb-24">
      <Container className="flex flex-col items-center text-center">
        <SectionLabel index="09">Telegram</SectionLabel>
        <h2 id="telegram-title" className={displayClass("md") + " mt-6 text-foreground"}>
          <MaskLines lines={["Your assistant goes", "where your customers", "already are."]} />
        </h2>
        <Reveal delay={0.15}>
          <p className="mx-auto mt-6 max-w-md text-lg leading-relaxed text-muted-foreground">
            Customers can chat with Nia in Telegram and carry on where they left off on the web — the same memory, cart and conversation.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            {telegramUrl ? (
              <Cta href={telegramUrl} external className="bg-[#2AABEE] text-white shadow-[0_12px_30px_-12px_rgb(42_171_238/0.9)] hover:bg-[#229ed9]">
                Open Nia on Telegram
              </Cta>
            ) : null}
            <Cta href="/market/signin" variant="secondary">
              Sign in with Telegram
            </Cta>
          </div>
        </Reveal>
      </Container>
      <Container className="mt-6 sm:mt-10">
        <TelegramOrbitExperience />
      </Container>
    </section>
  );
}
