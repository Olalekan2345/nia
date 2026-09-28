/**
 * Developer/admin recovery utility: rebuild the relayer's vector index for one
 * namespace from the blobs on Walrus.
 *
 *   pnpm walrus:restore -- <namespace> [limit]
 *
 * Limits (from the Walrus Memory docs): restore is single-shot with no
 * pagination cursor; `limit` caps how many *missing* blobs are processed per
 * call (default 10); `truncated=true` means call again; `truncated=false` is
 * not proof every blob was seen (owner-wide candidate cap). Restore re-indexes
 * blobs — including memories Nia marked as forgotten; Nia keeps excluding those
 * at recall time via its metadata, so logical forgetting still holds.
 *
 * Not exposed to customers. Requires server credentials.
 */
import { loadEnv } from "../../database/scripts/env";
loadEnv();

const { getMemoryStore } = await import("../src/store");
const { parseNamespace } = await import("../src/namespaces");

const [namespace, limitArg] = process.argv.slice(2).filter((a) => a !== "--");
if (!namespace || !parseNamespace(namespace)) {
  console.error("Usage: pnpm walrus:restore -- <nia namespace> [limit]");
  console.error("Example: pnpm walrus:restore -- nia:merchant:<uuid>:customer:<uuid> 20");
  process.exit(1);
}
const store = getMemoryStore();
if (!store || store.backend !== "walrus") {
  console.error("Walrus Memory is not configured (MEMWAL_PRIVATE_KEY / MEMWAL_ACCOUNT_ID).");
  process.exit(1);
}
const limit = limitArg ? Number(limitArg) : 10;
let round = 0;
for (;;) {
  round++;
  const res = await store.restore(namespace, limit);
  console.log(`round ${round}: restored=${res.restored} skipped=${res.skipped} failed=${res.failed} total=${res.total} truncated=${res.truncated}`);
  if (!res.truncated || round >= 10) break;
}
