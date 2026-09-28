import type { User } from "@nia/database";

/** How to show an account: email, else Telegram @username, else the Telegram name. */
export function userLabel(user: Pick<User, "email" | "telegramUsername" | "name">): string {
  return user.email ?? (user.telegramUsername ? `@${user.telegramUsername}` : null) ?? user.name ?? "Telegram account";
}

/** A friendly first name for greetings. */
export function userFirstName(user: Pick<User, "email" | "telegramUsername" | "name">): string {
  return user.name?.split(/\s+/)[0] ?? user.email?.split("@")[0] ?? user.telegramUsername ?? "there";
}

/** Only allow same-site relative redirects. */
export function safeNext(next: unknown, fallback: string): string {
  const v = typeof next === "string" ? next : "";
  return v.startsWith("/") && !v.startsWith("//") && !v.includes("\\") ? v : fallback;
}
