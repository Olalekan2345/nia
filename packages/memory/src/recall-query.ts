/**
 * Targeted semantic recall queries and repeat-intent detection.
 */

const REPEAT_PATTERNS: RegExp[] = [
  /\bsame (?:as|like) (?:last|before|the last)\b/i,
  /\bsame (?:thing|order|one|again|kind)\b/i,
  /\bthe usual\b/i,
  /\bmy usual\b/i,
  /\brepeat (?:my |the )?(?:last )?order\b/i,
  /\breorder\b/i,
  /\border (?:it |that )?again\b/i,
  /\blast time\b/i,
  /\bwhat i (?:got|bought|ordered) (?:last|before)\b/i,
  /\bwhere you sent the last\b/i,
  /\bbook my usual\b/i,
  /\bsame colou?r\b/i,
];

export function isRepeatIntent(text: string): boolean {
  return REPEAT_PATTERNS.some((re) => re.test(text));
}

const MEMORY_QUESTION =
  /\b(?:what do (?:i|you) (?:normally|usually|remember)|do you remember|what (?:do you know|have i told you)|my (?:usual|normal|preferences?|size)|where do you (?:usually|normally) (?:deliver|send)|usual(?:ly)? deliver|what size do i)\b/i;

export function isMemoryQuestion(text: string): boolean {
  return MEMORY_QUESTION.test(text);
}

const FORGET = /\b(?:don'?t|do not|stop) (?:remember|remembering|store|storing|save|saving)\b|\bforget (?:that|this|it|about)\b|\bthat(?:'s| is)(?:n'?t| not) (?:correct|right|true)\b/i;

/** The customer asks Nia to forget something (or says a remembered fact is wrong) — gates the forget tool. */
const FORGET_REQUEST =
  /\bforget\b|\b(?:delete|erase|wipe|clear|remove)\b.{0,40}\b(?:memor(?:y|ies)|that|this|it|what you)\b|\b(?:don'?t|do not|stop) (?:remember|remembering|store|storing|save|saving|keep|keeping)\b|\bthat(?:'s| is)(?:n'?t| not) (?:correct|right|true)\b/i;

export function isForgetRequest(text: string): boolean {
  return FORGET_REQUEST.test(text);
}

export function isForgetOrCorrectIntent(text: string): boolean {
  return FORGET.test(text);
}

const TRIVIAL = /^(?:ok(?:ay)?|k|yes|yeah|yep|no|nope|thanks?|thank you|great|cool|nice|sure|alright|👍|🙏|hi|hello|hey)[.!?\s]*$/i;

/** Should we run memory extraction after this user turn? */
const UPDATE_WORDS = /\b(?:now|from now|moved|changed?|instead|actually|anymore|no longer|i'?m|i am|i'?ve|i have|i prefer|i like|i want)\b/i;

/** A single question asking what Nia remembers ("What do I normally like?") — nothing new to store. */
export function isRecallOnlyQuestion(text: string): boolean {
  const t = text.trim();
  return /\?\s*$/.test(t) && !/[.!?]\s+\S/.test(t) && MEMORY_QUESTION.test(t) && !UPDATE_WORDS.test(t);
}

export function shouldExtract(userText: string): boolean {
  const t = userText.trim();
  if (t.length < 8) return false;
  if (TRIVIAL.test(t)) return false;
  if (isRecallOnlyQuestion(t)) return false;
  return true;
}

/** A second, order-history-focused query used when the customer refers to past purchases. */
export const ORDER_HISTORY_QUERY = "Customer placed order: previous purchases, items, variants, sizes, quantities, delivered to";

/** All recall queries for a turn: the focused message query, plus order history when relevant. */
export function buildRecallQueries(userTurns: string[]): string[] {
  const latest = userTurns[userTurns.length - 1] ?? "";
  const queries = [buildRecallQuery(userTurns)];
  if (isRepeatIntent(latest) || isMemoryQuestion(latest)) queries.push(ORDER_HISTORY_QUERY);
  return queries;
}

/**
 * Build a focused recall query from the latest user turn. Short follow-ups
 * ("yes, same size") borrow the previous user turn for context; repeat intents
 * are expanded toward order history and delivery defaults.
 */
export function buildRecallQuery(userTurns: string[]): string {
  const latest = (userTurns[userTurns.length - 1] ?? "").trim();
  const previous = (userTurns[userTurns.length - 2] ?? "").trim();
  let query = latest.length < 25 && previous ? `${previous} ${latest}` : latest;
  if (isRepeatIntent(latest)) {
    query += " — previous orders, usual items, quantities, sizes, colours and usual delivery area";
  }
  if (isMemoryQuestion(latest)) {
    query += " — customer preferences, sizes, colours, delivery area, typical orders";
  }
  return query.slice(0, 500);
}
