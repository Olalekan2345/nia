"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { ArrowUp, CircleAlert, MessageCircle, Plus, RotateCcw, Send, ShieldOff, Sparkles, Square } from "lucide-react";
import { Button, Mascot, cn, type MascotState } from "@nia/ui";
import type { MemoryReceiptView, NiaDataParts, NiaUIMessage } from "@nia/ai";
import { addToCartAction, cancelBookingAction, confirmBookingAction, confirmOrderAction, resolveConsentAction } from "@/app/actions/store";
import { Markdown } from "./markdown";
import { MemoryPanel, RecallChip } from "./memory-parts";
import { ToolParts, type ChatActions, type ToolPart } from "./tool-parts";

export interface ChatViewProps {
  slug: string;
  shopName: string;
  locale: string;
  timeZone: string;
  /** Existing conversation id, or a fresh id minted by the server page for a new chat. */
  conversationId: string;
  initialMessages: NiaUIMessage[];
  signedIn: boolean;
  customerName: string | null;
  memory: { enabled: boolean; backend: "walrus" | "mock" | null; network: string | null };
  aiConfigured: boolean;
  suggestions: string[];
  initialPrompt?: { text: string; send: boolean } | null;
  memoryMode?: "on" | "off";
  showExtraction?: boolean;
  compactHeader?: boolean;
  /** Send this prompt when `key` changes (Judge Mode "ask both"). */
  externalPrompt?: { key: number; text: string } | null;
  /** Title shown in the header instead of the shop assistant line. */
  headerNote?: string;
  /** Embedded (Judge Mode) — don't touch the page URL. */
  embedded?: boolean;
  /** Bot deep link that continues this conversation in Telegram (Telegram-connected accounts). */
  telegramUrl?: string | null;
  /** A recent Telegram conversation this web chat can pick up. */
  resume?: { href: string; preview: string } | null;
  /** Where sign-in, the memory profile and "new chat" live (defaults: the shop's pages). */
  paths?: { signIn: string; profile: string; newChat: string };
  /** Line under the empty-state greeting. */
  intro?: string;
}

type DataPart<K extends keyof NiaDataParts> = { type: `data-${K}`; id?: string; data: NiaDataParts[K] };

function partsOf<K extends keyof NiaDataParts>(m: NiaUIMessage, kind: K): DataPart<K> | undefined {
  return (m.parts as unknown as { type: string }[]).filter((p) => p.type === `data-${kind}`).pop() as DataPart<K> | undefined;
}

