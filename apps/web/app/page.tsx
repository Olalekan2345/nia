import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Brain,
  CalendarClock,
  Cake,
  Check,
  Eye,
  EyeOff,
  Fingerprint,
  Layers,
  Lock,
  MessageCircle,
  Package,
  PenLine,
  Repeat,
  Ruler,
  Scissors,
  Send,
  ShieldCheck,
  Shirt,
  Smartphone,
  Sparkles,
  Store,
  Truck,
  Wrench,
} from "lucide-react";
import { Mascot, buttonClasses, cn } from "@nia/ui";
import { MascotArt, NiaLogo, WalrusChip } from "@/components/brand";

export default function LandingPage() {
  return (
    <div className="min-h-dvh">
      <SiteHeader />
      <main>
        <Hero />
        <Problem />
        <ProductsAndServices />
        <MemoryThatHelps />
        <Channels />
        <HowItWorks />
        <BuiltOnWalrus />
        <PrivacyAndControl />
        <DashboardPreview />
        <FinalCta />
      </main>
      <SiteFooter />
    </div>
  );
}

function Container({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-6xl px-4 sm:px-6 lg:px-8", className)}>{children}</div>;
}

function SectionHeading({ eyebrow, title, body, center = false }: { eyebrow: string; title: string; body?: string; center?: boolean }) {
  return (
    <div className={cn("max-w-2xl", center && "mx-auto text-center")}>
      <p className="text-sm font-semibold text-accent-strong">{eyebrow}</p>
      <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">{title}</h2>
      {body ? <p className="mt-4 text-lg leading-relaxed text-muted-foreground text-pretty">{body}</p> : null}
    </div>
  );
}

function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/85 backdrop-blur-md">
      <Container className="flex h-16 items-center justify-between gap-4">
        <NiaLogo />
        <nav aria-label="Primary" className="hidden items-center gap-1 md:flex">
          {[
            ["Walrus Market", "/market"],
            ["How it works", "#how"],
            ["Walrus Memory", "#walrus"],
            ["Privacy", "#privacy"],
            ["For businesses", "#business"],
          ].map(([label, href]) => (
            <a key={href} href={href} className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors duration-100 hover:text-foreground">
              {label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/signin" className={buttonClasses({ variant: "ghost", size: "sm", className: "hidden sm:inline-flex" })}>
            Sign in
          </Link>
          <Link href="/try" className={buttonClasses({ variant: "primary", size: "sm" })}>
            Try Nia
          </Link>
        </div>
      </Container>
    </header>
  );
}

function Hero() {
  return (
    <section className="nia-wash relative overflow-hidden">
      <Container className="grid items-center gap-12 py-16 sm:py-20 lg:grid-cols-[1.05fr_1fr] lg:py-24">
        <div>
          <WalrusChip label="Customer memory on Walrus" />
          <h1 className="mt-5 text-4xl font-extrabold tracking-tight text-balance sm:text-5xl lg:text-6xl">
            Every customer deserves to feel remembered.
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted-foreground text-pretty">
            Nia is an AI shopping and service assistant that remembers what your customers like, what they ordered, and how they prefer to buy — across conversations, on the web and in Telegram.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/try" className={buttonClasses({ size: "lg" })}>
              Try Nia <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <Link href="/market" className={buttonClasses({ variant: "secondary", size: "lg" })}>
              Browse Walrus Market
            </Link>
          </div>
          <ul className="mt-8 grid max-w-lg gap-2.5 text-sm text-muted-foreground sm:grid-cols-2">
            {["Products, services and bookings", "Understands “same as last time”", "Customers can see and correct memory", "Web + Telegram, one memory"].map((t) => (
              <li key={t} className="flex items-center gap-2">
                <Check className="size-4 shrink-0 text-accent-strong" aria-hidden="true" />
                {t}
              </li>
            ))}
          </ul>
        </div>
        <HeroPhone />
      </Container>
    </section>
  );
}

function HeroPhone() {
  return (
    <figure className="relative mx-auto w-full max-w-[380px]" aria-label="Example conversation with Nia">
      <div className="pointer-events-none absolute -top-24 -right-32 hidden rotate-6 xl:block 2xl:-right-44">
        <MascotArt size={240} priority className="size-[200px] 2xl:size-[240px]" />
      </div>
      <div className="absolute -top-10 -left-8 z-20 hidden sm:block xl:hidden">
        <Mascot size={96} state="greeting" decorative />
      </div>
      <div className="relative z-10 rounded-[2.25rem] border border-border bg-surface p-2 shadow-float">
        <div className="overflow-hidden rounded-[1.8rem] border border-border bg-background">
          <div className="flex items-center gap-3 border-b border-border bg-surface px-4 py-3">
            <span className="grid size-9 place-items-center rounded-xl bg-accent text-sm font-bold text-accent-foreground" aria-hidden="true">
              AL
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold">Adire Lane</p>
              <p className="text-xs text-muted-foreground">Nia · usually replies instantly</p>
            </div>
          </div>
          <div className="space-y-3 px-4 py-4 text-[14px] leading-relaxed">
            <p className="ml-auto max-w-[82%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2.5 text-primary-foreground">
              I need the same 6 yards I bought last time, but blue.
            </p>
            <div className="max-w-[90%] space-y-2">
              <p className="rounded-2xl rounded-bl-md border border-border bg-surface px-3.5 py-2.5">
                Your last fabric order was <strong>6 yards of emerald Ankara</strong>. I can keep the same quantity and quality, but switch to blue. Delivery to Lekki again?
              </p>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-memory-soft px-2.5 py-1 text-xs font-semibold text-memory">
                <Brain className="size-3.5" aria-hidden="true" /> 2 memories used
              </span>
            </div>
            <div className="rounded-2xl border border-border bg-surface p-3">
              <div className="flex gap-3">
                <div className="size-16 shrink-0 rounded-xl" style={{ background: "repeating-linear-gradient(135deg,#2F54EB 0 8px,#1E3AAE 8px 14px,#6F8BFF 14px 18px)" }} aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">Classic Ankara · Cobalt Blue</p>
                  <p className="text-sm text-muted-foreground">₦7,500 / yard · In stock</p>
                  <div className="mt-2 flex gap-2">
                    <span className="rounded-lg bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground">Add 6 yards</span>
                    <span className="rounded-lg border border-border px-2.5 py-1 text-xs font-semibold">Alternatives</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="border-t border-border bg-surface px-3 py-3">
            <div className="flex items-center gap-2 rounded-2xl border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
              Message Nia…
              <Send className="ml-auto size-4" aria-hidden="true" />
            </div>
          </div>
        </div>
      </div>
      <figcaption className="mt-3 text-center text-xs text-muted-foreground">Example conversation · demo store</figcaption>
    </figure>
  );
}

function Problem() {
  const items = [
    { icon: EyeOff, title: "Chatbots forget", body: "Close the tab and the “assistant” forgets your size, your address and what went wrong last time." },
    { icon: Repeat, title: "Customers repeat themselves", body: "Returning buyers re-explain the same preferences every visit — on every channel." },
    { icon: Layers, title: "Context lives in people’s heads", body: "Great shop staff remember regulars. That knowledge leaves when they do, and never reaches chat." },
  ];
  return (
    <section className="py-20 sm:py-24">
      <Container>
        <SectionHeading eyebrow="The problem" title="Returning customers are treated like strangers." body="Most commerce assistants can search a catalog. Very few remember the relationship — which is what makes people come back." />
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {items.map(({ icon: Icon, title, body }) => (
            <div key={title} className="rounded-2xl border border-border bg-surface p-6">
              <span className="grid size-10 place-items-center rounded-xl bg-surface-2 text-foreground">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <h3 className="mt-4 font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

function ProductsAndServices() {
  const types = [
    { icon: Shirt, name: "Fashion & fabric", memory: "Wears Medium · prefers darker colours" },
    { icon: Scissors, name: "Salons & barbers", memory: "Books silk press, Saturday mornings" },
    { icon: Cake, name: "Bakeries", memory: "Buying for mum’s 60th · no nuts" },
    { icon: Smartphone, name: "Electronics", memory: "iPhone 13 · prefers USB-C accessories" },
    { icon: Wrench, name: "Repair services", memory: "Last repair: cracked screen, 3 weeks ago" },
    { icon: Package, name: "Homeware", memory: "Oak finishes · delivery after 5pm" },
  ];
  return (
    <section id="business" className="border-y border-border bg-surface py-20 sm:py-24">
      <Container>
        <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <SectionHeading
            eyebrow="Works for products and services"
            title="One assistant for how your business actually sells."
            body="Products with sizes and colours, services with durations and deposits, appointments, custom orders and packages. Merchants configure the catalog; Nia converses accordingly — and never recommends something you don’t sell."
          />
          <ul className="grid gap-3 sm:grid-cols-2">
            {types.map(({ icon: Icon, name, memory }) => (
              <li key={name} className="flex gap-3 rounded-2xl border border-border bg-background p-4">
                <Icon className="mt-0.5 size-5 shrink-0 text-accent-strong" aria-hidden="true" />
                <div>
                  <p className="font-semibold">{name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    <span className="sr-only">Example memory: </span>“{memory}”
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  );
}

function MemoryThatHelps() {
  const rows = [
    { icon: Ruler, t: "Sizes & variants", d: "“My size is XL now, not L.” Nia uses XL going forward and keeps L for reading old orders." },
    { icon: Truck, t: "Delivery habits", d: "“Send this one to Yaba” changes this order only. “I’ve moved to Yaba” changes the default." },
    { icon: Repeat, t: "Same as last time", d: "Repeat intent is first-class — and when history is ambiguous, Nia asks instead of guessing." },
    { icon: Sparkles, t: "Occasions & people", d: "Remembers the story behind a purchase, like fabric for a mother’s 60th birthday." },
    { icon: ShieldCheck, t: "Past problems", d: "A late delivery last time means Nia confirms timing before finalising this one." },
    { icon: PenLine, t: "Honest confidence", d: "“You’ve chosen blue twice” — never “you love blue” from a single purchase." },
  ];
  return (
    <section className="py-20 sm:py-24">
      <Container>
        <SectionHeading eyebrow="Memory that improves service" title="Remember what helps. Forget what doesn’t." body="Nia scores every candidate memory for importance, confidence and durability. The application — not the model — decides what becomes durable." center />
        <div className="mt-12 grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map(({ icon: Icon, t, d }) => (
            <div key={t}>
              <Icon className="size-5 text-accent-strong" aria-hidden="true" />
              <h3 className="mt-3 font-semibold">{t}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

function Channels() {
  return (
    <section className="bg-ink-950 py-20 text-white sm:py-24">
      <Container className="grid gap-12 lg:grid-cols-2 lg:items-center">
        <div>
          <p className="text-sm font-semibold text-aqua-300">Web + Telegram</p>
          <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">One customer. Every channel. One memory.</h2>
          <p className="mt-4 text-lg leading-relaxed text-white/70">
            A preference shared in web chat is there when the same customer messages the shop’s Telegram bot. Identities are linked deliberately with a one-time link — never guessed from display names.
          </p>
          <ol className="mt-8 space-y-4">
            {[
              "Customer taps Connect Telegram in their profile",
              "Nia creates a short-lived, single-use link",
              "Telegram opens the bot and verifies the link",
              "Both channels now resolve to one customer and one memory",
            ].map((s, i) => (
              <li key={s} className="flex items-start gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-white/10 text-sm font-bold tabular">{i + 1}</span>
                <span className="pt-0.5 text-white/85">{s}</span>
              </li>
            ))}
          </ol>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
            <p className="flex items-center gap-2 text-sm font-semibold text-white/70">
              <Store className="size-4" aria-hidden="true" /> Web chat · Monday
            </p>
            <p className="mt-4 rounded-2xl rounded-br-md bg-white px-3.5 py-2.5 text-sm text-ink-900">I normally buy Medium and I like darker colours.</p>
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-aqua-400/15 px-2.5 py-1 text-xs font-semibold text-aqua-300">
              <BadgeCheck className="size-3.5" aria-hidden="true" /> 2 things remembered
            </p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 sm:mt-10">
            <p className="flex items-center gap-2 text-sm font-semibold text-white/70">
              <MessageCircle className="size-4" aria-hidden="true" /> Telegram · Friday
            </p>
            <p className="mt-4 rounded-2xl rounded-br-md bg-[#2AABEE] px-3.5 py-2.5 text-sm text-white">Can I get the same kind of thing as last time?</p>
            <p className="mt-3 rounded-2xl rounded-bl-md bg-white/10 px-3.5 py-2.5 text-sm text-white/90">Your previous order was a Medium black kaftan. Want something similar in a darker colour?</p>
          </div>
        </div>
      </Container>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { t: "Listen", d: "A separate, schema-validated extraction step proposes typed memory candidates after a conversation turn." },
    { t: "Decide", d: "Policy classifies each one: ignore, keep for this order only, ask the customer first, or remember durably. Sensitive data is always dropped." },
    { t: "Remember", d: "Approved memories are encrypted and stored with Walrus Memory. Nia waits for the relayer to confirm before saying “remembered”." },
    { t: "Recall", d: "Each new message triggers a targeted semantic recall. Only a few relevant memories reach the model — marked as data, never instructions." },
  ];
  return (
    <section id="how" className="py-20 sm:py-24">
      <Container className="grid gap-12 lg:grid-cols-[1fr_0.9fr] lg:items-start">
        <div>
          <SectionHeading eyebrow="How customer memory works" title="Durable memory with receipts — not a chat log." />
          <ol className="mt-10 space-y-6">
            {steps.map((s, i) => (
              <li key={s.t} className="grid grid-cols-[2.25rem_1fr] gap-4">
                <span className="grid size-9 place-items-center rounded-xl bg-accent-soft font-bold text-accent-strong tabular">{i + 1}</span>
                <div>
                  <h3 className="font-semibold">{s.t}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{s.d}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-5 lg:mt-20">
          <div className="flex items-start gap-4">
            <Mascot size={64} state="remembering" decorative />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-memory">Got it — I’ll remember that.</p>
              <p className="mt-1 text-lg font-bold">Preferred size: XL</p>
              <p className="text-sm text-muted-foreground">Saved securely with Walrus Memory</p>
            </div>
          </div>
          <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-xl bg-surface-2 p-4 text-sm">
            <dt className="text-muted-foreground">Network</dt>
            <dd className="font-medium">Mainnet</dd>
            <dt className="text-muted-foreground">Memory type</dt>
            <dd className="font-medium">Size preference · corrected by you</dd>
            <dt className="text-muted-foreground">Blob ID</dt>
            <dd className="truncate font-mono text-xs leading-5">shown once the relayer confirms</dd>
            <dt className="text-muted-foreground">Previous</dt>
            <dd className="font-medium">L (kept as history)</dd>
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">Receipt layout. Real receipts show the actual blob ID and timestamp returned by Walrus.</p>
        </div>
      </Container>
    </section>
  );
}

function BuiltOnWalrus() {
  const facts = [
    { icon: Lock, t: "Encrypted durable memory", d: "The Walrus Memory relayer embeds, SEAL-encrypts and stores each memory on Walrus. Recall is semantic, not keyword matching." },
    { icon: Fingerprint, t: "Isolated namespaces", d: "Every merchant and customer gets a server-derived namespace built from opaque ids — never emails or phone numbers." },
    { icon: Eye, t: "Visible, verifiable", d: "Receipts show real persistence state and blob IDs. Merchants get a memory explorer and health checks." },
    { icon: CalendarClock, t: "Operational truth stays in the database", d: "Prices, stock, orders and bookings live in PostgreSQL. Memory is never the only source for anything time-sensitive." },
  ];
  return (
    <section id="walrus" className="border-y border-border bg-surface py-20 sm:py-24">
      <Container>
        <SectionHeading
          eyebrow="Built on Walrus Memory"
          title="The memory layer is infrastructure — invisible until you want to inspect it."
          body="Nia feels like a normal, excellent commerce product. Under the hood, Walrus Memory is what gives it continuity across sessions and channels."
        />
        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          {facts.map(({ icon: Icon, t, d }) => (
            <div key={t} className="flex gap-4 rounded-2xl border border-border bg-background p-5">
              <Icon className="mt-0.5 size-5 shrink-0 text-accent-strong" aria-hidden="true" />
              <div>
                <h3 className="font-semibold">{t}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{d}</p>
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}

function PrivacyAndControl() {
  const items = [
    { label: "Size: Medium", tag: "Confirmed by you", tone: "bg-success-soft text-success" },
    { label: "Usual delivery: Yaba (was Lekki)", tag: "Corrected by you", tone: "bg-info-soft text-info" },
    { label: "Order #1042: 6 yards Emerald Ankara", tag: "Observed from orders", tone: "bg-surface-2 text-muted-foreground" },
    { label: "Likes earth tones", tag: "Likely preference", tone: "bg-warning-soft text-warning" },
  ];
  return (
    <section id="privacy" className="py-20 sm:py-24">
      <Container className="grid gap-12 lg:grid-cols-2 lg:items-center">
        <div>
          <SectionHeading
            eyebrow="Privacy and control"
            title="Known, not watched."
            body="Every customer has a Memory Passport: what Nia remembers, why it believes it, and buttons to correct or forget. Passwords, card numbers, codes and keys are filtered out before anything is stored."
          />
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            Walrus stores data durably, so “forget” is honest: Nia immediately stops using a forgotten memory in every future answer, and the encrypted copy expires with its storage period.
          </p>
        </div>
        <div className="rounded-2xl border border-border bg-surface p-5">
          <div className="flex items-center justify-between">
            <p className="font-semibold">What Nia remembers about you</p>
            <WalrusChip />
          </div>
          <ul className="mt-4 divide-y divide-border">
            {items.map((i) => (
              <li key={i.label} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{i.label}</p>
                  <span className={cn("mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold", i.tone)}>{i.tag}</span>
                </div>
                <span className="shrink-0 text-xs font-semibold text-muted-foreground">Correct · Forget</span>
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </section>
  );
}

function DashboardPreview() {
  const bars = [32, 44, 38, 56, 49, 62, 58, 71, 66, 80, 74, 88];
  return (
    <section className="border-t border-border bg-surface py-20 sm:py-24">
      <Container>
        <SectionHeading eyebrow="Merchant dashboard" title="Run the shop. See what Nia remembers." body="Catalog, services, orders, bookings, conversations and a Walrus memory explorer — in a calm, finance-grade workspace. Every metric comes from real activity." center />
        <div className="mx-auto mt-12 max-w-5xl overflow-hidden rounded-2xl border border-border bg-background shadow-float">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <span className="size-2.5 rounded-full bg-border" />
            <span className="size-2.5 rounded-full bg-border" />
            <span className="size-2.5 rounded-full bg-border" />
            <span className="ml-3 text-xs text-muted-foreground">Sample data · dashboard preview</span>
          </div>
          <div className="grid gap-4 p-4 sm:p-6 md:grid-cols-[180px_1fr]">
            <ul className="hidden space-y-1 text-sm md:block">
              {["Overview", "Conversations", "Customers", "Catalog", "Orders", "Bookings", "Memory", "Settings"].map((n, i) => (
                <li key={n} className={cn("rounded-lg px-3 py-2", i === 0 ? "bg-surface font-semibold" : "text-muted-foreground")}>
                  {n}
                </li>
              ))}
            </ul>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                {["Revenue", "Orders", "Repeat customers", "Memory-powered reorders"].map((k) => (
                  <div key={k} className="rounded-xl border border-border bg-surface p-3">
                    <p className="text-xs text-muted-foreground">{k}</p>
                    <div className="mt-2 h-5 w-20 rounded-md bg-surface-2" aria-hidden="true" />
                  </div>
                ))}
              </div>
              <div className="rounded-xl border border-border bg-surface p-4">
                <p className="text-xs font-semibold text-muted-foreground">Orders over time</p>
                <div className="mt-4 flex h-32 items-end gap-2" aria-hidden="true">
                  {bars.map((h, i) => (
                    <div key={i} className="flex-1 rounded-t-md bg-periwinkle-500/80" style={{ height: `${h}%` }} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="py-20 sm:py-24">
      <Container>
        <div className="nia-wash flex flex-col items-center rounded-3xl border border-border px-6 py-14 text-center">
          <Mascot size={112} state="idle" decorative />
          <h2 className="mt-6 max-w-2xl text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">The shop assistant who remembers your customers.</h2>
          <p className="mt-3 max-w-xl text-muted-foreground">Try a demo shop, or set up your own business in a few minutes.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link href="/try" className={buttonClasses({ size: "lg" })}>
              Try Nia <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
            <Link href="/signin?next=/onboarding" className={buttonClasses({ variant: "secondary", size: "lg" })}>
              Set up my business
            </Link>
          </div>
        </div>
      </Container>
    </section>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t border-border py-10">
      <Container className="flex flex-col items-center justify-between gap-4 text-sm text-muted-foreground sm:flex-row">
        <NiaLogo size={26} />
        <p>Demo stores are fictional. Memory powered by Walrus Memory.</p>
        <nav aria-label="Footer" className="flex gap-4">
          <Link href="/try" className="hover:text-foreground">
            Demo shops
          </Link>
          <Link href="/signin" className="hover:text-foreground">
            Sign in
          </Link>
          <a href="/api/health" className="hover:text-foreground">
            Status
          </a>
        </nav>
      </Container>
    </footer>
  );
}
