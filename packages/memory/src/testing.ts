/**
 * Test-only helpers. The SDK's MemWalMock is used exclusively by the vitest
 * suites (injected explicitly) — the application never reads it from config.
 */
import { MemWalMock } from "@mysten-incubation/memwal";
import { wrapClient, type MemoryStore } from "./store";

export function createMockStore(namespace = "nia-test:default"): MemoryStore {
  return wrapClient(MemWalMock.create({ namespace }), "mock", "Test store");
}
