"use client";

import Image from "next/image";
import { m } from "motion/react";
import { CheckCheck, ChevronLeft, Mic, MoreVertical, Paperclip } from "lucide-react";
import { EASE_OUT, VIEW_ONCE } from "./motion";
import { MaskLines, Reveal } from "./primitives";
import { Container, Cta, ExampleTag, SceneArt, SectionLabel, displayClass } from "./ui";

function Bubble({ delay, children, className }: { delay: number; children: React.ReactNode; className: string }) {
  return (
    <m.div initial={{ opacity: 0, y: 14, scale: 0.97 }} whileInView={{ opacity: 1, y: 0, scale: 1 }} viewport={VIEW_ONCE} transition={{ duration: 0.55, ease: EASE_OUT, delay }} className={className}>
      {children}
    </m.div>
  );
}

function Phone() {
  return (
    <div className="relative z-10 mx-auto w-full max-w-[340px] lg:mr-0 lg:ml-auto">
      <div aria-hidden="true" className="absolute -inset-[18%] rounded-full" style={{ background: "radial-gradient(closest-side, rgb(42 171 238 / 0.2), rgb(107 222 230 / 0.14) 50%, transparent)" }} />
      <div className="relative rounded-[48px] bg-ink-950 p-2.5 shadow-lift">
        <div className="overflow-hidden rounded-[40px] bg-white">
          <div className="flex items-center justify-between px-7 pt-3 pb-1 text-[12px] font-semibold text-ink-900" aria-hidden="true">
            <span>9:41</span>
            <span className="h-5 w-20 rounded-full bg-ink-950" />
            <span className="flex gap-1">
              <span className="h-2.5 w-4 rounded-sm bg-ink-900/80" />
            </span>
          </div>
          <div className="flex items-center gap-3 border-b border-ink-900/[0.06] px-3 py-2.5">
            <ChevronLeft className="size-5 text-[#2AABEE]" aria-hidden="true" />
            <Image src="/brand/nia-telegram-avatar.jpg" alt="" width={40} height={40} className="size-10 rounded-full" />
            <div className="min-w-0 flex-1 leading-tight">
              <p className="font-bold text-ink-900">Nia</p>
              <p className="text-xs text-muted-foreground">bot</p>
            </div>
            <MoreVertical className="size-5 text-ink-900/50" aria-hidden="true" />
          </div>
          <div className="space-y-2.5 px-3 pt-4 pb-5 text-[15px] leading-snug" style={{ background: "linear-gradient(170deg, #dcebf7 0%, #e8e6f7 55%, #f3e9f5 100%)" }}>
            <p className="mx-auto w-fit rounded-full bg-ink-900/15 px-2.5 py-0.5 text-xs font-semibold text-white">Today</p>
            <Bubble delay={0.3} className="ml-auto w-fit max-w-[80%] rounded-[18px] rounded-br-[6px] bg-[#e1f7cf] px-3.5 py-2 text-ink-900 shadow-[0_1px_1px_rgb(0_0_0/0.06)]">
              Can I get the usual?
              <span className="ml-2 inline-flex translate-y-0.5 items-center gap-0.5 text-[11px] text-[#4fae4e]">
                9:41 <CheckCheck className="size-3.5" aria-label="read" />
              </span>
            </Bubble>
            <Bubble delay={1.1} className="w-fit max-w-[88%] rounded-[18px] rounded-bl-[6px] bg-white px-3.5 py-2 text-ink-900 shadow-[0_1px_1px_rgb(0_0_0/0.06)]">
              Your last order was the <strong>Medium</strong> version. Your current delivery area is <strong>Yaba</strong>. Want me to repeat it?
              <span className="mt-1.5 block text-[12px] text-muted-foreground italic">🧠 Remembered from a previous visit</span>
            </Bubble>
            <Bubble delay={1.5} className="grid grid-cols-2 gap-1.5">
              {["Repeat order", "Change size"].map((b) => (
                <span key={b} className="rounded-xl bg-[#4f7396] px-3 py-2 text-center text-sm font-semibold text-white">
                  {b}
                </span>
              ))}
            </Bubble>
          </div>
          <div className="flex items-center gap-2.5 border-t border-ink-900/[0.06] px-3 py-3 text-muted-foreground" aria-hidden="true">
            <Paperclip className="size-5" />
            <span className="flex-1 rounded-full bg-surface-2 px-3.5 py-2 text-sm">Message</span>
            <Mic className="size-5" />
          </div>
        </div>
      </div>
      <ExampleTag className="absolute -top-3 right-6 bg-white shadow-soft">Example</ExampleTag>
    </div>
  );
}

export function TelegramDemo({ telegramUrl }: { telegramUrl: string | null }) {
  return (
    <section id="telegram" aria-labelledby="telegram-title" className="relative scroll-mt-10 overflow-x-clip bg-white py-28 sm:py-36">
      <Container className="grid items-center gap-16 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <SectionLabel index="09">Telegram</SectionLabel>
          <h2 id="telegram-title" className={displayClass("md") + " mt-6 text-foreground"}>
            <MaskLines lines={["Your assistant goes", "where your customers", "already are."]} />
          </h2>
          <Reveal delay={0.15}>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-muted-foreground">
              Customers can chat with Nia in Telegram and carry on where they left off on the web — the same memory, cart and conversation.
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              {telegramUrl ? (
                <Cta href={telegramUrl} external className="bg-[#2AABEE] text-white shadow-[0_12px_30px_-12px_rgb(42_171_238/0.9)] hover:bg-[#229ed9]">
                  Open Nia on Telegram
                </Cta>
              ) : null}
              <Cta href="/signin" variant="secondary">
                Sign in with Telegram
              </Cta>
            </div>
          </Reveal>
        </div>
        <div className="relative">
          {/* Nia peeks out from behind the phone on wide screens. */}
          <m.div
            initial={{ opacity: 0, x: 40, rotate: -2 }}
            whileInView={{ opacity: 1, x: 0, rotate: -5 }}
            viewport={VIEW_ONCE}
            transition={{ duration: 1, ease: EASE_OUT, delay: 0.2 }}
            className="absolute top-16 -left-[12%] hidden w-[62%] lg:block"
          >
            <SceneArt scene="telegram" sizes="300px" alt="Nia winking and holding a phone" className="rounded-[32px]" />
          </m.div>
          <Phone />
        </div>
      </Container>
    </section>
  );
}
