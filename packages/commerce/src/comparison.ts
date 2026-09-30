/**
 * Side-by-side facts for 2–4 products, from catalog data only. A spec a
 * product doesn't list is shown as "not listed" — never filled in.
 */
import type { ProductCardData } from "./types";

export interface ComparisonRow {
  key: string;
  label: string;
  /** One value per product, in order; null = not listed. */
  values: (string | null)[];
  /** True when the listed values are not all the same. */
  differs: boolean;
}

export interface ComparisonFacts {
  rows: ComparisonRow[];
  /** Specs the customer asked about that none of these products list. */
  notListed: string[];
}

const label = (k: string) => k.replace(/[_-]+/g, " ").replace(/^\w/, (c) => c.toUpperCase());
const norm = (v: string | string[] | undefined) => (v == null ? null : Array.isArray(v) ? v.join(", ") : String(v));

/** Option axes (colour, size, storage…) with their values, e.g. "storage: 64 GB, 128 GB". */
function optionAxes(p: ProductCardData): Record<string, string> {
  const axes: Record<string, Set<string>> = {};
  for (const v of p.variants) for (const [k, val] of Object.entries(v.options)) (axes[k] ??= new Set()).add(val);
  return Object.fromEntries(Object.entries(axes).map(([k, s]) => [k, [...s].join(", ")]));
}

/**
 * @param focus optional spec names to keep ("battery", "weight"); matched loosely against attribute keys.
 */
export function compareFacts(products: ProductCardData[], focus: string[] = []): ComparisonFacts {
  const keys: string[] = [];
  for (const p of products) for (const k of Object.keys(p.attributes)) if (!keys.includes(k)) keys.push(k);
  const axisKeys: string[] = [];
  for (const p of products) for (const k of Object.keys(optionAxes(p))) if (!axisKeys.includes(k)) axisKeys.push(k);

  const f = focus.map((x) => x.toLowerCase().trim()).filter(Boolean);
  const wanted = (k: string) => !f.length || f.some((w) => k.toLowerCase().includes(w) || w.includes(k.toLowerCase()));

  const rows: ComparisonRow[] = [];
  const push = (key: string, lbl: string, values: (string | null)[]) => {
    const listed = values.filter((v): v is string => v != null);
    rows.push({ key, label: lbl, values, differs: new Set(listed.map((v) => v.toLowerCase())).size > 1 || listed.length !== values.length });
  };
  for (const k of keys.filter(wanted)) push(k, label(k), products.map((p) => norm(p.attributes[k])));
  for (const k of axisKeys.filter(wanted)) push(`options.${k}`, `${label(k)} options`, products.map((p) => optionAxes(p)[k] ?? null));

  const known = [...keys, ...axisKeys].map((k) => k.toLowerCase());
  const notListed = f.filter((w) => !known.some((k) => k.includes(w) || w.includes(k)));
  // Asked about but listed by none: say so in the table too, rather than leaving it out.
  for (const w of notListed) rows.push({ key: w, label: label(w), values: products.map(() => null), differs: false });
  return { rows, notListed };
}
