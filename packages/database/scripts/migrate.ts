/**
 * Apply SQL migrations from packages/database/migrations to DATABASE_URL.
 *   pnpm db:migrate
 */
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import path from "node:path";
import { loadEnv, REPO_ROOT } from "./env";

loadEnv();

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set. Start a local database with `pnpm dev:db` or configure PostgreSQL in .env.");
  process.exit(1);
}

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
