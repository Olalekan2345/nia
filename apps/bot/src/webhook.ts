/**
 * Telegram webhook helper.
 *   pnpm telegram:webhook -- set      # register ${APP_URL}/api/telegram/webhook with the secret token
 *   pnpm telegram:webhook -- info     # show webhook status
 *   pnpm telegram:webhook -- delete   # remove the webhook (e.g. before using `pnpm bot:poll`)
 *   pnpm telegram:webhook -- profile  # set bot commands + descriptions
 */
import "./env";
import { appUrl, telegramConfig } from "@nia/config";
import { BOT_COMMANDS, bot, createTelegramApi } from "@nia/telegram";

const cfg = telegramConfig();
if (!cfg.botToken) {
  console.error("TELEGRAM_BOT_TOKEN is not set. Create a bot with @BotFather and add the token to .env.");
  process.exit(1);
}
const api = bot(createTelegramApi(cfg.botToken));
const cmd = process.argv.slice(2).find((a) => a !== "--") ?? "info";

async function profile() {
  await api.setMyCommands(BOT_COMMANDS);
  await api.setMyShortDescription("Your shop assistant that remembers you — orders, repeats and bookings.");
  await api.setMyDescription(
    "Hi, I'm Nia — the shopping assistant for independent shops. I can find products, reorder what you bought last time, book services, and remember helpful things like your size or delivery area. Sign in on a shop's website with “Continue with Telegram” and your web chats, cart and memory carry on here.",
  );
  console.log("✓ Commands and descriptions set. Upload apps/web/public/brand/nia-telegram-avatar.png as the bot photo via @BotFather → /setuserpic.");
}

if (cmd === "set") {
  if (!cfg.webhookSecret || cfg.webhookSecret.length < 16) {
    console.error("TELEGRAM_WEBHOOK_SECRET must be set (16+ random characters: A-Z, a-z, 0-9, _ and -).");
    process.exit(1);
  }
  const url = `${appUrl()}/api/telegram/webhook`;
  if (!url.startsWith("https://")) {
    console.error(`Telegram requires HTTPS. APP_URL resolves to ${url}. For local development use \`pnpm bot:poll\` instead.`);
    process.exit(1);
  }
  await api.setWebhook(url, cfg.webhookSecret);
  await profile();
  console.log(`✓ Webhook set → ${url}`);
} else if (cmd === "delete") {
  await api.deleteWebhook(false);
  console.log("✓ Webhook removed");
} else if (cmd === "profile") {
  await profile();
} else {
  const me = await api.getMe();
  const info = await api.getWebhookInfo();
  console.log(`Bot: @${me.username} (${me.first_name})`);
  console.log(`Webhook: ${info.url || "(none — polling mode)"}`);
  console.log(`Pending updates: ${info.pending_update_count}`);
  if (info.last_error_message) console.log(`Last error: ${info.last_error_message} (${new Date((info.last_error_date ?? 0) * 1000).toISOString()})`);
}
