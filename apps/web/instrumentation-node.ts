/**
 * In this monorepo the .env file lives at the repository root, which Next.js
 * doesn't read on its own; load it here. Platform-provided env vars always
 * take precedence over .env values.
 */
import { loadEnvConfig } from "@next/env";
import path from "node:path";

loadEnvConfig(path.resolve(process.cwd(), "../.."), process.env.NODE_ENV !== "production", { info: () => {}, error: console.error });
