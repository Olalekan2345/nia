"use client";

/**
 * Telegram orbit: the phone is the anchor, Telegram is the destination.
 * Product and service cards (commerce) and memory chips (customer context)
 * travel around it on elliptical orbits in real CSS 3D, so they genuinely
 * pass behind and in front of the phone. A memory orb carries what the
 * customer said on the web into the Telegram conversation.
 *
 * One clock drives everything and only ticks while the scene is near the
 * viewport. Reduced motion shows the same composition, still.
 */
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { animate, m, useInView, useMotionValue, useSpring, useTransform, type MotionValue } from "motion/react";
import { CheckCheck, ChevronLeft, Globe, Mic, MoreVertical, Paperclip, Scissors, Wrench } from "lucide-react";
import { Mascot, cn } from "@nia/ui";
import { EASE_OUT } from "./motion";
import { ExampleTag, WalrusMark } from "./ui";
import { usePrefersReducedMotion } from "./use-reduced-motion";

type Layout = "mobile" | "tablet" | "desktop";
const RANK: Record<Layout, number> = { mobile: 0, tablet: 1, desktop: 2 };

type RingName = "products" | "memory" | "orb";
interface Ring {
  rx: number; // horizontal radius
  rz: number; // depth radius
  y: number; // height of the ring's centre, relative to the phone's centre
  tilt: number; // how much lower the front of the ring sits than the back
  speed: number; // degrees per second (negative: the other way round)
  start: number; // angle of the first item, in degrees
}

/** `ring` overrides the default ring for that kind of item. */
type OrbitDatum = { id: string; from: Layout; ring?: RingName } & (
  | { kind: "product"; title: string; meta: string; image: string; ratio: number }
  | { kind: "service"; title: string; meta: string; icon: "salon" | "repair"; image?: string; ratio?: number }
  | { kind: "memory"; label: string }
  | { kind: "orb" }
);

/** What travels around the phone, and from which screen size it appears. */
const ORBIT: OrbitDatum[] = [
  { id: "salon", from: "tablet", kind: "service", title: "Silk press", meta: "Sat · 10:00", icon: "salon" },
  { id: "beauty", from: "tablet", kind: "product", title: "Glow lip set", meta: "Beauty · warm mocha", image: "/landing/orbit-beauty.webp", ratio: 320 / 267 },
  { id: "repair", from: "desktop", kind: "service", title: "Headphone repair", meta: "Booked · Thu 14:00", icon: "repair", image: "/landing/orbit-headphones.webp", ratio: 290 / 304 },
  { id: "size", from: "mobile", kind: "memory", label: "Size: Medium" },
  { id: "colours", from: "desktop", kind: "memory", label: "Colours: dark tones" },
  { id: "delivery", from: "mobile", kind: "memory", label: "Delivery: Yaba" },
  { id: "last", from: "tablet", ring: "products", kind: "memory", label: "Last order remembered" },
  { id: "orb", from: "mobile", kind: "orb" },
];

/**
 * Products that leave the screen: each object floats clear of its own card,
 * so the two separate in depth as the scene turns. Positions are from the
 * phone's centre.
 */
interface Emerging {
  id: string;
  from: Layout;
  title: string;
  meta: string;
  image: string;
  ratio: number;
  at: Partial<Record<Layout, { x: number; y: number; w: number }>>;
}
const EMERGING: Emerging[] = [
  {
    id: "sneaker",
    from: "mobile",
    title: "Cloud runners",
    meta: "Size 38 · white",
    image: "/landing/orbit-sneaker.webp",
    ratio: 380 / 257,
    at: { desktop: { x: -150, y: 200, w: 210 }, tablet: { x: -150, y: 200, w: 190 }, mobile: { x: -100, y: 150, w: 136 } },
  },
  {
    id: "bag",
    from: "tablet",
    title: "Pearl heart tote",
    meta: "Bags · new in",
    image: "/landing/orbit-bag.webp",
    ratio: 340 / 368,
    at: { desktop: { x: 160, y: 60, w: 150 }, tablet: { x: 160, y: 60, w: 136 } },
  },
];

