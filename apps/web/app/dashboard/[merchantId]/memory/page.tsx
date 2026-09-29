import type { Metadata } from "next";
import Link from "next/link";
import { and, count, countDistinct, desc, eq, isNotNull, isNull, max, ne, sql } from "drizzle-orm";
import { CheckCircle2, CircleAlert, XCircle } from "lucide-react";
import { Badge, Card, CardBody, CardHeader } from "@nia/ui";
import { customers, memoryRecords, type MemoryRecord } from "@nia/database";
import { walrusConfig } from "@nia/config";
import { MEMORY_TYPE_META, formatDateTime } from "@nia/shared";
import { parseNamespace, walrusHealth, type MemoryStore } from "@nia/memory";
import { EmptyPanel, PageHeader, Stat, Table, Td } from "@/components/dashboard/ui";
import { ArchiveNoteButton, CopyText, MemoryActions, OpsNoteForm } from "@/components/dashboard/memory-tools";
import { requireMerchant } from "@/lib/access";
import { db, memoryStore } from "@/lib/server";

export const metadata: Metadata = { title: "Memory" };
export const dynamic = "force-dynamic";

function short(v: string | null, n = 10) {
  if (!v) return "—";
  return v.length > n * 2 ? `${v.slice(0, n)}…${v.slice(-6)}` : v;
}

/** Relayer-side counts per namespace for this merchant (authoritative, from Walrus Memory). */
async function relayerCounts(store: MemoryStore | null, merchantId: string): Promise<{ counts: Map<string, number>; error?: string }> {
  const counts = new Map<string, number>();
  if (!store) return { counts };
  try {
    let cursor: string | undefined;
    for (let page = 0; page < 20; page++) {
      const res = await store.listNamespaces({ cursor, limit: 500 });
      for (const ns of res.namespaces) {
        const parsed = parseNamespace(ns.name);
        if (parsed?.merchantId === merchantId) counts.set(ns.name, ns.memory_count);
      }
      if (!res.has_more) break;
      cursor = res.next_cursor ?? undefined;
    }
    return { counts };
  } catch (err) {
    return { counts, error: (err as Error).message.slice(0, 160) };
  }
}

