/**
 * Web chat endpoint (streaming).
 *
 * Only the latest customer message text is accepted from the browser; history
 * is loaded from the database, identity from the session cookie, and the
 * memory namespace is derived on the server. Memory receipts are streamed as
 * data parts and only flip to "stored" after Walrus confirms.
 */
import { after } from "next/server";
import { createUIMessageStream, createUIMessageStreamResponse, stepCountIs, streamText } from "ai";
import { z } from "zod";
import { env } from "@nia/config";
import {
  aiBusyMessage,
  createConversation,
  decisionView,
  extractAndRemember,
  getChatModel,
  getConversationForCustomer,
  isAiConfigured,
  memoryUsage,
  prepareTurn,
  recalledView,
  saveAssistantMessage,
  saveUserMessage,
  updateAssistantParts,
  answerOnLastStep,
  MAX_STEPS,
  withAskedQuestions,
  type AskedDecision,
  type NiaDataParts,
  type NiaUIMessage,
} from "@nia/ai";
import { awaitDurable, type MemoryReceipt } from "@nia/memory";
import { isAppError } from "@nia/shared";
import { newId } from "@nia/shared/server";
import { getGuestId } from "@/lib/auth";
import { assertSameOrigin, clientIpFrom, limit } from "@/lib/security";
import { ensureCustomer, loadStorefront } from "@/lib/storefront";
import { db, memoryStore } from "@/lib/server";

export const maxDuration = 60;

/** What the customer sees when a turn fails; the cause is logged either way. */
function chatErrorMessage(err: unknown): string {
  const busy = aiBusyMessage(err);
  if (busy) {
    console.warn("[chat] model provider rate limit", (err as Error)?.message?.slice(0, 200));
    return busy;
  }
  console.error("[chat] stream error", err);
  return isAppError(err) ? err.message : "Nia had trouble answering. Please try again.";
}

const Body = z.object({
  slug: z.string().min(1).max(64),
  conversationId: z.string().uuid().nullish(),
  text: z.string().trim().min(1).max(2000),
  memoryMode: z.enum(["on", "off"]).optional(),
});

function json(status: number, error: string) {
  return Response.json({ error }, { status });
}

