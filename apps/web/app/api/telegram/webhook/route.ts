/**
 * Telegram webhook (HTTPS). Verifies the secret token Telegram echoes in
 * `X-Telegram-Bot-Api-Secret-Token`, claims the update_id (Telegram retries
 * deliveries) and acknowledges immediately; the reply is produced after the
 * response via `after()` so Telegram never times out and re-sends.
 */
import { after } from "next/server";
import { appUrl, env, telegramConfig } from "@nia/config";
import { bot, claimUpdate, createTelegramApi, finishUpdate, processUpdate, verifyWebhookSecret, type TgUpdate } from "@nia/telegram";
import { db, memoryStore } from "@/lib/server";

export const maxDuration = 60;

export async function POST(req: Request) {
  const cfg = telegramConfig();
  if (!cfg.configured) return Response.json({ error: "Telegram not configured" }, { status: 503 });
  if (!verifyWebhookSecret(req.headers.get("x-telegram-bot-api-secret-token"), cfg.webhookSecret)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const raw = await req.text();
  if (raw.length > 256_000) return Response.json({ error: "Too large" }, { status: 413 });
  let update: TgUpdate;
  try {
    update = JSON.parse(raw) as TgUpdate;
  } catch {
    return Response.json({ error: "Bad JSON" }, { status: 400 });
  }
  if (!Number.isSafeInteger(update?.update_id)) return Response.json({ error: "Bad update" }, { status: 400 });

  if (!(await claimUpdate(db(), update.update_id))) return Response.json({ ok: true, duplicate: true });

  after(async () => {
    try {
      await processUpdate(
        { db: db(), store: memoryStore(), bot: bot(createTelegramApi(cfg.botToken)), appUrl: appUrl(), defaultShopSlug: env().TELEGRAM_DEFAULT_SHOP ?? null },
        update,
      );
      await finishUpdate(db(), update.update_id);
    } catch (err) {
      console.error("[telegram] update failed", update.update_id, (err as Error).message);
      await finishUpdate(db(), update.update_id, (err as Error).message);
    }
  });
  return Response.json({ ok: true });
}

export function GET() {
  return Response.json({ ok: true, endpoint: "telegram-webhook", configured: telegramConfig().configured });
}
