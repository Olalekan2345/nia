/**
 * Deterministic language models for tests (AI SDK MockLanguageModelV4).
 * Real model calls are never made in CI.
 */
import { MockLanguageModelV4 } from "ai/test";

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
  outputTokens: { total: 5, text: 5, reasoning: 0 },
};

export interface ScriptStep {
  text?: string;
  toolCalls?: { name: string; input: Record<string, unknown> }[];
}

function contentFor(step: ScriptStep, index: number) {
  const content: ({ type: "text"; text: string } | { type: "tool-call"; toolCallId: string; toolName: string; input: string })[] = [];
  if (step.text) content.push({ type: "text", text: step.text });
  for (const [i, call] of (step.toolCalls ?? []).entries()) {
    content.push({ type: "tool-call", toolCallId: `call_${index}_${i}`, toolName: call.name, input: JSON.stringify(call.input) });
  }
  return content;
}

/** A model that plays back one step per call (tool calls, then a final answer). */
export function scriptedModel(steps: ScriptStep[]) {
  let call = 0;
  const next = () => {
    const step = steps[Math.min(call, steps.length - 1)]!;
    const index = call++;
    return { step, index };
  };
  return new MockLanguageModelV4({
    doGenerate: async () => {
      const { step, index } = next();
      return {
        content: contentFor(step, index),
        finishReason: { unified: step.toolCalls?.length ? "tool-calls" : "stop", raw: undefined },
        usage,
        warnings: [],
      };
    },
    doStream: async () => {
      const { step, index } = next();
      const parts: unknown[] = [{ type: "stream-start", warnings: [] }];
      if (step.text) {
        parts.push({ type: "text-start", id: `t${index}` });
        for (const word of step.text.split(/(?<= )/)) parts.push({ type: "text-delta", id: `t${index}`, delta: word });
        parts.push({ type: "text-end", id: `t${index}` });
      }
      for (const [i, call] of (step.toolCalls ?? []).entries()) {
        parts.push({ type: "tool-call", toolCallId: `call_${index}_${i}`, toolName: call.name, input: JSON.stringify(call.input) });
      }
      parts.push({ type: "finish", finishReason: { unified: step.toolCalls?.length ? "tool-calls" : "stop", raw: undefined }, usage });
      return {
        stream: new ReadableStream({
          start(controller) {
            for (const p of parts) controller.enqueue(p as never);
            controller.close();
          },
        }),
      };
    },
  });
}

/** A model that always answers with the given JSON (for structured extraction). */
export function jsonModel(value: unknown | (() => unknown)) {
  return new MockLanguageModelV4({
    doGenerate: async () => ({
      content: [{ type: "text", text: JSON.stringify(typeof value === "function" ? (value as () => unknown)() : value) }],
      finishReason: { unified: "stop", raw: undefined },
      usage,
      warnings: [],
    }),
  });
}