export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
  } catch {
    return json(403, "Cross-site request blocked");
  }
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return json(400, "Invalid request");
  const input = parsed.data;

  const sf = await loadStorefront(input.slug);
  if (!sf) return json(404, "Shop not found");
  const { merchant } = sf;
  const customer = await ensureCustomer(sf);
  const guestId = customer ? null : await getGuestId(true);
  const who = customer?.id ?? guestId ?? clientIpFrom(req.headers);

  try {
    await limit(`chat-min:${merchant.id}:${who}`, 20, 60);
    await limit(`chat-day:${merchant.id}:${who}`, 300, 86400);
  } catch (err) {
    return json(429, isAppError(err) ? err.message : "Too many messages");
  }

  // Resolve or open the conversation (only the owner can continue it).
  let conversation = input.conversationId
    ? await getConversationForCustomer(db(), { merchantId: merchant.id, customerId: customer?.id ?? null, guestSessionId: guestId, conversationId: input.conversationId })
    : null;
  if (!conversation) {
    // Memory OFF is a comparison mode for the shop's own team in demo/judge mode.
    const allowOff = input.memoryMode === "off" && sf.isMember && env().NIA_DEMO_MODE;
    const base = { merchantId: merchant.id, customerId: customer?.id ?? null, guestSessionId: guestId, channel: "web" as const, memoryMode: allowOff ? ("off" as const) : ("on" as const) };
    // The page proposes the id for a new chat; if it's taken (by anyone), fall back to a fresh one.
    conversation = input.conversationId
      ? await createConversation(db(), { ...base, id: input.conversationId }).catch(() => createConversation(db(), base))
      : await createConversation(db(), base);
  }
  const conv = conversation;
  const store = memoryStore();
  const saved = await saveUserMessage(db(), { conversation: conv, text: input.text, channel: "web" });
  const ctx = { db: db(), store, merchant, customer, conversation: conv, channel: "web" as const };

  const stream = createUIMessageStream<NiaUIMessage>({
    onError: chatErrorMessage,
    execute: async ({ writer }) => {
      const messageId = newId();
      writer.write({ type: "start", messageId, messageMetadata: { conversationId: conv.id, channel: "web", createdAt: new Date().toISOString() } });

      if (!isAiConfigured()) {
        const text = `${merchant.name}'s assistant isn't fully set up yet — the AI provider is not configured on this deployment.`;
        const notice: NiaDataParts["notice"] = { kind: "ai_not_configured", message: "Set AI_PROVIDER, AI_MODEL and AI_API_KEY on the server to enable Nia's replies." };
        writer.write({ type: "data-notice", id: "notice", data: notice });
        writer.write({ type: "text-start", id: "t0" });
        writer.write({ type: "text-delta", id: "t0", delta: text });
        writer.write({ type: "text-end", id: "t0" });
        await saveAssistantMessage(db(), { conversation: conv, id: messageId, text, parts: [{ type: "data-notice", id: "notice", data: notice }, { type: "text", text }], memoryUsed: [], channel: "web" });
        writer.write({ type: "finish" });
        return;
      }

      const turn = await prepareTurn(ctx, input.text);
      const recall = (): NiaDataParts["recall"] => ({
        mode: turn.memoryMode,
        customer: recalledView(turn.scope.recalled.customer),
        merchant: recalledView(turn.scope.recalled.merchant),
        backend: store?.backend ?? null,
        network: store?.network ?? null,
        ...(turn.recallError ? { error: turn.recallError } : {}),
      });
      const showRecall = () => turn.memoryMode === "off" || turn.scope.recalled.customer.length > 0 || turn.scope.recalled.merchant.length > 0 || Boolean(turn.recallError);
      if (showRecall()) writer.write({ type: "data-recall", id: "recall", data: recall() });
      if (!customer && turn.memoryOffReason === "guest") {
        // Nudge once per conversation that sign-in enables durable memory.
        if (turn.history.length === 0) writer.write({ type: "data-notice", id: "notice", data: { kind: "sign_in_required", message: "Sign in so Nia can remember your preferences next time." } });
      }

      let responseParts: unknown[] = [];
      let resolveParts: () => void = () => {};
      const partsReady = new Promise<void>((r) => (resolveParts = r));
      const result = streamText({
        model: getChatModel(),
        system: turn.system,
        messages: turn.messages,
        tools: turn.tools,
        activeTools: turn.activeTools,
        stopWhen: stepCountIs(MAX_STEPS),
        prepareStep: answerOnLastStep,
        temperature: 0.4,
        maxRetries: turn.maxRetries,
        abortSignal: req.signal,
        onFinish: ({ steps, totalUsage }) => {
          // Token use per turn matters on rate-limited tiers (e.g. Groq free: 8K tokens/min).
          if (process.env.NODE_ENV === "development") console.info(`[ai] chat: ${steps.length} step(s), ${totalUsage.inputTokens ?? "?"} in / ${totalUsage.outputTokens ?? "?"} out tokens`);
        },
      });
      writer.merge(
        result.toUIMessageStream<NiaUIMessage>({
          sendStart: false,
          sendFinish: false,
          // Errors from the model call itself (e.g. provider rate limits) surface here.
          onError: chatErrorMessage,
          onFinish: ({ responseMessage }) => {
            responseParts = responseMessage.parts;
            resolveParts();
          },
        }),
      );
      const text = await result.text;
      await Promise.race([partsReady, new Promise((r) => setTimeout(r, 5000))]);

      // Tools may have recalled more memories mid-turn.
      if (showRecall()) writer.write({ type: "data-recall", id: "recall", data: recall() });
      const baseParts = [...(showRecall() ? [{ type: "data-recall", id: "recall", data: recall() }] : []), ...responseParts.filter((p) => (p as { type: string }).type !== "data-recall")];
      // Keep decision questions in the stored text, so the next turn (and memory extraction)
      // knows what a tapped answer like "A gift" was answering.
      const asked = (await result.steps)
        .flatMap((st) => st.toolCalls)
        .filter((tc) => tc.toolName === "askDecision")
        .map((tc) => tc.input as AskedDecision);
      const storedText = withAskedQuestions(text, asked);
      await saveAssistantMessage(db(), { conversation: conv, id: messageId, text: storedText, parts: baseParts, memoryUsed: memoryUsage(turn.scope), channel: "web" });

      // Memory: extract → classify → persist → confirm durably.
      if (customer && turn.memoryMode === "on" && store) {
        writer.write({ type: "data-memory", id: "memory", data: { phase: "extracting", receipts: [], decisions: [], consent: [] } });
        const extracted = await extractAndRemember(ctx, turn, { assistantText: text, userMessageId: saved.id });
        const decisions = extracted.outcomes.map(decisionView);
        const consent = extracted.outcomes.filter((o) => o.pendingCandidateId).map((o) => ({ candidateId: o.pendingCandidateId!, label: o.candidate.label }));
        let receipts = extracted.outcomes.map((o) => o.receipt).filter((r): r is MemoryReceipt => Boolean(r));
        if (receipts.length === 0) {
          const data: NiaDataParts["memory"] = { phase: "none", receipts: [], decisions, consent, ...(extracted.error ? { error: extracted.error } : {}) };
          writer.write({ type: "data-memory", id: "memory", data });
          if (decisions.length || consent.length) await updateAssistantParts(db(), messageId, [...baseParts, { type: "data-memory", id: "memory", data }]);
        } else {
          const pending = receipts.filter((r) => r.status === "pending" && r.recordId).map((r) => r.recordId!);
          const data: NiaDataParts["memory"] = { phase: pending.length ? "submitted" : "confirmed", receipts, decisions, consent };
          writer.write({ type: "data-memory", id: "memory", data });
          await updateAssistantParts(db(), messageId, [...baseParts, { type: "data-memory", id: "memory", data }]);
          // Walrus Mainnet jobs take ~30–60 s. Don't hold the customer's composer:
          // the client polls /api/memory/status, and this confirms server-side after the response.
          if (pending.length) {
            after(async () => {
              const confirmed = await awaitDurable(db(), store, pending, { timeoutMs: 50_000 });
              receipts = receipts.map((r) => confirmed.find((c) => c.recordId === r.recordId) ?? r);
              const final: NiaDataParts["memory"] = { phase: receipts.some((r) => r.status === "pending") ? "timeout" : "confirmed", receipts, decisions, consent };
              await updateAssistantParts(db(), messageId, [...baseParts, { type: "data-memory", id: "memory", data: final }]);
            });
          }
        }
      }
      writer.write({ type: "finish" });
    },
  });

  return createUIMessageStreamResponse({ stream });
}
