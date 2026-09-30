import "server-only";
import credits from "@/public/stock/credits.json";

interface Credit {
  title: string;
  source: string;
  author?: string | null;
  license: string;
  provider?: string;
}

const CREDITS = credits as Record<string, Credit>;

/** Credit line for a bundled demo photo (/stock/<slug>.jpg|webp), or null for merchant uploads and links. */
export function stockCredit(image: string | null | undefined): { text: string; href: string } | null {
  const m = image?.match(/^\/stock\/([a-z0-9-]+)\.(jpg|webp)$/);
  if (!m) return null;
  const c = CREDITS[m[1]!];
  if (!c) return null;
  const site = c.provider?.startsWith("Openverse") ? c.provider.replace("Openverse · ", "") : c.provider === "Pexels" ? "Pexels" : /burst\.shopify/.test(c.source) ? "Burst" : "free stock";
  const who = c.author && !/burst/i.test(site) ? `${c.author} on ${site}` : site;
  return { text: `Illustrative photo: ${who} (${c.license.replace(" (free for commercial use)", "")})`, href: c.source };
}
