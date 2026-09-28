import type { Metadata } from "next";
import { asc, eq, and, isNull } from "drizzle-orm";
import { memoryRecords, merchantInvites, merchantKnowledge, merchantMembers, users } from "@nia/database";
import { appUrl, env, telegramConfig, walrusConfig } from "@nia/config";
import { fromMinorUnits, type WeekdayKey } from "@nia/shared";
import { bot, createTelegramApi } from "@nia/telegram";
import { PageHeader } from "@/components/dashboard/ui";
import {
  FulfilmentForm,
  HoursForm,
  KnowledgeManager,
  NiaSettingsForm,
  PaymentsForm,
  ProfileForm,
  PublishCard,
  TeamManager,
  TelegramSettings,
} from "@/components/dashboard/settings-forms";
import { requireMerchant } from "@/lib/access";
import { db } from "@/lib/server";
import { userLabel } from "@/lib/user";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage({ params }: { params: Promise<{ merchantId: string }> }) {
  const { merchantId } = await params;
  const { merchant: m, role } = await requireMerchant(merchantId);
  const tg = telegramConfig();

  const [knowledge, members, invites, webhook] = await Promise.all([
    db()
      .select({ k: merchantKnowledge, memoryStatus: memoryRecords.persistStatus })
      .from(merchantKnowledge)
      .leftJoin(memoryRecords, eq(memoryRecords.id, merchantKnowledge.memoryRecordId))
      .where(eq(merchantKnowledge.merchantId, m.id))
      .orderBy(asc(merchantKnowledge.createdAt)),
    db()
      .select({ userId: merchantMembers.userId, role: merchantMembers.role, email: users.email, telegramUsername: users.telegramUsername, name: users.name })
      .from(merchantMembers)
      .innerJoin(users, eq(users.id, merchantMembers.userId))
      .where(eq(merchantMembers.merchantId, m.id))
      .then((rows) => rows.map((r) => ({ userId: r.userId, role: r.role, email: userLabel(r) }))),
    db().select().from(merchantInvites).where(and(eq(merchantInvites.merchantId, m.id), isNull(merchantInvites.acceptedAt))),
    tg.configured
      ? bot(createTelegramApi(tg.botToken))
          .getWebhookInfo()
          .then((i) => ({ url: i.url || null, pending: i.pending_update_count, lastError: i.last_error_message ?? null }))
          .catch(() => null)
      : Promise.resolve(null),
  ]);

  const major = (v: number | null) => (v == null ? "" : String(fromMinorUnits(v, m.currency)));
  const hours = Object.fromEntries(Object.entries(m.openingHours).map(([d, w]) => [d, w && w[0] ? [w[0][0], w[0][1]] : null])) as Partial<Record<WeekdayKey, [string, string] | null>>;
  const canEdit = role !== "STAFF";

  return (
    <>
      <PageHeader title="Settings" description={canEdit ? "Configure your store, Nia and integrations." : "You have staff access — ask an owner or admin to change settings."} />
      <div className="space-y-6">
        <PublishCard merchantId={m.id} status={m.status} storeUrl={`${appUrl()}/s/${m.slug}`} canPublish={role === "OWNER"} />
        {canEdit ? (
          <>
            <ProfileForm
              merchantId={m.id}
              initial={{
                name: m.name,
                tagline: m.tagline ?? "",
                description: m.description ?? "",
                logoUrl: m.logoUrl ?? "",
                accentColor: m.accentColor,
                welcomeMessage: m.welcomeMessage ?? "",
                currency: m.currency,
                locale: m.locale,
                timezone: m.timezone,
                city: m.city ?? "",
                country: m.country ?? "",
                businessType: m.businessType,
              }}
            />
            <NiaSettingsForm merchantId={m.id} initial={{ tone: m.niaSettings.tone, memoryEnabled: m.niaSettings.memoryEnabled, recommendationsEnabled: m.niaSettings.recommendationsEnabled, instructions: m.niaSettings.instructions ?? "" }} />
            <FulfilmentForm
              merchantId={m.id}
              currency={m.currency}
              initial={{
                delivery: m.fulfillment.delivery,
                pickup: m.fulfillment.pickup,
                pickupAddress: m.fulfillment.pickupAddress ?? "",
                areas: m.deliveryAreas.map((a) => ({ name: a.name, fee: major(a.fee), etaDays: a.etaDays == null ? "" : String(a.etaDays), sameDay: Boolean(a.sameDay) })),
              }}
            />
            <HoursForm merchantId={m.id} initial={hours} />
            {role === "OWNER" ? (
              <PaymentsForm merchantId={m.id} paystackAvailable={Boolean(env().PAYSTACK_SECRET_KEY)} initial={{ paymentMode: m.paymentMode, paymentInstructions: m.paymentInstructions ?? "", paymentLinkUrl: m.paymentLinkUrl ?? "" }} />
            ) : null}
            <KnowledgeManager
              merchantId={m.id}
              walrusReady={walrusConfig().configured}
              entries={knowledge.map(({ k, memoryStatus }) => ({ id: k.id, category: k.category, title: k.title, body: k.body, rememberInWalrus: k.rememberInWalrus, memoryStatus: memoryStatus ?? null }))}
            />
            <TelegramSettings
              merchantId={m.id}
              enabled={m.telegramEnabled}
              configured={tg.configured}
              botUsername={tg.botUsername ?? null}
              deepLink={tg.botUsername ? `https://t.me/${tg.botUsername}?start=s_${m.slug}` : null}
              webhook={webhook}
            />
          </>
        ) : null}
        <TeamManager merchantId={m.id} members={members} invites={invites.map((i) => ({ email: i.email, role: i.role }))} isOwner={role === "OWNER"} />
      </div>
    </>
  );
}
