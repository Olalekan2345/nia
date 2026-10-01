/**
 * Configurable model provider. Nia is not locked to any vendor; the
 * hackathon build defaults to a non-OpenAI / non-Anthropic model (Gemini,
 * Mistral, DeepSeek, or Qwen via any OpenAI-compatible endpoint).
 */
import { wrapLanguageModel, type LanguageModel } from "ai";
import { createGoogle } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { createMistral } from "@ai-sdk/mistral";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { aiConfig, type AiProviderName } from "@nia/config";
import { AppError } from "@nia/shared";

const globalForModel = globalThis as unknown as { __niaChatModel?: LanguageModel; __niaExtractionModel?: LanguageModel };

type ModelV4 = ReturnType<typeof wrapLanguageModel>;

function buildFor(provider: AiProviderName, apiKey: string | undefined, baseUrl: string | undefined, modelId: string): ModelV4 {
  switch (provider) {
    case "groq":
      return createGroq({ apiKey })(modelId);
    case "google":
      return createGoogle({ apiKey })(modelId);
    case "mistral":
      return createMistral({ apiKey })(modelId);
    case "deepseek":
      return createDeepSeek({ apiKey })(modelId);
    case "openai-compatible":
      return createOpenAICompatible({ name: "nia-compatible", baseURL: baseUrl!, apiKey }).chatModel(modelId);
  }
}

