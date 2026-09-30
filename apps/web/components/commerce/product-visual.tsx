"use client";

import { useState } from "react";
import { cn } from "@nia/ui";
import { colourHex } from "./colour";

/**
 * Product artwork. A product photo when there is one; otherwise — or if the
 * photo ever fails to load — a generated artwork from the product's real
 * colour options and category, never a stock photo that could misrepresent it.
 */

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

const FALLBACKS = ["#5352E0", "#086A82", "#2A2670", "#9A5A06", "#6E1F33", "#177A53"]; // brand-leaning, all dark enough for white initials

type Motif =
  | "ankara"
  | "adire"
  | "lace"
  | "stripes"
  | "garment"
  | "jar"
  | "bottle"
  | "bread"
  | "cake"
  | "tape"
  | "service"
  | "device"
  | "audio"
  | "cup"
  | "bowl"
  | "lamp"
  | "shoe"
  | "bag"
  | "chair"
  | "linen"
  | "box"
  | "desk"
  | "candle"
  | "vase"
  | "knife"
  | "pot"
  | "frame"
  | "plain";

function motifFor(category: string | null | undefined, name: string, kind?: string): Motif {
  const c = `${category ?? ""} ${name}`.toLowerCase();
  if (kind === "SERVICE" || kind === "APPOINTMENT") return "service";
  if (/ankara|\bwax\b/.test(c)) return "ankara";
  if (/adire|tie[- ]?(and[- ])?dye|\bdye|indigo/.test(c)) return "adire";
  if (/\blace\b/.test(c)) return "lace";
  if (/aso[- ]?oke|\bstripe|headwrap/.test(c)) return "stripes";
  if (/headphone|earbud|speaker|headset|audio/.test(c)) return "audio";
  if (/phone|laptop|tablet|watch|\bband\b|charger|power bank|keyboard|mouse|webcam|\bhub\b|controller|camera|plug|gadget/.test(c)) return "device";
  if (/sneaker|shoe|loafer|sandal|slide|heel/.test(c)) return "shoe";
  if (/bag\b|bags\b|tote|backpack|crossbody|purse/.test(c)) return "bag";
  // Home before clothing: "steel", "set" and "piece" must not read as a T-shirt or a pie.
  if (/chair|stool/.test(c)) return "chair";
  if (/towel|bedsheet|bedding|duvet|blanket|pillow|cushion/.test(c)) return "linen";
  if (/organi[sz]er|basket|container|storage/.test(c)) return "box";
  if (/riser|monitor|desk mat/.test(c)) return "desk";
  if (/candle|diffuser/.test(c)) return "candle";
  if (/\bvase/.test(c)) return "vase";
  if (/knife|knives/.test(c)) return "knife";
  if (/cookware|\bpans?\b|\bpots?\b|utensil/.test(c)) return "pot";
  if (/wall art|frame|art print|poster/.test(c)) return "frame";
  if (/lamp|\blight\b|pendant|d[ée]cor|\bhome\b/.test(c)) return "lamp";
  if (/kaftan|shirt|dress|ready|wear|agbada|hoodie|\btee\b|t-shirt|jacket|trouser|jean|chino|skirt|blouse|jogger|blazer|polo|gown|senator|two-piece|three-piece|\b(wo)?men('s)?\b|unisex|fashion/.test(c)) return "garment";
  if (/tailor|measure|made-to/.test(c)) return "tape";
  if (/juice|water|soda|cola|drink|malt|milk|\btea\b|coffee|smoothie|mocktail|zobo|beverage|\bmugs?\b/.test(c)) return "cup";
  if (/rice|soup|meal|pasta|spaghetti|noodle|bowl|salad|grill|suya|chicken|fish|prawn|burger|shawarma|\bwrap\b|pizza|breakfast|pancake|akara|yam|beans|plantain|chops|snack|food/.test(c)) return "bowl";
  if (/butter|cream|jar/.test(c)) return "jar";
  if (/serum|oil|bottle|hair|perfume|mist|lotion|cleanser|lipstick|gloss|foundation|mascara|polish/.test(c)) return "bottle";
  if (/bread|loaf|sourdough|\brolls?\b|pastr|croissant|\bpies?\b|doughnut|cookie|brownie|puff/.test(c)) return "bread";
  if (/cake|cupcake|cheesecake/.test(c)) return "cake";
  return "plain";
}

type Props = {
  name: string;
  category?: string | null;
  colours?: string[];
  image?: string | null;
  kind?: string;
  className?: string;
  rounded?: string;
};

export function ProductVisual({ name, category, colours, image, kind, className, rounded = "rounded-xl" }: Props) {
  // A photo that fails to load (moved, blocked, offline) falls back to the generated artwork —
  // also when it failed before hydration, which onError alone would miss.
  const [failed, setFailed] = useState(false);
  if (image && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        ref={(el) => {
          if (el?.complete && el.naturalWidth === 0) setFailed(true);
        }}
        src={image}
        alt={name}
        className={cn("aspect-square w-full bg-surface-2 object-cover", rounded, className)}
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
      />
    );
  }
  return <ProductArt name={name} category={category} colours={colours} kind={kind} className={className} rounded={rounded} />;
}

function ProductArt({ name, category, colours, kind, className, rounded }: Omit<Props, "image">) {
  const hexes = (colours ?? []).map(colourHex).filter((h): h is string => Boolean(h));
  const seed = hashString(name);
  const base = hexes[0] ?? FALLBACKS[seed % FALLBACKS.length]!;
  const second = hexes[1] ?? base;
  const motif = motifFor(category, name, kind);
  const id = `pv${seed.toString(36)}`;
  const light = /^#(E|D|C)/i.test(base);
  const ink = light ? "#1A1D24" : "#FFFFFF";
  const shape = { fill: ink, fillOpacity: 0.18, stroke: ink, strokeOpacity: 0.45, strokeWidth: 1.5, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };

  return (
    <div className={cn("relative aspect-square w-full overflow-hidden", rounded, className)} role="img" aria-label={`${name} — illustration`} data-fallback-art="">
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
          <path d="M44 30 L54 26 Q60 32 66 26 L76 30 L90 44 L81 53 L76 49 V92 H44 V49 L39 53 L30 44 Z" {...shape} />
        ) : motif === "jar" ? (
          <>
            <rect x="38" y="44" width="44" height="42" rx="8" {...shape} />
            <rect x="40" y="36" width="40" height="10" rx="4" fill={ink} fillOpacity=".32" />
          </>
        ) : motif === "bottle" ? (
          <>
            <rect x="47" y="42" width="26" height="48" rx="7" {...shape} />
            <rect x="54" y="30" width="12" height="13" rx="3" fill={ink} fillOpacity=".32" />
          </>
        ) : motif === "bread" ? (
          <path d="M32 72 Q32 46 60 46 Q88 46 88 72 Q88 80 80 80 H40 Q32 80 32 72 Z M48 56 L54 66 M60 54 L66 64 M72 56 L76 64" {...shape} />
        ) : motif === "cake" ? (
          <path d="M36 84 V64 H84 V84 Z M40 64 V52 H80 V64 M60 52 V42 M60 42 Q57 38 60 34 Q63 38 60 42" {...shape} />
        ) : motif === "tape" ? (
          <>
            <circle cx="52" cy="58" r="20" {...shape} />
            <circle cx="52" cy="58" r="6" fill={ink} fillOpacity=".32" />
            <path d="M52 78 H92 V70 H72" fill="none" stroke={ink} strokeOpacity=".45" strokeWidth="1.5" />
          </>
        ) : motif === "service" ? (
          <path d="M42 40 H78 A6 6 0 0 1 84 46 V80 A6 6 0 0 1 78 86 H42 A6 6 0 0 1 36 80 V46 A6 6 0 0 1 42 40 Z M36 54 H84 M48 34 V44 M72 34 V44" {...shape} fillOpacity={0.12} />
        ) : motif === "device" ? (
          <>
            <rect x="42" y="28" width="36" height="64" rx="8" {...shape} />
            <path d="M54 34 H66 M56 84 H64" stroke={ink} strokeOpacity=".5" strokeWidth="2" strokeLinecap="round" />
          </>
        ) : motif === "audio" ? (
          <path d="M34 70 V60 A26 26 0 0 1 86 60 V70 M34 66 H42 V88 H34 Z M78 66 H86 V88 H78 Z" {...shape} />
        ) : motif === "cup" ? (
          <path d="M42 36 H78 L73 90 H47 Z M44 52 H76 M58 36 L64 22" {...shape} />
        ) : motif === "bowl" ? (
          <path d="M28 60 H92 Q90 86 60 88 Q30 86 28 60 Z M44 60 Q48 46 60 46 Q72 46 76 60 M52 40 Q50 34 54 30 M64 40 Q62 34 66 30" {...shape} />
        ) : motif === "lamp" ? (
          <path d="M44 34 H76 L84 60 H36 Z M60 60 V86 M46 88 H74" {...shape} />
        ) : motif === "shoe" ? (
          <path d="M26 74 Q26 60 36 58 L56 56 Q66 50 72 60 L92 68 Q96 72 94 80 H28 Q26 80 26 74 Z M26 80 H94" {...shape} />
        ) : motif === "bag" ? (
          <path d="M36 50 H84 L80 90 H40 Z M48 50 V44 A12 12 0 0 1 72 44 V50" {...shape} />
        ) : motif === "chair" ? (
          <path d="M46 26 H74 Q78 26 78 30 V56 H42 V30 Q42 26 46 26 Z M36 60 H84 V68 H36 Z M60 68 V84 M42 92 L60 84 L78 92" {...shape} />
        ) : motif === "linen" ? (
          <path d="M30 44 H90 V56 H30 Z M34 58 H86 V70 H34 Z M30 72 H90 V86 H30 Z" {...shape} />
        ) : motif === "box" ? (
          <path d="M28 50 H92 L86 90 H34 Z M36 38 H84 L92 50 H28 Z M50 62 V78 M60 62 V78 M70 62 V78" {...shape} />
        ) : motif === "desk" ? (
          <path d="M36 28 H84 V62 H36 Z M54 62 V72 H66 V62 M28 74 H92 V82 H28 Z M34 82 V90 M86 82 V90" {...shape} />
        ) : motif === "candle" ? (
          <path d="M42 56 H78 V90 H42 Z M60 56 V46 M60 46 Q54 38 60 28 Q66 38 60 46" {...shape} />
        ) : motif === "vase" ? (
          <path d="M50 28 H70 V36 Q86 50 82 70 Q78 90 60 90 Q42 90 38 70 Q34 50 50 36 Z" {...shape} />
        ) : motif === "knife" ? (
          <path d="M26 78 L80 42 Q94 34 92 48 L40 84 Z M26 78 L18 84 L22 90 L34 84" {...shape} />
        ) : motif === "pot" ? (
          <path d="M32 54 H88 V80 Q88 88 80 88 H40 Q32 88 32 80 Z M22 58 H32 M88 58 H98 M44 54 Q60 42 76 54" {...shape} />
        ) : motif === "frame" ? (
          <path d="M30 28 H90 V92 H30 Z M38 36 H82 V84 H38 Z M42 76 L56 58 L66 70 L72 62 L80 76 Z" {...shape} />
        ) : null}
      </svg>
    </div>
  );
}
