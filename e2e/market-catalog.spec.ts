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

test("Nia's back-to-top button works in the market, above the compare tray", async ({ page }) => {
  await page.goto("/market");
  const backToTop = page.getByRole("button", { name: "Back to the top" });
  await expect(backToTop).toHaveCount(0);
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight / 2, behavior: "instant" }));
  await expect(backToTop).toBeVisible();
  // Opening the compare tray lifts her above it.
  await page.locator("article").getByRole("button", { name: "Compare" }).first().click();
  const tray = page.getByRole("region", { name: "Compare selection" });
  await expect(tray).toBeVisible();
  await expect.poll(async () => {
    const [b, t] = await Promise.all([backToTop.boundingBox(), tray.locator("> div").boundingBox()]);
    return Boolean(b && t && b.y + b.height <= t.y);
  }).toBe(true);
  await backToTop.click();
  await expect.poll(() => page.evaluate(() => window.scrollY), { timeout: 10_000 }).toBeLessThan(5);
  await expect(page.getByRole("heading", { level: 1, name: /Welcome to Walrus Market/ })).toBeFocused();
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

  // …and one cart shows everything, from every shop, ready to confirm together.
  await expect(page.getByRole("link", { name: "Your cart, 2 items" })).toBeVisible();
  await page.goto("/market/cart");
  await expect(page.getByRole("heading", { level: 1, name: "Your cart" })).toBeVisible();
  await expect(page.getByText("2 items from 2 shops")).toBeVisible();
  const gadgets = page.locator("section", { has: page.getByRole("heading", { name: "Walrus Gadgets" }) });
  const drinks = page.locator("section", { has: page.getByRole("heading", { name: "Walrus Drinks" }) });
  await expect(gadgets).toContainText("Arc A15 Smartphone");
  await expect(drinks).toContainText("100% Orange Juice");
  await gadgets.getByRole("button", { name: "Pickup" }).click();
  await expect(gadgets.getByRole("button", { name: "Pickup" })).toHaveAttribute("aria-pressed", "true");
  await drinks.getByRole("button", { name: "Pickup" }).click();
  await expect(drinks.getByRole("button", { name: "Pickup" })).toHaveAttribute("aria-pressed", "true");
  // Demo shops: one tap pays (simulated), Nia confirms for a moment, then celebrates.
  await expect(page.getByText(/payment is simulated — no real money moves/).first()).toBeVisible();
  await page.getByRole("button", { name: "Pay for all 2 orders (demo)" }).click();
  await expect(page.getByRole("dialog", { name: "Confirming your payment…" })).toBeVisible();
  const done = page.getByRole("dialog", { name: "Payment confirmed" });
  await expect(done).toBeVisible({ timeout: 60_000 });
  await expect(done).toContainText("All paid! Every shop has your order.");
  await expect(done.getByText("Ready for pickup")).toHaveCount(2);
  await expect(done).toContainText("Walrus Gadgets");
  await expect(done).toContainText("Walrus Drinks");
  // It stays until the shopper closes it (the page doesn't refresh away under it).
  await page.waitForTimeout(2000);
  await expect(done).toBeVisible();
  await done.getByRole("button", { name: "Done" }).click();
  await expect(page.getByText(/Order #\d+ paid · Walrus Gadgets/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(/Order #\d+ paid · Walrus Drinks/)).toBeVisible();
  await expect(page.getByText("Your cart is empty")).toHaveCount(0);
});

test("a demo-shop delivery is paid at once and goes out, with no owner to wait for", async ({ page }) => {
  await page.goto("/s/walrus-drinks/signin");
  await completeSignIn(page, uniqueEmail("demo-pay"));
  await page.goto("/s/walrus-drinks/shop/orange-juice");
  await page.getByRole("button", { name: "Add to cart" }).click();
  await expect(page.getByRole("button", { name: "Added to cart" })).toBeVisible();
  await page.goto("/s/walrus-drinks/orders");
  await page.getByRole("button", { name: "Delivery" }).click();
  await page.getByLabel("Delivery area").selectOption("Yaba");
  const pay = page.getByRole("button", { name: /^Pay ₦[\d,]+ \(demo\)$/ });
  await expect(pay).toBeEnabled();
  await pay.click();
  const done = page.getByRole("dialog", { name: "Payment confirmed" });
  await expect(done).toBeVisible({ timeout: 60_000 });
  await expect(done).toContainText("Woohoo! Your order is on its way.");
  await expect(done).toContainText("On its way to Yaba");
  await expect(done).toContainText(/Expected by \w{3} \d{1,2} \w{3}\./);
  await page.waitForTimeout(2000);
  await expect(done).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(done).toHaveCount(0);
  await expect(page.getByText(/Order #\d+ paid · On its way to Yaba/)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Paid (demo)").first()).toBeVisible();
});

test("market cards add straight to the one cart", async ({ page }) => {
  await page.goto("/market/signin");
  await completeSignIn(page, uniqueEmail("quickadd"));
  await page.goto("/market?q=desk organiser");
  const card = page.locator("article").filter({ hasText: "Desk Organiser" }).first();
  await card.getByRole("button", { name: "Add" }).click();
  await expect(card.getByRole("link", { name: "In cart" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Your cart, 1 item/ })).toBeVisible();
  // Items with options go to their page to choose.
  await page.goto("/market?q=arc a15");
  await expect(page.locator("article").filter({ hasText: "Arc A15 Smartphone" }).first().getByRole("link", { name: "Choose options" })).toBeVisible();
});

test("comparison shows real specs and says when one isn't listed", async ({ page }) => {
  await page.goto("/market?q=tusk");
  const cards = page.locator("article").filter({ has: page.getByRole("button", { name: "Compare" }) });
  await cards.filter({ hasText: "Tusk 15 Business Laptop" }).getByRole("button", { name: "Compare" }).click();
  await cards.filter({ hasText: "Tusk Air 13 Ultrabook" }).getByRole("button", { name: "Compare" }).click();
  await page.getByRole("link", { name: "Compare now" }).click();
  const table = page.getByRole("table");
  await expect(table).toContainText("Screen");
  const weight = table.locator("tr", { has: page.getByRole("rowheader", { name: /Weight/ }) });
  await expect(weight).toContainText("1.15 kg");
  await expect(weight).toContainText("Not listed");
  // Comparing uses the selection up: the floating tray is gone here and back on the market.
  const tray = page.getByRole("region", { name: "Compare selection" });
  await expect(tray).toHaveCount(0);
  await page.goBack();
  await expect(page.locator("article").first()).toBeVisible();
  await expect(tray).toHaveCount(0);
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
