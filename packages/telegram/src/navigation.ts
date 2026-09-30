/**
 * Moving between shops and Walrus Market in a Telegram chat, in the customer's
 * own words: "back to the market", "leave this shop", "switch to Walrus Drinks",
 * "take me to the bakery", "show me other shops". Deterministic (no model call)
 * and deliberately narrow: it needs a navigation verb AND a known place, so
 * "I'm going to a wedding" never switches anything.
 */
import { MARKET_DEPARTMENTS } from "@nia/shared";

export interface NavPlace {
  slug: string;
  name: string;
  businessType: string;
  kind: "shop" | "market";
}

export type NavTarget = { kind: "market" } | { kind: "shop"; slug: string } | { kind: "chooser" };

export interface NavIntent {
  target: NavTarget;
  /** What else they asked for in the same message ("…and find me a phone"), to answer after switching. */
  request: string | null;
}

/** A navigation phrase that must be followed by "to/into": "go back to", "switch to", "take me to", "back to". */
const MOVE_TO = String.raw`(?:(?:go|goes|going|head|move|switch|jump|return|change|take\s+me|take\s+us|bring\s+me|get\s+me|send\s+me)(?:\s+(?:back|over))?|back)\s+(?:to|into)`;
const MARKET_WORDS = String.raw`(?:the\s+)?(?:main\s+|big\s+)?(?:walrus\s+)?market(?:place)?\b|all\s+(?:the\s+)?shops\b|every\s+shop\b`;

/** "back to the market", "take me to the main market", "open walrus market", or just "market". */
const TO_MARKET = new RegExp(String.raw`\b${MOVE_TO}\s+(?:${MARKET_WORDS})|\bopen\s+(?:the\s+)?(?:walrus\s+)?market\b|^\s*(?:the\s+)?(?:main\s+|walrus\s+)?market\s*[.!]?\s*$`, "i");
/** "leave this shop", "exit this department". */
const LEAVE = /\b(?:leave|exit|quit|get out of|close)\s+(?:this|the)\s+(?:shop|store|department|section|chat)\b/i;
/** "show me other shops", "switch shops", "change store". */
const CHOOSER = /\b(?:other|another|different)\s+(?:shops?|stores?|departments?)\b|\b(?:switch|change)\s+(?:shops?|stores?|departments?)\b|\blist (?:the |all )?shops\b/i;
/** "switch to X", "take me to X", "go to the bakery", "open adire lane". */
const TO_PLACE = new RegExp(String.raw`(?:\b${MOVE_TO}|\bopen)\s+(?:the\s+)?([^,.!?]{2,40}?)(?:\s+(?:shop|store|section|department|please))?(?=$|[,.!?]|\s+(?:and|to|so|then)\b)`, "i");

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\b(?:the|shop|store|section|department|walrus|co)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Department words a customer might use for a shop ("bakery", "clothes", "gadgets"). */
const DEPARTMENT_WORDS: Record<string, string[]> = {
  gadgets: ["gadgets", "gadget", "electronics", "phones", "laptops", "tech"],
  fashion: ["fashion", "clothes", "clothing", "designers", "fabric", "fabrics"],
  food: ["food", "kitchen", "restaurant", "meals"],
  drinks: ["drinks", "beverages", "drink"],
  bakery: ["bakery", "cakes", "cake", "pastries"],
  beauty: ["beauty", "salon", "hair", "skincare"],
  home: ["home", "homeware", "home and lifestyle", "lifestyle"],
};

function requestAfter(text: string, matchEnd: number): string | null {
  const rest = text.slice(matchEnd).replace(/^[\s,.;:!-]*(?:and|then|so|to)?\s*/i, "").trim();
  return rest.split(/\s+/).filter(Boolean).length >= 2 ? rest : null;
}

export function navigationIntent(text: string, places: NavPlace[]): NavIntent | null {
  const t = text.trim();
  if (!t || t.startsWith("/")) return null;

  const toMarket = TO_MARKET.exec(t) ?? LEAVE.exec(t);
  if (toMarket && places.some((p) => p.kind === "market")) return { target: { kind: "market" }, request: requestAfter(t, toMarket.index + toMarket[0].length) };
  if (CHOOSER.test(t)) return { target: { kind: "chooser" }, request: null };

  const m = TO_PLACE.exec(t);
  if (!m) return null;
  const wanted = norm(m[1]!);
  if (!wanted) return null;
  const shops = places.filter((p) => p.kind === "shop");
  // A shop by name ("walrus drinks", "crumb", "adire lane") …
  const byName = shops.find((s) => {
    const n = norm(s.name);
    return n === wanted || (wanted.length >= 4 && (n.includes(wanted) || wanted.includes(n)));
  });
  // … or by department ("the bakery", "clothes").
  const dept = byName ? null : Object.entries(DEPARTMENT_WORDS).find(([, words]) => words.includes(wanted))?.[0];
  const byDept = dept ? shops.filter((s) => MARKET_DEPARTMENTS.find((d) => d.key === dept)?.businessTypes.includes(s.businessType)) : [];
  const request = requestAfter(t, m.index + m[0].length);
  if (byName) return { target: { kind: "shop", slug: byName.slug }, request };
  if (byDept.length === 1) return { target: { kind: "shop", slug: byDept[0]!.slug }, request };
  if (byDept.length > 1) return { target: { kind: "chooser" }, request: null };
  return null;
}
