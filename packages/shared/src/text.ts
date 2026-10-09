/** Normalise a free-text value for comparison / dedup ("  Dark  Colours " → "dark colours"). */
export function normalizeValue(value: string): string {
  return value
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[“”"'`’]/g, "")
    .replace(/[^\p{L}\p{N}\s.,/&+-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Normalise a memory subject key: "Colour Style" → "colour_style". */
export function normalizeSubject(subject: string): string {
  return subject
    .normalize("NFKC")
    .toLowerCase()
    .replace(/colou?r/g, "colour")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
}

export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

/** Internal memory refs ("[M3]", "[B1]") are for tools only — never show them to a customer. */
export function stripMemoryRefs(text: string): string {
  return text.replace(/ ?\[(?:M|B)\d{1,3}\](?:\s?,\s?\[(?:M|B)\d{1,3}\])*/g, "");
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
}

export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** Greeting by local hour in the merchant's timezone. */
export function greetingFor(date: Date, timeZone = "UTC"): string {
  let hour = date.getUTCHours();
  try {
    hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone }).format(date));
  } catch {
    /* fall back to UTC */
  }
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export function formatDateTime(
  date: Date | string,
  { locale = "en-GB", timeZone, withTime = true }: { locale?: string; timeZone?: string; withTime?: boolean } = {},
): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
    ...(timeZone ? { timeZone } : {}),
  }).format(d);
}

export function formatRelative(date: Date | string, now: Date = new Date()): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = (d.getTime() - now.getTime()) / 1000;
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (abs < 60) return rtf.format(Math.round(diff), "second");
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  if (abs < 86400 * 30) return rtf.format(Math.round(diff / 86400), "day");
  if (abs < 86400 * 365) return rtf.format(Math.round(diff / (86400 * 30)), "month");
  return rtf.format(Math.round(diff / (86400 * 365)), "year");
}

const phrase = (s: string) => ` ${s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim()} `;

/**
 * The one product a message is about, when it names it ("Tell me more about the
 * Vanilla Celebration Cake"): the product whose full name appears in any of the
 * texts, preferring the longest name, so "Vanilla Celebration Cake" wins over
 * "Celebration Cake". General searches ("cakes for a birthday") name none → null.
 */
export function namedProduct<T extends { id: string; name: string }>(products: T[], texts: (string | null | undefined)[]): T | null {
  const haystacks = texts.filter((t): t is string => Boolean(t && t.trim())).map(phrase);
  let best: T | null = null;
  for (const p of products) {
    const name = phrase(p.name);
    if (name.trim().length < 3 || !haystacks.some((h) => h.includes(name))) continue;
    if (!best || name.length > phrase(best.name).length) best = p;
  }
  return best;
}