/** Which ring an item rides: on phones everything but the orb shares one ring around the phone's base. */
function ringOf(d: OrbitDatum, layout: Layout): RingName {
  if (d.kind === "orb") return "orb";
  if (layout === "mobile") return "products";
  return d.ring ?? (d.kind === "memory" ? "memory" : "products");
}

function ringsFor(layout: Layout, width: number): Record<RingName, Ring> {
  if (layout === "desktop") {
    return {
      products: { rx: Math.min(440, width / 2 - 130), rz: 260, y: 150, tilt: 115, speed: 6.5, start: 54 },
      memory: { rx: Math.min(400, width / 2 - 120), rz: 130, y: -336, tilt: 44, speed: -8, start: 20 },
      orb: { rx: 240, rz: 170, y: 130, tilt: 18, speed: 15, start: 200 },
    };
  }
  if (layout === "tablet") {
    return {
      products: { rx: Math.min(330, width / 2 - 100), rz: 220, y: 140, tilt: 100, speed: 7, start: 54 },
      memory: { rx: Math.min(270, width / 2 - 100), rz: 110, y: -326, tilt: 38, speed: -9, start: 20 },
      orb: { rx: 190, rz: 140, y: 120, tilt: 16, speed: 15, start: 200 },
    };
  }
  return {
    products: { rx: Math.max(96, width / 2 - 44), rz: 110, y: 196, tilt: 44, speed: 9, start: 30 },
    memory: { rx: 0, rz: 0, y: 0, tilt: 0, speed: 0, start: 0 },
    orb: { rx: 112, rz: 80, y: -244, tilt: 12, speed: 16, start: 200 },
  };
}

const PERSPECTIVE: Record<Layout, number> = { mobile: 1200, tablet: 1700, desktop: 2000 };
const STAGE_HEIGHT: Record<Layout, string> = { mobile: "h-[640px]", tablet: "h-[760px]", desktop: "h-[820px]" };
const RAD = Math.PI / 180;

/* ─────────────────────────────── Telegram phone ─────────────────────────────── */

function Reveal({ on, delay = 0, className, children }: { on: boolean; delay?: number; className?: string; children: React.ReactNode }) {
  return (
    <m.div initial={false} animate={on ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 12, scale: 0.97 }} transition={{ duration: 0.5, ease: EASE_OUT, delay }} className={className}>
      {children}
    </m.div>
  );
}

