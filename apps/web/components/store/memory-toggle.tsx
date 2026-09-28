"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Switch } from "@nia/ui";
import { setMemoryEnabledAction } from "@/app/actions/store";

export function MemoryToggle({ slug, enabled }: { slug: string; enabled: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(enabled);
  const [pending, start] = useTransition();
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="font-semibold" id="memory-toggle-label">
          Let Nia remember me
        </p>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {on ? "Nia uses what you’ve shared to help faster next time." : "Nia won’t use or save memories. Existing ones stay listed so you can review or forget them."}
        </p>
      </div>
      <Switch
        checked={on}
        disabled={pending}
        label="Let Nia remember me"
        onChange={(next) => {
          setOn(next);
          start(async () => {
            await setMemoryEnabledAction(slug, next);
            router.refresh();
          });
        }}
      />
    </div>
  );
}
