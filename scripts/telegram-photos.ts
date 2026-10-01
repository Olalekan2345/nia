/**
 * JPEG copies of the catalog photos for Telegram.
 *   pnpm market:tg-photos
 *
 * The catalog photos in apps/web/public/stock are mostly WebP, which Telegram's
 * sendPhoto doesn't reliably accept by URL. This writes a JPEG twin of each one
 * to apps/web/public/stock/tg/<name>.jpg (≤ 800 px), which the bot links to.
 * Idempotent: existing, newer twins are kept. Run it after `pnpm market:images`.
 */
import sharp from "sharp";
import { existsSync, mkdirSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const stock = path.join(root, "apps/web/public/stock");
const out = path.join(stock, "tg");
mkdirSync(out, { recursive: true });

let made = 0;
let kept = 0;
for (const file of readdirSync(stock)) {
  if (!file.endsWith(".webp")) continue;
  const src = path.join(stock, file);
  const dest = path.join(out, file.replace(/\.webp$/, ".jpg"));
  if (existsSync(dest) && statSync(dest).mtimeMs >= statSync(src).mtimeMs) {
    kept++;
    continue;
  }
  await sharp(src).resize(800, 800, { fit: "inside", withoutEnlargement: true }).flatten({ background: "#ffffff" }).jpeg({ quality: 80, mozjpeg: true }).toFile(dest);
  made++;
}
console.log(`✓ Telegram photos: ${made} written, ${kept} up to date → apps/web/public/stock/tg/`);
