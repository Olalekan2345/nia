import { expect, test } from "@playwright/test";
import { completeSignIn, hasAiAndWalrus, uniqueEmail } from "./helpers";

/**
 * Real memory end-to-end (real model + real Walrus Mainnet writes).
 * Skipped unless AI_API_KEY, MEMWAL_PRIVATE_KEY and MEMWAL_ACCOUNT_ID are set
 * in the environment running Playwright.
 */
test.skip(!hasAiAndWalrus, "Needs AI + Walrus credentials");

async function say(page: import("@playwright/test").Page, text: string) {
  await page.fill("#nia-composer", text);
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Stop" })).toBeHidden({ timeout: 90_000 });
}

test("explicit preferences are stored on Walrus and recalled in a new conversation", async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto("/s/adire-lane/signin");
  await completeSignIn(page, uniqueEmail("memory"));
  await page.goto("/s/adire-lane/chat");
  await say(page, "I normally buy Medium, I like darker colours, and I usually want delivery around Lekki.");
  await expect(page.getByText(/Got it — (I’ll remember that|\d things remembered)/)).toBeVisible({ timeout: 90_000 });
  await expect(page.getByText("Saved securely with Walrus Memory").first()).toBeVisible();

  // New conversation → semantic recall.
  await page.goto("/s/adire-lane/chat");
  await say(page, "What do I normally like?");
  await expect(page.getByRole("button", { name: /memor(y|ies) used|Remembered from a previous visit/ })).toBeVisible();
  await expect(page.locator("[role=log]")).toContainText(/Medium/i);
});