function TelegramPhone({ step, layout }: { step: number; layout: Layout }) {
  const small = layout === "mobile";
  return (
    <div className={cn("relative rounded-[48px] bg-ink-950 p-2.5 shadow-lift", small ? "w-[218px] rounded-[40px] p-2" : "w-[300px]")}>
      {/* Gentle glare across the glass. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-2 z-10 rounded-[40px] bg-[linear-gradient(115deg,rgb(255_255_255/0.22)_0%,transparent_28%,transparent_70%,rgb(255_255_255/0.08)_100%)]" />
      <div className={cn("overflow-hidden bg-white", small ? "rounded-[32px]" : "rounded-[40px]")}>
        <div className="flex items-center justify-between px-6 pt-2.5 pb-1 text-[11px] font-semibold text-ink-900" aria-hidden="true">
          <span>9:41</span>
          <span className={cn("rounded-full bg-ink-950", small ? "h-4 w-16" : "h-5 w-20")} />
          <span className="h-2.5 w-4 rounded-sm bg-ink-900/80" />
        </div>
        <div className="flex items-center gap-2.5 border-b border-ink-900/[0.06] px-3 py-2">
          <ChevronLeft className="size-5 text-[#2AABEE]" aria-hidden="true" />
          <Image src="/brand/nia-telegram-avatar.jpg" alt="" width={36} height={36} className="size-9 rounded-full" />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="text-sm font-bold text-ink-900">Nia</p>
            <p className="text-[11px] text-muted-foreground">bot</p>
          </div>
          <MoreVertical className="size-5 text-ink-900/50" aria-hidden="true" />
        </div>
        <div
          className={cn("space-y-2 px-2.5 pt-3 pb-3 leading-snug", small ? "min-h-[340px] text-[12.5px]" : "min-h-[430px] text-[14px]")}
          style={{ background: "linear-gradient(170deg, #dcebf7 0%, #e8e6f7 55%, #f3e9f5 100%)" }}
        >
          <p className="mx-auto w-fit rounded-full bg-ink-900/15 px-2.5 py-0.5 text-[11px] font-semibold text-white">Today</p>
          <Reveal on={step >= 1} className="ml-auto w-fit max-w-[82%] rounded-[16px] rounded-br-[5px] bg-[#e1f7cf] px-3 py-1.5 text-ink-900 shadow-[0_1px_1px_rgb(0_0_0/0.06)]">
            Can I get the same one as last time?
            <span className="ml-1.5 inline-flex translate-y-0.5 items-center gap-0.5 text-[10px] text-[#4fae4e]">
              9:41 <CheckCheck className="size-3" aria-label="read" />
            </span>
          </Reveal>
          <Reveal on={step >= 3} className="w-fit max-w-[90%] rounded-[16px] rounded-bl-[5px] bg-white px-3 py-1.5 text-ink-900 shadow-[0_1px_1px_rgb(0_0_0/0.06)]">
            Of course. You previously ordered the <strong>Medium black</strong> version. Should I use your current <strong>Yaba</strong> delivery address?
            <span className="mt-1 block text-[11px] text-muted-foreground italic">🧠 Recalled from a previous visit</span>
          </Reveal>
          <Reveal on={step >= 4} delay={0.05} className="w-[90%] rounded-[16px] bg-white p-2 shadow-[0_1px_1px_rgb(0_0_0/0.06)]">
            <p className="px-1 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">Previous order</p>
            <div className="mt-1.5 flex items-center gap-2">
              <span className="size-9 shrink-0 rounded-lg" style={{ backgroundImage: "linear-gradient(135deg, #1b1a4b, #0f0e26 60%, #2a2670)" }} aria-hidden="true" />
              <span className="min-w-0 leading-tight">
                <span className="block truncate font-semibold text-ink-900">Midnight Linen Kaftan</span>
                <span className="text-[11px] text-muted-foreground">Medium · Black · Yaba</span>
              </span>
            </div>
          </Reveal>
          <Reveal on={step >= 4} delay={0.2} className="grid w-[90%] grid-cols-2 gap-1">
            {["Repeat order", "Change size"].map((b) => (
              <span key={b} className="rounded-lg bg-[#4f7396] px-2 py-1.5 text-center text-[12px] font-semibold text-white">
                {b}
              </span>
            ))}
          </Reveal>
        </div>
        <div className="flex items-center gap-2 border-t border-ink-900/[0.06] px-3 py-2.5 text-muted-foreground" aria-hidden="true">
          <Paperclip className="size-4" />
          <span className="flex-1 rounded-full bg-surface-2 px-3 py-1.5 text-xs">Message</span>
          <Mic className="size-4" />
        </div>
      </div>
    </div>
  );
}

/* ─────────────────────────────── Orbit pieces ─────────────────────────────── */

function ProductCard3D({ d, compact, tiny }: { d: Extract<OrbitDatum, { kind: "product" }>; compact: boolean; tiny: boolean }) {
  const w = tiny ? 108 : compact ? 132 : 188;
  return (
    <div className="relative" style={{ width: w }}>
      {/* The product leaves its card: it sits over the card's top edge, slightly larger. */}
      <div className="relative z-10 mx-auto -mb-[34%]" style={{ width: w * 0.96, aspectRatio: d.ratio }}>
        <Image src={d.image} alt="" fill sizes={`${Math.round(w)}px`} className="object-contain drop-shadow-[0_14px_16px_rgb(27_26_75/0.18)]" />
      </div>
      <div className={cn("rounded-[22px] border border-ink-900/[0.06] bg-white shadow-soft", compact ? "px-3 pt-[36%] pb-2.5" : "px-4 pt-[38%] pb-3.5")}>
        <p className={cn("font-bold tracking-tight text-ink-900", compact ? "text-[13px]" : "text-[15px]")}>{d.title}</p>
        <p className={cn("text-muted-foreground", compact ? "text-[11px]" : "text-[12.5px]")}>{d.meta}</p>
      </div>
    </div>
  );
}

function ServiceCard3D({ d, compact }: { d: Extract<OrbitDatum, { kind: "service" }>; compact: boolean }) {
  const Icon = d.icon === "salon" ? Scissors : Wrench;
  return (
    <div className="relative" style={{ width: compact ? 150 : 196 }}>
      {d.image ? (
        <div className="relative z-10 mx-auto -mb-[26%] w-[70%]" style={{ aspectRatio: d.ratio }}>
          <Image src={d.image} alt="" fill sizes="140px" className="object-contain drop-shadow-[0_14px_16px_rgb(27_26_75/0.18)]" />
        </div>
      ) : null}
      <div className={cn("flex items-center gap-3 rounded-[22px] border border-ink-900/[0.06] bg-white p-3 shadow-soft", d.image && "pt-[28%]")}>
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-linear-to-br from-lavender-100 to-periwinkle-50 text-ink-800">
          <Icon className="size-5" />
        </span>
        <span className="min-w-0 leading-tight">
          <span className="block text-[14px] font-bold tracking-tight text-ink-900">{d.title}</span>
          <span className="text-[12px] text-muted-foreground">{d.meta}</span>
        </span>
      </div>
    </div>
  );
}

function MemoryChip({ label, compact }: { label: string; compact: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border border-aqua-200/80 bg-white font-semibold whitespace-nowrap text-memory shadow-memory", compact ? "px-2.5 py-1 text-[11px]" : "px-3.5 py-2 text-[13px]")}>
      <WalrusMark className={compact ? "size-3" : "size-3.5"} /> {label}
    </span>
  );
}

function MemoryOrb({ size }: { size: number }) {
  return (
    <span className="relative block" style={{ width: size, height: size }}>
      <span className="absolute -inset-[60%] rounded-full" style={{ background: "radial-gradient(closest-side, rgb(81 224 246 / 0.45), transparent)" }} />
      <span className="nia-orb absolute inset-0" />
    </span>
  );
}

/** One orbiting item: its 3D position is a pure function of the shared clock. */
function OrbitItem({ d, ring, phase, clock, spread, layout }: { d: OrbitDatum; ring: Ring; phase: number; clock: MotionValue<number>; spread: MotionValue<number>; layout: Layout }) {
  const angle = (t: number) => (phase + t * ring.speed) * RAD;
  const x = useTransform(() => Math.cos(angle(clock.get())) * ring.rx * (0.25 + 0.75 * spread.get()));
  // Spreading out from behind the phone: items start set back and close in.
  const z = useTransform(() => Math.sin(angle(clock.get())) * ring.rz * spread.get() - (1 - spread.get()) * 220);
  const y = useTransform(() => {
    const t = clock.get();
    return ring.y + Math.sin(angle(t)) * ring.tilt * spread.get() + Math.sin(t * 0.8 + phase) * 4;
  });
  // Cards turn a little as they swing round, as if facing the phone.
  const rotateY = useTransform(() => -Math.cos(angle(clock.get())) * 20);
  const opacity = useTransform(() => (0.55 + 0.45 * ((Math.sin(angle(clock.get())) + 1) / 2)) * spread.get());

  const compact = layout !== "desktop";
  return (
    <m.div aria-hidden="true" className="absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2 will-change-transform" style={{ x, y, z, rotateY, rotateX: 4, opacity }}>
      {d.kind === "product" ? <ProductCard3D d={d} compact={compact} tiny={layout === "mobile"} /> : null}
      {d.kind === "service" ? <ServiceCard3D d={d} compact={compact} /> : null}
      {d.kind === "memory" ? <MemoryChip label={d.label} compact={layout === "mobile"} /> : null}
      {d.kind === "orb" ? <MemoryOrb size={layout === "mobile" ? 26 : 36} /> : null}
    </m.div>
  );
}

function EmergingProduct({ e, layout, clock, spread, index }: { e: Emerging; layout: Layout; clock: MotionValue<number>; spread: MotionValue<number>; index: number }) {
  const at = e.at[layout]!;
  const h = at.w / e.ratio;
  // The object drifts forward out of its card, then hovers just in front of the glass.
  const objectZ = useTransform(() => 36 + 56 * spread.get() + Math.sin(clock.get() * 0.6 + index) * 8);
  const objectY = useTransform(() => at.y - 18 * spread.get() + Math.sin(clock.get() * 0.9 + index * 2) * 6);
  const objectRotate = useTransform(() => -8 + Math.sin(clock.get() * 0.5 + index) * 4);
  const cardOpacity = useTransform(() => spread.get());
  const compact = layout === "mobile";
  return (
    <>
      <m.div
        aria-hidden="true"
        className={cn("absolute top-1/2 left-1/2 -translate-x-1/2 rounded-[18px] border border-ink-900/[0.06] bg-white shadow-soft", compact ? "px-2.5 pt-[22%] pb-2" : "px-3.5 pt-[20%] pb-3")}
        style={{ x: at.x, y: at.y + h * 0.1, z: 30, width: at.w * 0.82, opacity: cardOpacity }}
      >
        <p className={cn("font-bold tracking-tight text-ink-900", compact ? "text-[11px]" : "text-[13px]")}>{e.title}</p>
        <p className={cn("text-muted-foreground", compact ? "text-[10px]" : "text-[11.5px]")}>{e.meta}</p>
      </m.div>
      <m.div aria-hidden="true" className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" style={{ x: at.x, y: objectY, z: objectZ, rotate: objectRotate, width: at.w, aspectRatio: e.ratio }}>
        <Image src={e.image} alt="" fill sizes={`${Math.round(at.w)}px`} className="object-contain drop-shadow-[0_18px_18px_rgb(27_26_75/0.22)]" />
      </m.div>
    </>
  );
}

/**
 * A faint ellipse tracing an orbit. It is drawn flat, behind the 3D scene: a
 * large tilted plane cutting through the phone and cards makes browsers split
 * and mis-order them (stray strips of the phone showing through cards).
 */
function RingGuide({ ring, spread }: { ring: Ring; spread: MotionValue<number> }) {
  const opacity = useTransform(() => spread.get() * 0.9);
  return (
    <m.div
      aria-hidden="true"
      className="absolute top-1/2 left-1/2 rounded-[50%] border border-aqua-300/40"
      style={{ marginLeft: -ring.rx, marginTop: ring.y - ring.tilt, width: ring.rx * 2, height: ring.tilt * 2, opacity }}
    />
  );
}

/* ─────────────────────────────── Scene ─────────────────────────────── */

export function TelegramOrbitExperience() {
  const stageRef = useRef<HTMLDivElement>(null);
  const reduce = usePrefersReducedMotion();
  const near = useInView(stageRef, { margin: "20% 0px 20% 0px" });
  const entered = useInView(stageRef, { once: true, amount: 0.3 });

  // Stage width decides the composition (phone-only ring on phones, full orbit on desktop).
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = stageRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.round(entry!.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const layout: Layout = width >= 1000 ? "desktop" : width >= 640 ? "tablet" : "mobile";
  const rings = ringsFor(layout, width);

  const clock = useMotionValue(0);
  const spread = useMotionValue(0);
  const phoneIn = useMotionValue(0);
  const [step, setStep] = useState(0);

  // Entry: phone settles, the customer asks, the memory arrives, Nia answers, cards spread out.
  useEffect(() => {
    if (!entered) return;
    if (reduce) {
      phoneIn.set(1);
      spread.set(1);
      return;
    }
    const controls = [animate(phoneIn, 1, { duration: 0.9, ease: EASE_OUT }), animate(spread, 1, { duration: 1.6, ease: EASE_OUT, delay: 0.7 })];
    const timers = [
      setTimeout(() => setStep(1), 500),
      setTimeout(() => setStep(2), 1000),
      setTimeout(() => setStep(3), layout === "desktop" ? 2300 : 1500),
      setTimeout(() => setStep(4), layout === "desktop" ? 2900 : 2100),
    ];
    return () => {
      controls.forEach((c) => c.stop());
      timers.forEach(clearTimeout);
    };
  }, [entered, reduce, phoneIn, spread, layout]);
  const shownStep = reduce ? 4 : step;

  // The orbit clock only ticks while the scene is near the viewport.
  useEffect(() => {
    if (!near || reduce) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      clock.set(clock.get() + Math.min(0.05, (now - last) / 1000));
      last = now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [near, reduce, clock]);

  // Desktop only: the composition leans a few degrees toward the pointer.
  const lean = { x: useSpring(0, { stiffness: 60, damping: 18 }), y: useSpring(0, { stiffness: 60, damping: 18 }) };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (reduce || layout !== "desktop" || e.pointerType !== "mouse") return;
    const r = e.currentTarget.getBoundingClientRect();
    lean.x.set(((e.clientX - r.left) / r.width - 0.5) * 6);
    lean.y.set(-((e.clientY - r.top) / r.height - 0.5) * 3);
  };
  const onPointerLeave = () => {
    lean.x.set(0);
    lean.y.set(0);
  };

  // The whole composition turns slowly, like a product on a turntable; the phone just floats within it.
  const swing = layout === "desktop" ? 12 : layout === "tablet" ? 10 : 6;
  const rest = layout === "mobile" ? -8 : -12;
  const worldRotateY = useTransform(() => (reduce ? rest : rest + Math.sin(clock.get() * 0.26) * swing) + lean.x.get());
  const worldRotateX = useTransform(() => (reduce ? 5 : 5 + Math.sin(clock.get() * 0.2) * 1.5) + lean.y.get());
  const phoneY = useTransform(() => Math.sin(clock.get() * 0.5) * 5);
  const phoneScale = useTransform(() => 0.9 + 0.1 * phoneIn.get());

  // Memory story (tablet and up): an orb leaves the web chat and lands in Telegram.
  const web = layout === "desktop" ? { x: -(width / 2) + 175, y: -120 } : { x: -(width / 2) + 120, y: -300 };
  const travel = useMotionValue(0);
  useEffect(() => {
    if (!entered || reduce || layout === "mobile") return;
    const c = animate(travel, 1, { duration: 1.3, ease: [0.65, 0, 0.35, 1], delay: 1.0 });
    return () => c.stop();
  }, [entered, reduce, layout, travel]);
  const orbX = useTransform(() => web.x + (-70 - web.x) * travel.get());
  const orbY = useTransform(() => {
    const t = travel.get();
    return web.y + (-20 - web.y) * t - Math.sin(t * Math.PI) * 60;
  });
  const orbOpacity = useTransform(() => {
    const t = travel.get();
    return t <= 0 || t >= 1 ? 0 : Math.min(1, t * 6, (1 - t) * 6);
  });
  const trail = useTransform(() => travel.get());
  const trailOpacity = useTransform(() => (travel.get() >= 1 ? 0.35 : 0.9));

  const counts: Record<RingName, number> = { products: 0, memory: 0, orb: 0 };
  const visible = width > 0 ? ORBIT.filter((d) => RANK[layout] >= RANK[d.from]) : [];
  for (const d of visible) counts[ringOf(d, layout)]++;
  const seen: Record<RingName, number> = { products: 0, memory: 0, orb: 0 };

  return (
    <div
      ref={stageRef}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      className={cn("relative w-full", STAGE_HEIGHT[layout])}
      style={{ perspective: PERSPECTIVE[layout], perspectiveOrigin: "50% 42%" }}
    >
      {/* Light behind the phone: aqua and a breath of lavender, from the page's own glow tokens. */}
      <div aria-hidden="true" className="absolute top-1/2 left-1/2 size-[min(760px,120vw)] -translate-x-1/2 -translate-y-1/2 rounded-full" style={{ background: "radial-gradient(closest-side, rgb(107 222 230 / 0.28), rgb(206 147 227 / 0.12) 55%, transparent)" }} />

      {Object.entries(rings).map(([name, ring]) => (counts[name as RingName] > 1 && name !== "orb" ? <RingGuide key={name} ring={ring} spread={spread} /> : null))}

      <m.div className="absolute top-1/2 left-1/2" style={{ transformStyle: "preserve-3d", rotateY: worldRotateY, rotateX: worldRotateX }}>

        {/* Soft floor shadow under the phone. */}
        <div aria-hidden="true" className="absolute -translate-x-1/2 rounded-[50%]" style={{ top: layout === "mobile" ? 250 : 330, width: layout === "mobile" ? 200 : 260, height: 34, background: "radial-gradient(closest-side, rgb(27 26 75 / 0.22), transparent)" }} />

        {layout === "desktop" ? (
          <>
            {/* The web chat the memory came from, set back and a little faded. */}
            <div aria-hidden="true" className="absolute w-[240px] -translate-x-1/2 -translate-y-1/2 rounded-[22px] border border-ink-900/[0.06] bg-white/85 p-3.5 opacity-80 shadow-soft" style={{ transform: `translate3d(${web.x}px, ${web.y}px, -60px)` }}>
              <p className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
                <Globe className="size-3.5" /> Web chat · Monday
              </p>
              <p className="mt-2 ml-auto w-fit rounded-[14px] rounded-br-[4px] bg-ink-900 px-3 py-1.5 text-[12px] text-white">I usually buy Medium, in darker colours.</p>
              <p className="mt-2 flex items-center gap-1.5 text-[11px] text-ink-900/70">
                <Mascot size={18} decorative /> Noted.
              </p>
            </div>
            {/* Nia herself, beside the phone and behind the orbit. */}
            <div aria-hidden="true" className="absolute w-[190px] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[28px] shadow-soft ring-1 ring-white/70" style={{ transform: `translate3d(${width / 2 - 165}px, -110px, -140px) rotate(5deg)` }}>
              <Image src="/landing/nia-telegram.webp" alt="" width={190} height={190} className="block" />
            </div>
            {/* The trail the memory takes into Telegram. */}
            <svg aria-hidden="true" className="absolute overflow-visible" style={{ transform: "translate3d(0, 0, -60px)" }} width="1" height="1">
              <m.path
                d={`M ${web.x + 110} ${web.y} Q ${(web.x - 70) / 2} ${web.y - 120} -70 -20`}
                fill="none"
                stroke="url(#orbit-trail)"
                strokeWidth="2.5"
                strokeLinecap="round"
                style={{ pathLength: trail, opacity: trailOpacity }}
              />
              <defs>
                <linearGradient id="orbit-trail" x1="0" x2="1">
                  <stop offset="0" stopColor="#9fb8fc" stopOpacity="0.2" />
                  <stop offset="1" stopColor="#51e0f6" />
                </linearGradient>
              </defs>
            </svg>
          </>
        ) : null}

        {/* The travelling memory. */}
        {layout !== "mobile" ? (
          <m.div aria-hidden="true" className="absolute top-0 left-0 -translate-x-1/2 -translate-y-1/2" style={{ x: orbX, y: orbY, z: 40, opacity: orbOpacity }}>
            <MemoryOrb size={30} />
          </m.div>
        ) : null}

        {/* The anchor. */}
        <m.figure
          aria-label="Example Telegram conversation with Nia"
          className="absolute top-0 left-0 m-0 -translate-x-1/2 -translate-y-1/2"
          style={{ y: phoneY, scale: phoneScale, opacity: phoneIn, transformStyle: "preserve-3d" }}
        >
          {/* Body: a back plate and two edges, seen as the scene turns. */}
          <div aria-hidden="true" className="absolute inset-0 rounded-[44px] bg-ink-800" style={{ transform: "translateZ(-12px)" }} />
          <div aria-hidden="true" className="absolute top-12 bottom-12 -left-1.5 w-3 bg-ink-800" style={{ transform: "translateZ(-6px) rotateY(90deg)" }} />
          <div aria-hidden="true" className="absolute top-12 -right-1.5 bottom-12 w-3 bg-ink-800" style={{ transform: "translateZ(-6px) rotateY(90deg)" }} />
          <TelegramPhone step={shownStep} layout={layout} />
          <ExampleTag className="absolute -top-3 left-8 z-20 bg-white shadow-soft" />
          {width > 0
            ? EMERGING.filter((e) => RANK[layout] >= RANK[e.from]).map((e, i) => <EmergingProduct key={`${e.id}-${layout}`} e={e} layout={layout} clock={clock} spread={spread} index={i} />)
            : null}
        </m.figure>

        {visible.map((d) => {
          const name = ringOf(d, layout);
          const ring = rings[name];
          const phase = ring.start + (360 / Math.max(1, counts[name])) * seen[name]++;
          return <OrbitItem key={`${d.id}-${layout}-${width}`} d={d} ring={ring} phase={phase} clock={clock} spread={spread} layout={layout} />;
        })}
      </m.div>
    </div>
  );
}
