import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { ArrowLeft, Brain } from "lucide-react";
import { Badge } from "@nia/ui";
import { conversations, customers } from "@nia/database";
import { listConversationMessages } from "@nia/ai";
import { formatDateTime } from "@nia/shared";
import { Markdown } from "@/components/chat/markdown";
import { requireMerchant } from "@/lib/access";
import { traceFromParts } from "@/lib/trace";
import { db } from "@/lib/server";

export const metadata: Metadata = { title: "Conversation" };

type Part = { type: string; data?: { phase?: string; receipts?: { label: string; status: string }[] }; output?: { ok?: boolean } };

/** What Nia understood, which tools ran and what real data came back (staff only). */
function TraceDetails({ parts }: { parts: unknown[] }) {
  const { steps } = traceFromParts(parts);
  if (!steps.length) return null;
  return (
    <details className="rounded-2xl border border-border bg-surface-2/50 px-3 py-2 text-xs">
      <summary className="cursor-pointer font-semibold text-muted-foreground">Nia trace</summary>
      <ol className="mt-2 space-y-1.5">
        {steps.map((s, i) => (
          <li key={i}>
            <span className={s.ok ? "font-semibold" : "font-semibold text-danger"}>{s.tool}</span>
            {s.input ? <span className="text-muted-foreground"> · {s.input}</span> : null}
            <span className="block text-muted-foreground">→ {s.outcome}</span>
          </li>
        ))}
      </ol>
    </details>
  );
}

export default async function ConversationDetail({ params }: { params: Promise<{ merchantId: string; conversationId: string }> }) {
  const { merchantId, conversationId } = await params;
  const { merchant } = await requireMerchant(merchantId);
  if (!/^[0-9a-f-]{36}$/i.test(conversationId)) notFound();
  const [conv] = await db().select().from(conversations).where(and(eq(conversations.id, conversationId), eq(conversations.merchantId, merchant.id)));
  if (!conv) notFound();
  const [customer] = conv.customerId ? await db().select().from(customers).where(eq(customers.id, conv.customerId)) : [];
  const msgs = await listConversationMessages(db(), conv.id);
  const base = `/dashboard/${merchant.id}`;

  return (
    <>
      <Link href={`${base}/conversations`} className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden="true" /> Conversations
      </Link>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <h1 className="text-[clamp(1.75rem,3vw,2.35rem)] leading-tight font-extrabold tracking-[-0.035em] text-balance">{conv.title ?? "Conversation"}</h1>
        <Badge tone={conv.channel === "telegram" ? "info" : "neutral"}>{conv.channel}</Badge>
        {conv.memoryMode === "off" ? <Badge tone="warning">Memory off</Badge> : null}
        {customer ? (
          <Link href={`${base}/customers/${customer.id}`} className="text-sm font-semibold text-accent-strong hover:underline">
            {customer.displayName ?? "Customer"}
          </Link>
        ) : (
          <span className="text-sm text-muted-foreground">Guest</span>
        )}
      </div>
      <ol className="mx-auto max-w-2xl space-y-4">
        {msgs.map((m) => {
          const parts = m.parts as Part[];
          const memory = parts.find((p) => p.type === "data-memory")?.data;
          const tools = parts.filter((p) => p.type.startsWith("tool-")).map((p) => p.type.slice(5));
          return (
            <li key={m.id} className={m.role === "user" ? "flex justify-end" : ""}>
              <div className={m.role === "user" ? "max-w-[85%] rounded-3xl rounded-br-lg bg-primary px-4 py-2.5 text-primary-foreground" : "space-y-2"}>
                {m.role === "assistant" && m.memoryUsed.length ? (
                  <p className="inline-flex items-center gap-1.5 rounded-full bg-memory-soft px-2.5 py-1 text-xs font-semibold text-memory">
                    <Brain className="size-3.5" aria-hidden="true" /> {m.memoryUsed.length} memories used: {m.memoryUsed.map((u) => u.label ?? "memory").join(" · ")}
                  </p>
                ) : null}
                {m.role === "assistant" ? (
                  <div className="rounded-3xl rounded-bl-lg border border-border bg-surface px-4 py-3 text-[15px]">
                    <Markdown text={m.content || "(cards only)"} />
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">{m.content}</p>
                )}
                {tools.length ? <p className="text-xs text-muted-foreground">Tools: {[...new Set(tools)].join(", ")}</p> : null}
                {m.role === "assistant" && tools.length ? <TraceDetails parts={m.parts} /> : null}
                {memory?.receipts?.length ? (
                  <p className="text-xs text-memory">Remembered: {memory.receipts.filter((r) => r.status === "stored").map((r) => r.label).join(" · ") || "pending"}</p>
                ) : null}
                <p className="text-[11px] text-muted-foreground">{formatDateTime(m.createdAt, { timeZone: merchant.timezone })}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </>
  );
}
