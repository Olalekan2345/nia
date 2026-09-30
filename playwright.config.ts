import { defineConfig, devices } from "@playwright/test";
import { config } from "dotenv";

// Keys from the repo-root .env (the live memory test runs when AI + Walrus keys are set).
config({ path: ".env", quiet: true });

const PORT = Number(process.env.E2E_PORT ?? 3310);
const baseURL = `http://localhost:${PORT}`;

/** Tests use their own database (`<dev db>_e2e`), so test shops never appear in your dev data. */
function e2eDatabaseUrl(): string {
  if (process.env.E2E_DATABASE_URL) return process.env.E2E_DATABASE_URL;
  const url = new URL(process.env.DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:54329/nia");
  if (!["127.0.0.1", "localhost", "::1"].includes(url.hostname)) {
    throw new Error("DATABASE_URL is not local. Set E2E_DATABASE_URL to a disposable database whose name ends in _e2e.");
  }
  url.pathname = `${url.pathname}_e2e`;
  return url.toString();
}
const DATABASE_URL = e2eDatabaseUrl();

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/warm-up.ts",
  timeout: 120_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  use: { baseURL, trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    { name: "mobile", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 900 } }, testMatch: /dashboard|smoke|market-catalog/ },
  ],
  webServer: {
    command: `pnpm db:e2e && pnpm --filter @nia/web exec next dev --port ${PORT}`,
    url: `${baseURL}/api/health`,
    timeout: 180_000,
    reuseExistingServer: false,
    env: { NIA_E2E: "1", APP_URL: baseURL, NIA_DEV_LOG_CODES: "true", DATABASE_URL, SEED_OWNER_EMAIL: "", NIA_NEXT_DIST_DIR: ".next-e2e" },
  },
});
