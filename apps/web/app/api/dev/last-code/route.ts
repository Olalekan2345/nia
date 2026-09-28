/**
 * Playwright only: returns the last sign-in code sent to an email.
 * Disabled unless NIA_E2E=1, and never available in production.
 */
import { devLastCode } from "@/lib/email";

export function GET(req: Request) {
  if (process.env.NODE_ENV === "production" || process.env.NIA_E2E !== "1") return new Response("Not found", { status: 404 });
  const email = new URL(req.url).searchParams.get("email")?.toLowerCase() ?? "";
  const code = devLastCode(email);
  return code ? Response.json({ code }) : Response.json({ error: "no code" }, { status: 404 });
}
