"use client";

import { useState, useTransition } from "react";
import { Button } from "@nia/ui";
import { restoreNamespaceAction } from "@/app/actions/dashboard";

/** Owner-only recovery: rebuild the relayer index for one customer's namespace from Walrus. */
export function RestoreButton({ merchantId, customerId }: { merchantId: string; customerId: string }) {
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <Button
        size="sm"
        variant="secondary"
        loading={busy}
        onClick={() =>
          start(async () => {
            const r = await restoreNamespaceAction(merchantId, customerId);
            setMsg(r.ok ? `Restored ${r.restored}, already indexed ${r.skipped}, failed ${r.failed} of ${r.total} on-chain blobs${r.truncated ? " — more remain, run again" : ""}.` : r.error);
          })
        }
      >
        Restore index from Walrus
      </Button>
      {msg ? (
        <p className="text-xs text-muted-foreground" role="status">
          {msg}
        </p>
      ) : null}
    </div>
  );
}
