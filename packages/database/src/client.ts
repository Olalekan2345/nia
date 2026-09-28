import { drizzle } from "drizzle-orm/postgres-js";
import type { PgDatabase, PgQueryResultHKT, PgTransaction } from "drizzle-orm/pg-core";
import type { ExtractTablesWithRelations } from "drizzle-orm";
import postgres from "postgres";
import { AppError } from "@nia/shared";
import * as schema from "./schema";

export type Schema = typeof schema;
export type Database = PgDatabase<PgQueryResultHKT, Schema, ExtractTablesWithRelations<Schema>>;
export type Transaction = PgTransaction<PgQueryResultHKT, Schema, ExtractTablesWithRelations<Schema>>;
/** Anything that can run queries — the root db or an open transaction. */
export type Db = Database | Transaction;

export interface DbHandle {
  db: Database;
  close: () => Promise<void>;
}

/** Connect to PostgreSQL (Neon, Supabase, RDS, or the local PGlite socket server). */
export function createPostgresDb(url: string, { max = 10 }: { max?: number } = {}): DbHandle {
  const client = postgres(url, {
    max,
    // Transaction-mode poolers (Supabase/Neon pgbouncer) and the local PGlite
    // socket server do not support named prepared statements.
    prepare: false,
    idle_timeout: 20,
    connect_timeout: 15,
    onnotice: () => {},
  });
  const db = drizzle(client, { schema }) as unknown as Database;
  return { db, close: () => client.end({ timeout: 5 }) };
}

const globalForDb = globalThis as unknown as { __niaDb?: DbHandle; __niaDbOverride?: Database };

/**
 * Process-wide database. Uses DATABASE_URL. The singleton lives on globalThis
 * so Next.js dev reloads and multiple server bundles share one pool.
 */
export function getDb(): Database {
  if (globalForDb.__niaDbOverride) return globalForDb.__niaDbOverride;
  if (!globalForDb.__niaDb) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new AppError(
        "NOT_CONFIGURED",
        "DATABASE_URL is not set. Run `pnpm dev:db` for a local database or point DATABASE_URL at PostgreSQL.",
      );
    }
    globalForDb.__niaDb = createPostgresDb(url);
  }
  return globalForDb.__niaDb.db;
}

/** Tests: route getDb() to an in-memory PGlite instance. */
export function setDbOverride(db: Database | undefined): void {
  globalForDb.__niaDbOverride = db;
}

export function isDbConfigured(): boolean {
  return Boolean(globalForDb.__niaDbOverride || process.env.DATABASE_URL);
}
