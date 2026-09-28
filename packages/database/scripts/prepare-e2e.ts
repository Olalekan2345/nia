/**
 * Prepare the Playwright database: `<dev db>_e2e` on the same server, so test
 * shops and customers never show up in your development data. Creates it if
 * needed, then applies migrations and seeds the demo shops.
 *   DATABASE_URL=postgres://…/nia_e2e pnpm db:e2e   (playwright.config.ts does this)
 */
import { spawnSync } from "node:child_process";
import postgres from "postgres";
import { REPO_ROOT } from "./env";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}
const name = decodeURIComponent(new URL(url).pathname.slice(1));
if (!name.endsWith("_e2e")) {
  console.error(`Refusing to prepare "${name}": the end-to-end database name must end in _e2e.`);
  process.exit(1);
}

const maintenance = new URL(url);
maintenance.pathname = "/postgres";
const sql = postgres(maintenance.toString(), { max: 1, onnotice: () => {} });
try {
  const [exists] = await sql`select 1 from pg_database where datname = ${name}`;
  if (!exists) {
    await sql.unsafe(`create database "${name.replace(/"/g, '""')}"`);
    console.log(`✓ Created database ${name}`);
  }
} finally {
  await sql.end({ timeout: 5 });
}

for (const script of ["db:migrate", "db:seed"]) {
  const run = spawnSync("pnpm", [script], { cwd: REPO_ROOT, stdio: "inherit", shell: process.platform === "win32", env: process.env });
  if (run.status !== 0) process.exit(run.status ?? 1);
}
