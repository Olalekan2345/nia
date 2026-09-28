/**
 * Check Walrus Memory configuration and relayer health.
 *   pnpm walrus:health
 * Prints no key material.
 */
import { loadEnv } from "../../database/scripts/env";
loadEnv();

const { getMemoryStore } = await import("../src/store");
const { walrusHealth } = await import("../src/health");
const { walrusConfig } = await import("@nia/config");

const cfg = walrusConfig();
console.log(`Relayer:   ${cfg.serverUrl}`);
console.log(`Network:   ${cfg.network}`);
console.log(`Prefix:    ${cfg.namespacePrefix}`);
console.log(`Account:   ${cfg.accountId ? `${cfg.accountId.slice(0, 10)}…${cfg.accountId.slice(-6)}` : "(not set)"}`);
console.log(`Delegate:  ${cfg.privateKey ? "set (hidden)" : "(not set)"}`);

const store = getMemoryStore();
const health = await walrusHealth(store);
console.log(JSON.stringify(health, null, 2));
process.exit(health.ok ? 0 : 1);
