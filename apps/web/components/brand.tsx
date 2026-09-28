import Image from "next/image";
import Link from "next/link";
import { Mascot, cn } from "@nia/ui";

export function NiaLogo({ className, href = "/", size = 30 }: { className?: string; href?: string; size?: number }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2 rounded-xl focus-visible:outline-offset-4", className)} aria-label="Nia home">
      <Mascot size={size} decorative />
      <span className="text-lg font-extrabold tracking-tight">Nia</span>
    </Link>
  );
}

export function WalrusChip({ className, label = "Walrus Memory" }: { className?: string; label?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border border-memory/25 bg-memory-soft px-2.5 py-0.5 text-xs font-semibold text-memory", className)}>
      <svg viewBox="0 0 16 16" className="size-3.5" aria-hidden="true">
        <path d="M8 1.5 13.5 4.5v7L8 14.5 2.5 11.5v-7Z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M5.5 8.2 7.2 9.8 10.6 6.3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {label}
    </span>
  );
}

/** The full mascot artwork, for large placements (hero, feature panels). Small sizes use <Mascot>. */
export function MascotArt({ size, className, priority = false }: { size: number; className?: string; priority?: boolean }) {
  return (
    <Image
      src="/brand/nia-art-1200.webp"
      alt="Nia, the walrus shop assistant, winking and waving"
      width={size}
      height={size}
      sizes={`${size}px`}
      priority={priority}
      className={cn("nia-holo-border rounded-[2rem] shadow-float", className)}
    />
  );
}
