import { config } from "dotenv";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

/** Load the repo-root .env (then .env.local) for CLI scripts. */
export function loadEnv(): void {
  for (const file of [".env.local", ".env"]) {
    const p = path.join(REPO_ROOT, file);
    if (existsSync(p)) config({ path: p, quiet: true });
  }
}
