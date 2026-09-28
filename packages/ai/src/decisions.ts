/**
 * Decision questions (askDecision). The question is kept in the stored
 * assistant text, so a tapped answer like "Emerald" keeps its meaning for the
 * next turn and for memory extraction — and a tapped option becomes a memory
 * directly, worded from the question, without another model call.
 */
import type { MemoryCandidate } from "@nia/memory";
import type { MemoryType } from "@nia/shared";

const MARKER = "Nia asked: ";

export interface AskedDecision {
  question: string;
  options: string[];
  /** 2–3 word label for what the answer tells Nia ("Gift type", "Budget"). */
  topic?: string;
}

export function withAskedQuestions(text: string, asked: AskedDecision[]): string {
  if (!asked.length) return text;
  return `${text}\n\n${MARKER}${asked.map((q) => `${q.question} (${q.options.join(" / ")})`).join("; ")}`.trim();
}

/** Split stored assistant text into what Nia said and the question she asked, if any. */
export function splitAskedQuestion(text: string): { body: string; asked: string | null } {
  const i = text.lastIndexOf(MARKER);
  if (i < 0) return { body: text, asked: null };
  return { body: text.slice(0, i).trim(), asked: text.slice(i + MARKER.length).trim() || null };
}

const normalize = (s: string) => s.trim().toLowerCase().replace(/[.!\s]+$/, "");
const NON_ANSWER = /^(?:no preference|not sure(?: yet)?|something else|other|anything|any|none|skip|i don'?t know|show me (?:everything|all|options))$/i;
const ABOUT_THEM = /\b(?:you|your)\b/i;

function typeFor(topic: string, question: string): MemoryType {
  const t = `${topic} ${question}`;
  if (/budget|spend|price range|how much/i.test(t)) return "BUDGET";
  if (/\bwho\b|for whom|recipient|buying for/i.test(t)) return "RELATIONSHIP_CONTEXT";
  if (/occasion|event|by when|what date/i.test(t)) return "OCCASION";
  if (/deliver|pick ?up/i.test(t)) return "DELIVERY_PREFERENCE";
  if (/\bsize\b/i.test(t) && ABOUT_THEM.test(question)) return "SIZE_OR_VARIANT";
  if (/colou?r|style|taste|flavou?r|material|fabric|scent|finish/i.test(t) && ABOUT_THEM.test(question)) return "CUSTOMER_PREFERENCE";
  return "PRODUCT_INTEREST";
}

const LONG_TERM: ReadonlySet<MemoryType> = new Set(["CUSTOMER_PREFERENCE", "SIZE_OR_VARIANT", "DELIVERY_PREFERENCE"]);

/**
 * Did the shopper tap one of the options? If so, the memory to propose (null
 * for non-answers like "No preference"). `tapped: false` means they typed
 * something else — leave it to the extraction model.
 */
export function decisionAnswer(decision: AskedDecision, userText: string): { tapped: boolean; candidate: MemoryCandidate | null } {
  const answer = decision.options.find((o) => normalize(o) === normalize(userText));
  if (!answer) return { tapped: false, candidate: null };
  if (NON_ANSWER.test(normalize(answer))) return { tapped: true, candidate: null };

  const question = decision.question.trim();
  const topic = (decision.topic?.trim() || question.replace(/\?+$/, "")).slice(0, 40);
  const type = typeFor(topic, question);
  const subject =
    type === "BUDGET"
      ? "budget_range"
      : topic
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "_")
          .replace(/^_+|_+$/g, "")
          .slice(0, 48) || "decision";
  return {
    tapped: true,
    candidate: {
      type,
      subject,
      value: answer.slice(0, 300),
      statement: `When Nia asked "${question.slice(0, 200)}", the shopper chose "${answer.slice(0, 200)}".`,
      label: `${topic}: ${answer}`.slice(0, 80),
      evidence: `Tapped "${answer.slice(0, 200)}"`,
      explicit: true,
      confidence: 0.9,
      importance: 0.6,
      futureUsefulness: 0.65,
      durability: LONG_TERM.has(type) ? "long_term" : "short_term",
      temporalScope: "current",
      isCorrection: false,
      previousValue: null,
    },
  };
}