export function ChatView(props: ChatViewProps) {
  const { slug, locale, timeZone, signedIn } = props;
  const router = useRouter();
  const [input, setInput] = useState(props.initialPrompt && !props.initialPrompt.send ? props.initialPrompt.text : "");
  const [celebrate, setCelebrate] = useState<MascotState | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport<NiaUIMessage>({
        api: "/api/chat",
        prepareSendMessagesRequest: ({ id, messages }) => {
          const last = messages[messages.length - 1];
          const text = (last?.parts ?? [])
            .filter((p): p is { type: "text"; text: string } => p.type === "text")
            .map((p) => p.text)
            .join("\n");
          return { body: { slug, conversationId: id, text, memoryMode: props.memoryMode } };
        },
      }),
    [slug, props.memoryMode],
  );

  const { messages, sendMessage, status, stop, error, clearError } = useChat<NiaUIMessage>({
    id: props.conversationId,
    messages: props.initialMessages,
    transport,
    onFinish: () => router.refresh(),
  });

  // Keep the conversation in the URL once it exists (so refresh / share-to-self resumes it).
  useEffect(() => {
    const meta = [...messages].reverse().find((m) => m.metadata?.conversationId)?.metadata?.conversationId;
    if (meta && !props.embedded && new URL(window.location.href).searchParams.get("c") !== meta) {
      const url = new URL(window.location.href);
      url.searchParams.set("c", meta);
      url.searchParams.delete("q");
      url.searchParams.delete("send");
      window.history.replaceState(null, "", url.toString());
    }
  }, [messages, props.embedded]);

  const busy = status === "submitted" || status === "streaming";

  const send = useCallback(
    (text: string) => {
      const t = text.trim();
      if (!t || busy) return;
      clearError();
      stickToBottom.current = true;
      void sendMessage({ text: t });
      setInput("");
    },
    [busy, clearError, sendMessage],
  );

  // Home-screen quick actions arrive as ?q=…&send=1.
  const autoSent = useRef(false);
  useEffect(() => {
    if (autoSent.current || !props.initialPrompt?.send || !props.aiConfigured) return;
    autoSent.current = true;
    send(props.initialPrompt.text);
  }, [props.initialPrompt, props.aiConfigured, send]);

  const lastExternal = useRef<number | null>(null);
  useEffect(() => {
    const ep = props.externalPrompt;
    if (!ep || ep.key === lastExternal.current) return;
    lastExternal.current = ep.key;
    send(ep.text);
  }, [props.externalPrompt, send]);

  // Auto-scroll while the user is near the bottom.
  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages, status]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
  };

  useEffect(() => {
    if (!celebrate) return;
    const t = setTimeout(() => setCelebrate(null), 4500);
    return () => clearTimeout(t);
  }, [celebrate]);

  const paths = props.paths ?? { signIn: `/s/${slug}/signin?next=${encodeURIComponent(`/s/${slug}/chat`)}`, profile: `/s/${slug}/profile`, newChat: `/s/${slug}/chat` };
  const actions: ChatActions = {
    slug,
    signInHref: paths.signIn,
    profileHref: paths.profile,
    shopName: props.shopName,
    locale,
    timeZone,
    signedIn,
    busy,
    send,
    addToCart: async (productId, variantId, quantity) => {
      const res = await addToCartAction(slug, { productId, variantId, quantity });
      if (res.ok) router.refresh();
      return res.ok ? { ok: true } : { ok: false, error: res.error };
    },
    // A basket line or alternative from another shop goes into THAT shop's cart (the server re-checks the product belongs to it).
    addToShopCart: async (shopSlug, productId, variantId, quantity) => {
      const res = await addToCartAction(shopSlug, { productId, variantId, quantity });
      return res.ok ? { ok: true } : { ok: false, error: res.error };
    },
    confirmOrder: async (orderId) => {
      const res = await confirmOrderAction(slug, orderId);
      if (!res.ok) return { ok: false, error: res.error };
      setCelebrate("order_success");
      router.refresh();
      return { ok: true, summary: res.summary, payment: res.payment, receipt: (res.receipt as MemoryReceiptView | null) ?? null };
    },
    confirmBooking: async (bookingId) => {
      const res = await confirmBookingAction(slug, bookingId);
      if (!res.ok) return { ok: false, error: res.error };
      setCelebrate("booking_success");
      router.refresh();
      return { ok: true, booking: res.booking, receipt: (res.receipt as MemoryReceiptView | null) ?? null };
    },
    cancelBooking: async (bookingId) => {
      const res = await cancelBookingAction(slug, bookingId);
      return res.ok ? { ok: true } : { ok: false, error: res.error };
    },
  };

  const onConsent = async (candidateId: string, accept: boolean) => {
    const res = await resolveConsentAction(slug, candidateId, accept);
    return res.ok && res.receipt ? (res.receipt as MemoryReceiptView) : null;
  };

  // Mascot reflects what Nia is doing.
  const last = messages[messages.length - 1];
  const lastMemory = last?.role === "assistant" ? partsOf(last, "memory") : undefined;
  const lastRecall = last?.role === "assistant" ? partsOf(last, "recall") : undefined;
  const memoryOff = props.memoryMode === "off" || !props.memory.enabled;
  const mascot: MascotState = error
    ? "warning"
    : celebrate
      ? celebrate
      : status === "submitted"
        ? "thinking"
        : lastMemory && (lastMemory.data.phase === "extracting" || (lastMemory.data.phase === "submitted" && busy))
          ? "remembering"
          : status === "streaming"
            ? lastRecall && lastRecall.data.customer.length
              ? "recalling"
              : "thinking"
            : lastMemory?.data.phase === "confirmed" && lastMemory.data.receipts.some((r) => r.status === "stored")
              ? "remembering"
              : memoryOff
                ? "privacy"
                : "idle";
  const statusText =
    mascot === "thinking" ? "Thinking…" : mascot === "recalling" ? "Recalling…" : mascot === "remembering" ? "Remembering…" : mascot === "order_success" ? "Order placed" : mascot === "booking_success" ? "Booking requested" : mascot === "warning" ? "Something went wrong" : null;

  const memoryBadge = !signedIn ? (
    <Link href={paths.signIn} className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs font-semibold text-muted-foreground hover:text-foreground">
      Guest · Sign in
    </Link>
  ) : memoryOff ? (
    <span className="inline-flex items-center gap-1 rounded-full border border-border px-2.5 py-1 text-xs font-semibold text-muted-foreground">
      <ShieldOff className="size-3.5" aria-hidden="true" /> Memory off
    </span>
  ) : !props.memory.backend ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2.5 py-1 text-xs font-semibold text-warning" title="Walrus Memory credentials are not configured on this server">
      <CircleAlert className="size-3.5" aria-hidden="true" /> Memory not connected
    </span>
  ) : (
    <Link href={paths.profile} className="inline-flex items-center gap-1 rounded-full bg-memory-soft px-2.5 py-1 text-xs font-semibold text-memory hover:opacity-90">
      <Sparkles className="size-3.5" aria-hidden="true" /> Memory on
    </Link>
  );

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-3 border-b border-ink-900/[0.06] bg-surface/90 px-4 py-3 backdrop-blur-md sm:px-5">
        <Mascot size={40} state={mascot} label={`Nia — ${statusText ?? "ready"}`} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold leading-tight">Nia</p>
          <p className="truncate text-xs text-muted-foreground" aria-live="polite">
            {statusText ?? props.headerNote ?? `${props.shopName}’s assistant`}
          </p>
        </div>
        {memoryBadge}
        {props.telegramUrl && messages.length > 0 ? (
          <a
            href={props.telegramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="grid size-10 place-items-center rounded-full text-muted-foreground transition-colors duration-150 hover:bg-ink-900/[0.05] hover:text-foreground"
            aria-label="Continue in Telegram"
            title="Continue in Telegram"
          >
            <Send className="size-5" aria-hidden="true" />
          </a>
        ) : null}
        {!props.compactHeader ? (
          <a href={paths.newChat} className="grid size-10 place-items-center rounded-full text-muted-foreground transition-colors duration-150 hover:bg-ink-900/[0.05] hover:text-foreground" aria-label="New chat">
            <Plus className="size-5" aria-hidden="true" />
          </a>
        ) : null}
      </div>

      <div ref={scrollRef} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto overscroll-contain" role="log" aria-label="Conversation" aria-live="polite">
        <div className="mx-auto flex max-w-2xl flex-col gap-5 px-4 py-5">
          {messages.length === 0 ? (
            <EmptyState name={props.customerName} shop={props.shopName} suggestions={props.suggestions} onPick={send} aiConfigured={props.aiConfigured} disabled={busy} resume={props.resume ?? null} intro={props.intro} />
          ) : null}

          {messages.map((m, idx) =>
            m.role === "user" ? (
              <UserBubble key={m.id} message={m} />
            ) : (
              <AssistantMessage
                key={m.id}
                message={m}
                actions={actions}
                asked={messageText(messages[idx - 1])}
                streaming={busy && idx === messages.length - 1}
                latest={idx === messages.length - 1}
                showExtraction={Boolean(props.showExtraction)}
                onConsent={onConsent}
              />
            ),
          )}

          {status === "submitted" ? (
            <div className="flex items-center gap-1.5 pl-1" aria-label="Nia is typing">
              {[0, 1, 2].map((i) => (
                <span key={i} className="size-2 rounded-full bg-muted-foreground/50 motion-safe:animate-bounce" style={{ animationDelay: `${i * 120}ms` }} />
              ))}
            </div>
          ) : null}

          {error ? (
            <div className="flex items-center gap-3 rounded-2xl border border-danger/15 bg-danger-soft px-4 py-3 text-sm text-danger" role="alert">
              <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
              <p className="min-w-0 flex-1">{error.message.includes("{") ? "Nia couldn’t answer just now." : error.message}</p>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  const lastUser = [...messages].reverse().find((x) => x.role === "user");
                  const text = lastUser?.parts.filter((p) => p.type === "text").map((p) => (p as { text: string }).text).join("\n");
                  clearError();
                  if (text) void sendMessage({ text });
                }}
              >
                <RotateCcw className="size-4" aria-hidden="true" /> Retry
              </Button>
            </div>
          ) : null}
        </div>
      </div>

      <form
        className="safe-bottom border-t border-ink-900/[0.06] bg-surface/95 px-3 pt-3 backdrop-blur-md sm:px-4"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <div className="mx-auto flex max-w-2xl items-end gap-2">
          <label htmlFor="nia-composer" className="sr-only">
            Message Nia
          </label>
          <textarea
            id="nia-composer"
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              const el = e.target;
              el.style.height = "auto";
              el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={1}
            maxLength={2000}
            placeholder={props.aiConfigured ? "Message Nia…" : "Nia isn’t configured yet"}
            disabled={!props.aiConfigured}
            className="max-h-40 min-h-12 flex-1 resize-none rounded-[24px] border border-ink-900/12 bg-surface px-5 py-3 text-[16px] leading-6 placeholder:text-muted-foreground/75 transition-[border-color,box-shadow] duration-150 hover:border-ink-900/20 focus-visible:border-accent focus-visible:ring-4 focus-visible:ring-ring/20 focus-visible:outline-none disabled:opacity-60"
          />
          {busy ? (
            <Button type="button" size="icon" variant="secondary" className="size-12" onClick={() => stop()} aria-label="Stop">
              <Square className="size-4 fill-current" aria-hidden="true" />
            </Button>
          ) : (
            <Button type="submit" size="icon" className="size-12" disabled={!input.trim() || !props.aiConfigured} aria-label="Send">
              <ArrowUp className="size-5" aria-hidden="true" />
            </Button>
          )}
        </div>
        <p className="mx-auto max-w-2xl px-1 py-1.5 text-center text-[11px] text-muted-foreground">
          Nia never asks for passwords, card numbers or codes.
        </p>
      </form>
    </div>
  );
}

