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
 * retried with backoff.
 */
export function callSettings(role: "chat" | "extraction"): {
  maxRetries: number;
  schemaInPrompt: boolean;
  providerOptions?: Record<string, Record<string, string | number | boolean>>;
} {
  const cfg = aiConfig();
  if (cfg.provider !== "groq") return { maxRetries: 1, schemaInPrompt: false };
  const model = (role === "extraction" ? cfg.extractionModel : cfg.model) ?? "";
  const jsonSchema = /gpt-oss|qwen3|kimi-k2/i.test(model);
  return {
    maxRetries: 4,
    schemaInPrompt: role === "extraction" && !jsonSchema,
    providerOptions: role === "extraction" ? { groq: { structuredOutputs: jsonSchema } } : undefined,
  };
}
