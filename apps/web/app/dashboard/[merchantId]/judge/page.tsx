import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { and, countDistinct, eq, isNotNull, sql } from "drizzle-orm";
import { Card, CardBody, CardHeader, buttonClasses } from "@nia/ui";
import { customers, memoryRecords } from "@nia/database";
import { env, telegramConfig, walrusConfig } from "@nia/config";
import { describeModel, isAiConfigured } from "@nia/ai";
import { relayerInfo } from "@nia/memory";
import { newId } from "@nia/shared/server";
import { PageHeader, Stat } from "@/components/dashboard/ui";
import { BeforeAfter } from "@/components/dashboard/before-after";
import { CopyText } from "@/components/dashboard/memory-tools";
import { requireMerchant } from "@/lib/access";
import { ensureCustomer, getStorefront } from "@/lib/storefront";
import { db, memoryStore } from "@/lib/server";
import { userLabel } from "@/lib/user";

export const metadata: Metadata = { title: "Judge mode" };
export const dynamic = "force-dynamic";

export default async function JudgePage({ params }: { params: Promise<{ merchantId: string }> }) {
  if (!env().NIA_DEMO_MODE) notFound();
  const { merchantId } = await params;
  const { merchant } = await requireMerchant(merchantId);
  const cfg = walrusConfig();
  const store = memoryStore();

  // Account-wide evidence (every shop on this deployment writes with the same Walrus Memory account).
  const [[blobs], perCustomer, info, relayerTotal] = await Promise.all([
    db().select({ n: countDistinct(memoryRecords.blobId) }).from(memoryRecords).where(and(isNotNull(memoryRecords.blobId), eq(memoryRecords.persistStatus, "stored"))),
    db()
      .select({ customerId: memoryRecords.customerId, n: sql<number>`count(*)::int` })
      .from(memoryRecords)
      .innerJoin(customers, eq(customers.id, memoryRecords.customerId))
      .where(and(eq(memoryRecords.persistStatus, "stored"), eq(memoryRecords.scope, "customer")))
      .groupBy(memoryRecords.customerId),
    relayerInfo().catch(() => null),
    (async () => {
      if (!store) return null;
      try {
        let total = 0;
        let cursor: string | undefined;
        for (let i = 0; i < 20; i++) {
          const res = await store.listNamespaces({ cursor, limit: 500 });
          for (const ns of res.namespaces) if (ns.name.startsWith(`${cfg.namespacePrefix}:`)) total += ns.memory_count;
          if (!res.has_more) break;
          cursor = res.next_cursor ?? undefined;
        }
        return total;
      } catch {
        return null;
      }
    })(),
  ]);
  const tenPlus = perCustomer.filter((c) => c.n >= 10).length;

  const sf = await getStorefront(merchant.slug);
  const me = await ensureCustomer(sf);
  const model = describeModel();

  return (
    <>
      <PageHeader title="Judge mode" description="A guided, genuine demonstration of Nia’s memory. Nothing here is scripted — every answer comes from the live model, and every memory from Walrus." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Walrus blobs written" value={blobs?.n ?? 0} tone="memory" hint="Confirmed by the relayer (all shops)" />
        <Stat label="Memories on relayer" value={relayerTotal ?? "—"} hint={`Namespaces with prefix “${cfg.namespacePrefix}”`} />
        <Stat label="Customers with 10+ memories" value={tenPlus} tone="accent" hint="Hackathon target: 3" />
        <Stat label="Network" value={<span className="capitalize">{info?.network ?? "—"}</span>} hint={info?.relayerVersion ? `Relayer ${info.relayerVersion}` : undefined} />
      </div>

      <Card className="mt-4">
        <CardBody className="grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <p className="text-xs text-muted-foreground">Agent (Walrus Memory account ID)</p>
            <p className="flex items-center gap-1 font-mono text-xs">
              <span className="truncate">{cfg.accountId ?? "not configured"}</span>
              {cfg.accountId ? <CopyText value={cfg.accountId} /> : null}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">LLM</p>
            <p className="font-semibold">{model.provider ? `${model.provider} · ${model.model}` : "not configured"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Telegram</p>
            <p className="font-semibold">{telegramConfig().configured ? `@${telegramConfig().botUsername}` : "not configured"}</p>
          </div>
        </CardBody>
      </Card>

      <Card className="mt-6">
        <CardHeader title="Walkthrough" description="Run this in a private window as a customer (any email you can receive)." />
        <CardBody>
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            <li>
              Open <Link href={`/s/${merchant.slug}/signin`} target="_blank" className="font-semibold text-accent-strong hover:underline">the store</Link> and sign in as a customer.
            </li>
            <li>In chat, say: “I normally buy Medium, I like darker colours, and I usually want delivery around Lekki.” Watch the extraction and the receipts flip to <em>stored</em> with real blob IDs.</li>
            <li>Order something (e.g. a black Medium item) delivered to Lekki, and confirm it.</li>
            <li>Start a new chat and ask “What do I normally like?” — tap “memories used” to see what came back from Walrus.</li>
            <li>Say “I’ve moved. Use Yaba from now on.” then ask where you usually get deliveries: Yaba now, Lekki kept as history.</li>
            <li>On your profile, connect Telegram and ask the bot “Can I get the same kind of thing as last time?”</li>
          </ol>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href={`/s/${merchant.slug}/chat`} target="_blank" className={buttonClasses()}>
              Open store chat
            </Link>
            <Link href={`/dashboard/${merchant.id}/memory`} className={buttonClasses({ variant: "secondary" })}>
              Memory explorer
            </Link>
          </div>
        </CardBody>
      </Card>

      <Card className="mt-6">
        <CardHeader
          title="Before / after memory"
          description={`Both panes are real conversations with Nia as you (${sf.user ? userLabel(sf.user) : "you"}). Left: memory OFF (no Walrus recall, no history). Right: memory ON.`}
        />
        <CardBody>
          {!isAiConfigured() ? (
            <p className="rounded-xl bg-warning-soft px-3 py-2 text-sm text-warning">Configure AI_PROVIDER, AI_MODEL and AI_API_KEY to run the comparison.</p>
          ) : (
            <BeforeAfter
              offId={newId()}
              onId={newId()}
              slug={merchant.slug}
              shopName={merchant.name}
              locale={merchant.locale}
              timeZone={merchant.timezone}
              signedIn
              customerName={me?.displayName ?? null}
              memory={{ enabled: Boolean(me?.memoryEnabled), backend: store?.backend ?? null, network: info?.network ?? null }}
              aiConfigured
              suggestions={[]}
            />
          )}
        </CardBody>
      </Card>
    </>
  );
}
