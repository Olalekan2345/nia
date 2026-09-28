import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";
import nextVitals from "eslint-config-next/core-web-vitals";

export default tseslint.config(
  {
    ignores: ["**/node_modules/**", "**/.next/**", "**/.next-e2e/**", "**/dist/**", ".data/**", "**/next-env.d.ts", "playwright-report/**", "test-results/**", "packages/database/migrations/**"],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
      "no-empty": ["error", { allowEmptyCatch: true }],
    },
  },
  // Next.js + React rules for the web app only.
  ...nextVitals.map((c) => ({ ...c, files: ["apps/web/**/*.{ts,tsx}"] })),
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    settings: { next: { rootDir: "apps/web" } },
  },
  {
    files: ["**/test/**/*.ts", "**/*.test.ts", "e2e/**/*.ts"],
    rules: { "@typescript-eslint/no-non-null-assertion": "off", "@typescript-eslint/no-explicit-any": "off" },
  },
);
