import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/**/test/**/*.test.ts", "apps/**/test/**/*.test.ts"],
    environment: "node",
    testTimeout: 60_000,
    hookTimeout: 60_000,
    pool: "forks",
    env: {
      NODE_ENV: "test",
      MEMWAL_NAMESPACE_PREFIX: "nia-test",
      // MemWalMock ranks by token overlap, not embeddings — loosen the cutoff for offline tests only.
      MEMWAL_RECALL_MAX_DISTANCE: "0.999",
      MEMWAL_STATUS_MIN_INTERVAL_MS: "0",
      TELEGRAM_WEBHOOK_SECRET: "test-webhook-secret",
      TELEGRAM_BOT_TOKEN: "123456:TEST",
      TELEGRAM_BOT_USERNAME: "nia_test_bot",
    },
  },
});
