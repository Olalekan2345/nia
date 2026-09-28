import "server-only";
import { emailConfig } from "@nia/config";

const globalCodes = globalThis as unknown as { __niaDevCodes?: Map<string, string> };

/** Test-only (NIA_E2E=1, never in production): last code per email for Playwright. */
export function devLastCode(email: string): string | null {
  if (process.env.NODE_ENV === "production" || process.env.NIA_E2E !== "1") return null;
  return globalCodes.__niaDevCodes?.get(email) ?? null;
}

/** Email codes can be delivered (Resend) or, in development, printed to the console. */
export function emailSignInAvailable(): boolean {
  const cfg = emailConfig();
  return cfg.configured || cfg.devLogCodes;
}

export async function sendSignInCodeEmail(email: string, code: string, context: { shopName?: string } = {}): Promise<{ delivered: boolean; devLogged: boolean }> {
  const cfg = emailConfig();
  const subject = `${code} is your Nia sign-in code`;
  const who = context.shopName ? ` for ${context.shopName}` : "";
  const text = `Your Nia sign-in code${who} is ${code}.\n\nIt expires in 10 minutes. If you didn't request it, you can ignore this email.`;
  const html = `<div style="font-family:system-ui,-apple-system,Segoe UI,sans-serif;max-width:420px;margin:0 auto;padding:24px;color:#0e1116">
  <p style="font-size:15px;margin:0 0 16px">Your Nia sign-in code${who}:</p>
  <p style="font-size:32px;letter-spacing:8px;font-weight:700;margin:0 0 16px;font-family:ui-monospace,Consolas,monospace">${code}</p>
  <p style="font-size:13px;color:#5b6472;margin:0">It expires in 10 minutes. If you didn't request it, you can ignore this email. Nia will never ask you for this code in chat.</p>
</div>`;

  if (process.env.NIA_E2E === "1" && process.env.NODE_ENV !== "production") {
    (globalCodes.__niaDevCodes ??= new Map()).set(email, code);
  }

  if (cfg.configured && cfg.resendApiKey) {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${cfg.resendApiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: cfg.from, to: [email], subject, text, html }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error("[email] Resend rejected the message", res.status, body.slice(0, 200));
      throw new Error("We couldn't send the email. Please try again in a minute.");
    }
    return { delivered: true, devLogged: false };
  }

  if (cfg.devLogCodes) {
    console.log(`\n┌─ Nia sign-in code (development only) ─────────\n│ ${email}\n│ code: ${code}\n└────────────────────────────────────────────────\n`);
    return { delivered: false, devLogged: true };
  }
  throw new Error("Email sign-in is not configured on this deployment (RESEND_API_KEY).");
}
