/**
 * OPT-IN real Walrus Memory integration test (writes to Mainnet — costs a
 * little WAL/SUI on your account). Never runs in ordinary CI.
 *
 *   pnpm test:walrus
 *
 * Requires MEMWAL_PRIVATE_KEY + MEMWAL_ACCOUNT_ID in the repo-root .env.
 * Writes one memory into a throwaway namespace, waits for durable
 * confirmation, recalls it with a semantically equivalent (not identical)
 * question, and prints the real persistence metadata.
 */
import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
config({ path: path.join(root, ".env"), quiet: true, override: false });

const enabled = process.env.NIA_WALRUS_INTEGRATION === "1" && Boolean(process.env.MEMWAL_PRIVATE_KEY && process.env.MEMWAL_ACCOUNT_ID);

describe.skipIf(!enabled)("Walrus Memory (real relayer)", () => {
  it("health → remember → durable wait → semantic recall", async () => {
    const { resetEnvCache, walrusConfig } = await import("@nia/config");
    resetEnvCache();
    const { getMemoryStore, setMemoryStoreOverride } = await import("../src/store");
    const { customerNamespace } = await import("../src/namespaces");
    const { walrusHealth } = await import("../src/health");
    setMemoryStoreOverride(undefined);
    const store = getMemoryStore();
    expect(store?.backend).toBe("walrus");

    const health = await walrusHealth(store);
    console.log("health:", JSON.stringify({ ok: health.ok, network: health.network, relayer: health.relayerVersion, writeReady: health.writeReady }));
    expect(health.ok).toBe(true);

    const namespace = customerNamespace("nia-it", randomUUID(), randomUUID());
    const text = `Customer usually purchases six yards of emerald Ankara fabric per order. (integration test ${new Date().toISOString()})`;
    const accepted = await store!.remember(text, namespace, `nia-it-${randomUUID()}`);
    console.log("accepted job:", accepted.job_id);
    const done = await store!.waitForRememberJob(accepted.job_id, 120_000);
    console.log("durable:", JSON.stringify({ blobId: done.blob_id, owner: done.owner, namespace: done.namespace, account: walrusConfig().accountId }));
    expect(done.blob_id).toBeTruthy();

    // The vector index can lag the `done` signal briefly — retry a few times.
    let hit: { text: string; distance: number; blob_id: string } | undefined;
    for (let attempt = 0; attempt < 6 && !hit; attempt++) {
      const res = await store!.recall({ query: "How much fabric do I normally buy?", namespace, limit: 3 });
      hit = res.results.find((r) => r.blob_id === done.blob_id);
      if (!hit) await new Promise((r) => setTimeout(r, 4000));
    }
    console.log("recalled:", JSON.stringify(hit));
    expect(hit?.text).toContain("six yards");
  }, 240_000);
});
