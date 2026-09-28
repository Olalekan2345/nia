import { cn } from "./cn";

export const MASCOT_STATES = ["idle", "greeting", "thinking", "remembering", "recalling", "order_success", "booking_success", "privacy", "warning"] as const;
export type MascotState = (typeof MASCOT_STATES)[number];

export interface MascotProps {
  state?: MascotState;
  size?: number;
  className?: string;
  /** Accessible label; decorative mascots should pass `decorative`. */
  label?: string;
  decorative?: boolean;
}

/** Small status badges (inline SVG paths, 24×24 viewBox). */
const BADGES: Partial<Record<MascotState, { kind: string; path: string }>> = {
  remembering: { kind: "memory", path: "M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9z" },
  order_success: { kind: "success", path: "M5 12.5l4.5 4.5L19 7.5" },
  booking_success: { kind: "success", path: "M5 12.5l4.5 4.5L19 7.5" },
  privacy: { kind: "neutral", path: "M7 11V8a5 5 0 0 1 10 0v3M6 11h12v9H6z" },
  warning: { kind: "warning", path: "M12 6v7M12 17.5v.5" },
};

/**
 * Nia, the walrus — the brand artwork (built by `pnpm brand:icons` from
 * brand/nia-mascot.*) in a holographic ring. The ring and a small badge carry
 * the state: spinning while thinking, glowing while recalling/remembering,
 * a check on success, a lock for privacy, amber for warnings. Motion lives in
 * globals.css and only runs when the user allows motion.
 */
export function Mascot({ state = "idle", size = 120, className, label = "Nia", decorative = false }: MascotProps) {
  const src = size <= 48 ? 96 : size <= 96 ? 192 : 384;
  const badge = BADGES[state];
  const ring = Math.max(2, Math.round(size * 0.035));
  return (
    <span
      className={cn("nia-mascot relative inline-block shrink-0 select-none", className)}
      style={{ width: size, height: size, ["--nia-ring" as string]: `${ring}px` }}
      data-state={state}
      role={decorative ? undefined : "img"}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative || undefined}
    >
      <span className="nia-mascot-ring" aria-hidden="true" />
      <img
        src={`/brand/nia-mascot-${src}.webp`}
        srcSet="/brand/nia-mascot-96.webp 96w, /brand/nia-mascot-192.webp 192w, /brand/nia-mascot-384.webp 384w"
        sizes={`${size}px`}
        width={size}
        height={size}
        alt=""
        draggable={false}
        className="nia-mascot-img"
      />
      {badge && size >= 32 ? (
        <span className="nia-mascot-badge" data-kind={badge.kind} style={{ width: Math.max(14, Math.round(size * 0.3)), height: Math.max(14, Math.round(size * 0.3)) }}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d={badge.path} />
          </svg>
        </span>
      ) : null}
    </span>
  );
}
