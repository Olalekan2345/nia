import { config } from "dotenv";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
for (const f of [".env.local", ".env"]) {
  const p = path.join(root, f);
  if (existsSync(p)) config({ path: p, quiet: true });
}
