/**
 * Sensitive-pattern filtering.
 *
 * Runs before text is sent to the AI provider (redaction) and — more strictly —
 * before any candidate memory is persisted to Walrus (rejection). Nia must
 * never store passwords, card numbers, CVVs, OTP codes, API keys, seed
 * phrases, private keys or access tokens.
 */

export type SensitiveKind =
  | "card_number"
  | "cvv"
  | "otp"
  | "password"
  | "api_key"
  | "private_key"
  | "seed_phrase"
  | "access_token"
  | "bank_pin";

export interface SensitiveFinding {
  kind: SensitiveKind;
  index: number;
  length: number;
}

function luhnValid(digits: string): boolean {
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (d < 0 || d > 9) return false;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

interface PatternRule {
  kind: SensitiveKind;
  re: RegExp;
  /** optional post-filter on the matched text */
  accept?: (match: string) => boolean;
}

const RULES: PatternRule[] = [
  // Payment card numbers: 13–19 digits, optionally separated by spaces/dashes, Luhn-valid.
  {
    kind: "card_number",
    re: /\b(?:\d[ -]?){12,18}\d\b/g,
    accept: (m) => {
      const digits = m.replace(/[ -]/g, "");
      return digits.length >= 13 && digits.length <= 19 && luhnValid(digits);
    },
  },
  { kind: "cvv", re: /\b(?:cvv2?|cvc2?|security code)\s*(?:is|:|=)?\s*\d{3,4}\b/gi },
  {
    kind: "otp",
    re: /\b(?:otp|one[- ]time (?:code|password|pin)|verification code|auth(?:entication)? code|login code|2fa code|code)\s*(?:is|:|=)?\s*\d{4,8}\b/gi,
  },
  { kind: "bank_pin", re: /\b(?:pin|atm pin|card pin)\s*(?:is|:|=)\s*\d{4,6}\b/gi },
  { kind: "password", re: /\b(?:password|passcode|passwd|pwd)\s*(?:is|:|=)\s*\S+/gi },
  // Common API key / token shapes.
  { kind: "api_key", re: /\b(?:sk|pk|rk)_(?:live|test)_[A-Za-z0-9]{16,}\b/g },
  { kind: "api_key", re: /\bsk-[A-Za-z0-9_-]{20,}\b/g },
  { kind: "api_key", re: /\bAIza[0-9A-Za-z_-]{30,}\b/g },
  { kind: "api_key", re: /\b(?:AKIA|ASIA)[0-9A-Z]{16}\b/g },
  { kind: "api_key", re: /\bgh[pousr]_[A-Za-z0-9]{30,}\b/g },
  { kind: "api_key", re: /\bxox[abpr]-[A-Za-z0-9-]{10,}\b/g },
  { kind: "access_token", re: /\b\d{8,10}:[A-Za-z0-9_-]{35}\b/g }, // Telegram bot token
  { kind: "access_token", re: /\bBearer\s+[A-Za-z0-9._~+/-]{20,}=*/gi },
  { kind: "access_token", re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g }, // JWT
  { kind: "private_key", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
  { kind: "private_key", re: /\bsuiprivkey1[0-9a-z]{20,}\b/g },
  { kind: "private_key", re: /\b(?:private key|secret key|priv key)\s*(?:is|:|=)?\s*(?:0x)?[0-9a-fA-F]{32,}\b/gi },
  { kind: "private_key", re: /\b0x[0-9a-fA-F]{64}\b/g },
  {
    kind: "seed_phrase",
    re: /\b(?:seed phrase|recovery phrase|mnemonic|secret phrase|wallet phrase)\b[^\n]{0,20}?(?:[a-z]{3,8}\s+){11,23}[a-z]{3,8}\b/gi,
  },
];

export function findSensitive(text: string): SensitiveFinding[] {
  const findings: SensitiveFinding[] = [];
  for (const rule of RULES) {
    rule.re.lastIndex = 0;
    for (const match of text.matchAll(rule.re)) {
      const value = match[0];
      if (rule.accept && !rule.accept(value)) continue;
      findings.push({ kind: rule.kind, index: match.index ?? 0, length: value.length });
    }
  }
  return findings.sort((a, b) => a.index - b.index);
}

export function containsSensitive(text: string): boolean {
  return findSensitive(text).length > 0;
}

const REDACTION_LABEL: Record<SensitiveKind, string> = {
  card_number: "[card number removed]",
  cvv: "[security code removed]",
  otp: "[one-time code removed]",
  password: "[password removed]",
  api_key: "[API key removed]",
  private_key: "[private key removed]",
  seed_phrase: "[recovery phrase removed]",
  access_token: "[access token removed]",
  bank_pin: "[PIN removed]",
};

/** Replace sensitive spans with neutral placeholders. Overlapping findings are merged. */
export function redactSensitive(text: string): { text: string; kinds: SensitiveKind[] } {
  const findings = findSensitive(text);
  if (findings.length === 0) return { text, kinds: [] };
  let out = "";
  let cursor = 0;
  const kinds = new Set<SensitiveKind>();
  for (const f of findings) {
    if (f.index < cursor) continue; // overlapping with previous redaction
    out += text.slice(cursor, f.index) + REDACTION_LABEL[f.kind];
    cursor = f.index + f.length;
    kinds.add(f.kind);
  }
  out += text.slice(cursor);
  return { text: out, kinds: [...kinds] };
}
