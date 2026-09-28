import { expect, test } from "@playwright/test";

test("landing page explains Nia and links to the demo", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Every customer deserves to feel remembered.");
  await expect(page.getByRole("link", { name: "Try Nia" }).first()).toBeVisible();
  await expect(page.getByText("Built on Walrus Memory")).toBeVisible();
});

test("demo picker shows shops from different business types", async ({ page }) => {
  await page.goto("/try");
  await expect(page.getByRole("heading", { name: "Pick a shop to try Nia" })).toBeVisible();
  for (const name of ["Adire Lane", "Glow Theory Studio", "Crumb & Co."]) await expect(page.getByRole("link", { name: new RegExp(name) })).toBeVisible();
  await expect(page.getByText("Salon & barbering").first()).toBeVisible();
  await expect(page.getByText("Bakery & desserts").first()).toBeVisible();
});

test("demo storefront lists real catalog items and a working search", async ({ page }) => {
  await page.goto("/try");
  await page.getByRole("link", { name: /Adire Lane/ }).click();
  await expect(page).toHaveURL(/\/s\/adire-lane$/);
  await expect(page.getByRole("heading", { name: "What can I help you find today?" })).toBeVisible();
  await page.goto("/s/adire-lane/shop?q=ankara");
  await expect(page.getByText("Classic Ankara Wax Print").first()).toBeVisible();
  await page.goto("/s/adire-lane/shop?q=laptop");
  await expect(page.getByText("Nothing matches “laptop”")).toBeVisible();
});

test("health endpoint never leaks secrets", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.ok()).toBeTruthy();
  const text = await res.text();
  expect(text).not.toMatch(/suiprivkey|MEMWAL_PRIVATE_KEY=|AI_API_KEY=/);
  const body = JSON.parse(text);
  expect(body.walrus.serverUrl).toContain("relayer.memory.walrus.xyz");
});

test("chat rejects cross-site requests", async ({ request }) => {
  const res = await request.post("/api/chat", { headers: { origin: "https://evil.example" }, data: { slug: "adire-lane", text: "hi" } });
  expect(res.status()).toBe(403);
});

test("telegram webhook rejects a missing or wrong secret", async ({ request }) => {
  const res = await request.post("/api/telegram/webhook", { data: { update_id: 1 }, headers: { "x-telegram-bot-api-secret-token": "wrong" } });
  expect([401, 503]).toContain(res.status());
});
