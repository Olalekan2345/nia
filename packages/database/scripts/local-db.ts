/**
 * Zero-install local PostgreSQL for development.
 *
 * Runs a real PostgreSQL server (embedded-postgres downloads the official
 * binaries for your platform) with data persisted in .data/postgres:
 *
 *   pnpm dev:db
 *   DATABASE_URL=postgres://postgres:postgres@127.0.0.1:54329/nia
 *
 * For production use Neon, Supabase or any PostgreSQL 15+.
 */
import EmbeddedPostgres from "embedded-postgres";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { REPO_ROOT } from "./env";

const port = Number(process.env.NIA_LOCAL_DB_PORT ?? 54329);
const dataDir = path.join(REPO_ROOT, ".data", "postgres");
const fresh = !existsSync(path.join(dataDir, "PG_VERSION"));
mkdirSync(path.dirname(dataDir), { recursive: true });

const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: "postgres",
  password: "postgres",
  port,
  persistent: true,
  // UTF-8 regardless of the OS locale (Windows defaults to WIN1252).
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
  onLog: () => {},
  onError: (e) => console.error(String(e)),
});

if (fresh) {
  console.log("Initialising a new local PostgreSQL cluster…");
  await pg.initialise();
}
await pg.start();
if (fresh) await pg.createDatabase("nia");

console.log(`Nia local PostgreSQL listening on 127.0.0.1:${port}`);
console.log(`Data directory: ${dataDir}`);
console.log(`DATABASE_URL=postgres://postgres:postgres@127.0.0.1:${port}/nia`);
if (fresh) console.log("Next: pnpm db:setup (migrations + demo stores)");

let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  await pg.stop();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
// Keep the process alive.
setInterval(() => {}, 1 << 30);
