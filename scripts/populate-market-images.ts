/**
 * Find and store photos for the demo catalog (development-time only — shoppers
 * never trigger an image search).
 *   pnpm market:images                       # Openverse (no key needed), items without a photo
 *   pnpm market:images -- --provider pexels  # Pexels (needs PEXELS_API_KEY in .env)
 *   pnpm market:images -- --only slug-a,slug-b --force
 *   pnpm market:images -- --dry-run          # show what would be fetched
 *
 * Sources and licences:
 * - Openverse (api.openverse.org), limited to CC0 photos from StockSnap and
 *   rawpixel: no copyright restrictions and no attribution required.
 * - Pexels (api.pexels.com): the Pexels licence (free to use, attribution
 *   appreciated).
 * Photos showing a brand name in their title or tags are skipped, so a
 * generic demo product is never pictured as a real branded one. Review the
 * result by eye: for a photo that doesn't show the product, add its source URL
 * to scripts/market-images-rejected.json, delete its .webp and credits entry,
 * and run again — the next candidate (or the next photoQuery phrase) is tried.
 *
 * Output: apps/web/public/stock/<slug>.webp (square, ≤ 800 px), credits in
 * apps/web/public/stock/credits.json, and the seed manifest
 * packages/database/src/catalog/photos.ts. Then run `pnpm db:seed` to attach
 * photos to already-seeded products (it only fills empty image lists).
 */
import sharp from "sharp";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { DEMO_TEMPLATES } from "../packages/database/src/demo-templates";
import { CATALOG_PHOTOS } from "../packages/database/src/catalog/photos";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
config({ path: path.join(root, ".env"), quiet: true });
const STOCK = path.join(root, "apps/web/public/stock");
const CREDITS = path.join(STOCK, "credits.json");
const MANIFEST = path.join(root, "packages/database/src/catalog/photos.ts");
const CACHE = path.join(root, ".cache/market-images");
/** Photos a person reviewed and turned down (wrong subject, a brand, a graphic): never picked again. */
const REJECTED = path.join(root, "scripts/market-images-rejected.json");
mkdirSync(CACHE, { recursive: true });

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const value = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const provider = (value("provider") ?? "openverse") as "openverse" | "pexels";
const only = value("only")?.split(",").map((s) => s.trim()).filter(Boolean);
const force = flag("force");
const dryRun = flag("dry-run");
const UA = "NiaCatalogImport/1.0 (+https://github.com/Olalekan2345/nia)";

/** Photo candidates never used: brands and trade dress, cut-outs and graphics. */
const BRANDS =
  /\b(apple|iphone|ipad|macbook|imac|airpods|samsung|galaxy|google|pixel|huawei|xiaomi|oppo|tecno|infinix|nokia|sony|playstation|xbox|nintendo|dell|lenovo|asus|acer|hp|microsoft|surface|logitech|bose|beats|jbl|nike|adidas|puma|reebok|converse|vans|gucci|chanel|dior|prada|zara|louis vuitton|coca|coke|pepsi|fanta|sprite|red ?bull|monster|starbucks|nescafe|nestle|heinz|kellogg|mcdonald|kfc|domino|ikea|canon|nikon|fitbit|garmin|amazon|kindle|alexa)\b/i;
const NOT_PHOTOS = /\b(png|sticker|mockup|mock-up|vector|illustration|illustrated|psd|template|logo|clipart|clip art|icon|drawing|cartoon|render|sketch|element|collage|transparent|vintage|antique|engraving|etching|lithograph|woodcut|painting|poster|advertisement|victorian|public domain|historical|century)\b/i;

