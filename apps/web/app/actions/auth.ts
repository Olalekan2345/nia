"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { merchants } from "@nia/database";
import { claimGuestConversations } from "@nia/ai";
import { resolveWebCustomer } from "@nia/commerce";
import { isAppError } from "@nia/shared";
import { getGuestId, requestSignInCode, signOut, verifySignInCode } from "@/lib/auth";
import { clientIp } from "@/lib/security";
import { db } from "@/lib/server";
import { safeNext } from "@/lib/user";

export type SignInState =
  | { step: "email"; error?: string; email?: string }
  | { step: "code"; email: string; devLogged: boolean; error?: string };

export async function signInAction(prev: SignInState, formData: FormData): Promise<SignInState> {
  const intent = formData.get("intent");
  const shopSlug = typeof formData.get("shop") === "string" ? (formData.get("shop") as string) : null;
  const ip = await clientIp();

  if (intent === "send" || prev.step === "email") {
    const email = String(formData.get("email") ?? "");
    try {
      let shopName: string | undefined;
      if (shopSlug) {
        const [m] = await db().select({ name: merchants.name }).from(merchants).where(eq(merchants.slug, shopSlug));
        shopName = m?.name;
      }
      const res = await requestSignInCode(email, ip, { shopName });
      return { step: "code", email: res.email, devLogged: res.devLogged };
    } catch (err) {
      return { step: "email", email, error: isAppError(err) ? err.message : (err as Error).message || "Couldn't send the code." };
    }
  }

  const email = prev.step === "code" ? prev.email : String(formData.get("email") ?? "");
  const code = String(formData.get("code") ?? "");
  let destination: string;
  try {
    const user = await verifySignInCode(email, code, ip);
    if (shopSlug) {
      const [m] = await db().select().from(merchants).where(eq(merchants.slug, shopSlug));
      if (m) {
        const customer = await resolveWebCustomer(db(), {
          merchantId: m.id,
          userId: user.id,
          email: user.email,
          name: user.name,
          telegramUserId: user.telegramUserId,
          telegramUsername: user.telegramUsername,
        });
        const guest = await getGuestId(false);
        if (guest) await claimGuestConversations(db(), { merchantId: m.id, customerId: customer.id, guestSessionId: guest });
      }
      destination = safeNext(formData.get("next"), `/s/${shopSlug}`);
    } else {
      destination = safeNext(formData.get("next"), "/dashboard");
    }
  } catch (err) {
    return { step: "code", email, devLogged: prev.step === "code" ? prev.devLogged : false, error: isAppError(err) ? err.message : "Couldn't verify the code." };
  }
  redirect(destination);
}

export async function signOutAction(formData: FormData): Promise<void> {
  await signOut();
  redirect(safeNext(formData.get("next"), "/"));
}
