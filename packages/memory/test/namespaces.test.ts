import { describe, expect, it } from "vitest";
import {
  customerNamespace,
  merchantKnowledgeNamespace,
  merchantOperationsNamespace,
  namespaceFor,
  NamespaceError,
  parseNamespace,
} from "../src/namespaces";

const M = "3f2b7c1e-8a4d-4b6e-9c1f-2d3e4f5a6b7c";
const C = "9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d";

describe("namespace derivation", () => {
  it("derives the documented shapes", () => {
    expect(merchantKnowledgeNamespace("nia", M)).toBe(`nia:merchant:${M}:knowledge`);
    expect(merchantOperationsNamespace("nia", M)).toBe(`nia:merchant:${M}:operations`);
    expect(customerNamespace("nia", M, C)).toBe(`nia:merchant:${M}:customer:${C}`);
  });

  it("is deterministic and case-normalised", () => {
    expect(customerNamespace("nia", M.toUpperCase(), C)).toBe(customerNamespace("nia", M, C));
  });

  it("separates merchants and customers", () => {
    const other = "11111111-2222-4333-8444-555555555555";
    expect(customerNamespace("nia", M, C)).not.toBe(customerNamespace("nia", other, C));
    expect(customerNamespace("nia", M, C)).not.toBe(customerNamespace("nia", M, other));
  });

  it("rejects emails, phone numbers and injection attempts as ids", () => {
    expect(() => customerNamespace("nia", M, "amara@example.com")).toThrow(NamespaceError);
    expect(() => customerNamespace("nia", M, "+2348012345678")).toThrow(NamespaceError);
    expect(() => customerNamespace("nia", `${M}:customer:${C}`, C)).toThrow(NamespaceError);
    expect(() => merchantKnowledgeNamespace("nia", "*")).toThrow(NamespaceError);
  });

  it("rejects unsafe prefixes", () => {
    expect(() => merchantKnowledgeNamespace("Nia Prod", M)).toThrow(NamespaceError);
    expect(() => merchantKnowledgeNamespace("", M)).toThrow(NamespaceError);
  });

  it("requires a customer for customer scope", () => {
    expect(() => namespaceFor("nia", "customer", M, null)).toThrow(NamespaceError);
    expect(namespaceFor("nia", "merchant_operations", M)).toBe(merchantOperationsNamespace("nia", M));
  });

  it("round-trips through parseNamespace", () => {
    expect(parseNamespace(customerNamespace("nia", M, C))).toEqual({ prefix: "nia", merchantId: M, scope: "customer", customerId: C });
    expect(parseNamespace(merchantKnowledgeNamespace("nia", M))?.scope).toBe("merchant_knowledge");
    expect(parseNamespace("default")).toBeNull();
  });
});
