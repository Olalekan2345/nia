import { Eye, Fingerprint, PauseCircle, PenLine, ShieldCheck } from "lucide-react";
import { MaskLines, RevealGroup, RevealItem } from "./primitives";
import { Container, SectionLabel, displayClass } from "./ui";

const ITEMS = [
  { icon: Eye, title: "See what Nia remembers", body: "Every customer has a Memory Passport." },
  { icon: PenLine, title: "Correct a memory", body: "The new value is used; the old one is kept as history." },
  { icon: PauseCircle, title: "Pause memory", body: "Turn it off and Nia stops using and saving memories." },
  { icon: Fingerprint, title: "Private customer isolation", body: "Each customer’s memory lives in its own space." },
  { icon: ShieldCheck, title: "No passwords or card details", body: "Codes, card numbers and keys are filtered out first." },
] as const;

export function Privacy() {
  return (
    <section id="privacy" aria-labelledby="privacy-title" className="relative scroll-mt-10 bg-white py-28 sm:py-36">
      <Container>
        <div className="grid gap-10 lg:grid-cols-[1.4fr_1fr] lg:items-end">
          <div>
            <SectionLabel index="11">Privacy</SectionLabel>
            <h2 id="privacy-title" className={displayClass("lg") + " mt-6 text-foreground"}>
              <MaskLines lines={["Helpful memory.", <span key="c" className="text-memory">Customer-controlled.</span>]} />
            </h2>
          </div>
          <p className="max-w-md text-lg leading-relaxed text-muted-foreground lg:justify-self-end lg:pb-3">
            When someone asks Nia to forget something, Nia stops using it straight away. Walrus keeps the encrypted copy until its storage period ends — we say so plainly.
          </p>
        </div>
        <RevealGroup as="ul" className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-5" step={0.07}>
          {ITEMS.map(({ icon: Icon, title, body }, i) => (
            <RevealItem as="li" key={title} className={i === 0 ? "rounded-[26px] bg-ink-950 p-6 text-white" : "rounded-[26px] border border-ink-900/[0.07] bg-paper p-6"}>
              <Icon className={i === 0 ? "size-6 text-aqua-300" : "size-6 text-ink-900"} aria-hidden="true" />
              <h3 className="mt-8 text-lg leading-snug font-extrabold tracking-tight text-balance">{title}</h3>
              <p className={i === 0 ? "mt-2 text-sm text-white/70" : "mt-2 text-sm text-muted-foreground"}>{body}</p>
            </RevealItem>
          ))}
        </RevealGroup>
      </Container>
    </section>
  );
}
