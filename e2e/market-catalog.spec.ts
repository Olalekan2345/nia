import { expect, test } from "@playwright/test";
import { completeSignIn, uniqueEmail } from "./helpers";

// Walrus Market departments, collections, Popular Mart and the expanded demo catalog.
// Everything here reads the real seeded database (pnpm db:e2e).

const DEPARTMENTS = [
  ["gadgets", "Walrus Gadgets"],
  ["fashion", "Walrus Clothes & Designers"],
  ["food", "Food"],
  ["drinks", "Drinks & Beverages"],
  ["bakery", "Cakes & Bakery"],
  ["beauty", "Beauty"],
  ["home", "Home & Lifestyle"],
] as const;

test("market home: departments, the Phones & Laptops collection, Popular Mart and department rails", async ({ page }) => {
  await page.goto("/market");
  const departments = page.locator("section", { has: page.getByRole("heading", { name: "Shop by department" }) });
  for (const [key, name] of DEPARTMENTS) {
    const card = departments.locator(`a[href="/market?dept=${key}"]`);
    await expect(card).toContainText(name);
    await expect(card).toContainText("Shop now");
  }
  await expect(departments.locator('a[href="/market?col=phones-laptops"]')).toContainText("Phones & Laptops");

  // Popular Mart is editorial: its rails say so, and nothing claims sales numbers.
  const mart = page.locator("section", { has: page.getByRole("heading", { name: "Popular right now in Walrus Market" }) });
  await expect(mart.getByRole("heading", { name: "Popular picks" })).toBeVisible();
  await expect(mart.getByText("Chosen by the Walrus Market team")).toBeVisible();
  await expect(mart.getByText("Curated").first()).toBeVisible();
  await expect(mart.getByRole("heading", { name: "Under ₦10,000" })).toBeVisible();
  await expect(mart).not.toContainText(/\bsold\b|best-?seller|\d+\s*(orders|reviews)/i);

  // One rail per department, each with a way to see everything.
  for (const [key] of DEPARTMENTS) await expect(page.locator(`#dept-${key}`)).toBeAttached();
  await expect(page.getByRole("link", { name: /See all \d+/ }).first()).toBeVisible();
});

test("department page lists its categories and pages through products", async ({ page }) => {
  await page.goto("/market");
  await page.locator('a[href="/market?dept=gadgets"]').first().click();
  await expect(page.getByRole("heading", { level: 1, name: "Walrus Gadgets" })).toBeVisible();
  const chips = page.getByRole("navigation", { name: "Gadgets categories" });
  await expect(chips.getByRole("link", { name: "Phones & Laptops" })).toBeVisible();
  await chips.getByRole("link", { name: /^Laptops \d+$/ }).click();
  await expect(page).toHaveURL(/cat=Laptops/);
  await expect(page.getByText("Tusk 15 Business Laptop").first()).toBeVisible();
  await expect(page.getByText("Floe Buds Pro Wireless Earbuds")).toHaveCount(0);

  // Fashion has more than one page; the second page shows different products.
  await page.goto("/market?dept=fashion");
  const names = () => page.locator("article h3").allInnerTexts();
  const first = await names();
  expect(first.length).toBe(24);
  await page.getByRole("link", { name: "Next" }).click();
  await expect(page.getByText("Page 2")).toBeVisible();
  const second = await names();
  expect(second.length).toBeGreaterThan(0);
  expect(second.filter((n) => first.includes(n))).toEqual([]);
});

