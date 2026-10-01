/**
 * Nia turn orchestration — shared by the web chat and the Telegram bot.
 *
 *   1. resolve merchant + customer (done by the caller from a verified session / update)
 *   2. build a targeted recall query
 *   3. recall a few relevant Walrus memories (customer + business)
 *   4. assemble context: rules, shop profile, policies, cart, memories, recent turns
 *   5. generate (streamed on web)
 *   6. extract → classify → persist approved memories (after the reply)
 */
import type { ModelMessage, ToolSet } from "ai";
import { and, eq, sql } from "drizzle-orm";
import { customers, memoryRecords, merchantKnowledge, messages, products, services, type Conversation, type Customer, type Db, type MemoryUsage, type Merchant } from "@nia/database";
import { getDraft, marketShopsWithCategories, orderSummary, type OrderSummaryData } from "@nia/commerce";
import {
  buildRecallQueries,
  isForgetRequest,
  isMemoryQuestion,
  processCandidates,
  recallCustomerMemory,
  recallMerchantMemory,
  refreshPending,
  shouldExtract,
  type CandidateOutcome,
  type MemoryStore,
  type RecalledMemory,
} from "@nia/memory";
import { redactSensitive, type Channel, type MemoryScope } from "@nia/shared";
import { buildMarketSystemPrompt, buildSystemPrompt, formatCart, formatKnowledge, formatRecalledMemories } from "./prompts";
import { createNiaTools, type NiaToolScope, type NiaTools } from "./tools";
import { createMarketTools, type MarketTools } from "./market-tools";
import { BASKET_EDIT_TALK, COMPARE_TALK, LIST_TALK, PLAN_TALK, SAVE_TALK } from "./agent-tools";
import { withCompactOutputs } from "./model-output";
import { CONTINUE_TALK, formatSession, previousSession, sessionHandle } from "./session";
import { extractMemories } from "./extraction";
import { decisionAnswer, splitAskedQuestion, type AskedDecision } from "./decisions";
import { callSettings, getExtractionModel } from "./provider";
import { loadHistory } from "./conversations";
import type { ExtractionDecisionView, MemoryReceiptView, RecalledMemoryView } from "./ui-types";

export interface TurnContext {
  db: Db;
  store: MemoryStore | null;
  merchant: Merchant;
  customer: Customer | null;
  conversation: Conversation;
  channel: Channel;
  now?: Date;
}

export interface PreparedTurn {
  system: string;
  messages: ModelMessage[];
  /** Shop tools, or the Walrus Market guide's tools when the merchant is the market. */
  tools: ToolSet;
  scope: NiaToolScope;
  userText: string;
  history: { id: string; role: "user" | "assistant"; text: string }[];
  memoryMode: "on" | "off";
  /** Why memory is effectively off, if it is. */
  memoryOffReason: "demo_off" | "merchant_disabled" | "customer_disabled" | "guest" | "not_configured" | null;
  recallError?: string;
  cart: OrderSummaryData | null;
  /** Tools offered this turn (only the relevant ones — keeps prompts small for rate-limited providers). */
  activeTools: string[];
  /** Provider-specific retry budget (e.g. Groq rate limits). */
  maxRetries: number;
  /** Output cap per model step (Groq rejects requests whose expected output exceeds its per-minute cap). */
  maxOutputTokens?: number;
}

export function effectiveMemoryMode(ctx: Pick<TurnContext, "merchant" | "customer" | "conversation" | "store">): {
  mode: "on" | "off";
  reason: PreparedTurn["memoryOffReason"];
} {
  if (ctx.conversation.memoryMode === "off") return { mode: "off", reason: "demo_off" };
  if (!ctx.merchant.niaSettings.memoryEnabled) return { mode: "off", reason: "merchant_disabled" };
  if (!ctx.customer) return { mode: "off", reason: "guest" };
  if (!ctx.customer.memoryEnabled) return { mode: "off", reason: "customer_disabled" };
  if (!ctx.store) return { mode: "on", reason: "not_configured" };
  return { mode: "on", reason: null };
}

