"use client";

import { useEffect, useRef, useState } from "react";
import type { MemoryReceiptView } from "@nia/ai";

/**
 * Keep polling real persistence state for receipts that are still pending
 * (Walrus Mainnet jobs take ~30–60 s). Stops when all are terminal. The server
 * shares one relayer status check per job every few seconds across all pollers.
 */
export function useReceiptPoll(slug: string, initial: MemoryReceiptView[]): MemoryReceiptView[] {
  const key = initial.map((r) => `${r.recordId}:${r.status}`).join(",");
  const [state, setState] = useState({ key, receipts: initial });
  const tries = useRef(0);

  // New receipts from the stream replace polled state (derived-state pattern, no effect).
  let current = state;
  if (state.key !== key) {
    current = { key, receipts: initial };
    setState(current);
  }
  const receipts = current.receipts;
  const pendingIds = receipts.filter((r) => r.status === "pending" && r.recordId).map((r) => r.recordId!).join(",");

  useEffect(() => {
    if (!pendingIds) {
      tries.current = 0;
      return;
    }
    if (tries.current > 45) return;
    const t = setTimeout(async () => {
      tries.current++;
      try {
        const res = await fetch(`/api/memory/status?slug=${encodeURIComponent(slug)}&ids=${pendingIds}`, { cache: "no-store" });
        if (!res.ok) return;
        const body = (await res.json()) as { receipts: MemoryReceiptView[] };
        setState((prev) => ({ ...prev, receipts: prev.receipts.map((r) => body.receipts.find((u) => u.recordId === r.recordId) ?? r) }));
      } catch {
        /* retry on next tick */
      }
    }, 4000);
    return () => clearTimeout(t);
  }, [pendingIds, slug, receipts]);

  return receipts;
}
