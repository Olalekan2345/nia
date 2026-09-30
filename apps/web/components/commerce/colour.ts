/** Swatch colour for a variant's colour name (server and client). Null when the name isn't a known colour. */

const COLOUR_HEX: [RegExp, string][] = [
  [/emerald|green|sage|olive|mint|teal/i, "#11775F"],
  [/cobalt|royal blue/i, "#2F54EB"],
  [/sky indigo|sky/i, "#5B7BC4"],
  [/deep indigo|indigo/i, "#27306B"],
  [/navy/i, "#1F2A4D"],
  [/terracotta|rust|coral|brick/i, "#B85C3C"],
  [/wine|burgundy|berry/i, "#6E1F33"],
  [/champagne|oat|nude|camel|tan|beige|stone/i, "#D9C3A0"],
  [/ivory|cream|white|pearl|natural/i, "#EFE9DD"],
  [/gold|mustard/i, "#C79A3A"],
  [/sand/i, "#CDB892"],
  [/charcoal|graphite|grey|gray|silver/i, "#3A3F47"],
  [/onyx|midnight|black|stealth/i, "#1A1D24"],
  [/pink|blush|rose|lilac|lavender/i, "#C9689A"],
  [/blue/i, "#3867D6"],
];

export function colourHex(name: string | undefined | null): string | null {
  if (!name) return null;
  for (const [re, hex] of COLOUR_HEX) if (re.test(name)) return hex;
  return null;
}
