import { expect, test } from "@playwright/test";

test("landing page explains Nia and links to the demo", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Every customer deserves to feel remembered.");
  await expect(page.getByRole("link", { name: /shop with Nia/ }).first()).toHaveAttribute("href", "/market/signin");
  // The hero artwork is the one eagerly loaded image, and it actually decodes.
  const hero = page.getByRole("img", { name: /Nia, the walrus shopping assistant/ });
  await expect(hero).toBeVisible();
  expect(await hero.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true);
  // Nav anchors land on real sections; examples are labelled as examples.
  for (const id of ["how", "business", "memory", "telegram"]) await expect(page.locator(`#${id}`)).toHaveCount(1);
  await expect(page.getByText("Example", { exact: true }).first()).toBeAttached();
  await expect(page.getByText("Built on Walrus Memory")).toBeAttached();
  await expect(page.getByRole("link", { name: "Browse Walrus Market" })).toHaveAttribute("href", "/market");

  // Nia's back-to-top button: hidden at the top, offered further down, and it works.
  const backToTop = page.getByRole("button", { name: "Back to the top" });
  await expect(backToTop).toHaveCount(0);
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "instant" }));
  await backToTop.click();
  await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 10_000 }).toBeLessThan(5);
  await expect(page.locator("#hero-title")).toBeFocused();
});

test("old /try links land in Walrus Market, which lists shops of different business types", async ({ page }) => {
  await page.goto("/try");
  await expect(page).toHaveURL(/\/market$/);
  for (const name of ["Adire Lane", "Glow Theory Studio", "Crumb & Co."]) await expect(page.locator(`a[href^="/s/"]`, { hasText: name }).first()).toBeVisible();
  await expect(page.getByText("Salon & barbering").first()).toBeVisible();
  await expect(page.getByText("Bakery & desserts").first()).toBeVisible();
});

test("demo storefront lists real catalog items and a working search", async ({ page }) => {
  await page.goto("/market");
  await page.locator(`a[href="/s/adire-lane"]`).first().click();
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

test("Walrus Market: browse every shop, search, compare side by side", async ({ page }) => {
  await page.goto("/market");
  await expect(page.getByRole("heading", { name: /Welcome to Walrus Market/ })).toBeVisible();
  // Products from different shops, with real photos.
  await expect(page.getByText("Classic Ankara Wax Print").first()).toBeVisible();
  await expect(page.getByText("Country Sourdough Loaf").first()).toBeVisible();
  await expect(page.locator('img[src^="/stock/"]:visible').first()).toBeVisible();

  await page.goto("/market?q=cake");
  await expect(page.getByRole("heading", { name: /Results for “cake”/ })).toBeVisible();
  await expect(page.getByText("Celebration Cake").first()).toBeVisible();

  await page.goto("/market");
  const cards = page.locator("article").filter({ has: page.getByRole("button", { name: "Compare" }) });
  await cards.filter({ hasText: "Classic Ankara Wax Print" }).getByRole("button", { name: "Compare" }).click();
  await cards.filter({ hasText: "Corded French Lace" }).getByRole("button", { name: "Compare" }).click();
  await page.getByRole("link", { name: "Compare now" }).click();
  await expect(page.getByRole("heading", { name: "Compare", exact: true })).toBeVisible();
  await expect(page.getByRole("table")).toContainText("Classic Ankara Wax Print");
  await expect(page.getByRole("table")).toContainText("Corded French Lace");
  await expect(page.getByRole("link", { name: /Ask Nia to decide/ })).toBeVisible();

  await page.goto("/market/nia");
  await expect(page.getByText("Help me choose a gift")).toBeVisible();
});
