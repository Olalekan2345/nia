import "server-only";
import { eq } from "drizzle-orm";
import { telegramIdentities, type User } from "@nia/database";
import { telegramConfig } from "@nia/config";
import { bot, CB, createTelegramApi, newSignInText } from "@nia/telegram";
import { db } from "./server";

/** The bot's public username (for t.me links), or null when Telegram isn't configured. */
export function telegramBotUsername(): string | null {
  const cfg = telegramConfig();
  return cfg.configured ? (cfg.botUsername ?? null) : null;
}

/** Deep link into the bot with a /start parameter. */
export function botLink(startParam?: string): string | null {
  const username = telegramBotUsername();
  if (!username) return null;
  return `https://t.me/${username}${startParam ? `?start=${encodeURIComponent(startParam)}` : ""}`;
}

/** Tell the account's Telegram chat about an email sign-in, with a one-tap "sign out everywhere". */
export async function notifyEmailSignIn(user: User, device: string | null): Promise<void> {
  const cfg = telegramConfig();
  if (!cfg.configured || !user.telegramUserId) return;
  const [identity] = await db().select({ chatId: telegramIdentities.chatId }).from(telegramIdentities).where(eq(telegramIdentities.telegramUserId, user.telegramUserId));
  await bot(createTelegramApi(cfg.botToken))
    .sendMessage(identity?.chatId ?? user.telegramUserId, newSignInText(device, "email"), {
      html: true,
      keyboard: { inline_keyboard: [[{ text: "🔒 Sign out everywhere", callback_data: CB.signOutEverywhere() }]] },
    })
    .catch((err: Error) => console.error("[telegram] sign-in alert failed", err.message));
}
