import { cn } from "@nia/ui";

/**
 * Product artwork. When a merchant hasn't uploaded a photo we render a
 * tasteful generated swatch from the product's real colour options and
 * category — never a stock photo that could misrepresent the item.
 */

const COLOUR_HEX: [RegExp, string][] = [
  [/emerald|green/i, "#11775F"],
  [/cobalt|royal blue/i, "#2F54EB"],
  [/sky indigo|sky/i, "#5B7BC4"],
  [/deep indigo|indigo/i, "#27306B"],
  [/navy/i, "#1F2A4D"],
  [/terracotta|rust/i, "#B85C3C"],
  [/wine|burgundy/i, "#6E1F33"],
  [/champagne/i, "#D9C3A0"],
  [/ivory|cream|white/i, "#EFE9DD"],
  [/gold/i, "#C79A3A"],
  [/sand/i, "#CDB892"],
  [/charcoal/i, "#3A3F47"],
  [/onyx|midnight|black/i, "#1A1D24"],
  [/blue/i, "#3867D6"],
];

export function colourHex(name: string | undefined | null): string | null {
  if (!name) return null;
  for (const [re, hex] of COLOUR_HEX) if (re.test(name)) return hex;
  return null;
}

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const FALLBACKS = ["#0A7A89", "#2F54EB", "#177A53", "#9A5A06", "#6E1F33", "#27306B"];

type Motif = "ankara" | "adire" | "lace" | "stripes" | "garment" | "jar" | "bottle" | "bread" | "cake" | "tape" | "service" | "plain";

function motifFor(category: string | null | undefined, name: string, kind?: string): Motif {
  const c = `${category ?? ""} ${name}`.toLowerCase();
  if (kind === "SERVICE" || kind === "APPOINTMENT") return "service";
  if (/ankara|wax|print/.test(c)) return "ankara";
  if (/adire|tie|dye|indigo/.test(c)) return "adire";
  if (/lace/.test(c)) return "lace";
  if (/aso|oke|woven|stripe|headwrap|wrap/.test(c)) return "stripes";
  if (/kaftan|shirt|dress|ready|wear|agbada/.test(c)) return "garment";
  if (/tailor|measure|made-to/.test(c)) return "tape";
  if (/butter|cream|jar/.test(c)) return "jar";
  if (/serum|oil|bottle|hair/.test(c)) return "bottle";
  if (/bread|loaf|sourdough|roll|pastry/.test(c)) return "bread";
  if (/cake/.test(c)) return "cake";
  return "plain";
}

