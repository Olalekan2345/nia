/**
 * Local development only: drop everything, re-apply migrations, re-seed demo stores.
 *   pnpm db:reset
 * Refuses to run against a non-local database.
 */
import postgres from "postgres";
import { execSync } from "node:child_process";
import { loadEnv, REPO_ROOT } from "./env";

loadEnv();
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}
const host = new URL(url).hostname;
if (!["localhost", "127.0.0.1", "::1"].includes(host)) {
  console.error(`Refusing to reset a non-local database (${host}).`);
  process.exit(1);
}
const sql = postgres(url, { max: 1, onnotice: () => {} });
await sql.unsafe("drop schema if exists public cascade; drop schema if exists drizzle cascade; create schema public;");
await sql.end();
console.log("✓ Local database cleared");
execSync("pnpm db:migrate && pnpm db:seed", { cwd: REPO_ROOT, stdio: "inherit" });