function EmptyState({
  name,
  shop,
  suggestions,
  onPick,
  aiConfigured,
  disabled,
  resume,
  intro,
}: {
  name: string | null;
  shop: string;
  suggestions: string[];
  onPick: (t: string) => void;
  aiConfigured: boolean;
  disabled: boolean;
  resume: { href: string; preview: string } | null;
  intro?: string;
}) {
  return (
    <div className="flex flex-col items-center pt-6 text-center">
      <Mascot size={120} state="greeting" decorative />
      <h1 className="mt-5 text-2xl leading-tight font-extrabold tracking-[-0.03em] text-balance">{name ? `Hi ${name}, how can I help?` : "How can I help today?"}</h1>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{intro ?? `Ask about ${shop}’s products and services, reorder something, or book an appointment.`}</p>
      {!aiConfigured ? (
        <p className="mt-4 max-w-sm rounded-xl bg-warning-soft px-3 py-2 text-sm text-warning">
          The AI provider isn’t configured on this server yet (AI_PROVIDER, AI_MODEL, AI_API_KEY).
        </p>
      ) : null}
      {resume ? (
        <a href={resume.href} className="mt-6 flex w-full max-w-md items-center gap-3 rounded-2xl border border-accent/40 bg-accent-soft px-4 py-3 text-left transition-colors duration-100 hover:border-accent">
          <MessageCircle className="size-5 shrink-0 text-accent-strong" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">Continue your Telegram chat</span>
            <span className="block truncate text-sm text-muted-foreground">{resume.preview}</span>
          </span>
        </a>
      ) : null}
      <ul className="mt-6 flex w-full max-w-md flex-col gap-2">
        {suggestions.map((s) => (
          <li key={s}>
            <button
              type="button"
              disabled={disabled || !aiConfigured}
              onClick={() => onPick(s)}
              className="w-full rounded-[22px] border border-ink-900/[0.07] bg-surface px-5 py-3.5 text-left text-[15px] font-medium shadow-soft transition-[border-color,box-shadow,transform] duration-200 hover:border-accent/35 hover:shadow-lift motion-safe:hover:-translate-y-px disabled:opacity-50"
            >
              {s}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The words a customer typed (for the reply after it: which product they asked about). */
function messageText(message: NiaUIMessage | undefined): string | undefined {
  if (!message || message.role !== "user") return undefined;
  return message.parts
    .filter((p) => p.type === "text")
    .map((p) => (p as { text: string }).text)
    .join("\n");
}

function UserBubble({ message }: { message: NiaUIMessage }) {
  const text = messageText(message) ?? "";
  return (
    <div className="nia-enter flex justify-end">
      <p className="max-w-[85%] rounded-[22px] rounded-br-md bg-primary px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap text-primary-foreground shadow-[0_10px_24px_-18px_rgb(27_26_75/0.8)]">{text}</p>
    </div>
  );
}

function AssistantMessage({
  message,
  actions,
  asked,
  streaming,
  latest,
  showExtraction,
  onConsent,
}: {
  message: NiaUIMessage;
  actions: ChatActions;
  /** The customer message this replies to. */
  asked?: string;
  streaming: boolean;
  latest: boolean;
  showExtraction: boolean;
  onConsent: (candidateId: string, accept: boolean) => Promise<MemoryReceiptView | null>;
}) {
  const parts = message.parts as unknown as ({ type: string; text?: string } & Record<string, unknown>)[];
  const recall = partsOf(message, "recall");
  const memory = partsOf(message, "memory");
  const notice = partsOf(message, "notice");
  const text = parts
    .filter((p) => p.type === "text")
    .map((p) => p.text ?? "")
    .join("\n\n")
    .trim();
  const tools = parts.filter((p) => p.type.startsWith("tool-")) as unknown as ToolPart[];

  return (
    <div className="nia-enter flex flex-col gap-2.5">
      {recall ? <RecallChip data={recall.data} /> : null}
      {text ? (
        <div className={cn("max-w-[92%] rounded-[22px] rounded-bl-md border border-ink-900/[0.04] bg-surface-2/70 px-4 py-3 text-[15px] leading-relaxed", streaming && "min-h-11")}>
          <Markdown text={text} />
        </div>
      ) : null}
      {tools.length ? <ToolParts parts={tools} actions={actions} latest={latest} asked={asked} /> : null}
      {notice && notice.data.kind === "sign_in_required" ? (
        <p className="text-xs text-muted-foreground">
          <Link href={actions.signInHref} className="font-semibold text-accent-strong hover:underline">
            Sign in
          </Link>{" "}
          so Nia can remember your preferences next time.
        </p>
      ) : null}
      {notice && notice.data.kind === "ai_not_configured" ? <p className="rounded-xl bg-warning-soft px-3 py-2 text-sm text-warning">{notice.data.message}</p> : null}
      {memory ? <MemoryPanel slug={actions.slug} data={memory.data} showDecisions={showExtraction} onConsent={onConsent} /> : null}
    </div>
  );
}
