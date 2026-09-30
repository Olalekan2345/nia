/**
 * Nia turn trace for the shop's own team and developers: what Nia understood
 * (tool inputs = structured intent), which tools ran, how many real results
 * came back, cart changes and memory writes. Derived from the stored message
 * parts; never shown to shoppers.
 */

type Part = { type: string; input?: Record<string, unknown>; output?: Record<string, unknown> & { ok?: boolean; error?: string; code?: string }; data?: { receipts?: { label: string; status: string }[] } };

export interface TraceStep {
  tool: string;
  input: string;
  outcome: string;
  ok: boolean;
}

const INPUT_KEYS = ["query", "category", "goal", "maxBudget", "minBudget", "budget", "people", "colour", "size", "exclude", "prefer", "forWhom", "occasion", "topic", "quantity", "focus", "cheaper", "fromOrderId", "method", "deliveryArea"];

function summariseInput(input: Record<string, unknown> | undefined): string {
  if (!input) return "";
  const parts = INPUT_KEYS.filter((k) => input[k] != null && input[k] !== "").map((k) => `${k}=${Array.isArray(input[k]) ? (input[k] as unknown[]).join("/") : String(input[k])}`);
  if (Array.isArray(input.slots)) parts.push(`slots=${(input.slots as { label?: string; quantity?: number }[]).map((s) => `${s.label}${s.quantity ? `×${s.quantity}` : ""}`).join(", ")}`);
  if (Array.isArray(input.productIds)) parts.push(`${(input.productIds as unknown[]).length} products`);
  return parts.join(" · ").slice(0, 220);
}

function summariseOutput(tool: string, o: NonNullable<Part["output"]>): string {
  if (o.ok === false) return `not done: ${o.code ?? ""} ${o.error ?? ""}`.trim();
  if (Array.isArray(o.products)) return `${o.products.length} real product(s)`;
  if (Array.isArray(o.services)) return `${o.services.length} service(s)`;
  if (tool === "planBasket") return `${(o.lines as unknown[] | undefined)?.length ?? 0} line(s) · total ${String(o.totalLabel ?? "")}${o.overBudgetBy != null ? " · over budget" : ""}`;
  if (tool === "showMyMemory") return `${String(o.count ?? 0)} memories shown`;
  if (o.cart && typeof o.cart === "object") return `cart: ${((o.cart as { items?: unknown[] }).items ?? []).length} line(s)`;
  if (o.summary) return "order summary shown";
  if (o.booking) return "booking proposal";
  if (Array.isArray(o.slots)) return `${o.slots.length} slot(s)`;
  if (Array.isArray(o.memories)) return `${o.memories.length} memory hit(s)`;
  if (Array.isArray(o.saved)) return `saved ${o.saved.length}`;
  if (Array.isArray(o.list)) return `list: ${o.list.length} item(s)`;
  return "ok";
}

export function traceFromParts(parts: unknown[]): { steps: TraceStep[]; memoryWrites: string[] } {
  const list = (Array.isArray(parts) ? parts : []) as Part[];
  const steps = list
    .filter((p) => p.type?.startsWith("tool-") && p.output)
    .map((p) => {
      const tool = p.type.slice(5);
      return { tool, input: summariseInput(p.input), outcome: summariseOutput(tool, p.output!), ok: p.output!.ok !== false };
    });
  const memoryWrites = (list.find((p) => p.type === "data-memory")?.data?.receipts ?? []).map((r) => `${r.label} (${r.status})`);
  return { steps, memoryWrites };
}

/** One-line dev log for a finished turn. */
export function traceLine(parts: unknown[], extra: { recalled: number; activeTools: string[] }): string {
  const t = traceFromParts(parts);
  return `[nia trace] offered=${extra.activeTools.length} recalled=${extra.recalled} ${t.steps.map((s) => `${s.tool}(${s.input || "-"}) → ${s.outcome}`).join(" | ") || "no tools"}`;
}
