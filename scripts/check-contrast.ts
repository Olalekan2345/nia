/**
 * WCAG contrast check for the colour tokens in apps/web/app/globals.css.
 *   pnpm exec tsx scripts/check-contrast.ts
 * Text pairs need 4.5:1; the chart colour needs 3:1 against surfaces.
 */
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../apps/web/app/globals.css", import.meta.url), "utf8");
const block = (start: string) => {
  const i = css.indexOf(start);
  return css.slice(i, css.indexOf("}", i));
};
const tokens = (text: string) => Object.fromEntries([...text.matchAll(/--([a-z0-9-]+):\s*(#[0-9a-f]{6})/gi)].map((m) => [m[1]!, m[2]!]));
const themes = { light: tokens(block(":root {\n  color-scheme: light;")), dark: tokens(block(':root:not([data-theme="light"]) {')) };

const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
};
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x! + 0.05) / (y! + 0.05);
};

const TEXT: [string, string][] = [
  ["foreground", "background"],
  ["foreground", "surface"],
  ["muted-foreground", "background"],
  ["muted-foreground", "surface"],
  ["muted-foreground", "surface-2"],
  ["primary-foreground", "primary"],
  ["accent-foreground", "accent"],
  ["accent-strong", "background"],
  ["accent-strong", "surface"],
  ["accent-strong", "accent-soft"],
  ["memory", "memory-soft"],
  ["memory", "surface"],
  ["success", "success-soft"],
  ["warning", "warning-soft"],
  ["danger", "danger-soft"],
  ["info", "info-soft"],
];
const GRAPHIC: [string, string][] = [
  ["chart-1", "surface"],
  ["ring", "background"],
];

let failures = 0;
for (const [name, t] of Object.entries(themes)) {
  for (const [pairs, min] of [
    [TEXT, 4.5],
    [GRAPHIC, 3],
  ] as const) {
    for (const [fg, bg] of pairs) {
      const r = ratio(t[fg]!, t[bg]!);
      const ok = r >= min;
      if (!ok) failures++;
      console.log(`${ok ? "✓" : "✗"} ${name.padEnd(5)} ${`${fg} on ${bg}`.padEnd(36)} ${r.toFixed(2)}:1 ${ok ? "" : `(needs ${min}:1)`}`);
    }
  }
}
process.exitCode = failures ? 1 : 0;
