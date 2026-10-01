import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { APICallError, generateText, stepCountIs, streamText, tool } from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { z } from "zod";
import { aiConfig, resetEnvCache } from "@nia/config";
import { aiBusyMessage, normalizeToolCallIds, shouldFallBack, withFallback } from "../src/provider";
import { scriptedModel } from "./mock-model";

// The backup model (Mistral) answers whenever the main one (Groq) refuses a request.

const refused = (statusCode: number, message: string, responseBody = "") =>
  new APICallError({ message, url: "https://api.groq.com/openai/v1/chat/completions", requestBodyValues: {}, statusCode, responseBody, isRetryable: statusCode === 429 });

const failing = (err: Error) =>
  new MockLanguageModelV4({
    doGenerate: async () => {
      throw err;
    },
    doStream: async () => {
      throw err;
    },
  });

const TPD = refused(429, "Rate limit reached for model `qwen/qwen3.8-27b` on tokens per day (TPD): Limit 300000, Used 299500, Requested 8200. Please try again in 21m3s.");

// Real keys from .env never leak into these tests, and are put back afterwards.
const KEYS = ["AI_FALLBACK_PROVIDER", "AI_FALLBACK_MODEL", "AI_FALLBACK_API_KEY", "MISTRAL_API_KEY"] as const;
const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
beforeEach(() => {
  for (const k of KEYS) delete process.env[k];
  resetEnvCache();
});
afterEach(() => {
  vi.restoreAllMocks();
  for (const k of KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  resetEnvCache();
});

describe("backup model", () => {
  it("answers when the main model has hit its daily limit", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const model = withFallback(failing(TPD), scriptedModel([{ text: "Here are three laptops." }]), "mistral/mistral-medium-latest");
    const r = await generateText({ model, prompt: "laptops under 800k", maxRetries: 0 });
    expect(r.text).toBe("Here are three laptops.");
    expect(console.warn).toHaveBeenCalledWith(expect.stringMatching(/main model refused \(429\) — using mistral\/mistral-medium-latest/));
  });

  it("streams the backup's reply on the web", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const r = streamText({ model: withFallback(failing(TPD), scriptedModel([{ text: "Hello from the backup" }])), prompt: "hi", maxRetries: 0 });
    expect(await r.text).toBe("Hello from the backup");
  });

  it("finishes a reply on the backup when the limit runs out between steps, with ids it accepts", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    let calls = 0;
    const seenIds: string[] = [];
    const main = new MockLanguageModelV4({
      doGenerate: async () => {
        if (calls++ > 0) throw TPD;
        return {
          content: [{ type: "tool-call", toolCallId: "call_8f2c_x-91", toolName: "searchMarket", input: JSON.stringify({ query: "laptop" }) }],
          finishReason: { unified: "tool-calls", raw: undefined },
          usage: { inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 5, text: 5, reasoning: 0 } },
          warnings: [],
        };
      },
    });
    const backup = new MockLanguageModelV4({
      doGenerate: async (options) => {
        for (const m of options.prompt) if (Array.isArray(m.content)) for (const p of m.content) if ("toolCallId" in p) seenIds.push(p.toolCallId as string);
        return {
          content: [{ type: "text", text: "The Tusk 15 is the pick." }],
          finishReason: { unified: "stop", raw: undefined },
          usage: { inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 }, outputTokens: { total: 5, text: 5, reasoning: 0 } },
          warnings: [],
        };
      },
    });
    const r = await generateText({
      model: withFallback(main, backup),
      prompt: "laptop for work",
      tools: { searchMarket: tool({ description: "search", inputSchema: z.object({ query: z.string() }), execute: async () => ({ ok: true, products: [] }) }) },
      stopWhen: stepCountIs(3),
      maxRetries: 0,
    });
    expect(r.text).toBe("The Tusk 15 is the pick.");
    // The tool call and its result reach the backup under one 9-character id.
    expect(seenIds).toHaveLength(2);
    expect(new Set(seenIds).size).toBe(1);
    expect(seenIds[0]).toMatch(/^[A-Za-z0-9]{9}$/);
  });

  it("only steps in for limits, overload, outages and broken tool calls — not real bad requests", async () => {
    expect(shouldFallBack(TPD)).toBe(true);
    expect(shouldFallBack(refused(413, "Request too large for model on tokens per minute"))).toBe(true);
    expect(shouldFallBack(refused(503, "Service unavailable"))).toBe(true);
    expect(shouldFallBack(refused(400, "Failed to call a function. Please adjust your prompt.", '{"error":{"code":"tool_use_failed"}}'))).toBe(true);
    expect(shouldFallBack(refused(400, "messages: invalid role"))).toBe(false);
    expect(shouldFallBack(refused(401, "Invalid API Key"))).toBe(false);
    await expect(generateText({ model: withFallback(failing(refused(400, "messages: invalid role")), scriptedModel([{ text: "never" }])), prompt: "hi", maxRetries: 0 })).rejects.toThrow(/invalid role/);
  });

  it("when the backup is out too, customers still get the main model's honest wait", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    try {
      const geminiQuota = refused(429, "You exceeded your current quota, please check your plan and billing details.");
      const run = generateText({ model: withFallback(failing(TPD), failing(geminiQuota), "google/gemini-3.5-flash-lite"), prompt: "hi", maxRetries: 0 }).catch((e: unknown) => e);
      await vi.runAllTimersAsync();
      const err = await run;
      expect(aiBusyMessage(err)).toBe("Nia has reached today's usage limit for this demo. Please try again in about 22 minutes."); // 21m3s, rounded up
      expect(console.warn).toHaveBeenCalledWith(expect.stringMatching(/gemini-3.5-flash-lite failed too: You exceeded your current quota/));
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps ids that are already valid and maps each other id consistently", () => {
    const params = {
      prompt: [
        { role: "assistant", content: [{ type: "tool-call", toolCallId: "abcDEF123", toolName: "a", input: {} }, { type: "tool-call", toolCallId: "call_1", toolName: "b", input: {} }] },
        { role: "tool", content: [{ type: "tool-result", toolCallId: "call_1", toolName: "b", output: { type: "json", value: {} } }] },
      ],
    } as unknown as Parameters<typeof normalizeToolCallIds>[0];
    const out = normalizeToolCallIds(params).prompt as unknown as { content: { toolCallId: string }[] }[];
    expect(out[0]!.content[0]!.toolCallId).toBe("abcDEF123");
    expect(out[0]!.content[1]!.toolCallId).toMatch(/^[A-Za-z0-9]{9}$/);
    expect(out[1]!.content[0]!.toolCallId).toBe(out[0]!.content[1]!.toolCallId);
  });

  it("is switched on by a Mistral key alone, and off without one", () => {
    resetEnvCache();
    expect(aiConfig().fallback).toBeNull();
    process.env.MISTRAL_API_KEY = "test-key";
    resetEnvCache();
    expect(aiConfig().fallback).toEqual({ provider: "mistral", model: "mistral-medium-latest", apiKey: "test-key", baseUrl: undefined });
    process.env.AI_FALLBACK_MODEL = "mistral-small-latest";
    resetEnvCache();
    expect(aiConfig().fallback?.model).toBe("mistral-small-latest");
  });

  it("uses a free Gemini key as the backup, with Flash-Lite unless a model is named", () => {
    Object.assign(process.env, { AI_FALLBACK_PROVIDER: "google", AI_FALLBACK_API_KEY: "gemini-test-key" });
    resetEnvCache();
    expect(aiConfig().fallback).toEqual({ provider: "google", model: "gemini-3.5-flash-lite", apiKey: "gemini-test-key", baseUrl: undefined });
    process.env.AI_FALLBACK_API_KEY = "";
    resetEnvCache();
    expect(aiConfig().fallback).toBeNull();
  });
});
