/**
 * Structured memory extraction — a separate, schema-validated model call
 * after the reply. Output is validated by Zod; anything invalid is dropped.
 * The policy in @nia/memory then decides what is durable.
 *
 * Providers with JSON-schema output (Gemini, gpt-oss/qwen on Groq…) use it
 * directly. Others (e.g. Llama 3.3 on Groq) get JSON-object mode with the
 * schema in the prompt, and each candidate is validated individually.
 */
import { generateText, Output, type LanguageModel } from "ai";
import { z } from "zod";
import { CANONICAL_SUBJECTS, ExtractionResultSchema, MemoryCandidateSchema, normalizeCandidateType, type MemoryCandidate, type RecalledMemory } from "@nia/memory";
import { redactSensitive } from "@nia/shared";
import type { Merchant } from "@nia/database";
import { buildExtractionPrompt } from "./prompts";
import { splitAskedQuestion } from "./decisions";
import { callSettings } from "./provider";

export interface ExtractionInput {
  model: LanguageModel;
  merchant: Merchant;
  userText: string;
  /** The decision question the customer's message answers, e.g. "Who is it for? (Me / A gift)". */
  answering?: string | null;
  assistantText: string;
  previousTurns: { role: "user" | "assistant"; text: string }[];
  recalled: RecalledMemory[];
  now: Date;
}

const clamp01 = (v: unknown) => {
  const n = typeof v === "string" ? Number(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0.5;
};
const bool = (v: unknown) => v === true || v === "true";

/** Light, safe coercion of near-miss model output before strict validation. */
export function coerceCandidates(raw: unknown): MemoryCandidate[] {
  const list = Array.isArray(raw) ? raw : Array.isArray((raw as { candidates?: unknown })?.candidates) ? (raw as { candidates: unknown[] }).candidates : [];
  const out: MemoryCandidate[] = [];
  for (const item of list.slice(0, 8)) {
    if (!item || typeof item !== "object") continue;
    const c = item as Record<string, unknown>;
    const parsed = MemoryCandidateSchema.safeParse({
      ...c,
      type: typeof c.type === "string" ? c.type.toUpperCase() : c.type,
      explicit: bool(c.explicit),
      isCorrection: bool(c.isCorrection),
      confidence: clamp01(c.confidence),
      importance: clamp01(c.importance),
      futureUsefulness: clamp01(c.futureUsefulness),
      previousValue: typeof c.previousValue === "string" && c.previousValue.trim() ? c.previousValue : null,
      evidence: typeof c.evidence === "string" && c.evidence ? c.evidence : String(c.statement ?? ""),
      label: typeof c.label === "string" && c.label ? c.label : String(c.value ?? "").slice(0, 80),
    });
    if (parsed.success) out.push(normalizeCandidateType(parsed.data));
  }
  return out;
}

function logUsage(usage: { inputTokens?: number; outputTokens?: number }) {
  if (process.env.NODE_ENV === "development") console.info(`[ai] extraction: ${usage.inputTokens ?? "?"} in / ${usage.outputTokens ?? "?"} out tokens`);
}

export async function extractMemories(input: ExtractionInput): Promise<{ candidates: MemoryCandidate[]; error?: string }> {
  const recalledBlock = input.recalled.length
    ? input.recalled.map((r) => `- ${r.historical ? "(historical) " : ""}${r.text}`).join("\n")
    : "(none)";
  const context = input.previousTurns
    .slice(-4)
    .map((t) => {
      if (t.role === "user") return `Customer: ${redactSensitive(t.text).text.slice(0, 600)}`;
      // Keep Nia's question even when her reply is long — it gives short answers their meaning.
      const { body, asked } = splitAskedQuestion(redactSensitive(t.text).text);
      return `Nia: ${body.slice(0, 500)}${asked ? `\nNia asked: ${asked.slice(0, 300)}` : ""}`;
    })
    .join("\n");
  const answering = input.answering ? `The customer is answering Nia's question: ${redactSensitive(input.answering).text.slice(0, 300)}\n` : "";

  const prompt = `Recalled memories (data, may be outdated):
${recalledBlock}

Earlier in the conversation:
${context || "(start of conversation)"}

LATEST EXCHANGE
${answering}Customer: ${redactSensitive(input.userText).text.slice(0, 2000)}
Nia: ${redactSensitive(input.assistantText).text.slice(0, 1200)}

Extract memory candidates from the customer's latest message (use the rest only as context).`;

  const settings = callSettings("extraction");
  let system = buildExtractionPrompt({
    merchantName: input.merchant.name,
    businessType: input.merchant.businessType,
    today: input.now.toISOString().slice(0, 10),
    canonicalSubjects: CANONICAL_SUBJECTS,
  });

  try {
    if (settings.schemaInPrompt) {
      system += `\n\nOUTPUT FORMAT: reply with ONLY a JSON object, no prose, matching this JSON Schema:\n${JSON.stringify(z.toJSONSchema(ExtractionResultSchema))}\nIf nothing is worth remembering reply {"candidates":[]}.`;
      const result = await generateText({
        model: input.model,
        system,
        prompt,
        output: Output.json(),
        temperature: 0,
        maxRetries: settings.maxRetries,
        providerOptions: settings.providerOptions,
      });
      logUsage(result.usage);
      return { candidates: coerceCandidates(result.output) };
    }
    const result = await generateText({
      model: input.model,
      system,
      prompt,
      output: Output.object({ schema: ExtractionResultSchema, name: "memory_candidates" }),
      temperature: 0,
      maxRetries: settings.maxRetries,
      providerOptions: settings.providerOptions,
    });
    logUsage(result.usage);
    const parsed = ExtractionResultSchema.safeParse(result.output);
    if (!parsed.success) return { candidates: [], error: "Extraction output failed validation" };
    return { candidates: parsed.data.candidates.map(normalizeCandidateType) };
  } catch (err) {
    return { candidates: [], error: (err as Error).message.slice(0, 200) };
  }
}
