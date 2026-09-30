/**
 * Apply SQL migrations from packages/database/migrations.
 *   pnpm db:migrate        → DATABASE_URL (local)
 *   pnpm db:migrate:prod   → PRODUCTION_DATABASE_URL from .env (the connection string is never printed)
 * Migrations are additive and tracked by drizzle, so re-running applies only new ones.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import path from "node:path";
import { loadEnv, REPO_ROOT } from "./env";

loadEnv();

const production = process.argv.includes("--production");
const url = production ? process.env.PRODUCTION_DATABASE_URL : process.env.DATABASE_URL;
if (!url) {
  console.error(production ? "PRODUCTION_DATABASE_URL is not set in .env." : "DATABASE_URL is not set. Start a local database with `pnpm dev:db` or configure PostgreSQL in .env.");
  process.exit(1);
}
if (production) console.log(`Migrating production database at ${new URL(url).hostname}`);

const client = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
try {
  await migrate(drizzle(client), { migrationsFolder: path.join(REPO_ROOT, "packages/database/migrations") });
  console.log("✓ Migrations applied");
} catch (err) {
  console.error("✗ Migration failed:", (err as Error).message);
  process.exitCode = 1;
} finally {
  await client.end({ timeout: 5 });
}
