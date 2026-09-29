/**
 * Build the landing page's scene artwork from the originals in brand/landing/.
 *   pnpm brand:landing
 *
 * Each scene has a stable name, so a new picture can replace one by pointing
 * its entry at a different source file. Output: apps/web/public/landing/*.webp
 * (≤ 1600 px wide; next/image serves smaller sizes from these).
 */
import sharp from "sharp";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const src = path.join(root, "brand/landing");
const out = path.join(root, "apps/web/public/landing");
mkdirSync(out, { recursive: true });

/** Scene name → source file (see brand/README.md for what each scene shows). */
const SCENES: Record<string, string> = {
  hero: "000_10D0FCAF-6398-414F-A2FE-B072D1362FC0.jpg", // full body, peace sign, memory orb, device
  remembers: "001_013D68B7-058F-4CCB-A3F5-2426DDAAD547.jpg", // confused bot vs Nia with the right product
  "memory-orb": "002_92B43A00-7F4F-4DBB-8A1C-0D62DB91DEA6.jpg", // holding a glowing memory orb
  businesses: "003_EB088C3A-BDA3-4FA0-A76F-CF8D3E07BEB4.jpg", // fashion, beauty, electronics, food, home, bookings
  telegram: "003_084BC3FE-FE1B-46E2-B2C7-64F7202006AE.jpg", // winking with a phone
  dashboard: "004_6D31E8E8-0C02-4396-903C-1847F0BD9A0F.jpg", // merchant dashboard on a laptop
  market: "004_79358D62-AC30-4479-9F2A-857303A58581.jpg", // in a shop with bags
  cta: "005_5FCE3601-9FFB-4970-B529-2DF319BB1D72.jpg", // peace sign under a bright arch
};

/** Small crops for UI (fractions of the source's width/height). */
const CROPS: Record<string, { file: string; left: number; top: number; size: number; px: number }> = {
  // Back-to-top button: face and the raised peace-sign paw, which reads as "up".
  "back-to-top": { file: SCENES.hero!, left: 0.12, top: 0, size: 0.574, px: 256 },
};

for (const [name, c] of Object.entries(CROPS)) {
  const input = path.join(src, c.file);
  const meta = await sharp(input).metadata();
  const side = Math.round(meta.width! * c.size);
  const info = await sharp(input)
    .extract({ left: Math.round(meta.width! * c.left), top: Math.round(meta.height! * c.top), width: side, height: side })
    .resize(c.px, c.px, { kernel: "lanczos3" })
    .webp({ quality: 86 })
    .toFile(path.join(out, `nia-${name}.webp`));
  console.log(`✓ nia-${name}.webp  ${info.width}×${info.height}  ${Math.round(info.size / 1024)} KB`);
}

/**
 * Floating product objects for the Telegram orbit scene: boxes in source
 * pixels, softened at the edges so the object floats with a glow, not a square.
 */
const OBJECTS: Record<string, { file: string; box: { left: number; top: number; width: number; height: number }; px: number }> = {
  bag: { file: "002_BEF57865-86BF-4CF5-9D07-AB3B941CD628.jpg", box: { left: 605, top: 80, width: 300, height: 325 }, px: 340 },
  sneaker: { file: "001_013D68B7-058F-4CCB-A3F5-2426DDAAD547.jpg", box: { left: 1090, top: 340, width: 310, height: 210 }, px: 380 },
  beauty: { file: "003_EB088C3A-BDA3-4FA0-A76F-CF8D3E07BEB4.jpg", box: { left: 380, top: 92, width: 240, height: 200 }, px: 320 },
  headphones: { file: "003_EB088C3A-BDA3-4FA0-A76F-CF8D3E07BEB4.jpg", box: { left: 762, top: 100, width: 205, height: 215 }, px: 290 },
};

for (const [name, o] of Object.entries(OBJECTS)) {
  const width = o.px;
  const height = Math.round((o.px * o.box.height) / o.box.width);
  const feather = Buffer.from(
    `<svg width="${width}" height="${height}"><defs><radialGradient id="f" cx="50%" cy="50%" r="50%"><stop offset="0.6" stop-color="#fff" stop-opacity="1"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><ellipse cx="${width / 2}" cy="${height / 2}" rx="${width / 2}" ry="${height / 2}" fill="url(#f)"/></svg>`,
  );
  const info = await sharp(path.join(src, o.file))
    .extract(o.box)
    .resize(width, height, { kernel: "lanczos3" })
    .ensureAlpha()
    .composite([{ input: feather, blend: "dest-in" }])
    .webp({ quality: 86, alphaQuality: 90 })
    .toFile(path.join(out, `orbit-${name}.webp`));
  console.log(`✓ orbit-${name}.webp  ${info.width}×${info.height}  ${Math.round(info.size / 1024)} KB`);
}

for (const [name, file] of Object.entries(SCENES)) {
  const input = path.join(src, file);
  if (!existsSync(input)) throw new Error(`Missing brand/landing/${file} (scene "${name}")`);
  const info = await sharp(input).rotate().resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 82, effort: 6 }).toFile(path.join(out, `nia-${name}.webp`));
  console.log(`✓ nia-${name}.webp  ${info.width}×${info.height}  ${Math.round(info.size / 1024)} KB`);
}