/** The configured model — with the backup behind it when one is set up. */
function build(modelId: string): LanguageModel {
  const cfg = aiConfig();
  if (!cfg.configured || !cfg.provider) {
    throw new AppError("NOT_CONFIGURED", `AI provider not configured (missing: ${cfg.missing.join(", ")})`);
  }
  const primary = buildFor(cfg.provider, cfg.apiKey, cfg.baseUrl, modelId);
  const b = cfg.fallback;
  return b ? withFallback(primary, buildFor(b.provider, b.apiKey, b.baseUrl, b.model), `${b.provider}/${b.model}`) : primary;
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

/**
 * Worth a second try elsewhere: rate or daily limits, request too large for the
 * plan, overload and outages — and Groq's 400 when the model produced a tool call
 * it couldn't parse. Anything else (a real bad request) is not retried.
 */
export function shouldFallBack(err: unknown): boolean {
  const e = err as { statusCode?: number; message?: string; responseBody?: string } | null;
  const status = e?.statusCode;
  const text = `${e?.message ?? ""} ${e?.responseBody ?? ""}`;
  if (status === 429 || status === 413 || status === 498 || (status != null && status >= 500)) return true;
  if (status === 400) return /tool_use_failed|failed to call a function|output_parse_failed/i.test(text);
  return status == null && /fetch failed|ECONNRESET|ETIMEDOUT|socket hang up/i.test(text);
}

/**
 * Some providers (Mistral) only accept tool-call ids of 9 letters/digits. When a
 * reply started on the main model and continues on the backup, earlier steps'
 * ids are rewritten — the same id always maps to the same replacement.
 */
export function normalizeToolCallIds(params: Parameters<ModelV4["doGenerate"]>[0]): Parameters<ModelV4["doGenerate"]>[0] {
  const ids = new Map<string, string>();
  const short = (id: string) => {
    if (/^[A-Za-z0-9]{9}$/.test(id)) return id;
    let v = ids.get(id);
    if (!v) {
      let h = 0;
      for (const ch of id) h = (Math.imul(h, 31) + ch.charCodeAt(0)) >>> 0;
      v = `${h.toString(36)}${ids.size.toString(36)}`.padStart(9, "0").slice(-9);
      ids.set(id, v);
    }
    return v;
  };
  const prompt = params.prompt.map((m) =>
    Array.isArray(m.content)
      ? { ...m, content: m.content.map((part) => ("toolCallId" in part && typeof part.toolCallId === "string" ? { ...part, toolCallId: short(part.toolCallId) } : part)) }
      : m,
  ) as typeof params.prompt;
  return { ...params, prompt };
}

/** The backup itself is rate-limited (Mistral's free plan: ~1 request/second): one short wait, then give up. */
async function backupCall<T>(call: () => PromiseLike<T>): Promise<T> {
  try {
    return await call();
  } catch (err) {
    if ((err as { statusCode?: number })?.statusCode !== 429) throw err;
    await new Promise((r) => setTimeout(r, 1500));
    return call();
  }
}

/**
 * Main model with a backup: any request the main one refuses (see shouldFallBack)
 * goes to the backup straight away, so the customer gets an answer instead of
 * "try again later". Each step of a reply is its own request, so a reply can
 * start on one and finish on the other.
 */
export function withFallback(primary: ModelV4, backup: ModelV4, label = "backup"): ModelV4 {
  // Both refused: report the main model's error — its "try again in 21m" is what the customer should hear.
  const gaveUp =
    (main: unknown) =>
    (backupErr: unknown): never => {
      console.warn(`[ai] ${label} failed too: ${String((backupErr as Error)?.message ?? backupErr).slice(0, 160)}`);
      throw main;
    };
  const note = (err: unknown) => console.warn(`[ai] main model refused (${(err as { statusCode?: number })?.statusCode ?? "network"}) — using ${label}`);
  return wrapLanguageModel({
    model: primary,
    middleware: {
      wrapGenerate: async ({ doGenerate, params }) => {
        try {
          return await doGenerate();
        } catch (err) {
          if (!shouldFallBack(err)) throw err;
          note(err);
          return backupCall(() => backup.doGenerate(normalizeToolCallIds(params))).catch(gaveUp(err));
        }
      },
      wrapStream: async ({ doStream, params }) => {
        try {
          return await doStream();
        } catch (err) {
          if (!shouldFallBack(err)) throw err;
          note(err);
          return backupCall(() => backup.doStream(normalizeToolCallIds(params))).catch(gaveUp(err));
        }
      },
    },
  });
}

export function isAiConfigured(): boolean {
  return Boolean(globalForModel.__niaChatModel) || aiConfig().configured;
}

/** Tests: inject mock language models. */
export function setModelOverrides(models: { chat?: LanguageModel; extraction?: LanguageModel } | undefined): void {
  globalForModel.__niaChatModel = models?.chat;
  globalForModel.__niaExtractionModel = models?.extraction ?? models?.chat;
}

export function describeModel(): { provider: string | null; model: string | null; backup: string | null } {
  const cfg = aiConfig();
  return { provider: cfg.provider ?? null, model: cfg.model ?? null, backup: cfg.fallback ? `${cfg.fallback.provider} · ${cfg.fallback.model}` : null };
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
  const wait = retryAfterSeconds(text);
  // A daily budget (TPD/RPD) is a different situation from a busy minute: say so, with the real wait.
  if (/per day|\bTPD\b|\bRPD\b/i.test(text)) {
    return `Nia has reached today's usage limit for this demo. Please try again in ${wait != null ? humanWait(wait) : "a little while"}.`;
  }
  return `Nia is getting a lot of messages right now. Please try again in ${wait != null ? humanWait(wait) : "a few seconds"}.`;
}

/** "try again in 30m19.48s" / "1h2m3s" / "12.5s" / "2m" → seconds, or null. */
export function retryAfterSeconds(text: string): number | null {
  const m = /try again in ((?:\d+(?:\.\d+)?[hms])+)/i.exec(text);
  if (!m) return null;
  let total = 0;
  for (const [, n, unit] of m[1]!.matchAll(/(\d+(?:\.\d+)?)([hms])/gi)) total += Number(n) * (unit!.toLowerCase() === "h" ? 3600 : unit!.toLowerCase() === "m" ? 60 : 1);
  return Number.isFinite(total) && total > 0 ? total : null;
}

function humanWait(seconds: number): string {
  if (seconds < 60) return `about ${Math.ceil(seconds)} seconds`;
  const minutes = Math.ceil(seconds / 60);
  if (minutes < 60) return `about ${minutes} minute${minutes === 1 ? "" : "s"}`;
  const hours = Math.round(minutes / 60);
  return `about ${hours} hour${hours === 1 ? "" : "s"}`;
}
