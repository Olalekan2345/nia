import type { NextConfig } from "next";
import { loadEnvConfig } from "@next/env";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
// Monorepo: the single .env lives at the repository root.
loadEnvConfig(repoRoot, process.env.NODE_ENV !== "production");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  // Playwright builds into its own directory so the tests can run beside `pnpm dev`.
  distDir: process.env.NIA_NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  reactStrictMode: true,
  transpilePackages: ["@nia/ui", "@nia/shared", "@nia/config", "@nia/database", "@nia/memory", "@nia/commerce", "@nia/ai", "@nia/telegram"],
  // Server-only SDKs with dynamic imports / WASM — keep them out of the bundle.
  serverExternalPackages: ["@mysten-incubation/memwal", "@mysten/sui", "@mysten/seal", "postgres", "@electric-sql/pglite"],
  turbopack: { root: repoRoot },
  outputFileTracingRoot: repoRoot,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
