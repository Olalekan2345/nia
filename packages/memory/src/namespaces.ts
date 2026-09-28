/**
 * Walrus Memory namespace derivation.
 *
 * Namespaces are always derived on the server from database ids that were
 * resolved through an authenticated session or a verified Telegram update.
 * Nothing from the browser or a Telegram payload is ever used as a namespace.
 *
 * Only opaque UUIDs are accepted as ids, which structurally prevents emails,
 * phone numbers or other personal identifiers from ending up in a namespace.
 *
 *   <prefix>:merchant:<merchant-id>:knowledge
 *   <prefix>:merchant:<merchant-id>:operations
 *   <prefix>:merchant:<merchant-id>:customer:<customer-id>
 *
 * Note (from the Walrus Memory docs): a namespace is a data-organisation
 * boundary, not a security boundary — the delegate key can read every
 * namespace under the account. Isolation is enforced by this server mapping
 * each authenticated identity to exactly one namespace.
 */
import type { MemoryScope } from "@nia/shared";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const PREFIX_RE = /^[a-z][a-z0-9-]{0,31}$/;
const MAX_NAMESPACE_BYTES = 255;

export class NamespaceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NamespaceError";
  }
}

function assertUuid(value: string, what: string): string {
  const v = value.toLowerCase();
  if (!UUID_RE.test(v)) throw new NamespaceError(`${what} must be an opaque UUID`);
  return v;
}

function assertPrefix(prefix: string): string {
  if (!PREFIX_RE.test(prefix)) throw new NamespaceError("namespace prefix must be lowercase letters, digits or dashes");
  return prefix;
}

function finalize(ns: string): string {
  if (Buffer.byteLength(ns, "utf8") > MAX_NAMESPACE_BYTES) throw new NamespaceError("namespace too long");
  return ns;
}

export function customerNamespace(prefix: string, merchantId: string, customerId: string): string {
  return finalize(
    `${assertPrefix(prefix)}:merchant:${assertUuid(merchantId, "merchantId")}:customer:${assertUuid(customerId, "customerId")}`,
  );
}

export function merchantKnowledgeNamespace(prefix: string, merchantId: string): string {
  return finalize(`${assertPrefix(prefix)}:merchant:${assertUuid(merchantId, "merchantId")}:knowledge`);
}

export function merchantOperationsNamespace(prefix: string, merchantId: string): string {
  return finalize(`${assertPrefix(prefix)}:merchant:${assertUuid(merchantId, "merchantId")}:operations`);
}

export function namespaceFor(
  prefix: string,
  scope: MemoryScope,
  merchantId: string,
  customerId?: string | null,
): string {
  switch (scope) {
    case "customer":
      if (!customerId) throw new NamespaceError("customer scope requires a customerId");
      return customerNamespace(prefix, merchantId, customerId);
    case "merchant_knowledge":
      return merchantKnowledgeNamespace(prefix, merchantId);
    case "merchant_operations":
      return merchantOperationsNamespace(prefix, merchantId);
  }
}

/** Parse a namespace back into its parts (used by diagnostics and the explorer). */
export function parseNamespace(
  ns: string,
): { prefix: string; merchantId: string; scope: MemoryScope; customerId?: string } | null {
  const parts = ns.split(":");
  if (parts.length === 4 && parts[1] === "merchant" && UUID_RE.test(parts[2]!)) {
    if (parts[3] === "knowledge") return { prefix: parts[0]!, merchantId: parts[2]!, scope: "merchant_knowledge" };
    if (parts[3] === "operations") return { prefix: parts[0]!, merchantId: parts[2]!, scope: "merchant_operations" };
  }
  if (parts.length === 5 && parts[1] === "merchant" && parts[3] === "customer" && UUID_RE.test(parts[2]!) && UUID_RE.test(parts[4]!)) {
    return { prefix: parts[0]!, merchantId: parts[2]!, scope: "customer", customerId: parts[4]! };
  }
  return null;
}
