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

for (const [name, file] of Object.entries(SCENES)) {
  const input = path.join(src, file);
  if (!existsSync(input)) throw new Error(`Missing brand/landing/${file} (scene "${name}")`);
  const info = await sharp(input).rotate().resize({ width: 1600, withoutEnlargement: true }).webp({ quality: 82, effort: 6 }).toFile(path.join(out, `nia-${name}.webp`));
  console.log(`✓ nia-${name}.webp  ${info.width}×${info.height}  ${Math.round(info.size / 1024)} KB`);
}
