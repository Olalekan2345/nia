"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { Button, Input } from "@nia/ui";
import { ChatView, type ChatViewProps } from "@/components/chat/chat-view";

type Shared = Omit<ChatViewProps, "memoryMode" | "externalPrompt" | "conversationId" | "initialMessages" | "headerNote">;

/**
 * Genuine before/after: the same question goes to two real conversations —
 * one with memory OFF (no Walrus recall, no history) and one with memory ON.
 */
export function BeforeAfter({ offId, onId, ...props }: Shared & { offId: string; onId: string }) {
  const [text, setText] = useState("Same as last time");
  const [prompt, setPrompt] = useState<{ key: number; text: string } | null>(null);
  const ask = () => text.trim() && setPrompt({ key: Date.now(), text: text.trim() });
  return (
    <div className="space-y-4">
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          ask();
        }}
      >
        <label htmlFor="both" className="sr-only">
          Ask both
        </label>
        <Input id="both" value={text} onChange={(e) => setText(e.target.value)} className="min-w-60 flex-1" maxLength={300} />
        <Button type="submit">
          <Send className="size-4" aria-hidden="true" /> Ask both
        </Button>
        <div className="flex w-full flex-wrap gap-2">
          {["Same as last time", "What do I normally like?", "Where do you usually deliver my orders?", "Show me something in my size"].map((s) => (
            <button key={s} type="button" onClick={() => setText(s)} className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-semibold hover:bg-surface-2">
              {s}
            </button>
          ))}
        </div>
      </form>
      <div className="grid gap-4 lg:grid-cols-2">
        <section aria-label="Memory off" className="h-[640px] overflow-hidden rounded-3xl border border-border bg-surface">
          <ChatView {...props} conversationId={offId} embedded initialMessages={[]} memoryMode="off" externalPrompt={prompt} headerNote="Memory OFF — no Walrus recall, no history" compactHeader />
        </section>
        <section aria-label="Memory on" className="h-[640px] overflow-hidden rounded-3xl border border-memory/40 bg-surface">
          <ChatView {...props} conversationId={onId} embedded initialMessages={[]} memoryMode="on" externalPrompt={prompt} headerNote="Memory ON — recalls from Walrus" compactHeader showExtraction />
        </section>
      </div>
    </div>
  );
}
