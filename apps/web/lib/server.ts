import "server-only";
import { getDb } from "@nia/database";
import { getMemoryStore } from "@nia/memory";

/** Process-wide database handle. */
export const db = () => getDb();

/** Walrus Memory store (null when not configured). Server-only: holds the delegate key. */
export const memoryStore = () => getMemoryStore();
