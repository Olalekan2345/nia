import { walrusConfig } from "@nia/config";
import type { MemoryStore } from "./store";

export interface WalrusHealth {
  configured: boolean;
  backend: "walrus" | "mock" | null;
  /** Network reported by the relayer's public /config endpoint (e.g. "mainnet"). */
  network: string | null;
  serverUrl: string;
  ok: boolean;
  relayerVersion?: string;
  apiVersion?: string;
  writeReady?: boolean;
  missing: string[];
  error?: string;
  latencyMs?: number;
}

let relayerCache: { at: number; value: { network: string | null; relayerVersion?: string; apiVersion?: string; writeReady?: boolean } } | null = null;

/** Public, unsigned relayer metadata — safe to call without credentials. Cached for 5 minutes. */
export async function relayerInfo(serverUrl = walrusConfig().serverUrl) {
  if (relayerCache && Date.now() - relayerCache.at < 300_000) return relayerCache.value;
  const [config, health] = await Promise.all([
    fetch(`${serverUrl}/config`, { signal: AbortSignal.timeout(8000) }).then((r) => r.json() as Promise<{ network?: string }>),
    fetch(`${serverUrl}/health`, { signal: AbortSignal.timeout(8000) }).then((r) => r.json() as Promise<{ relayerVersion?: string; apiVersion?: string; write_ready?: boolean }>),
  ]);
  const value = { network: config.network ?? null, relayerVersion: health.relayerVersion, apiVersion: health.apiVersion, writeReady: health.write_ready };
  relayerCache = { at: Date.now(), value };
  return value;
}

/** Relayer health + credential check — never includes key material. */
export async function walrusHealth(store: MemoryStore | null): Promise<WalrusHealth> {
  const cfg = walrusConfig();
  const base = { configured: cfg.configured, backend: store?.backend ?? null, serverUrl: cfg.serverUrl, missing: cfg.missing };
  let info: Awaited<ReturnType<typeof relayerInfo>> | null = null;
  try {
    info = await relayerInfo(cfg.serverUrl);
  } catch (err) {
    return { ...base, network: null, ok: false, error: `Relayer unreachable: ${(err as Error).message}` };
  }
  if (!store) return { ...base, ...info, ok: false, error: "Credentials not configured" };
  try {
    const started = Date.now();
    const h = await store.health();
    // A signed call proves the delegate key + account id are accepted.
    await store.listNamespaces({ limit: 1 });
    return { ...base, ...info, ok: h.status === "ok", latencyMs: Date.now() - started };
  } catch (err) {
    return { ...base, ...info, ok: false, error: (err as Error).message.slice(0, 200) };
  }
}
