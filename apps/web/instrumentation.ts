/**
 * Runs once per server runtime before requests are handled. Node-only work
 * lives in instrumentation-node.ts so the Edge bundle stays clean.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation-node");
  }
}
