/**
 * Types shared by the server stream and the web chat UI. Type-only module —
 * safe to import from client components.
 */
import type { UIMessage } from "ai";
import type { MemoryDecision, MemoryScope, MemoryType } from "@nia/shared";

export interface RecalledMemoryView {
  ref: string;
  text: string;
  label: string | null;
  type: MemoryType | null;
  scope: MemoryScope;
  historical: boolean;
  distance: number;
  blobId: string;
  storedAt: string | null;
}

export interface MemoryReceiptView {
  recordId: string | null;
  type: MemoryType;
  label: string;
  status: "pending" | "stored" | "failed" | "duplicate" | "skipped";
  confirmation: string;
  blobId: string | null;
  jobId: string | null;
  namespace: string | null;
  storedAt: string | null;
  backend: "walrus" | "mock" | null;
  network: string | null;
  supersededCount: number;
  reason?: string;
}

export interface ExtractionDecisionView {
  type: MemoryType;
  label: string;
  statement: string;
  decision: MemoryDecision;
  score: number;
  explicit: boolean;
  confidence: number;
  reasons: string[];
}

export type NiaDataParts = {
  /** Which Walrus memories informed this answer. */
  recall: {
    mode: "on" | "off";
    customer: RecalledMemoryView[];
    merchant: RecalledMemoryView[];
    backend: "walrus" | "mock" | null;
    network: string | null;
    error?: string;
  };
  /** Memory write receipts — flips pending → stored only after the relayer confirms. */
  memory: {
    phase: "extracting" | "submitted" | "confirmed" | "timeout" | "none";
    receipts: MemoryReceiptView[];
    decisions: ExtractionDecisionView[];
    consent: { candidateId: string; label: string }[];
    error?: string;
  };
  notice: { kind: "sign_in_required" | "ai_not_configured" | "memory_not_configured" | "error"; message: string };
};

export type NiaMessageMetadata = { createdAt?: string; conversationId?: string; channel?: "web" | "telegram" };

export type NiaUIMessage = UIMessage<NiaMessageMetadata, NiaDataParts>;
