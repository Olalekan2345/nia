/**
 * Server health diagnostics: database, AI provider, Walrus Memory, Telegram.
 * Reports configuration state and reachability only — never secrets.
 */
import { sql } from "drizzle-orm";
import { aiConfig, emailConfig, telegramConfig } from "@nia/config";
import { isDbConfigured } from "@nia/database";
import { walrusHealth } from "@nia/memory";
import { createTelegramApi, bot } from "@nia/telegram";
import { db, memoryStore } from "@/lib/server";

export const dynamic = "force-dynamic";

async function timed<T>(fn: () => Promise<T>): Promise<{ ok: true; ms: number; value: T } | { ok: false; ms: number; error: string }> {
  const started = Date.now();
  try {
    return { ok: true, ms: Date.now() - started, value: await fn() };
  } catch (err) {
    return { ok: false, ms: Date.now() - started, error: (err as Error).message.slice(0, 160) };
  }
}

export async function GET() {
  const ai = aiConfig();
  const tg = telegramConfig();

  const [database, walrus, telegram] = await Promise.all([
    isDbConfigured() ? timed(() => db().execute(sql`select 1`)) : Promise.resolve({ ok: false as const, ms: 0, error: "DATABASE_URL not set" }),
    walrusHealth(memoryStore()),
    tg.configured
      ? timed(async () => {
          const info = await bot(createTelegramApi()).getWebhookInfo();
          return { webhookSet: Boolean(info.url), pending: info.pending_update_count, lastError: info.last_error_message ?? null };
        })
      : Promise.resolve(null),
  ]);

  const body = {
    status: database.ok && ai.configured && walrus.ok ? "ok" : "degraded",
    database: { ok: database.ok, latencyMs: database.ms, ...(database.ok ? {} : { error: database.error }) },
    ai: { configured: ai.configured, provider: ai.provider ?? null, model: ai.model ?? null, missing: ai.missing },
    walrus,
    telegram: tg.configured
      ? telegram && telegram.ok
        ? { configured: true, ...telegram.value }
        : { configured: true, error: telegram && !telegram.ok ? telegram.error : "unreachable" }
      : { configured: false, missing: tg.missing },
    email: { configured: emailConfig().configured },
    time: new Date().toISOString(),
  };
  return Response.json(body, { headers: { "Cache-Control": "no-store" } });
}
