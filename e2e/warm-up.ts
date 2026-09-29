import type { FullConfig } from "@playwright/test";

/**
 * The test server runs `next dev`, which compiles each route on first request —
 * with a fresh build directory that can take longer than a test's navigation
 * timeout. Compile the main routes once before the tests start.
 */
const ROUTES = ["/", "/signin", "/onboarding", "/dashboard", "/s/adire-lane", "/s/adire-lane/signin", "/s/adire-lane/shop", "/s/adire-lane/chat", "/s/adire-lane/orders", "/s/adire-lane/profile", "/market", "/market/compare", "/market/nia", "/market/profile", "/market/signin"];

export default async function warmUp(config: FullConfig) {
  const baseURL = config.projects[0]?.use.baseURL;
  if (!baseURL) return;
  for (const route of ROUTES) {
    await fetch(new URL(route, baseURL), { redirect: "manual", signal: AbortSignal.timeout(180_000) }).catch(() => {});
  }
}
