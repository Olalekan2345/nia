/**
 * Local development without a public HTTPS URL: long-poll Telegram and
 * forward each update to the running web app's webhook endpoint with the
 * secret header — the exact code path used in production.
 *
 *   pnpm dev            # web app on APP_URL
 *   pnpm bot:poll       # this runner (deletes any registered webhook first)
 */
import "./env";
import { appUrl, telegramConfig } from "@nia/config";
import { bot, createTelegramApi } from "@nia/telegram";

const cfg = telegramConfig();
if (!cfg.configured) {
  console.error(`Telegram is not configured (missing: ${cfg.missing.join(", ")}).`);
  process.exit(1);
}
const api = bot(createTelegramApi(cfg.botToken));
const target = `${appUrl()}/api/telegram/webhook`;

/** Home connections drop now and then; retry Telegram calls instead of crashing. */
async function retrying<T>(what: string, fn: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (attempt >= 8) throw err;
      console.error(`${what} failed (${(err as Error).message}); retrying…`);
      await new Promise((r) => setTimeout(r, Math.min(15_000, 1000 * 2 ** attempt)));
    }
  }
}

await retrying("deleteWebhook", () => api.deleteWebhook(false));
const me = await retrying("getMe", () => api.getMe());
console.log(`Polling as @${me.username} → forwarding to ${target}`);

let offset = 0;
let stop = false;
process.on("SIGINT", () => (stop = true));

while (!stop) {
  try {
    const updates = await api.getUpdates(offset, 50);
    for (const u of updates) {
      offset = u.update_id + 1;
      const res = await fetch(target, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Telegram-Bot-Api-Secret-Token": cfg.webhookSecret! },
        body: JSON.stringify(u),
      });
      console.log(`update ${u.update_id} → ${res.status}`);
    }
  } catch (err) {
    console.error("poll error:", (err as Error).message);
    await new Promise((r) => setTimeout(r, 3000));
  }
}
