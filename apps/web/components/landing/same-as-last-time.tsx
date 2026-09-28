"use client";

import { m } from "motion/react";
import { Bot, RotateCcw } from "lucide-react";
import { Mascot } from "@nia/ui";
import { EASE_OUT, VIEW_ONCE } from "./motion";
import { MaskLines, Reveal } from "./primitives";
import { Container, ExampleTag, SectionLabel, WalrusMark, displayClass } from "./ui";

function UserBubble({ children }: { children: React.ReactNode }) {
  return <p className="ml-auto w-fit max-w-[80%] rounded-[20px] rounded-br-md bg-ink-900 px-4 py-2.5 text-[15px] text-white">{children}</p>;
}

export function SameAsLastTime() {
  return (
    <section aria-labelledby="same-title" className="relative overflow-x-clip bg-paper py-28 sm:py-36">
      <div aria-hidden="true" className="nia-dots absolute inset-x-0 top-0 h-72 [mask-image:linear-gradient(to_bottom,black,transparent)]" />
      <Container className="relative">
        <div className="flex flex-col items-center text-center">
          <SectionLabel index="03">Repeat orders</SectionLabel>
          <h2 id="same-title" className={displayClass("xl") + " mt-8 text-foreground"}>
            <MaskLines lines={["“Same as", "last time.”"]} />
          </h2>
          <Reveal delay={0.2}>
            <p className="mt-6 max-w-md text-lg text-muted-foreground">The same four words. Two very different answers.</p>
          </Reveal>
        </div>

        <div className="mx-auto mt-16 grid max-w-5xl gap-5 lg:mt-20 lg:grid-cols-2 lg:gap-6">
          {/* Without memory: deliberately quiet and grey. */}
          <m.article
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={VIEW_ONCE}
            transition={{ duration: 0.8, ease: EASE_OUT }}
            className="rounded-[32px] border border-ink-900/[0.07] bg-surface-2/60 p-6 sm:p-8"
          >
            <header className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-muted-foreground">Without memory</h3>
              <ExampleTag className="bg-white" />
            </header>
            <div className="mt-8 space-y-3">
              <UserBubble>Same as last time.</UserBubble>
              <div className="flex items-end gap-2.5">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white text-ink-900/40" aria-hidden="true">
                  <Bot className="size-4" />
                </span>
                <p className="w-fit rounded-[20px] rounded-bl-md bg-white px-4 py-2.5 text-[15px] text-ink-900/70">Sorry, can you remind me what you ordered?</p>
              </div>
            </div>
            <p className="mt-10 flex items-center gap-2 text-sm text-muted-foreground">
              <RotateCcw className="size-4" aria-hidden="true" /> Starts from zero, every visit.
            </p>
          </m.article>

          {/* With Nia: the answer arrives, then a single memory pulse. */}
          <m.article
            initial={{ opacity: 0, x: 60 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={VIEW_ONCE}
            transition={{ duration: 0.9, ease: EASE_OUT, delay: 0.35 }}
            className="nia-holo-border relative rounded-[32px] p-6 shadow-lift sm:p-8"
          >
            <header className="flex items-center justify-between">
              <h3 className="inline-flex items-center gap-2 text-sm font-semibold text-ink-900">
                With Nia <span className="text-muted-foreground">+</span> <span className="inline-flex items-center gap-1 text-memory"><WalrusMark /> Walrus Memory</span>
              </h3>
              <ExampleTag />
            </header>
            <div className="mt-8 space-y-3">
              <UserBubble>Same as last time.</UserBubble>
              <m.div
                className="flex items-start gap-2.5"
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={VIEW_ONCE}
                transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.95 }}
              >
                <Mascot size={32} state="idle" decorative />
                <div className="min-w-0 space-y-2">
                  <p className="w-fit rounded-[20px] rounded-bl-md bg-surface-2 px-4 py-2.5 text-[15px] text-ink-900">
                    Your last order was the <strong>Medium black kaftan</strong>, delivered to Yaba. Want the same again?
                  </p>
                  <div className="flex items-center gap-3 rounded-2xl border border-ink-900/[0.07] bg-white p-2.5 pr-3">
                    <span className="size-11 shrink-0 rounded-xl bg-ink-950" style={{ backgroundImage: "linear-gradient(135deg, #1b1a4b, #0f0e26 60%, #2a2670)" }} aria-hidden="true" />
                    <span className="min-w-0 flex-1 text-sm leading-tight">
                      <span className="block font-bold text-ink-900">Midnight Linen Kaftan</span>
                      <span className="text-muted-foreground">Medium · Black · to Yaba</span>
                    </span>
                    <span className="rounded-full bg-ink-900 px-3 py-1.5 text-xs font-semibold text-white">Repeat</span>
                  </div>
                </div>
              </m.div>
            </div>
            <m.p
              className="relative mt-8 inline-flex items-center gap-2 rounded-full bg-memory-soft px-3 py-1.5 text-xs font-semibold text-memory"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={VIEW_ONCE}
              transition={{ duration: 0.5, delay: 1.3 }}
            >
              <span className="relative size-3.5" aria-hidden="true">
                <span className="nia-orb absolute inset-0" />
                <m.span
                  className="absolute inset-0 rounded-full border-2 border-aqua-400"
                  initial={{ opacity: 0, scale: 1 }}
                  whileInView={{ opacity: [0, 0.8, 0], scale: [1, 1, 3.2] }}
                  viewport={VIEW_ONCE}
                  transition={{ duration: 1.3, delay: 1.45, ease: "easeOut" }}
                />
              </span>
              Two memories recalled: last order, delivery area
            </m.p>
          </m.article>
        </div>
      </Container>
    </section>
  );
}
