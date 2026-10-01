/**
 * Build every brand asset from the mascot artwork.
 *   pnpm brand:icons
 *
 * Source: brand/nia-mascot.(png|jpg|jpeg|webp) — square artwork, ideally ≥ 1024 px.
 * Output: apps/web/public/brand/ (mascot sizes, full art, favicons, app icons,
 * Telegram avatar, social card).
 *
 * Small sizes use a tight crop on the face (visor, eyes, tusks) so the mascot
 * still reads at 32 px; large placements use the full artwork.
 */
import sharp from "sharp";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "apps/web/public/brand");
mkdirSync(out, { recursive: true });

const source = ["png", "jpg", "jpeg", "webp"].map((ext) => path.join(root, "brand", `nia-mascot.${ext}`)).find(existsSync);
if (!source) throw new Error("Put the mascot artwork at brand/nia-mascot.png (or .jpg / .webp).");

const meta = await sharp(source).metadata();
const side = Math.min(meta.width!, meta.height!);
/** Face crop as fractions of the artwork (tuned for the current art: visor → tusks). */
const FACE = { left: 0.239, top: 0.136, size: 0.574 };
const face = { left: Math.round(side * FACE.left), top: Math.round(side * FACE.top), width: Math.round(side * FACE.size), height: Math.round(side * FACE.size) };
/** Wider head-and-hair crop for the Telegram avatar (Telegram shows it as a circle). */
const HEAD = { left: 0.2, top: 0.096, size: 0.686 };
const head = { left: Math.round(side * HEAD.left), top: Math.round(side * HEAD.top), width: Math.round(side * HEAD.size), height: Math.round(side * HEAD.size) };

const art = () => sharp(source).resize(side, side, { fit: "cover" });
const faceAt = (px: number) => sharp(source).extract(face).resize(px, px, { kernel: "lanczos3" });
/** Palette PNGs keep icons small (a 512 px truecolor PNG of this art is ~700 KB). */
const iconPng = { compressionLevel: 9, palette: true, quality: 92, effort: 10 } as const;

// Mascot (UI) — face crop in the sizes the component asks for.
for (const px of [96, 192, 384]) await faceAt(px).webp({ quality: 86 }).toFile(path.join(out, `nia-mascot-${px}.webp`));
// Full artwork for large placements (hero, sign-in).
for (const px of [640, 1200]) await art().resize(Math.min(px, side), Math.min(px, side)).webp({ quality: 84 }).toFile(path.join(out, `nia-art-${px}.webp`));

// Icons.
await faceAt(512).png(iconPng).toFile(path.join(out, "nia-icon-512.png"));
await faceAt(192).png(iconPng).toFile(path.join(out, "nia-icon-192.png"));
await faceAt(180).png(iconPng).toFile(path.join(out, "apple-touch-icon.png"));
await faceAt(32).png(iconPng).toFile(path.join(out, "nia-icon-32.png"));

// favicon.ico with PNG-encoded 16/32/48 px images (supported by every current browser).
const icoSizes = [16, 32, 48];
const pngs = await Promise.all(icoSizes.map((px) => faceAt(px).png().toBuffer()));
const header = Buffer.alloc(6 + 16 * pngs.length);
header.writeUInt16LE(0, 0);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(pngs.length, 4);
let offset = header.length;
pngs.forEach((png, i) => {
  const e = 6 + i * 16;
  header.writeUInt8(icoSizes[i]!, e);
  header.writeUInt8(icoSizes[i]!, e + 1);
  header.writeUInt8(0, e + 2);
  header.writeUInt8(0, e + 3);
  header.writeUInt16LE(1, e + 4);
  header.writeUInt16LE(32, e + 6);
  header.writeUInt32LE(png.length, e + 8);
  header.writeUInt32LE(offset, e + 12);
  offset += png.length;
});
writeFileSync(path.join(root, "apps/web/public/favicon.ico"), Buffer.concat([header, ...pngs]));

// Telegram bot photo (upload via @BotFather → /setuserpic; the Bot API can't set it).
await sharp(source).extract(head).resize(640, 640).jpeg({ quality: 90 }).toFile(path.join(out, "nia-telegram-avatar.jpg"));

// Social card 1200×630: the artwork on a wash of its own colours.
const wash = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#9fb8fc"/><stop offset="0.55" stop-color="#c7b6f7"/><stop offset="1" stop-color="#f5c3e6"/></linearGradient>
    <radialGradient id="r" cx="0.3" cy="0.4" r="0.6"><stop offset="0" stop-color="#6bdee6" stop-opacity="0.55"/><stop offset="1" stop-color="#6bdee6" stop-opacity="0"/></radialGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#g)"/><rect width="1200" height="630" fill="url(#r)"/>
  <g font-family="Segoe UI, Helvetica Neue, Arial, sans-serif" fill="#1b1a4b">
    <text x="64" y="250" font-size="120" font-weight="800" letter-spacing="-3">Nia</text>
    <text x="68" y="320" font-size="38" font-weight="600">The shop assistant who</text>
    <text x="68" y="368" font-size="38" font-weight="600">remembers your customers</text>
    <text x="68" y="448" font-size="26" font-weight="500" fill="#3b3a73">Web + Telegram · Memory on Walrus</text>
  </g>
</svg>`);
const artCard = await art().resize(630, 630).png().toBuffer();
await sharp(wash).composite([{ input: artCard, left: 570, top: 0 }]).jpeg({ quality: 86 }).toFile(path.join(out, "nia-og.jpg"));

// Demo-checkout celebration (Telegram sends it with a confetti effect): the artwork, confetti, "Thank you!".
const confettiColours = ["#5352e0", "#086a82", "#177a53", "#f5b544", "#ffffff", "#e0559d"];
const confetti = Array.from({ length: 46 }, (_, i) => {
  // Deterministic scatter around the edges, leaving the face clear.
  const a = (i * 137.5 * Math.PI) / 180;
  const r = 300 + ((i * 53) % 90);
  const x = Math.round(400 + Math.cos(a) * r);
  const y = Math.round(380 + Math.sin(a) * r * 0.95);
  const c = confettiColours[i % confettiColours.length];
  return i % 3 === 0
    ? `<circle cx="${x}" cy="${y}" r="${7 + (i % 4)}" fill="${c}" stroke="#ffffff" stroke-width="2"/>`
    : `<rect x="${x}" y="${y}" width="${12 + (i % 5) * 2}" height="${22 + (i % 4) * 3}" rx="3" fill="${c}" stroke="#ffffff" stroke-width="2" transform="rotate(${(i * 47) % 180} ${x} ${y})"/>`;
}).join("");
const celebrateOverlay = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800">
  ${confetti}
  <rect x="230" y="676" width="340" height="84" rx="42" fill="#ffffff" fill-opacity="0.94"/>
  <text x="400" y="733" text-anchor="middle" font-family="Segoe UI, Helvetica Neue, Arial, sans-serif" font-size="44" font-weight="800" fill="#1b1a4b">Thank you!</text>
</svg>`);
await art().resize(800, 800).composite([{ input: celebrateOverlay }]).jpeg({ quality: 86 }).toFile(path.join(out, "nia-celebrate.jpg"));

// Retire assets of the previous (SVG) mascot.
for (const old of ["nia-icon.svg", "nia-mascot.svg", "mascot-states.png", "nia-telegram-avatar.png"]) rmSync(path.join(out, old), { force: true });

console.log(`✓ Brand assets from ${path.relative(root, source)} (${meta.width}×${meta.height}) → apps/web/public/brand/`);
