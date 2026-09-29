import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes, type InputHTMLAttributes, type LabelHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "./cn";

/* ─────────────────────────────── Button ─────────────────────────────── */

/** The landing page's pill buttons: navy primary with a soft lift, white secondary with a hairline. */
const BUTTON_VARIANTS = {
  primary: "bg-primary text-primary-foreground shadow-[0_10px_30px_-14px_rgb(27_26_75/0.7)] hover:bg-ink-800 motion-safe:hover:-translate-y-px",
  accent: "bg-accent text-accent-foreground shadow-[0_10px_30px_-14px_rgb(83_82_224/0.7)] hover:bg-accent/90 motion-safe:hover:-translate-y-px",
  secondary: "bg-surface text-foreground border border-ink-900/12 hover:border-ink-900/25 hover:bg-surface",
  ghost: "text-foreground hover:bg-ink-900/[0.05]",
  subtle: "bg-surface-2 text-foreground hover:bg-surface-2/70",
  danger: "bg-danger text-white hover:bg-danger/90",
  link: "text-accent-strong underline-offset-4 hover:underline px-0 h-auto",
} as const;

const BUTTON_SIZES = {
  sm: "h-9 px-4 text-sm gap-1.5 rounded-full",
  md: "h-11 px-5 text-[15px] gap-2 rounded-full",
  lg: "h-12 px-6 text-[15px] gap-2 rounded-full",
  icon: "h-10 w-10 rounded-full",
} as const;

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof BUTTON_VARIANTS;
  size?: keyof typeof BUTTON_SIZES;
  loading?: boolean;
}

export function buttonClasses({ variant = "primary", size = "md", className }: { variant?: keyof typeof BUTTON_VARIANTS; size?: keyof typeof BUTTON_SIZES; className?: string } = {}) {
  return cn(
    "inline-flex items-center justify-center font-semibold whitespace-nowrap select-none",
    "transition-[background-color,color,border-color,transform,box-shadow] duration-200 ease-out motion-safe:active:scale-[0.98]",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
    "disabled:pointer-events-none disabled:opacity-50",
    BUTTON_VARIANTS[variant],
    BUTTON_SIZES[size],
    className,
  );
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading = false, className, children, disabled, type = "button", ...props },
  ref,
) {
  return (
    <button ref={ref} type={type} className={buttonClasses({ variant, size, className })} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      {loading ? <Spinner className="size-4" /> : null}
      {children}
    </button>
  );
});

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn("motion-safe:animate-spin", className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity=".2" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

/* ─────────────────────────────── Surfaces ─────────────────────────────── */

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("rounded-3xl border border-ink-900/[0.06] bg-surface shadow-soft", className)} {...props} />;
}

export function CardHeader({ title, description, action, className }: { title: ReactNode; description?: ReactNode; action?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-start justify-between gap-4 p-6 pb-0", className)}>
      <div className="min-w-0">
        <h3 className="text-base font-bold tracking-tight text-foreground">{title}</h3>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function CardBody({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-6", className)} {...props} />;
}

/* ─────────────────────────────── Badge ─────────────────────────────── */

const BADGE_TONES = {
  neutral: "bg-surface-2 text-muted-foreground border-border",
  accent: "bg-accent-soft text-accent-strong border-accent/20",
  success: "bg-success-soft text-success border-success/20",
  warning: "bg-warning-soft text-warning border-warning/25",
  danger: "bg-danger-soft text-danger border-danger/20",
  info: "bg-info-soft text-info border-info/20",
  dark: "bg-foreground text-background border-foreground",
} as const;

export type BadgeTone = keyof typeof BADGE_TONES;

export function Badge({ tone = "neutral", className, children, dot = false }: { tone?: BadgeTone; className?: string; children: ReactNode; dot?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap", BADGE_TONES[tone], className)}>
      {dot ? <span className="size-1.5 rounded-full bg-current" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

/* ─────────────────────────────── Form fields ─────────────────────────────── */

/** Rounded white fields with a hairline and the NIA accent focus ring. */
const FIELD = cn(
  "w-full rounded-2xl border border-ink-900/12 bg-surface px-4 text-[15px] text-foreground placeholder:text-muted-foreground/75",
  "transition-[border-color,box-shadow] duration-150 ease-out hover:border-ink-900/20",
  "focus-visible:outline-none focus-visible:border-accent focus-visible:ring-4 focus-visible:ring-ring/15",
  "disabled:cursor-not-allowed disabled:opacity-60 aria-[invalid=true]:border-danger",
);

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...props }, ref) {
  return <input ref={ref} className={cn(FIELD, "h-12", className)} {...props} />;
});

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function Textarea({ className, ...props }, ref) {
  return <textarea ref={ref} className={cn(FIELD, "min-h-24 py-3 leading-relaxed", className)} {...props} />;
});

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select({ className, children, ...props }, ref) {
  return (
    <select ref={ref} className={cn(FIELD, "h-12 appearance-none bg-[length:16px] bg-[right_14px_center] bg-no-repeat pr-10 nia-select", className)} {...props}>
      {children}
    </select>
  );
});

export function Label({ className, ...props }: LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("text-sm font-semibold text-foreground", className)} {...props} />;
}

export function Field({ label, htmlFor, hint, error, children, className }: { label: ReactNode; htmlFor: string; hint?: ReactNode; error?: string | null; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-sm text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export function Switch({ checked, onChange, label, name, disabled }: { checked: boolean; onChange?: (next: boolean) => void; label: string; name?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={cn(
        "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full border border-transparent transition-colors duration-150 ease-out",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50",
        checked ? "bg-accent" : "bg-border",
      )}
    >
      {name ? <input type="hidden" name={name} value={checked ? "on" : "off"} /> : null}
      <span className={cn("inline-block size-5 rounded-full bg-white shadow-sm transition-transform duration-150 ease-out", checked ? "translate-x-6" : "translate-x-1")} />
    </button>
  );
}

/* ─────────────────────────────── States ─────────────────────────────── */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("nia-skeleton rounded-2xl", className)} aria-hidden="true" />;
}

export function Divider({ className }: { className?: string }) {
  return <hr className={cn("border-0 border-t border-ink-900/[0.06]", className)} />;
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className="rounded-md border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">{children}</kbd>;
}
