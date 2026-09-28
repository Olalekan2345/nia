import { expect, type Page } from "@playwright/test";

export const uniqueEmail = (tag: string) => `nia-e2e-${tag}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}@example.com`;

/** Complete the email-code sign-in form that is currently on screen. */
export async function completeSignIn(page: Page, email: string) {
  await page.fill("#email", email);
  await page.click("button[value=send]");
  await expect(page.locator("#code")).toBeVisible();
  let code: string | null = null;
  for (let i = 0; i < 30 && !code; i++) {
    const res = await page.request.get(`/api/dev/last-code?email=${encodeURIComponent(email)}`);
    if (res.ok()) code = ((await res.json()) as { code: string }).code;
    else await page.waitForTimeout(300);
  }
  expect(code, "sign-in code").toBeTruthy();
  await page.fill("#code", code!);
  await Promise.all([page.waitForURL((u) => !u.pathname.endsWith("/signin"), { timeout: 60_000 }), page.click("button[value=verify]")]);
}

export const hasAiAndWalrus = Boolean(process.env.AI_API_KEY && process.env.MEMWAL_PRIVATE_KEY && process.env.MEMWAL_ACCOUNT_ID);