test("Phones & Laptops collection filters by budget", async ({ page }) => {
  await page.goto("/market?col=phones-laptops");
  await expect(page.getByRole("heading", { level: 1, name: "Phones & Laptops" })).toBeVisible();
  await expect(page.getByText("Arc A15 Smartphone").first()).toBeVisible();
  await expect(page.getByText("Tusk Cloudbook 11").first()).toBeVisible();
  await expect(page.getByText("Floe Buds Pro Wireless Earbuds")).toHaveCount(0);

  // "Laptops under ₦700,000" through the filter form.
  await page.getByLabel("Category").selectOption("Laptops");
  await page.getByLabel(/Max budget/).fill("700000");
  await page.getByRole("button", { name: "Apply" }).click();
  await expect(page).toHaveURL(/max=700000/);
  await expect(page.getByText("Tusk 15 Business Laptop").first()).toBeVisible();
  await expect(page.getByText("Tusk G16 Gaming Laptop")).toHaveCount(0);
  await expect(page.getByText("Tusk Air 13 Ultrabook")).toHaveCount(0);
});

test("market search finds the new catalog", async ({ page }) => {
  // Query → what the top result must be (its name, or the shop it comes from).
  const cases: [string, RegExp][] = [
    ["laptop", /Tusk .*(Laptop|Ultrabook)|Tusk Cloudbook/],
    ["orange juice", /100% Orange Juice/],
    ["wireless earbuds", /Floe Buds/],
    ["birthday cake", /Cake/],
    ["drinks", /Walrus Drinks/],
    ["dress", /Dress/],
    ["sneakers", /Sneakers/],
  ];
  for (const [q, expected] of cases) {
    await page.goto(`/market?q=${encodeURIComponent(q)}`);
    await expect(page.getByRole("heading", { name: `Results for “${q}”` })).toBeVisible();
    await expect(page.locator("article").first(), q).toContainText(expected);
  }
});

test("new product pages work end to end: variants, price, and carts in two shops", async ({ page }) => {
  await page.goto("/s/walrus-gadgets/signin");
  await completeSignIn(page, uniqueEmail("catalog"));

  await page.goto("/s/walrus-gadgets/shop/arc-a15-smartphone");
  await expect(page.getByRole("heading", { level: 1, name: "Arc A15 Smartphone" })).toBeVisible();
  await expect(page.getByText("₦149,000").first()).toBeVisible();
  await page.getByRole("button", { name: "128 GB" }).click();
  await page.getByRole("button", { name: "Ocean Blue" }).click();
  await expect(page.getByText("₦169,000").first()).toBeVisible();
  await page.getByRole("button", { name: "Add to cart" }).click();
  await expect(page.getByRole("button", { name: "Added to cart" })).toBeVisible();

  await page.goto("/s/walrus-drinks/shop/orange-juice");
  await expect(page.getByRole("heading", { level: 1, name: "100% Orange Juice" })).toBeVisible();
  await page.getByRole("button", { name: "Add to cart" }).click();
  await expect(page.getByRole("button", { name: "Added to cart" })).toBeVisible();

  // Each shop keeps its own cart.
  await page.goto("/s/walrus-gadgets/orders");
  await expect(page.getByText("Arc A15 Smartphone").first()).toBeVisible();
  await expect(page.getByText(/128 GB/).first()).toBeVisible();
  await expect(page.getByText("100% Orange Juice")).toHaveCount(0);
  await page.goto("/s/walrus-drinks/orders");
  await expect(page.getByText("100% Orange Juice").first()).toBeVisible();
  await expect(page.getByText("Arc A15 Smartphone")).toHaveCount(0);
});

test("a photo that fails to load falls back to artwork, never a broken image", async ({ page }) => {
  await page.route("**/stock/**", (route) => route.abort());
  await page.goto("/s/adire-lane/shop/classic-ankara-wax-print");
  await expect(page.getByRole("heading", { level: 1, name: "Classic Ankara Wax Print" })).toBeVisible();
  await expect(page.locator("figure [data-fallback-art]")).toBeVisible();
  await expect(page.locator('figure img[src^="/stock/"]')).toHaveCount(0);

  await page.goto("/market?dept=gadgets");
  await expect(page.locator("article").first()).toBeVisible();
  await expect.poll(() => page.evaluate(() => [...document.images].filter((i) => i.src.includes("/stock/") && i.complete && i.naturalWidth === 0).length)).toBe(0);
});