async function relevantKnowledge(db: Db, merchantId: string, query: string) {
  const rows = await db.select().from(merchantKnowledge).where(and(eq(merchantKnowledge.merchantId, merchantId), eq(merchantKnowledge.active, true)));
  const words = query.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
  const always = new Set(["shipping", "returns", "service_policy"]);
  return rows
    .map((k) => ({
      k,
      score: (always.has(k.category) ? 1 : 0) + words.reduce((a, w) => a + (`${k.title} ${k.body}`.toLowerCase().includes(w) ? 2 : 0), 0),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map((x) => x.k);
}

/** Offer only the tools that can help this turn. */
export function selectTools(o: {
  signedIn: boolean;
  memoryOn: boolean;
  hasServices: boolean;
  customerHasMemory: boolean;
  merchantHasMemory: boolean;
  recalledCustomer: boolean;
  recalledMerchant: boolean;
  forgetRequested: boolean;
  /** Booking talk in recent turns, or a services-only shop. */
  bookingContext: boolean;
  /** A cart exists or the customer is talking about buying/delivery. */
  orderContext: boolean;
  /** "What do you remember about me?" and similar. */
  memoryQuestion?: boolean;
  /** A multi-part goal (event, outfit, set-up, list) or a basket to adjust. */
  planContext?: boolean;
  /** "Compare these", "which is better". */
  compareContext?: boolean;
  /** "Save these", "add milk to my list". */
  saveContext?: boolean;
  listContext?: boolean;
}): (keyof NiaTools)[] {
  const tools: (keyof NiaTools)[] = ["searchProducts", "getProduct", "getMerchantPolicy"];
  if (o.compareContext) tools.push("compareProducts");
  if (o.planContext) tools.push("planBasket");
  if (o.saveContext) tools.push("saveForLater");
  if (o.listContext) tools.push("updateShoppingList");
  if (o.memoryQuestion && o.signedIn && o.memoryOn) tools.push("showMyMemory");
  // Recall already ran for this turn. The search tools are only offered when it
  // found nothing, keeping relayer calls inside the delegate key's rate limit.
  if (o.merchantHasMemory && !o.recalledMerchant) tools.push("recallMerchantMemory");
  // Tool schemas are ~40% of each prompt; offering only what the turn can use keeps it small.
  const booking = o.hasServices && o.bookingContext;
  if (o.hasServices) tools.push("searchServices", "getService");
  if (booking) tools.push("getAvailableBookingSlots");
  if (o.signedIn) {
    tools.push("createDraftOrder", "addItemToDraft", "getOrder");
    if (o.orderContext) tools.push("updateDraftItem", "removeDraftItem", "setFulfillment", "showOrderSummary");
    if (booking) tools.push("createBookingDraft");
    if (o.memoryOn) {
      tools.push("getCustomerRecentOrders");
      if (o.customerHasMemory && !o.recalledCustomer) tools.push("recallCustomerMemory");
      if (o.recalledCustomer && o.forgetRequested) tools.push("forgetCustomerMemory");
    }
  }
  return tools;
}

const BOOKING_TALK = /\b(?:book(?:ing)?|appointment|slot|schedul\w*|reserv\w*|availab\w*|when can|come in|fitting|session|consult\w*|tailor\w*|sew\w*|alteration)\b/i;
const ORDER_TALK = /\b(?:buy|order|add|cart|checkout|check out|pay|deliver\w*|pick ?up|collect|ship\w*|quantity|yards?|remove|change|swap|instead)\b/i;

/** Model steps per reply. The last one may not call tools, so every reply ends in words. */
export const MAX_STEPS = 6;
export function answerOnLastStep({ stepNumber }: { stepNumber: number }): { toolChoice?: "none" } {
  return stepNumber >= MAX_STEPS - 1 ? { toolChoice: "none" } : {};
}

/** Walrus Market guide: always search/compare/ask; memory tools only when they can help. */
export function selectMarketTools(o: {
  memoryOn: boolean;
  customerHasMemory: boolean;
  recalledCustomer: boolean;
  forgetRequested: boolean;
  signedIn?: boolean;
  memoryQuestion?: boolean;
  planContext?: boolean;
  saveContext?: boolean;
  listContext?: boolean;
}): (keyof MarketTools)[] {
  const tools: (keyof MarketTools)[] = ["searchMarket", "searchMarketServices", "compareProducts", "askDecision"];
  if (o.planContext) tools.push("planBasket");
  if (o.saveContext) tools.push("saveForLater");
  if (o.listContext) tools.push("updateShoppingList");
  if (o.memoryQuestion && o.signedIn && o.memoryOn) tools.push("showMyMemory");
  else if (o.memoryOn && o.customerHasMemory && !o.recalledCustomer) tools.push("recallCustomerMemory");
  if (o.memoryOn && o.recalledCustomer && o.forgetRequested) tools.push("forgetCustomerMemory");
  return tools;
}

/** Does this customer (incl. merged records) / this shop have any stored, non-forgotten memory? */
async function memoryPresence(db: Db, merchantId: string, customerId: string | null): Promise<{ customerHasMemory: boolean; merchantScopes: MemoryScope[] }> {
  const [row] = await db
    .select({
      customer: customerId
        ? sql<boolean>`bool_or(${memoryRecords.customerId} = ${customerId} or ${memoryRecords.customerId} in (select ${customers.id} from ${customers} where ${customers.mergedIntoId} = ${customerId}))`
        : sql<boolean>`false`,
      knowledge: sql<boolean>`bool_or(${memoryRecords.scope} = 'merchant_knowledge')`,
      operations: sql<boolean>`bool_or(${memoryRecords.scope} = 'merchant_operations')`,
    })
    .from(memoryRecords)
    .where(and(eq(memoryRecords.merchantId, merchantId), eq(memoryRecords.persistStatus, "stored"), sql`${memoryRecords.lifecycle} <> 'forgotten'`));
  const merchantScopes: MemoryScope[] = [];
  if (row?.knowledge) merchantScopes.push("merchant_knowledge");
  if (row?.operations) merchantScopes.push("merchant_operations");
  return { customerHasMemory: Boolean(row?.customer), merchantScopes };
}

/**
 * Prepare one turn. `userText` is the raw customer message; it is redacted
 * before being sent to the model.
 */
export async function prepareTurn(ctx: TurnContext, rawUserText: string, opts: { historyLimit?: number } = {}): Promise<PreparedTurn> {
  const { db, store, merchant, customer, conversation, channel } = ctx;
  const now = ctx.now ?? new Date();
  const userText = redactSensitive(rawUserText).text;
  const history = await loadHistory(db, conversation.id, opts.historyLimit ?? 12);
  // The caller may already have saved the current user message; don't duplicate it.
  const prior = history.length && history[history.length - 1]!.role === "user" && history[history.length - 1]!.text === userText ? history.slice(0, -1) : history;

  const { mode, reason } = effectiveMemoryMode(ctx);
  const userTurns = [...prior.filter((h) => h.role === "user").map((h) => h.text), userText];
  const queries = buildRecallQueries(userTurns);
  const query = queries[0]!;

  // Settle writes from earlier turns whose Walrus job outlasted that request.
  if (store) await refreshPending(db, store, { merchantId: merchant.id, customerId: mode === "on" ? (customer?.id ?? null) : null }).catch(() => []);
  // Skip relayer calls for namespaces Nia has never written to (saves latency and rate limit).
  const { customerHasMemory, merchantScopes } = store
    ? await memoryPresence(db, merchant.id, mode === "on" ? (customer?.id ?? null) : null)
    : { customerHasMemory: false, merchantScopes: [] as MemoryScope[] };
  const merchantHasMemory = merchantScopes.length > 0;

  // The Walrus Market record sells nothing itself: no shop policies, cart or business memory.
  const isMarket = merchant.kind === "market";
  let recallError: string | undefined;
  const [customerMemories, merchantMemories, knowledge, cart, hasServices, hasProducts, shops] = await Promise.all([
    mode === "on" && customer && store && customerHasMemory
      ? recallCustomerMemory(db, store, { merchantId: merchant.id, customerId: customer.id, query: queries, limit: 6 }).catch((err: Error) => {
          console.warn("[memory] customer recall failed", err.message.slice(0, 200));
          recallError = `Customer memory recall failed: ${err.message.slice(0, 160)}`;
          return [] as RecalledMemory[];
        })
      : Promise.resolve([] as RecalledMemory[]),
    store && merchantHasMemory && !isMarket
      ? recallMerchantMemory(db, store, { merchantId: merchant.id, query, limit: 3, scopes: merchantScopes }).catch((err: Error) => {
          console.warn("[memory] business recall failed", err.message.slice(0, 200));
          recallError ??= `Business memory recall failed: ${err.message.slice(0, 160)}`;
          return [] as RecalledMemory[];
        })
      : Promise.resolve([] as RecalledMemory[]),
    isMarket ? Promise.resolve([]) : relevantKnowledge(db, merchant.id, userText),
    customer && !isMarket ? getDraft(db, merchant.id, customer.id).then((d) => (d ? orderSummary(db, merchant.id, d.id) : null)) : Promise.resolve(null),
    // Does the shop offer services? Decides whether booking tools are offered.
    db.select({ id: services.id }).from(services).where(and(eq(services.merchantId, merchant.id), eq(services.active, true))).limit(1).then((r) => r.length > 0),
    db.select({ id: products.id }).from(products).where(and(eq(products.merchantId, merchant.id), eq(products.active, true))).limit(1).then((r) => r.length > 0),
    isMarket ? marketShopsWithCategories(db) : Promise.resolve([]),
  ]);
  const recentTalk = userTurns.slice(-3).join(" ");

  // Shopping session: this conversation's goal, results shown, shortlist, list and basket.
  const session = sessionHandle(db, conversation.id, conversation.session);
  const s = session.current;
  // Picking up earlier shopping ("let's continue", "those laptops again") from another conversation —
  // only when asked, so Nia doesn't resurrect abandoned shopping unprompted.
  const earlier =
    customer && mode === "on" && CONTINUE_TALK.test(userText) && !s.shortlist?.length && !s.basket
      ? await previousSession(db, { merchantId: merchant.id, customerId: customer.id, excludeConversationId: conversation.id }).catch(() => null)
      : null;
  const sessionText = [
    formatSession(s),
    earlier ? formatSession(earlier.session, { label: new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: merchant.timezone }).format(earlier.lastMessageAt) }) : "",
  ]
    .filter(Boolean)
    .join("\n");
  if (earlier?.session.shortlist?.length && !s.lastResults?.length) {
    // Let "show me those again" / "compare those" resolve against the earlier shortlist.
    await session.update((cur) => ({ ...cur, lastResults: earlier.session.shortlist }));
  }
  const memoryNote = recallError ? "<nia_memory_status>Memory is temporarily unavailable this turn — say so if the customer asks what you remember; never guess their history.</nia_memory_status>" : "";

  const scope: NiaToolScope = {
    db,
    store,
    merchant,
    customerId: customer?.id ?? null,
    customerMemoryEnabled: Boolean(customer?.memoryEnabled),
    channel,
    conversationId: conversation.id,
    memoryMode: mode,
    recalled: { customer: customerMemories, merchant: merchantMemories },
    flags: { memoryAssisted: false, forgotten: [] },
    session,
  };
  const gates = {
    memoryQuestion: isMemoryQuestion(userText),
    planContext:
      PLAN_TALK.test(userText) ||
      Boolean(s.basket && (BASKET_EDIT_TALK.test(userText) || PLAN_TALK.test(recentTalk))) ||
      Boolean(s.list?.length && /\b(?:get|buy|order) (?:everything|it all|them)\b/i.test(userText)),
    compareContext: COMPARE_TALK.test(userText),
    saveContext: SAVE_TALK.test(userText),
    listContext: LIST_TALK.test(userText),
  };

  const customerView = customer ? { signedIn: true, name: customer.displayName, memoryEnabled: customer.memoryEnabled } : null;
  const system = isMarket
    ? [
        buildMarketSystemPrompt({
          now,
          timeZone: merchant.timezone,
          customer: customerView,
          memoryMode: mode,
          shops: shops.map((sh) => ({ name: sh.name, slug: sh.slug, type: sh.businessLabel, city: sh.city, demo: sh.isDemo, categories: sh.categories })),
        }),
        mode === "on" ? formatRecalledMemories(customerMemories, [], merchant.timezone) : "",
        memoryNote,
        sessionText,
      ]
        .filter(Boolean)
        .join("\n\n")
    : [
    buildSystemPrompt({
      merchant,
      channel,
      now,
      customer: customerView,
      memoryMode: mode,
      memoryConfigured: Boolean(store),
    }),
    formatKnowledge(knowledge),
    customer ? formatCart(cart, merchant.locale) : "",
    mode === "on" ? formatRecalledMemories(customerMemories, merchantMemories, merchant.timezone) : formatRecalledMemories([], merchantMemories, merchant.timezone),
    memoryNote,
    sessionText,
  ]
    .filter(Boolean)
    .join("\n\n");

  const messages: ModelMessage[] = [
    ...prior.map((h): ModelMessage => (h.role === "user" ? { role: "user", content: h.text } : { role: "assistant", content: h.text })),
    { role: "user", content: userText },
  ];

  return {
    system,
    messages,
    // The model gets compact tool results; cards and Telegram get the full ones.
    tools: isMarket ? withCompactOutputs(createMarketTools(scope)) : withCompactOutputs(createNiaTools(scope)),
    activeTools: isMarket
      ? selectMarketTools({
          memoryOn: mode === "on",
          customerHasMemory,
          recalledCustomer: customerMemories.length > 0,
          forgetRequested: isForgetRequest(userText),
          signedIn: Boolean(customer),
          ...gates,
        })
      : selectTools({
      signedIn: Boolean(customer),
      memoryOn: mode === "on",
      hasServices,
      customerHasMemory,
      merchantHasMemory,
      recalledCustomer: customerMemories.length > 0,
      recalledMerchant: merchantMemories.length > 0,
      forgetRequested: isForgetRequest(userText),
      bookingContext: !hasProducts || BOOKING_TALK.test(recentTalk),
      orderContext: Boolean(cart) || ORDER_TALK.test(recentTalk),
      ...gates,
    }),
    maxRetries: callSettings("chat").maxRetries,
    maxOutputTokens: callSettings("chat").maxOutputTokens,
    scope,
    userText,
    history: prior,
    memoryMode: mode,
    memoryOffReason: reason,
    recallError,
    cart,
  };
}

/* ─────────────────────────────── Views ─────────────────────────────── */

export function recalledView(list: RecalledMemory[]): RecalledMemoryView[] {
  return list.map((m) => ({
    ref: m.ref,
    text: m.text,
    label: m.record?.label ?? null,
    type: m.record?.type ?? null,
    scope: m.scope,
    historical: m.historical,
    distance: m.distance,
    blobId: m.blobId,
    storedAt: m.createdAt,
  }));
}

export function memoryUsage(scope: NiaToolScope): MemoryUsage[] {
  return [...scope.recalled.customer, ...scope.recalled.merchant]
    .filter((m) => !scope.flags.forgotten.includes(m.blobId))
    .map((m) => ({
      blobId: m.blobId,
      recordId: m.record?.id ?? null,
      type: m.record?.type ?? null,
      label: m.record?.label ?? null,
      scope: m.scope,
      distance: m.distance,
      lifecycle: m.record?.lifecycle ?? null,
      storedAt: m.createdAt,
    }));
}

export function receiptView(o: CandidateOutcome["receipt"]): MemoryReceiptView | null {
  if (!o) return null;
  return { ...o };
}

export function decisionView(o: CandidateOutcome): ExtractionDecisionView {
  return {
    type: o.candidate.type,
    label: o.candidate.label,
    statement: o.candidate.statement,
    decision: o.decision.decision,
    score: o.decision.score,
    explicit: o.candidate.explicit,
    confidence: o.candidate.confidence,
    reasons: o.decision.reasons,
  };
}

/* ─────────────────────────────── After the reply ─────────────────────────────── */

export interface AfterTurnResult {
  ran: boolean;
  outcomes: CandidateOutcome[];
  error?: string;
}

/** The decision question (askDecision) in a stored assistant message, if it asked one. */
async function askedDecisionIn(db: Db, messageId: string): Promise<AskedDecision | null> {
  const [row] = await db.select({ parts: messages.parts }).from(messages).where(eq(messages.id, messageId)).limit(1);
  const parts = (Array.isArray(row?.parts) ? row.parts : []) as { type?: string; input?: Partial<AskedDecision> }[];
  const input = parts.findLast((p) => p.type === "tool-askDecision")?.input;
  return input && typeof input.question === "string" && Array.isArray(input.options) ? { question: input.question, options: input.options.map(String), topic: input.topic } : null;
}

export async function extractAndRemember(
  ctx: TurnContext,
  turn: PreparedTurn,
  { assistantText, userMessageId }: { assistantText: string; userMessageId: string },
): Promise<AfterTurnResult> {
  const { db, store, merchant, customer, conversation, channel } = ctx;
  if (!customer || turn.memoryMode === "off" || !store) return { ran: false, outcomes: [] };
  // A tapped answer ("Emerald") is short, but it answers Nia's question — always worth a look.
  const lastNia = turn.history.findLast((h) => h.role === "assistant");
  const answering = lastNia ? splitAskedQuestion(lastNia.text).asked : null;
  if (!answering && !shouldExtract(turn.userText)) return { ran: false, outcomes: [] };

  // A tapped option is the shopper's own answer: record it as chosen, no model call needed.
  const decision = answering && lastNia ? await askedDecisionIn(db, lastNia.id) : null;
  const tapped = decision ? decisionAnswer(decision, turn.userText) : { tapped: false, candidate: null };
  const { candidates, error } = tapped.tapped
    ? { candidates: tapped.candidate ? [tapped.candidate] : [], error: undefined }
    : await extractMemories({
        model: getExtractionModel(),
        merchant,
        userText: turn.userText,
        answering,
        assistantText,
        previousTurns: turn.history.map((h) => ({ role: h.role, text: h.text })),
        recalled: turn.scope.recalled.customer,
        now: ctx.now ?? new Date(),
      });
  if (candidates.length === 0) return { ran: true, outcomes: [], error };

  const outcomes = await processCandidates(db, store, {
    merchantId: merchant.id,
    customerId: customer.id,
    sourceKind: "conversation",
    channel,
    conversationId: conversation.id,
    messageId: userMessageId,
  }, candidates);
  return { ran: true, outcomes, error };
}
