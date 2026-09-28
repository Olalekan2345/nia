import { expect, test } from "@playwright/test";
import { completeSignIn, uniqueEmail } from "./helpers";

/**
 * Critical path without AI: merchant creates a business, adds an offering,
 * publishes; a customer signs in, orders it; the merchant sees the order;
 * the customer cannot open the merchant's dashboard.
 */
test("merchant onboarding → product → customer order → merchant sees it", async ({ page, browser }) => {
  test.setTimeout(360_000);
  const owner = uniqueEmail("owner");
  const shopName = `E2E Linen ${Date.now().toString(36)}`;

  // Merchant signs up and creates a business.
  await page.goto("/signin?next=/onboarding");
  await completeSignIn(page, owner);
  await expect(page).toHaveURL(/\/onboarding/);
  await page.fill("#name", shopName);
  await page.selectOption("#businessType", "fashion");
  await page.getByRole("button", { name: "Create my business" }).click();
  await expect(page).toHaveURL(/step=2/);
  const merchantId = new URL(page.url()).searchParams.get("m")!;

  // Add a product with two sizes.
  await page.goto(`/dashboard/${merchantId}/catalog/products/new`);
  await page.fill("#name", "Test Linen Shirt");
  await page.fill("#price", "20000");
  await page.fill("#unit", "piece");
  await page.getByRole("button", { name: "Add option" }).click();
  await page.fill("#vn-0", "Black / M");
  await page.fill("#vo-0", "colour=Black, size=M");
  await page.fill("#vs-0", "5");
  await page.getByRole("button", { name: "Save product" }).click();
  await expect(page).toHaveURL(new RegExp(`/dashboard/${merchantId}/catalog$`));
  await expect(page.getByRole("link", { name: "Test Linen Shirt" })).toBeVisible();

  // Pickup + publish.
  await page.goto(`/dashboard/${merchantId}/settings`);
  await page.getByRole("switch", { name: "Offer pickup" }).click();
  await page.locator("#fulfilment").getByRole("button", { name: "Save" }).click();
  await expect(page.locator("#fulfilment").getByText("Saved")).toBeVisible();
  await page.getByRole("button", { name: "Publish store" }).click();
  await expect(page.getByText("Store is live")).toBeVisible();
  const storeUrl = await page.locator("#publish code").innerText();
  const slug = storeUrl.split("/s/")[1]!;

  // Customer in a separate browser context.
  const customerCtx = await browser.newContext();
  const c = await customerCtx.newPage();
  await c.goto(`/s/${slug}/signin`);
  await completeSignIn(c, uniqueEmail("customer"));
  await c.goto(`/s/${slug}/shop/test-linen-shirt`);
  await c.getByRole("button", { name: "Add to cart" }).click();
  await expect(c.getByRole("button", { name: "Added to cart" })).toBeVisible();
  await c.goto(`/s/${slug}/orders`);
  await c.getByRole("button", { name: "Pickup" }).click();
  await expect(c.getByRole("button", { name: "Confirm order" })).toBeEnabled();
  await c.getByRole("button", { name: "Confirm order" }).click();
  await expect(c.getByText(/Order #\d+ placed/)).toBeVisible();

  // Customers can't open the merchant's dashboard (404, not a redirect leak).
  const res = await c.goto(`/dashboard/${merchantId}`);
  expect(res?.status()).toBe(404);

  // Merchant sees the order awaiting confirmation and confirms it.
  await page.goto(`/dashboard/${merchantId}/orders?f=new`);
  await page.getByRole("link", { name: /#\d+/ }).first().click();
  await page.getByRole("button", { name: "Confirm order" }).click();
  await expect(page.getByText("Confirmed").first()).toBeVisible();
  await customerCtx.close();
});
