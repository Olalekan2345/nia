/**
 * In-process PGlite (real Postgres compiled to WASM). Used by tests and by the
 * local dev database server — never imported by the web app.
 */
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { fileURLToPath } from "node:url";
import path from "node:path";
import * as schema from "./schema";
import type { Database, DbHandle } from "./client";

export const MIGRATIONS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../migrations");

export async function createPgliteDb(dataDir?: string): Promise<DbHandle & { pglite: PGlite }> {
  const pglite = dataDir ? new PGlite(dataDir) : new PGlite();
  await pglite.waitReady;
  const db = drizzle(pglite, { schema }) as unknown as Database;
  return { db, pglite, close: () => pglite.close() };
}

/** Fresh, fully migrated in-memory database. */
export async function createTestDb(): Promise<DbHandle & { pglite: PGlite }> {
  const handle = await createPgliteDb();
  await migrate(drizzle(handle.pglite, { schema }), { migrationsFolder: MIGRATIONS_DIR });
  return handle;
}