export function ProductVisual({
  name,
  category,
  colours,
  image,
  kind,
  className,
  rounded = "rounded-xl",
}: {
  name: string;
  category?: string | null;
  colours?: string[];
  image?: string | null;
  kind?: string;
  className?: string;
  rounded?: string;
}) {
  if (image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={image} alt={name} className={cn("aspect-square w-full object-cover", rounded, className)} loading="lazy" />;
  }
  const hexes = (colours ?? []).map(colourHex).filter((h): h is string => Boolean(h));
  const seed = hashString(name);
  const base = hexes[0] ?? FALLBACKS[seed % FALLBACKS.length]!;
  const second = hexes[1] ?? base;
  const motif = motifFor(category, name, kind);
  const id = `pv${seed.toString(36)}`;
  const light = /^#(E|D|C)/i.test(base);
  const ink = light ? "#1A1D24" : "#FFFFFF";

  return (
    <div className={cn("relative aspect-square w-full overflow-hidden", rounded, className)} role="img" aria-label={`${name} — illustration`}>
      <svg viewBox="0 0 120 120" className="absolute inset-0 size-full" aria-hidden="true" preserveAspectRatio="xMidYMid slice">
        <defs>
          <linearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={base} />
            <stop offset="1" stopColor={second} stopOpacity={hexes[1] ? 1 : 0.82} />
          </linearGradient>
          <pattern id={`${id}p`} width="24" height="24" patternUnits="userSpaceOnUse">
            {motif === "ankara" ? (
              <>
                <circle cx="12" cy="12" r="7" fill="none" stroke={ink} strokeOpacity=".35" strokeWidth="2.2" />
                <circle cx="12" cy="12" r="2.4" fill={ink} fillOpacity=".45" />
                <path d="M0 0 L6 6 M24 0 L18 6 M0 24 L6 18 M24 24 L18 18" stroke={ink} strokeOpacity=".3" strokeWidth="2" />
              </>
            ) : motif === "lace" ? (
              <>
                <circle cx="12" cy="12" r="5" fill="none" stroke={ink} strokeOpacity=".35" strokeWidth="1.2" />
                <circle cx="0" cy="0" r="3" fill={ink} fillOpacity=".18" />
                <circle cx="24" cy="24" r="3" fill={ink} fillOpacity=".18" />
                <circle cx="12" cy="12" r="1.2" fill={ink} fillOpacity=".4" />
              </>
            ) : motif === "stripes" ? (
              <>
                <rect width="24" height="6" fill={ink} fillOpacity=".16" />
                <rect y="10" width="24" height="2" fill={ink} fillOpacity=".3" />
                <rect y="16" width="24" height="3" fill={ink} fillOpacity=".12" />
              </>
            ) : motif === "adire" ? (
              <>
                <circle cx="12" cy="12" r="9" fill="none" stroke={ink} strokeOpacity=".22" strokeWidth="1.6" strokeDasharray="2 3" />
                <circle cx="12" cy="12" r="4" fill={ink} fillOpacity=".16" />
              </>
            ) : (
              <circle cx="12" cy="12" r="1.2" fill={ink} fillOpacity=".14" />
            )}
          </pattern>
        </defs>
        <rect width="120" height="120" fill={`url(#${id}g)`} />
        <rect width="120" height="120" fill={`url(#${id}p)`} />
        {motif === "garment" ? (
          <path d="M44 30 L54 26 Q60 32 66 26 L76 30 L90 44 L81 53 L76 49 V92 H44 V49 L39 53 L30 44 Z" fill={ink} fillOpacity=".2" stroke={ink} strokeOpacity=".45" strokeWidth="1.5" strokeLinejoin="round" />
        ) : motif === "jar" ? (
          <>
            <rect x="38" y="44" width="44" height="42" rx="8" fill={ink} fillOpacity=".18" stroke={ink} strokeOpacity=".45" strokeWidth="1.5" />
            <rect x="40" y="36" width="40" height="10" rx="4" fill={ink} fillOpacity=".32" />
          </>
        ) : motif === "bottle" ? (
          <>
            <rect x="47" y="42" width="26" height="48" rx="7" fill={ink} fillOpacity=".18" stroke={ink} strokeOpacity=".45" strokeWidth="1.5" />
            <rect x="54" y="30" width="12" height="13" rx="3" fill={ink} fillOpacity=".32" />
          </>
        ) : motif === "bread" ? (
          <path d="M32 72 Q32 46 60 46 Q88 46 88 72 Q88 80 80 80 H40 Q32 80 32 72 Z M48 56 L54 66 M60 54 L66 64 M72 56 L76 64" fill={ink} fillOpacity=".18" stroke={ink} strokeOpacity=".45" strokeWidth="1.5" strokeLinecap="round" />
        ) : motif === "cake" ? (
          <path d="M36 84 V64 H84 V84 Z M40 64 V52 H80 V64 M60 52 V42 M60 42 Q57 38 60 34 Q63 38 60 42" fill={ink} fillOpacity=".16" stroke={ink} strokeOpacity=".45" strokeWidth="1.5" strokeLinejoin="round" />
        ) : motif === "tape" ? (
          <>
            <circle cx="52" cy="58" r="20" fill={ink} fillOpacity=".16" stroke={ink} strokeOpacity=".45" strokeWidth="1.5" />
            <circle cx="52" cy="58" r="6" fill={ink} fillOpacity=".32" />
            <path d="M52 78 H92 V70 H72" fill="none" stroke={ink} strokeOpacity=".45" strokeWidth="1.5" />
          </>
        ) : motif === "service" ? (
          <path d="M42 40 H78 A6 6 0 0 1 84 46 V80 A6 6 0 0 1 78 86 H42 A6 6 0 0 1 36 80 V46 A6 6 0 0 1 42 40 Z M36 54 H84 M48 34 V44 M72 34 V44" fill={ink} fillOpacity=".12" stroke={ink} strokeOpacity=".45" strokeWidth="1.5" strokeLinecap="round" />
        ) : null}
      </svg>
    </div>
  );
}
