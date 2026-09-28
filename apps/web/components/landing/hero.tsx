import { MessageCircle } from "lucide-react";
import { HeroVisual } from "./hero-visual";
import { Container, Cta, WalrusMark, displayClass } from "./ui";

const LINES = ["Every customer", "deserves to feel", "remembered."];

/** Delay helper for the CSS entrance (see .nia-in in globals.css). */
const enter = (delay: number, anim = "nia-fade-up", dur = 0.9) => ({ ["--nia-anim" as string]: anim, ["--nia-delay" as string]: `${delay}s`, ["--nia-dur" as string]: `${dur}s` });

export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="relative isolate overflow-x-clip pt-28 pb-20 sm:pt-32 lg:flex lg:min-h-[100svh] lg:items-center lg:pt-24 lg:pb-16">
      {/* Quiet wash: aqua behind Nia, a breath of lavender and blush. Static. */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10"
        style={{
          background:
            "radial-gradient(40% 50% at 78% 45%, rgb(107 222 230 / 0.22), transparent 70%), radial-gradient(30% 35% at 8% 10%, rgb(206 147 227 / 0.12), transparent 70%), radial-gradient(25% 30% at 60% 100%, rgb(245 179 220 / 0.12), transparent 70%)",
        }}
      />
      <Container className="grid items-center gap-14 lg:grid-cols-[1.1fr_0.9fr] lg:gap-8">
        <div className="relative z-10">
          <p className="nia-in inline-flex items-center gap-2 rounded-full border border-ink-900/[0.08] bg-white/80 px-3.5 py-1.5 text-[13px] font-semibold text-ink-900/80" style={enter(0)}>
            <span className="size-2 rounded-full bg-aqua-400" aria-hidden="true" />
            AI shopping &amp; service assistant
          </p>

          <h1 id="hero-title" className={displayClass("xl") + " mt-6 text-foreground"}>
            {LINES.map((line, i) => (
              <span key={line} className={i === LINES.length - 1 ? "-mb-[0.2em] block overflow-hidden pb-[0.2em]" : "-mb-[0.1em] block overflow-hidden pb-[0.1em]"}>
                <span className="nia-in block" style={enter(0.08 + i * 0.09, "nia-rise", 1)}>
                  {i === LINES.length - 1 ? (
                    <span className="relative inline-block">
                      {line}
                      <svg aria-hidden="true" viewBox="0 0 300 14" preserveAspectRatio="none" className="absolute -bottom-[0.1em] left-[1%] h-[0.2em] w-[92%] overflow-visible">
                        <defs>
                          <linearGradient id="hero-underline" x1="0" x2="1">
                            <stop offset="0" stopColor="#51e0f6" />
                            <stop offset="0.6" stopColor="#9fb8fc" />
                            <stop offset="1" stopColor="#ce93e3" />
                          </linearGradient>
                        </defs>
                        <path d="M3 10 C 70 3, 170 2, 297 7" pathLength={1} fill="none" stroke="url(#hero-underline)" strokeWidth="5" strokeLinecap="round" className="nia-draw" style={{ ["--nia-delay" as string]: "1.05s" }} />
                      </svg>
                    </span>
                  ) : (
                    line
                  )}
                  {i < LINES.length - 1 ? " " : null}
                </span>
              </span>
            ))}
          </h1>

          <p className="nia-in mt-7 max-w-[34rem] text-lg leading-relaxed text-muted-foreground text-pretty sm:text-xl" style={enter(0.4)}>
            Nia is an AI shopping and service assistant that remembers what your customers like, what they ordered, and how they prefer to buy — across conversations.
          </p>

          <div className="nia-in mt-9 flex flex-wrap items-center gap-3" style={enter(0.5)}>
            <Cta href="/try" arrow>
              Try Nia
            </Cta>
            <Cta href="#memory" variant="secondary">
              See how memory works
            </Cta>
          </div>

          <ul className="nia-in mt-10 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground" style={enter(0.6)}>
            <li className="inline-flex items-center gap-2">
              <MessageCircle className="size-4 text-ink-900/50" aria-hidden="true" /> Web chat and Telegram
            </li>
            <li className="inline-flex items-center gap-2">
              <WalrusMark className="size-4 text-memory" /> Memory on Walrus Mainnet
            </li>
          </ul>
        </div>

        <HeroVisual />
      </Container>
    </section>
  );
}
