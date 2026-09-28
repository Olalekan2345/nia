/**
 * Render static brand assets from the mascot SVG source.
 *   pnpm brand:icons
 * Outputs to apps/web/public/brand/.
 */
import { Resvg } from "@resvg/resvg-js";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { MASCOT_STATES, mascotSvg } from "../packages/ui/src/mascot-svg";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "apps/web/public/brand");
mkdirSync(out, { recursive: true });

function png(svg: string, size: number, file: string) {
  const r = new Resvg(svg, { fitTo: { mode: "width", value: size }, background: "rgba(0,0,0,0)" });
  writeFileSync(path.join(out, file), r.render().asPng());
}

// Telegram bot profile photo: square, mascot on the brand background (Telegram crops to a circle).
png(mascotSvg({ id: "tg", background: true, state: "greeting" }), 640, "nia-telegram-avatar.png");
png(mascotSvg({ id: "icon", background: true }), 512, "nia-icon-512.png");
png(mascotSvg({ id: "icon", background: true }), 192, "nia-icon-192.png");
png(mascotSvg({ id: "apple", background: true }), 180, "apple-touch-icon.png");
writeFileSync(path.join(out, "nia-mascot.svg"), mascotSvg({ id: "static" }));
writeFileSync(path.join(out, "nia-icon.svg"), mascotSvg({ id: "fav", background: true }));

// Contact sheet of every state (for design review).
const cols = 3;
const cell = 240;
const sheet = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${cols * cell} ${Math.ceil(MASCOT_STATES.length / cols) * cell}">
<rect width="100%" height="100%" fill="#F7F6F2"/>
${MASCOT_STATES.map((s, i) => `<g transform="translate(${(i % cols) * cell} ${Math.floor(i / cols) * cell})">${mascotSvg({ id: `s${i}`, state: s }).replace(/<svg[^>]*>/, "").replace("</svg>", "")}<text x="120" y="232" text-anchor="middle" font-family="sans-serif" font-size="13" fill="#5B6472">${s}</text></g>`).join("\n")}
</svg>`;
png(sheet, 1080, "mascot-states.png");
console.log(`✓ Brand icons written to ${path.relative(root, out)}`);