interface Candidate {
  id: string;
  url: string;
  width: number;
  height: number;
  title: string;
  author: string | null;
  landing: string;
  license: string;
  licenseUrl: string | null;
  source: string;
}
interface Credit {
  title: string;
  source: string;
  author?: string | null;
  license: string;
  licenseUrl?: string | null;
  provider?: string;
  file?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let lastCall = 0;
class RateLimited extends Error {}

async function throttle(minGapMs: number) {
  const wait = lastCall + minGapMs - Date.now();
  if (wait > 0) await sleep(wait);
  lastCall = Date.now();
}

function cacheFile(query: string) {
  return path.join(CACHE, `${provider}-${query.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 80)}.json`);
}

async function searchOpenverse(query: string): Promise<Candidate[]> {
  await throttle(3_200); // anonymous limit: 20 requests / minute
  const url = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(query)}&license=cc0,pdm&source=stocksnap,rawpixel&page_size=20&mature=false`;
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: "application/json" } });
  // 429 = per-minute limit, 401/403 = the anonymous daily quota: stop and keep progress either way.
  if (res.status === 429 || res.status === 401 || res.status === 403) throw new RateLimited(`Openverse limit reached (HTTP ${res.status}).`);
  if (!res.ok) throw new Error(`Openverse ${res.status}`);
  const body = (await res.json()) as { results: { id: string; url: string; width: number | null; height: number | null; title: string | null; creator: string | null; foreign_landing_url: string; license: string; license_url: string | null; source: string; tags?: { name: string }[] }[] };
  return body.results.map((r) => ({
    id: `openverse:${r.id}`,
    url: r.url,
    width: r.width ?? 0,
    height: r.height ?? 0,
    title: [r.title ?? "", ...(r.tags ?? []).map((t) => t.name)].join(" | "),
    author: r.creator,
    landing: r.foreign_landing_url,
    license: r.license.toUpperCase() === "PDM" ? "Public Domain Mark" : "CC0 1.0",
    licenseUrl: r.license_url,
    source: r.source === "stocksnap" ? "StockSnap" : r.source === "rawpixel" ? "rawpixel" : r.source,
  }));
}

async function searchPexels(query: string): Promise<Candidate[]> {
  const key = process.env.PEXELS_API_KEY;
  if (!key) throw new Error("PEXELS_API_KEY is not set in .env");
  await throttle(1_000);
  const res = await fetch(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=20&orientation=square`, { headers: { Authorization: key, "User-Agent": UA } });
  if (res.status === 429) throw new RateLimited("Pexels rate limit reached.");
  if (!res.ok) throw new Error(`Pexels ${res.status}`);
  const body = (await res.json()) as { photos: { id: number; width: number; height: number; alt: string; photographer: string; url: string; src: { large: string } }[] };
  return body.photos.map((p) => ({
    id: `pexels:${p.id}`,
    url: p.src.large,
    width: p.width,
    height: p.height,
    title: p.alt ?? "",
    author: p.photographer,
    landing: p.url,
    license: "Pexels License",
    licenseUrl: "https://www.pexels.com/license/",
    source: "Pexels",
  }));
}

async function search(query: string): Promise<Candidate[]> {
  const file = cacheFile(query);
  if (existsSync(file)) return JSON.parse(readFileSync(file, "utf8")) as Candidate[];
  const results = provider === "pexels" ? await searchPexels(query) : await searchOpenverse(query);
  writeFileSync(file, JSON.stringify(results, null, 1));
  return results;
}

function usable(c: Candidate): boolean {
  if (BRANDS.test(c.title) || NOT_PHOTOS.test(c.title)) return false;
  if (c.width && c.width < 900) return false;
  if (c.width && c.height) {
    const ratio = c.width / c.height;
    if (ratio < 0.6 || ratio > 1.8) return false;
  }
  return /^https:\/\//.test(c.url);
}

async function download(url: string): Promise<Buffer> {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return Buffer.from(await res.arrayBuffer());
  } catch {
    // Some CDNs refuse Node's fetch; curl is on every dev machine we support.
    return execFileSync("curl", ["-sfL", "--max-time", "40", "-A", UA, url], { maxBuffer: 30 * 1024 * 1024 });
  }
}

async function store(slug: string, image: Buffer): Promise<void> {
  const meta = await sharp(image).metadata();
  const side = Math.min(800, meta.width ?? 800, meta.height ?? 800);
  await sharp(image).rotate().resize(side, side, { fit: "cover", position: sharp.strategy.attention }).webp({ quality: 80 }).toFile(path.join(STOCK, `${slug}.webp`));
}

function writeManifest(credits: Record<string, Credit>) {
  const entries = Object.keys(credits)
    .filter((slug) => existsSync(path.join(STOCK, `${slug}.webp`)))
    .sort()
    .map((slug) => `  ${JSON.stringify(slug)}: ${JSON.stringify(`/stock/${slug}.webp`)},`);
  writeFileSync(
    MANIFEST,
    `/**
 * Catalog photos imported by \`pnpm market:images\` (scripts/populate-market-images.ts).
 * Generated — do not edit by hand. slug → public path under apps/web/public/stock.
 * Sources, authors and licences are recorded in apps/web/public/stock/credits.json.
 */
export const CATALOG_PHOTOS: Record<string, string> = {
${entries.join("\n")}
};
`,
  );
}

