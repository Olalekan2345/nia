/**
 * OPT-IN real model test for the structured memory-extraction step.
 *   pnpm test:ai
 * Requires AI_PROVIDER / AI_MODEL / AI_API_KEY in the repo-root .env.
 */
import { config } from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
config({ path: path.join(root, ".env"), quiet: true, override: false });
const enabled = process.env.NIA_AI_INTEGRATION === "1" && Boolean(process.env.AI_API_KEY);

describe.skipIf(!enabled)("real model extraction", () => {
  it("turns the flagship sentence into three explicit, durable memories", async () => {
    const { resetEnvCache } = await import("@nia/config");
    resetEnvCache();
    const { extractMemories, getExtractionModel, setModelOverrides } = await import("../src");
    const { classifyCandidate } = await import("@nia/memory");
    setModelOverrides(undefined);
    const merchant = { name: "Adire Lane", businessType: "fabric" } as never;
    const { candidates, error } = await extractMemories({
      model: getExtractionModel(),
      merchant,
      userText: "I normally buy Medium, I like darker colours, and I usually want delivery around Lekki.",
      assistantText: "Noted!",
      previousTurns: [],
      recalled: [],
      now: new Date(),
    });
    console.log(JSON.stringify(candidates.map((c) => ({ type: c.type, subject: c.subject, value: c.value, decision: classifyCandidate(c).decision })), null, 2));
    expect(error).toBeUndefined();
    const durable = candidates.filter((c) => classifyCandidate(c).decision === "durable");
    expect(durable.length).toBeGreaterThanOrEqual(3);
    const values = durable.map((c) => c.value.toLowerCase()).join(" | ");
    expect(values).toMatch(/medium|\bm\b/);
    expect(values).toMatch(/dark/);
    expect(values).toMatch(/lekki/);
  }, 120_000);
});
