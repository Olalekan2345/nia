import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { cn } from "@nia/ui";

export function Container({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-[1280px] px-5 sm:px-8", className)}>{children}</div>;
}

/** Editorial section label: a number and a word, e.g. "02 — Memory". */
export function SectionLabel({ index, children, tone = "light", className }: { index: string; children: React.ReactNode; tone?: "light" | "dark"; className?: string }) {
  return (
    <p className={cn("flex items-center gap-3 text-[13px] font-semibold tracking-[0.14em] uppercase", tone === "dark" ? "text-aqua-200" : "text-muted-foreground", className)}>
      <span className="tabular">{index}</span>
      <span aria-hidden="true" className={cn("h-px w-8", tone === "dark" ? "bg-aqua-200/50" : "bg-foreground/25")} />
      {children}
    </p>
  );
}

const DISPLAY = {
  xl: "text-[clamp(2.6rem,5.7vw,5.6rem)] leading-[0.96] tracking-[-0.045em]",
  lg: "text-[clamp(2.3rem,5.2vw,5rem)] leading-[0.98] tracking-[-0.04em]",
  md: "text-[clamp(2rem,4vw,3.6rem)] leading-[1.02] tracking-[-0.035em]",
} as const;

export function displayClass(size: keyof typeof DISPLAY) {
  return cn("font-extrabold text-balance", DISPLAY[size]);
}

type CtaProps = { href: string; children: React.ReactNode; variant?: "primary" | "secondary" | "light" | "ghost-dark"; className?: string; external?: boolean; arrow?: boolean };

const CTA_STYLES = {
  primary: "bg-ink-900 text-white shadow-[0_10px_30px_-12px_rgb(27_26_75/0.6)] hover:bg-ink-800",
  secondary: "border border-ink-900/12 bg-white text-ink-900 hover:border-ink-900/25",
  light: "bg-white text-ink-900 hover:bg-aqua-50",
  "ghost-dark": "border border-white/20 text-white hover:border-white/45 hover:bg-white/5",
} as const;

/** Pill CTA with a small lift on hover. Real links only. */
export function Cta({ href, children, variant = "primary", className, external = false, arrow = false }: CtaProps) {
  const Icon = external ? ArrowUpRight : ArrowRight;
  const classes = cn(
    "group inline-flex h-12 items-center justify-center gap-2 rounded-full px-6 text-[15px] font-semibold transition-[transform,background-color,border-color,box-shadow] duration-200 ease-out hover:-translate-y-0.5 active:translate-y-0 focus-visible:outline-offset-4 motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:h-[52px] sm:px-7",
    CTA_STYLES[variant],
    className,
  );
  const content = (
    <>
      {children}
      {arrow || external ? <Icon className="size-4 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" /> : null}
    </>
  );
  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={classes}>
        {content}
      </a>
    );
  }
  return href.startsWith("#") ? (
    <a href={href} className={classes}>
      {content}
    </a>
  ) : (
    <Link href={href} className={classes}>
      {content}
    </Link>
  );
}

/** Walrus Memory hexagon mark (the same glyph as the app's Walrus chip). */
export function WalrusMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={cn("size-3.5", className)} aria-hidden="true">
      <path d="M8 1.5 13.5 4.5v7L8 14.5 2.5 11.5v-7Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M5.5 8.2 7.2 9.8 10.6 6.3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Small label under example conversations: examples are never presented as live activity. */
export function ExampleTag({ className, children = "Example" }: { className?: string; children?: React.ReactNode }) {
  return <span className={cn("rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase", className)}>{children}</span>;
}

/** Scene artwork built by `pnpm brand:landing` into public/landing/. */
export type Scene = "hero" | "remembers" | "memory-orb" | "businesses" | "telegram" | "dashboard" | "market" | "cta";
const LANDSCAPE: ReadonlySet<Scene> = new Set(["remembers", "businesses", "dashboard"]);

/**
 * One of Nia's scene illustrations in a soft rounded frame. Only the hero uses
 * `priority`; the rest lazy-load. Full-body art is never cropped to a circle.
 */
export function SceneArt({ scene, alt, sizes, priority = false, className }: { scene: Scene; alt: string; sizes: string; priority?: boolean; className?: string }) {
  return (
    <div className={cn("relative overflow-hidden rounded-[36px] shadow-lift ring-1 ring-white/70", LANDSCAPE.has(scene) ? "aspect-[1448/1086]" : "aspect-square", className)}>
      <Image src={`/landing/nia-${scene}.webp`} alt={alt} fill sizes={sizes} priority={priority} className="object-cover" draggable={false} />
      {/* A hairline highlight, so the artwork sits on the page like a printed card. */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-white/40" />
    </div>
  );
}
