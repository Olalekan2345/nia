"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@nia/ui";
import { cancelBookingAction, cancelOrderAction } from "@/app/actions/store";

export function CancelButton({ slug, kind, id }: { slug: string; kind: "order" | "booking"; id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!confirming) {
    return (
      <Button size="sm" variant="ghost" onClick={() => setConfirming(true)}>
        Cancel {kind}
      </Button>
    );
  }
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="danger"
          loading={pending}
          onClick={() =>
            start(async () => {
              const res = kind === "order" ? await cancelOrderAction(slug, id) : await cancelBookingAction(slug, id);
              if (!res.ok) setError(res.error);
              router.refresh();
            })
          }
        >
          Yes, cancel
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
          Keep
        </Button>
      </div>
      {error ? (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