/** photoQuery is one phrase or several to try in order; without one, the name and category. */
function queriesOf(photoQuery: string | string[] | undefined, fallback: string): string[] {
  const list = Array.isArray(photoQuery) ? photoQuery : [photoQuery ?? fallback];
  return list.map((q) => q.toLowerCase().trim()).filter(Boolean);
}

async function main() {
  const credits = JSON.parse(readFileSync(CREDITS, "utf8")) as Record<string, Credit>;
  const rejected = existsSync(REJECTED) ? ((JSON.parse(readFileSync(REJECTED, "utf8")) as { sources?: string[] }).sources ?? []) : [];
  const used = new Set([...Object.values(credits).map((c) => c.source), ...rejected]);

  // Every demo product and service; the original Burst photos (.jpg) count as done.
  const items = Object.values(DEMO_TEMPLATES).flatMap((t) => [
    ...t.products.map((p) => ({ slug: p.slug, queries: queriesOf(p.photoQuery, `${p.name} ${p.category}`) })),
    ...t.services.map((s) => ({ slug: s.slug, queries: queriesOf(s.photoQuery, s.name) })),
  ]);
  const todo = items.filter((i) => (only ? only.includes(i.slug) : true) && (force || (!CATALOG_PHOTOS[i.slug] && !existsSync(path.join(STOCK, `${i.slug}.jpg`)) && !existsSync(path.join(STOCK, `${i.slug}.webp`)))));
  console.log(`${todo.length} item(s) need a photo · provider: ${provider}${dryRun ? " · dry run" : ""}`);
  if (dryRun) {
    for (const i of todo) console.log(`  ${i.slug.padEnd(38)} ${i.queries.map((q) => `"${q}"`).join(" → ")}`);
    return;
  }

  // One search per distinct phrase (cached); items sharing a phrase get different photos.
  // Each item tries its phrases in order until one yields a usable photo.
  const pools = new Map<string, Candidate[]>();
  const pool = async (query: string) => {
    if (!pools.has(query)) pools.set(query, (await search(query)).filter(usable));
    return pools.get(query)!;
  };

  let found = 0;
  const missing: string[] = [];
  try {
    for (const { slug, queries } of todo) {
      let done = false;
      for (const query of queries) {
        const candidates = await pool(query);
        while (!done) {
          const next = candidates.findIndex((c) => !used.has(c.landing));
          if (next < 0) break;
          const c = candidates.splice(next, 1)[0]!;
          try {
            await store(slug, await download(c.url));
            credits[slug] = { title: c.title.split(" | ")[0] || query, source: c.landing, author: c.author, license: c.license, licenseUrl: c.licenseUrl, provider: provider === "openverse" ? `Openverse · ${c.source}` : "Pexels", file: `${slug}.webp` };
            used.add(c.landing);
            found++;
            done = true;
            console.log(`✓ ${slug.padEnd(38)} ${c.source} · ${c.title.split(" | ")[0]?.slice(0, 50)}`);
          } catch (err) {
            console.warn(`  skipped a photo for ${slug}: ${(err as Error).message.slice(0, 80)}`);
          }
        }
        if (done) break;
      }
      if (!done) {
        missing.push(slug);
        console.log(`· ${slug.padEnd(38)} no suitable photo for ${queries.map((q) => `"${q}"`).join(" / ")} (keeps its generated artwork)`);
      }
      writeFileSync(CREDITS, `${JSON.stringify(credits, null, 2)}\n`);
      writeManifest(credits);
    }
  } catch (err) {
    if (!(err instanceof RateLimited)) throw err;
    console.warn(`\n${err.message} Progress is saved — run the same command again later to continue.`);
  }
  writeFileSync(CREDITS, `${JSON.stringify(credits, null, 2)}\n`);
  writeManifest(credits);
  console.log(`\nDone: ${found} photo(s) added${missing.length ? `, ${missing.length} without a match: ${missing.join(", ")}` : ""}.`);
  console.log("Next: pnpm db:seed (attaches photos to seeded products that have none).");
}

await main();
