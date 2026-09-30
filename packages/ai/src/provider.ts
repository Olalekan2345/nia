/**
 * Configurable model provider. Nia is not locked to any vendor; the
 * hackathon build defaults to a non-OpenAI / non-Anthropic model (Gemini,
 * Mistral, DeepSeek, or Qwen via any OpenAI-compatible endpoint).
 */
import type { LanguageModel } from "ai";
import { createGoogle } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { createMistral } from "@ai-sdk/mistral";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { aiConfig } from "@nia/config";
import { AppError } from "@nia/shared";

const globalForModel = globalThis as unknown as { __niaChatModel?: LanguageModel; __niaExtractionModel?: LanguageModel };

function build(modelId: string): LanguageModel {
  const cfg = aiConfig();
  if (!cfg.configured || !cfg.provider) {
    throw new AppError("NOT_CONFIGURED", `AI provider not configured (missing: ${cfg.missing.join(", ")})`);
  }
  switch (cfg.provider) {
    case "groq":
      return createGroq({ apiKey: cfg.apiKey })(modelId);
    case "google":
      return createGoogle({ apiKey: cfg.apiKey })(modelId);
    case "mistral":
      return createMistral({ apiKey: cfg.apiKey })(modelId);
    case "deepseek":
      return createDeepSeek({ apiKey: cfg.apiKey })(modelId);
    case "openai-compatible":
      return createOpenAICompatible({ name: "nia-compatible", baseURL: cfg.baseUrl!, apiKey: cfg.apiKey }).chatModel(modelId);
  }
}

export function getChatModel(): LanguageModel {
  if (globalForModel.__niaChatModel) return globalForModel.__niaChatModel;
  return build(aiConfig().model!);
}

export function getExtractionModel(): LanguageModel {
  if (globalForModel.__niaExtractionModel) return globalForModel.__niaExtractionModel;
  const cfg = aiConfig();
  return build(cfg.extractionModel ?? cfg.model!);
}

export function isAiConfigured(): boolean {
  return Boolean(globalForModel.__niaChatModel) || aiConfig().configured;
}

/** Tests: inject mock language models. */
export function setModelOverrides(models: { chat?: LanguageModel; extraction?: LanguageModel } | undefined): void {
  globalForModel.__niaChatModel = models?.chat;
  globalForModel.__niaExtractionModel = models?.extraction ?? models?.chat;
}

export function describeModel(): { provider: string | null; model: string | null } {
  const cfg = aiConfig();
  return { provider: cfg.provider ?? null, model: cfg.model ?? null };
}

/**
 * Per-provider call settings. Groq's JSON-schema mode only exists for some
 * models (gpt-oss, qwen3); others (e.g. Llama 3.3) use JSON-object mode with
 * the schema in the prompt — the result is still validated by Zod.
 * Groq's free plan has low tokens-per-minute limits, so rate-limited calls are
 * retried with backoff — but only twice: each wait is ~15 s and a serverless
 * request has 60 s in total, so after that Nia says it's busy instead of hanging.
 */
export function callSettings(role: "chat" | "extraction"): {
  maxRetries: number;
  schemaInPrompt: boolean;
  /**
   * Output cap per model call. Groq rejects a request outright when its *expected*
   * output exceeds the plan's output-tokens-per-minute (free tier: 1,000) — and without
   * a cap it estimates 1,200+. Nia's real outputs are far smaller (a whole chat turn
   * ≈ 100–350 tokens, extraction ≈ 6–140), so these caps never cut a normal reply.
   */
  maxOutputTokens?: number;
  providerOptions?: Record<string, Record<string, string | number | boolean>>;
} {
  const cfg = aiConfig();
  if (cfg.provider !== "groq") return { maxRetries: 1, schemaInPrompt: false };
  const model = (role === "extraction" ? cfg.extractionModel : cfg.model) ?? "";
  const jsonSchema = /gpt-oss|qwen3|kimi-k2/i.test(model);
  return {
    maxRetries: 2,
    schemaInPrompt: role === "extraction" && !jsonSchema,
    maxOutputTokens: role === "extraction" ? 500 : 600,
    providerOptions: role === "extraction" ? { groq: { structuredOutputs: jsonSchema } } : undefined,
  };
}

/**
 * A customer-facing message when the model provider is rate-limiting this
 * deployment (HTTP 429, also inside the SDK's RetryError), or null.
 */
export function aiBusyMessage(err: unknown): string | null {
  const parts: string[] = [];
  let e: unknown = err;
  for (let i = 0; i < 4 && e; i++) {
    const x = e as { message?: string; statusCode?: number; lastError?: unknown; cause?: unknown };
    if (x.statusCode === 429) parts.push("429");
    if (typeof x.message === "string") parts.push(x.message);
    e = x.lastError ?? x.cause;
  }
  const text = parts.join(" ");
  // Output-tokens-per-minute is a per-minute budget, not the conversation's length.
  if (/output tokens per minute|\bOTPM\b/i.test(text)) return "Nia is getting a lot of messages right now. Please try again in a moment.";
  if (/request too large|reduce your message size/i.test(text)) {
    return "This conversation has grown too long for Nia’s current AI plan. Start a new chat (the + button) and Nia will still remember what you told her.";
  }
  if (!/\b429\b|rate limit/i.test(text)) return null;
  const seconds = Number(/try again in (\d+(?:\.\d+)?)s/i.exec(text)?.[1]);
  const wait = Number.isFinite(seconds) && seconds > 0 ? `about ${Math.ceil(seconds)} seconds` : "a few seconds";
  return `Nia is getting a lot of messages right now. Please try again in ${wait}.`;
}
