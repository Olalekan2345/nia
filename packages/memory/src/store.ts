/**
 * Walrus Memory store adapter.
 *
 * Wraps the official MemWal SDK client (server-side only — the delegate key
 * never leaves this process). The adapter adds:
 *   • retry with backoff for transient relayer failures only (never 4xx/auth)
 *   • a shared cooldown after a rate-limit response (see noteRateLimit)
 *   • batched job-status checks
 *   • a narrow interface so tests can use the SDK's own MemWalMock
 *
 * When credentials are missing the store is null: memory features are disabled
 * and the UI says so — Nia never simulates memory.
 */
import { MemWal } from "@mysten-incubation/memwal";
import type {
  HealthResult,
  RecallResult,
  RememberAcceptedResult,
  RememberJobStatus,
  RememberResult,
  RestoreResult,
  NamespacesResult,
} from "@mysten-incubation/memwal";
import { walrusConfig } from "@nia/config";

export type MemoryBackend = "walrus" | "mock";

export interface MemoryStore {
  readonly backend: MemoryBackend;
  readonly network: string;
  remember(text: string, namespace: string, idempotencyKey: string): Promise<RememberAcceptedResult>;
  getRememberStatus(jobId: string): Promise<RememberJobStatus>;
  /** Status of many jobs in one relayer request. */
  getRememberStatuses(jobIds: string[]): Promise<RememberJobStatus[]>;
  waitForRememberJob(jobId: string, timeoutMs: number): Promise<RememberResult>;
  recall(params: { query: string; namespace: string; limit: number; maxDistance?: number }): Promise<RecallResult>;
  restore(namespace: string, limit?: number): Promise<RestoreResult>;
  health(): Promise<HealthResult>;
  /** Namespaces this account holds memories in, with relayer-side memory counts. */
  listNamespaces(options?: { cursor?: string; limit?: number }): Promise<NamespacesResult>;
}

export interface MemoryError extends Error {
  status?: number;
}

export function isRetryable(err: unknown): boolean {
  const status = (err as MemoryError)?.status;
  if (status === undefined || status === 0) return true; // network error
  if (status === 408 || status === 425) return true; // never 429: retrying extends the lockout
  return status >= 500;
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (!isRetryable(err) || i === attempts - 1) throw err;
      await new Promise((r) => setTimeout(r, 2 ** i * 400 + Math.random() * 200));
    }
  }
  throw lastErr;
}

/**
 * The relayer rate-limits each delegate key (Mainnet: 60 weighted requests/min)
 * and locks it for `retry_after_seconds` once exceeded. Every customer of this
 * deployment shares the key, so a 429 opens a process-wide cooldown: Walrus
 * calls fail fast until it ends and callers degrade honestly (recall notice,
 * writes stay pending with their outbox text).
 */
const limiter = globalThis as unknown as { __niaWalrusCooldownUntil?: number };

export function walrusCooldownMs(): number {
  return Math.max(0, (limiter.__niaWalrusCooldownUntil ?? 0) - Date.now());
}

function noteRateLimit(err: unknown): void {
  const e = err as MemoryError;
  if (e?.status !== 429) return;
  const seconds = Number(/retry_after_seconds\\?"?\s*:\s*(\d+)/.exec(e.message ?? "")?.[1] ?? 30);
  limiter.__niaWalrusCooldownUntil = Date.now() + seconds * 1000;
  console.warn(`[walrus] relayer rate limit reached — pausing Walrus calls for ${seconds}s`);
}

async function call<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  const wait = walrusCooldownMs();
  if (wait > 0) {
    const err = new Error(`Walrus Memory is rate-limited on this deployment — retry in ${Math.ceil(wait / 1000)} s`) as MemoryError;
    err.status = 429;
    throw err;
  }
  try {
    return await withRetry(fn, attempts);
  } catch (err) {
    noteRateLimit(err);
    throw err;
  }
}

type SdkClient = Pick<
  MemWal,
  "remember" | "getRememberStatus" | "getRememberBulkStatus" | "waitForRememberJob" | "recall" | "restore" | "health" | "listNamespaces"
>;

export function wrapClient(client: SdkClient, backend: MemoryBackend, network: string): MemoryStore {
  return {
    backend,
    network,
    remember: (text, namespace, idempotencyKey) => call(() => client.remember(text, namespace, { idempotencyKey })),
    getRememberStatus: (jobId) => call(() => client.getRememberStatus(jobId), 2),
    getRememberStatuses: async (jobIds) =>
      jobIds.length === 0
        ? []
        : (await call(() => client.getRememberBulkStatus(jobIds), 2)).results.map((r) => ({ job_id: r.job_id, status: r.status, blob_id: r.blob_id, error: r.error })),
    waitForRememberJob: (jobId, timeoutMs) => call(() => client.waitForRememberJob(jobId, { timeoutMs, pollIntervalMs: 5000 }), 1),
    recall: ({ query, namespace, limit, maxDistance }) =>
      call(() => client.recall({ query, namespace, limit, ...(maxDistance !== undefined ? { maxDistance } : {}) }), 2),
    restore: (namespace, limit) => call(() => client.restore(namespace, limit), 1),
    health: () => client.health(),
    listNamespaces: (options) => call(() => client.listNamespaces(options), 2),
  };
}

const globalForStore = globalThis as unknown as { __niaMemoryStore?: MemoryStore | null; __niaMemoryOverride?: MemoryStore | null };

/** Resolve the configured store, or null when Walrus Memory is not configured. */
export function getMemoryStore(): MemoryStore | null {
  if (globalForStore.__niaMemoryOverride !== undefined) return globalForStore.__niaMemoryOverride;
  if (globalForStore.__niaMemoryStore !== undefined) return globalForStore.__niaMemoryStore;

  const cfg = walrusConfig();
  if (!cfg.configured) {
    globalForStore.__niaMemoryStore = null;
    return null;
  }

  const client = MemWal.create({
    key: cfg.privateKey!,
    accountId: cfg.accountId!,
    serverUrl: cfg.serverUrl,
    namespace: `${cfg.namespacePrefix}:default`,
    requestTimeoutMs: 30_000,
  });
  globalForStore.__niaMemoryStore = wrapClient(client, "walrus", cfg.network);
  return globalForStore.__niaMemoryStore;
}

/** Tests only: force a specific store (e.g. the SDK's MemWalMock), or null for "not configured". */
export function setMemoryStoreOverride(store: MemoryStore | null | undefined): void {
  globalForStore.__niaMemoryOverride = store;
}

