/**
 * Server environment configuration.
 *
 * Every integration is environment-gated: a missing credential disables that
 * integration with an explicit "not configured" state instead of crashing the
 * app. Secrets are read only on the server — nothing here is exposed to the
 * browser (no NEXT_PUBLIC_ variables carry secrets).
 */
import { z } from "zod";

const optional = z
  .string()
  .optional()
  .transform((v) => (v && v.trim().length > 0 ? v.trim() : undefined));

const bool = z
  .string()
  .optional()
  .transform((v) => v === "1" || v?.toLowerCase() === "true");

export const AI_PROVIDERS = ["groq", "google", "mistral", "deepseek", "openai-compatible"] as const;
export type AiProviderName = (typeof AI_PROVIDERS)[number];

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_URL: optional,

  DATABASE_URL: optional,

  AUTH_SECRET: optional,

  AI_PROVIDER: optional,
  AI_MODEL: optional,
  /** Optional cheaper/faster model used for structured memory extraction. Defaults to AI_MODEL. */
  AI_EXTRACTION_MODEL: optional,
  AI_API_KEY: optional,
  /** Base URL for the openai-compatible provider (e.g. Qwen via DashScope or OpenRouter). */
  AI_BASE_URL: optional,
  /**
   * Backup model, used for any request the main one refuses (daily limit, outage).
   * e.g. AI_FALLBACK_PROVIDER=google + AI_FALLBACK_API_KEY (a free Gemini key; the model
   * defaults to gemini-3.5-flash-lite), or MISTRAL_API_KEY alone for Mistral. Off with no key.
   */
  AI_FALLBACK_PROVIDER: optional,
  AI_FALLBACK_MODEL: optional,
  AI_FALLBACK_API_KEY: optional,
  AI_FALLBACK_BASE_URL: optional,
  MISTRAL_API_KEY: optional,

  MEMWAL_PRIVATE_KEY: optional,
  MEMWAL_ACCOUNT_ID: optional,
  MEMWAL_SERVER_URL: optional,
  /** Namespace prefix. Keep "nia" in production; use e.g. "nia-dev" locally so dev data never mixes with prod. */
  MEMWAL_NAMESPACE_PREFIX: optional,
  /** Human label for the network the relayer writes to (display only). */
  MEMWAL_NETWORK: optional,
  /** Max durable memory writes per customer per hour (cost ceiling). */
  MEMWAL_MAX_WRITES_PER_HOUR: optional,
  /** Cosine-distance cutoff for recall (lower = stricter). Default 0.8. */
  MEMWAL_RECALL_MAX_DISTANCE: optional,
  /** Minimum ms between relayer status checks of the same job, shared by all pollers. Default 5000. */
  MEMWAL_STATUS_MIN_INTERVAL_MS: optional,

  TELEGRAM_BOT_TOKEN: optional,
  TELEGRAM_WEBHOOK_SECRET: optional,
  TELEGRAM_BOT_USERNAME: optional,
  /** Shop slug a new Telegram chat talks to before the user picks one (optional). */
  TELEGRAM_DEFAULT_SHOP: optional,

  RESEND_API_KEY: optional,
  EMAIL_FROM: optional,

  PAYSTACK_SECRET_KEY: optional,
  PAYSTACK_PUBLIC_KEY: optional,

  /** Enables the hackathon judge / before-after demo tools for merchant owners. */
  NIA_DEMO_MODE: bool,
  /** Development only: print sign-in codes to the server console when email is not configured. */
  NIA_DEV_LOG_CODES: bool,
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid environment: ${parsed.error.issues.map((i) => i.path.join(".")).join(", ")}`);
  }
  cached = parsed.data;
  return cached;
}

/** Test helper — re-read process.env on next access. */
export function resetEnvCache(): void {
  cached = null;
}

export const DEFAULT_MEMWAL_SERVER_URL = "https://relayer.memory.walrus.xyz";

export function isProduction(): boolean {
  return env().NODE_ENV === "production";
}

export function appUrl(): string {
  const e = env();
  if (e.APP_URL) return e.APP_URL.replace(/\/+$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3210";
}

export interface WalrusConfig {
  configured: boolean;
  privateKey?: string;
  accountId?: string;
  serverUrl: string;
  namespacePrefix: string;
  network: string;
  maxWritesPerHour: number;
  recallMaxDistance: number;
  statusMinIntervalMs: number;
  missing: string[];
}

export function walrusConfig(): WalrusConfig {
  const e = env();
  const missing: string[] = [];
  if (!e.MEMWAL_PRIVATE_KEY) missing.push("MEMWAL_PRIVATE_KEY");
  if (!e.MEMWAL_ACCOUNT_ID) missing.push("MEMWAL_ACCOUNT_ID");
  const serverUrl = e.MEMWAL_SERVER_URL ?? DEFAULT_MEMWAL_SERVER_URL;
  return {
    configured: missing.length === 0,
    privateKey: e.MEMWAL_PRIVATE_KEY,
    accountId: e.MEMWAL_ACCOUNT_ID,
    serverUrl,
    namespacePrefix: e.MEMWAL_NAMESPACE_PREFIX ?? "nia",
    network: e.MEMWAL_NETWORK ?? (serverUrl.includes("testnet") ? "Testnet" : "Mainnet"),
    maxWritesPerHour: Number(e.MEMWAL_MAX_WRITES_PER_HOUR ?? 30) || 30,
    recallMaxDistance: Math.min(1, Math.max(0.05, Number(e.MEMWAL_RECALL_MAX_DISTANCE ?? 0.8) || 0.8)),
    statusMinIntervalMs: Math.max(0, Number(e.MEMWAL_STATUS_MIN_INTERVAL_MS ?? 5000) || 0),
    missing,
  };
}

export interface AiConfig {
  configured: boolean;
  provider?: AiProviderName;
  model?: string;
  extractionModel?: string;
  apiKey?: string;
  baseUrl?: string;
  /** Backup provider for requests the main one refuses; null when not set up. */
  fallback: { provider: AiProviderName; model: string; apiKey: string; baseUrl?: string } | null;
  missing: string[];
}

function fallbackConfig(e: Env): AiConfig["fallback"] {
  const provider = (e.AI_FALLBACK_PROVIDER ?? (e.MISTRAL_API_KEY ? "mistral" : undefined)) as AiProviderName | undefined;
  if (!provider || !AI_PROVIDERS.includes(provider)) return null;
  const apiKey = e.AI_FALLBACK_API_KEY ?? (provider === "mistral" ? e.MISTRAL_API_KEY : undefined);
  const model = e.AI_FALLBACK_MODEL ?? ({ mistral: "mistral-medium-latest", google: "gemini-3.5-flash-lite" } as Partial<Record<AiProviderName, string>>)[provider];
  if (!apiKey || !model || (provider === "openai-compatible" && !e.AI_FALLBACK_BASE_URL)) return null;
  return { provider, model, apiKey, baseUrl: e.AI_FALLBACK_BASE_URL };
}

export function aiConfig(): AiConfig {
  const e = env();
  const missing: string[] = [];
  const provider = e.AI_PROVIDER as AiProviderName | undefined;
  if (!provider) missing.push("AI_PROVIDER");
  else if (!AI_PROVIDERS.includes(provider)) missing.push(`AI_PROVIDER (unsupported: ${provider})`);
  if (!e.AI_MODEL) missing.push("AI_MODEL");
  if (!e.AI_API_KEY) missing.push("AI_API_KEY");
  if (provider === "openai-compatible" && !e.AI_BASE_URL) missing.push("AI_BASE_URL");
  return {
    configured: missing.length === 0,
    provider: provider && AI_PROVIDERS.includes(provider) ? provider : undefined,
    model: e.AI_MODEL,
    extractionModel: e.AI_EXTRACTION_MODEL ?? e.AI_MODEL,
    apiKey: e.AI_API_KEY,
    baseUrl: e.AI_BASE_URL,
    fallback: fallbackConfig(e),
    missing,
  };
}

export interface TelegramConfig {
  configured: boolean;
  botToken?: string;
  webhookSecret?: string;
  botUsername?: string;
  missing: string[];
}

export function telegramConfig(): TelegramConfig {
  const e = env();
  const missing: string[] = [];
  if (!e.TELEGRAM_BOT_TOKEN) missing.push("TELEGRAM_BOT_TOKEN");
  if (!e.TELEGRAM_WEBHOOK_SECRET) missing.push("TELEGRAM_WEBHOOK_SECRET");
  if (!e.TELEGRAM_BOT_USERNAME) missing.push("TELEGRAM_BOT_USERNAME");
  return {
    configured: missing.length === 0,
    botToken: e.TELEGRAM_BOT_TOKEN,
    webhookSecret: e.TELEGRAM_WEBHOOK_SECRET,
    // Accept "nia_bot", "@nia_bot" or "https://t.me/nia_bot".
    botUsername: e.TELEGRAM_BOT_USERNAME?.trim().replace(/^https?:\/\/(www\.)?(t|telegram)\.me\//i, "").replace(/^@/, "").replace(/[/?#].*$/, "") || undefined,
    missing,
  };
}

export interface EmailConfig {
  configured: boolean;
  resendApiKey?: string;
  from: string;
  devLogCodes: boolean;
}

export function emailConfig(): EmailConfig {
  const e = env();
  return {
    configured: Boolean(e.RESEND_API_KEY),
    resendApiKey: e.RESEND_API_KEY,
    from: e.EMAIL_FROM ?? "Nia <onboarding@resend.dev>",
    // Never allow console codes in production, whatever the flag says.
    devLogCodes: e.NODE_ENV !== "production" && (e.NIA_DEV_LOG_CODES || !e.RESEND_API_KEY),
  };
}

export function authSecret(): string {
  const e = env();
  if (e.AUTH_SECRET && e.AUTH_SECRET.length >= 32) return e.AUTH_SECRET;
  if (e.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET must be set (32+ characters) in production");
  }
  return "nia-development-only-secret-do-not-use-in-production";
}
