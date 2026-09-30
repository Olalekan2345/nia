/**
 * Minimal Telegram Bot API client (server-side only — the bot token never
 * reaches a browser). Uses fetch; no SDK dependency.
 */
import { telegramConfig } from "@nia/config";
import type { InlineKeyboardMarkup, TgMessage, TgUpdate, TgUser, TgWebhookInfo } from "./types";

export class TelegramApiError extends Error {
  constructor(
    message: string,
    readonly errorCode?: number,
  ) {
    super(message);
    this.name = "TelegramApiError";
  }
}

export interface TelegramApi {
  call<T>(method: string, params?: Record<string, unknown>): Promise<T>;
}

export function createTelegramApi(token = telegramConfig().botToken): TelegramApi {
  return {
    async call<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
      if (!token) throw new TelegramApiError("TELEGRAM_BOT_TOKEN is not configured");
      const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
        signal: AbortSignal.timeout(method === "getUpdates" ? 65_000 : 20_000),
      });
      const body = (await res.json()) as { ok: boolean; result?: T; description?: string; error_code?: number };
      // Never include the URL (it contains the token) in errors.
      if (!body.ok) throw new TelegramApiError(`${method}: ${body.description ?? "request failed"}`, body.error_code);
      return body.result as T;
    },
  };
}

/**
 * Telegram rejects URL buttons that point at localhost or private addresses (local
 * development). Drop those buttons instead of failing the whole message.
 */
export function publicKeyboard(keyboard?: InlineKeyboardMarkup): InlineKeyboardMarkup | undefined {
  if (!keyboard) return undefined;
  const reachable = (url: string) => {
    try {
      const host = new URL(url).hostname;
      return !/^(localhost|127\.|0\.0\.0\.0|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1\]?$)/.test(host);
    } catch {
      return false;
    }
  };
  const rows = keyboard.inline_keyboard.map((row) => row.filter((b) => !("url" in b) || !b.url || reachable(b.url))).filter((row) => row.length > 0);
  return rows.length ? { inline_keyboard: rows } : undefined;
}

export const bot = (api: TelegramApi) => ({
  getMe: () => api.call<TgUser>("getMe"),
  getWebhookInfo: () => api.call<TgWebhookInfo>("getWebhookInfo"),
  setWebhook: (url: string, secretToken: string) =>
    api.call<boolean>("setWebhook", {
      url,
      secret_token: secretToken,
      allowed_updates: ["message", "callback_query"],
      max_connections: 40,
    }),
  deleteWebhook: (dropPending = false) => api.call<boolean>("deleteWebhook", { drop_pending_updates: dropPending }),
  getUpdates: (offset: number, timeout = 50) => api.call<TgUpdate[]>("getUpdates", { offset, timeout, allowed_updates: ["message", "callback_query"] }),
  sendMessage: (chatId: number, text: string, opts: { keyboard?: InlineKeyboardMarkup; html?: boolean; disablePreview?: boolean } = {}) =>
    api.call<TgMessage>("sendMessage", {
      chat_id: chatId,
      text: text.slice(0, 4096),
      ...(opts.html ? { parse_mode: "HTML" } : {}),
      ...(publicKeyboard(opts.keyboard) ? { reply_markup: publicKeyboard(opts.keyboard) } : {}),
      link_preview_options: { is_disabled: opts.disablePreview ?? true },
    }),
  sendPhoto: (chatId: number, photo: string, caption: string, keyboard?: InlineKeyboardMarkup) =>
    api.call<TgMessage>("sendPhoto", {
      chat_id: chatId,
      photo,
      caption: caption.slice(0, 1024),
      parse_mode: "HTML",
      ...(publicKeyboard(keyboard) ? { reply_markup: publicKeyboard(keyboard) } : {}),
    }),
  sendChatAction: (chatId: number, action: "typing" = "typing") => api.call<boolean>("sendChatAction", { chat_id: chatId, action }),
  answerCallbackQuery: (id: string, text?: string) => api.call<boolean>("answerCallbackQuery", { callback_query_id: id, ...(text ? { text: text.slice(0, 200) } : {}) }),
  editMessageText: (chatId: number, messageId: number, text: string, opts: { html?: boolean } = {}) =>
    api.call<unknown>("editMessageText", {
      chat_id: chatId,
      message_id: messageId,
      text: text.slice(0, 4096),
      ...(opts.html ? { parse_mode: "HTML" } : {}),
      link_preview_options: { is_disabled: true },
    }),
  editReplyMarkup: (chatId: number, messageId: number, keyboard?: InlineKeyboardMarkup) =>
    api.call<unknown>("editMessageReplyMarkup", { chat_id: chatId, message_id: messageId, reply_markup: keyboard ?? { inline_keyboard: [] } }),
  setMyCommands: (commands: { command: string; description: string }[]) => api.call<boolean>("setMyCommands", { commands }),
  setMyDescription: (description: string) => api.call<boolean>("setMyDescription", { description }),
  setMyShortDescription: (shortDescription: string) => api.call<boolean>("setMyShortDescription", { short_description: shortDescription }),
});

export type Bot = ReturnType<typeof bot>;

export const BOT_COMMANDS = [
  { command: "start", description: "Welcome and quick actions" },
  { command: "market", description: "Walrus Market — shop every shop" },
  { command: "shops", description: "Switch to another shop" },
  { command: "shop", description: "Browse products" },
  { command: "book", description: "Book a service" },
  { command: "last", description: "My last order" },
  { command: "memory", description: "What Nia remembers about me" },
  { command: "link", description: "Use the same account on the website" },
  { command: "new", description: "Start a fresh conversation" },
  { command: "logout", description: "Sign out of Nia on every browser" },
];
