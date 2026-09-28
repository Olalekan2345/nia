"use client";

import { useSyncExternalStore } from "react";

/**
 * The shopper's compare selection (up to 3 products). A per-browser convenience
 * kept in localStorage; the compare page itself is driven by its URL.
 */
const KEY = "nia-market-compare";
const EVENT = "nia-compare-change";
export const COMPARE_MAX = 3;

function read(): string[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    const ids = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(ids) ? ids.filter((x): x is string => typeof x === "string").slice(0, COMPARE_MAX) : [];
  } catch {
    return [];
  }
}

let cache: string[] = [];
let cacheKey = "";
function snapshot(): string[] {
  const ids = read();
  const key = ids.join(",");
  if (key !== cacheKey) {
    cache = ids;
    cacheKey = key;
  }
  return cache;
}

function write(ids: string[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(ids.slice(0, COMPARE_MAX)));
  } catch {
    /* storage unavailable — selection just won't persist */
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

const EMPTY: string[] = [];

export function useCompare() {
  const ids = useSyncExternalStore(subscribe, snapshot, () => EMPTY);
  return {
    ids,
    has: (id: string) => ids.includes(id),
    toggle: (id: string) => write(ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id].slice(-COMPARE_MAX)),
    clear: () => write([]),
  };
}