export default async function MemoryPage({ params }: { params: Promise<{ merchantId: string }> }) {
  const { merchantId } = await params;
  const { merchant } = await requireMerchant(merchantId);
  const base = `/dashboard/${merchant.id}`;
  const store = memoryStore();
  const cfg = walrusConfig();

  const [health, totals, [blobs], perCustomer, recent, merchantNotes, relayer] = await Promise.all([
    walrusHealth(store),
    db()
      .select({ status: memoryRecords.persistStatus, lifecycle: memoryRecords.lifecycle, n: count() })
      .from(memoryRecords)
      .where(eq(memoryRecords.merchantId, merchant.id))
      .groupBy(memoryRecords.persistStatus, memoryRecords.lifecycle),
    db()
      .select({ n: countDistinct(memoryRecords.blobId) })
      .from(memoryRecords)
      .where(and(eq(memoryRecords.merchantId, merchant.id), isNotNull(memoryRecords.blobId), eq(memoryRecords.persistStatus, "stored"))),
    db()
      .select({
        customerId: memoryRecords.customerId,
        name: customers.displayName,
        email: customers.email,
        stored: sql<number>`count(*) filter (where ${memoryRecords.persistStatus} = 'stored')::int`,
        active: sql<number>`count(*) filter (where ${memoryRecords.persistStatus} = 'stored' and ${memoryRecords.lifecycle} = 'active')::int`,
        last: max(memoryRecords.storedAt),
      })
      .from(memoryRecords)
      .innerJoin(customers, eq(customers.id, memoryRecords.customerId))
      .where(and(eq(memoryRecords.merchantId, merchant.id), eq(memoryRecords.scope, "customer"), isNull(customers.mergedIntoId)))
      .groupBy(memoryRecords.customerId, customers.displayName, customers.email)
      .orderBy(desc(sql`count(*)`))
      .limit(50),
    db().select().from(memoryRecords).where(eq(memoryRecords.merchantId, merchant.id)).orderBy(desc(memoryRecords.createdAt)).limit(25),
    db()
      .select()
      .from(memoryRecords)
      .where(and(eq(memoryRecords.merchantId, merchant.id), ne(memoryRecords.scope, "customer"), eq(memoryRecords.lifecycle, "active")))
      .orderBy(desc(memoryRecords.createdAt))
      .limit(30),
    relayerCounts(store, merchant.id),
  ]);

  const sum = (pred: (r: (typeof totals)[number]) => boolean) => totals.filter(pred).reduce((a, r) => a + r.n, 0);
  const stored = sum((r) => r.status === "stored");
  const pending = sum((r) => r.status === "pending" && r.lifecycle !== "forgotten");
  const failed = sum((r) => r.status === "failed" && r.lifecycle === "active");
  const forgotten = sum((r) => r.lifecycle === "forgotten");
  const tenPlus = perCustomer.filter((c) => c.stored >= 10).length;
  const nsFor = (customerId: string) => `${cfg.namespacePrefix}:merchant:${merchant.id}:customer:${customerId}`;

  return (
    <>
      <PageHeader title="Memory" description="What Nia has written to Walrus Memory for this shop — with real persistence state and blob IDs. Delegate keys never leave the server." actions={<MemoryActions merchantId={merchant.id} pending={pending} failed={failed} />} />

      <Card>
        <CardBody className="grid gap-4 md:grid-cols-[auto_1fr]">
          <div className="flex items-center gap-3">
            {health.ok ? <CheckCircle2 className="size-8 text-success" aria-hidden="true" /> : health.configured ? <CircleAlert className="size-8 text-warning" aria-hidden="true" /> : <XCircle className="size-8 text-danger" aria-hidden="true" />}
            <div>
              <p className="font-bold">{health.ok ? "Walrus Memory connected" : health.configured ? "Walrus Memory unreachable" : "Walrus Memory not configured"}</p>
              <p className="text-sm text-muted-foreground">{health.ok ? `Relayer healthy${health.latencyMs ? ` · ${health.latencyMs} ms` : ""}` : (health.error ?? "")}</p>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs text-muted-foreground">Network (from relayer)</dt>
              <dd className="font-semibold capitalize">{health.network ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Relayer</dt>
              <dd className="truncate font-mono text-xs leading-5">{cfg.serverUrl.replace(/^https?:\/\//, "")}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Writes</dt>
              <dd className="font-semibold">{health.writeReady === false ? "Not ready" : health.writeReady ? "Ready" : "—"}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-xs text-muted-foreground">Memory account ID (agent)</dt>
              <dd className="flex items-center gap-1 font-mono text-xs">
                {cfg.accountId ? (
                  <>
                    <span className="truncate">{cfg.accountId}</span> <CopyText value={cfg.accountId} label="Copy account ID" />
                  </>
                ) : (
                  <span className="font-sans text-sm text-muted-foreground">Set MEMWAL_ACCOUNT_ID</span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Delegate key</dt>
              <dd className="font-semibold">{cfg.privateKey ? "Configured (hidden)" : "Missing"}</dd>
            </div>
          </dl>
          {!health.configured ? (
            <p className="text-sm text-muted-foreground md:col-span-2">
              Add <code className="font-mono">MEMWAL_PRIVATE_KEY</code> and <code className="font-mono">MEMWAL_ACCOUNT_ID</code> (from memory.walrus.xyz) to the server environment. Until then Nia does not save or recall long-term memory.
            </p>
          ) : null}
        </CardBody>
      </Card>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Memories stored" value={stored} tone="memory" hint="Relayer confirmed (job done)" />
        <Stat label="Walrus blobs" value={blobs?.n ?? 0} hint="Distinct blob IDs returned" />
        <Stat label="Pending" value={pending} hint="Awaiting relayer confirmation" />
        <Stat label="Failed" value={failed} hint={failed ? "Use “Retry failed”" : "None"} />
        <Stat label="Customers with 10+" value={tenPlus} tone="accent" hint={`${forgotten} forgotten (excluded from recall)`} />
      </div>

      <Card className="mt-6">
        <CardHeader title="Memory per customer" description="Nia’s confirmed writes vs. the relayer’s own count for each customer namespace." />
        <CardBody>
          {perCustomer.length === 0 ? (
            <EmptyPanel title="No customer memories yet" body="When signed-in customers tell Nia their preferences or place orders, their memories appear here." state="thinking" />
          ) : (
            <Table head={["Customer", "Stored by Nia", "Current", "On relayer", "Last write", ""]} className="rounded-2xl shadow-none">
              {perCustomer.map((c) => {
                const onRelayer = relayer.counts.get(nsFor(c.customerId!));
                return (
                  <tr key={c.customerId}>
                    <Td>
                      <p className="font-medium">{c.name ?? "Customer"}</p>
                      <p className="text-xs text-muted-foreground">{c.email ?? "Telegram"}</p>
                    </Td>
                    <Td className="tabular">
                      {c.stored} {c.stored >= 10 ? <Badge tone="success">10+</Badge> : null}
                    </Td>
                    <Td className="tabular">{c.active}</Td>
                    <Td className="tabular">{onRelayer ?? (relayer.error ? "?" : "—")}</Td>
                    <Td className="text-muted-foreground">{c.last ? formatDateTime(c.last, { timeZone: merchant.timezone }) : "—"}</Td>
                    <Td>
                      <Link href={`${base}/customers/${c.customerId}`} className="text-sm font-semibold text-accent-strong hover:underline">
                        Open
                      </Link>
                    </Td>
                  </tr>
                );
              })}
            </Table>
          )}
          {relayer.error ? <p className="mt-2 text-xs text-warning">Couldn’t read relayer namespace counts: {relayer.error}</p> : null}
        </CardBody>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Shop memory" description="Operational notes and knowledge Nia can recall (merchant namespaces)." />
          <CardBody className="space-y-5">
            <OpsNoteForm merchantId={merchant.id} />
            {merchantNotes.length ? (
              <ul className="divide-y divide-ink-900/[0.06] rounded-xl border border-border">
                {merchantNotes.map((n) => (
                  <li key={n.id} className="flex items-center gap-3 px-3 py-2.5 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{n.label}</p>
                      <p className="text-xs text-muted-foreground">
                        {n.scope === "merchant_operations" ? "Operations" : "Knowledge"} · {n.persistStatus} · {formatDateTime(n.createdAt, { timeZone: merchant.timezone })}
                      </p>
                    </div>
                    <ArchiveNoteButton merchantId={merchant.id} recordId={n.id} />
                  </li>
                ))}
              </ul>
            ) : null}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="How forgetting works" />
          <CardBody className="space-y-2 text-sm text-muted-foreground">
            <p>Walrus stores memory durably and the SDK has no per-memory delete. When a customer forgets a memory, Nia marks it forgotten and excludes it from every future recall and from their Passport; any outbox text is cleared.</p>
            <p>The encrypted blob remains on Walrus until its storage period ends. Restoring a namespace re-indexes blobs on the relayer, but Nia keeps excluding forgotten ones at recall time.</p>
          </CardBody>
        </Card>
      </div>

      <Card className="mt-6">
        <CardHeader title="Recent writes" description="Latest memory records with their Walrus persistence state." />
        <CardBody>
          {recent.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Nothing written yet.</p>
          ) : (
            <Table head={["Memory", "Type", "Scope", "Status", "Blob ID", "Written"]} className="rounded-2xl shadow-none">
              {recent.map((r: MemoryRecord) => (
                <tr key={r.id}>
                  <Td className="max-w-64">
                    <p className="truncate font-medium">{r.label}</p>
                    {r.lifecycle !== "active" ? <p className="text-xs text-muted-foreground">{r.lifecycle}</p> : null}
                  </Td>
                  <Td className="text-muted-foreground">{MEMORY_TYPE_META[r.type].label}</Td>
                  <Td className="text-muted-foreground">{r.scope.replace("merchant_", "")}</Td>
                  <Td>
                    <Badge tone={r.persistStatus === "stored" ? "success" : r.persistStatus === "failed" ? "danger" : "warning"} dot>
                      {r.persistStatus}
                    </Badge>
                    {r.lastError && r.persistStatus === "failed" ? <p className="mt-1 max-w-48 truncate text-xs text-danger" title={r.lastError}>{r.lastError}</p> : null}
                  </Td>
                  <Td>
                    {r.blobId ? (
                      <span className="flex items-center gap-1 font-mono text-xs">
                        {short(r.blobId)} <CopyText value={r.blobId} label="Copy blob ID" />
                      </span>
                    ) : (
                      "—"
                    )}
                  </Td>
                  <Td className="text-muted-foreground">{formatDateTime(r.storedAt ?? r.createdAt, { timeZone: merchant.timezone })}</Td>
                </tr>
              ))}
            </Table>
          )}
        </CardBody>
      </Card>
    </>
  );
}
