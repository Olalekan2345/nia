import { MaskLines, Reveal } from "./primitives";
import { Container, Cta, SceneArt, WalrusMark, displayClass } from "./ui";

export function FinalCTA() {
  return (
    <section aria-labelledby="cta-title" className="relative isolate overflow-hidden bg-paper py-28 sm:py-40">
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10"
        style={{ background: "radial-gradient(45% 40% at 50% 38%, rgb(107 222 230 / 0.28), transparent 70%), radial-gradient(30% 25% at 30% 70%, rgb(206 147 227 / 0.12), transparent 70%), radial-gradient(30% 25% at 72% 72%, rgb(245 179 220 / 0.12), transparent 70%)" }}
      />
      <Container className="flex flex-col items-center text-center">
        <Reveal className="relative w-[min(74vw,340px)]">
          <div aria-hidden="true" className="nia-breathe absolute -inset-[22%] rounded-full" style={{ background: "radial-gradient(closest-side, rgb(81 224 246 / 0.42), rgb(159 184 252 / 0.22) 55%, transparent)" }} />
          <div aria-hidden="true" className="absolute -inset-[5%] rounded-[52px] border border-dashed border-aqua-300/70" />
          <SceneArt scene="cta" sizes="340px" alt="Nia making a peace sign under a bright arch" className="relative rounded-[40px]" />
        </Reveal>
        <h2 id="cta-title" className={displayClass("xl") + " mt-12 text-foreground"}>
          <MaskLines lines={["Make every customer", "feel remembered."]} />
        </h2>
        <Reveal delay={0.2}>
          <p className="mx-auto mt-6 max-w-md text-lg text-muted-foreground">Give your business an AI assistant that knows your returning customers.</p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Cta href="/try" arrow>
              Try Nia
            </Cta>
            <Cta href="/signin?next=/onboarding" variant="secondary">
              Build with Nia
            </Cta>
          </div>
        </Reveal>
        <p className="mt-16 inline-flex items-center gap-2 rounded-full border border-memory/20 bg-white/80 px-4 py-2 text-sm font-semibold text-memory">
          <WalrusMark className="size-4" /> Built with Walrus Memory.
        </p>
      </Container>
    </section>
  );
}
