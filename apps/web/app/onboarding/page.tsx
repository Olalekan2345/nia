import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, count, eq } from "drizzle-orm";
import { Check } from "lucide-react";
import { Mascot, buttonClasses, cn } from "@nia/ui";
import { merchantKnowledge, products, services } from "@nia/database";
import { appUrl, telegramConfig } from "@nia/config";
import { fromMinorUnits } from "@nia/shared";
import { NiaLogo } from "@/components/brand";
import { CreateBusinessForm } from "@/components/onboarding/create-business-form";
import { FulfilmentForm, KnowledgeManager, PublishCard, TelegramSettings } from "@/components/dashboard/settings-forms";
import { merchantAccessFor, requireUser } from "@/lib/access";
import { db } from "@/lib/server";
import { walrusConfig } from "@nia/config";

export const metadata: Metadata = { title: "Set up your business" };

const STEPS = ["Business", "What you sell", "Delivery", "Policies", "Telegram", "Test & publish"];

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ m?: string; step?: string }> }) {
  const sp = await searchParams;
  const user = await requireUser("/onboarding");
  const step = Math.min(6, Math.max(1, Number(sp.step ?? 1) || 1));
  const access = sp.m ? await merchantAccessFor(user, sp.m, "OWNER") : null;
  if (sp.m && !access) notFound();
  const current = access ? step : 1;
  const m = access?.merchant;
  const next = (n: number) => `/onboarding?m=${m?.id}&step=${n}`;

  return (
    <div className="nia-wash min-h-dvh">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-4 py-5">
        <NiaLogo />
        {m ? (
          <Link href={`/dashboard/${m.id}`} className="text-sm font-semibold text-muted-foreground hover:text-foreground">
            Skip to dashboard
          </Link>
        ) : null}
      </header>
      <main className="mx-auto max-w-3xl px-4 pb-16">
        <ol className="mb-8 flex flex-wrap gap-2" aria-label="Setup progress">
          {STEPS.map((label, i) => {
            const n = i + 1;
            const done = n < current;
            return (
              <li key={label} className={cn("flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold", n === current ? "border-foreground bg-foreground text-background" : done ? "border-success/30 bg-success-soft text-success" : "border-border bg-surface text-muted-foreground")} aria-current={n === current ? "step" : undefined}>
                {done ? <Check className="size-3.5" aria-hidden="true" /> : <span className="tabular">{n}</span>}
                {label}
              </li>
            );
          })}
        </ol>

        {current === 1 ? (
          <div className="grid gap-8 md:grid-cols-[1fr_1.3fr]">
            <div>
              <span className="relative inline-grid place-items-center">
              <span aria-hidden="true" className="nia-breathe absolute -inset-7 rounded-full" style={{ background: "radial-gradient(closest-side, rgb(107 222 230 / 0.42), rgb(159 184 252 / 0.2) 60%, transparent)" }} />
              <Mascot size={96} state="greeting" decorative className="relative" />
            </span>
              <h1 className="mt-5 text-[clamp(2rem,4.2vw,3rem)] leading-[1.05] font-extrabold tracking-[-0.04em] text-balance">Let’s set up your Nia assistant</h1>
              <p className="mt-3 text-muted-foreground">A few details about your business. You can change everything later in Settings.</p>
            </div>
            <div className="rounded-3xl border border-ink-900/[0.06] bg-surface p-6 shadow-soft sm:p-8">
              <CreateBusinessForm />
            </div>
          </div>
        ) : null}

        {m && current === 2 ? <SellStep merchantId={m.id} nextHref={next(3)} /> : null}

        {m && current === 3 ? (
          <StepShell title="How do customers get their orders?" nextHref={next(4)}>
            <FulfilmentForm
              merchantId={m.id}
              currency={m.currency}
              initial={{
                delivery: m.fulfillment.delivery,
                pickup: m.fulfillment.pickup,
                pickupAddress: m.fulfillment.pickupAddress ?? "",
                areas: m.deliveryAreas.map((a) => ({ name: a.name, fee: a.fee == null ? "" : String(fromMinorUnits(a.fee, m.currency)), etaDays: a.etaDays == null ? "" : String(a.etaDays), sameDay: Boolean(a.sameDay) })),
              }}
            />
          </StepShell>
        ) : null}

        {m && current === 4 ? <PoliciesStep merchantId={m.id} nextHref={next(5)} /> : null}

        {m && current === 5 ? (
          <StepShell title="Chat on Telegram too" nextHref={next(6)}>
            <TelegramSettings
              merchantId={m.id}
              enabled={m.telegramEnabled}
              configured={telegramConfig().configured}
              botUsername={telegramConfig().botUsername ?? null}
              deepLink={telegramConfig().botUsername ? `https://t.me/${telegramConfig().botUsername}?start=s_${m.slug}` : null}
              webhook={null}
            />
          </StepShell>
        ) : null}

        {m && current === 6 ? (
          <StepShell title="Test Nia, then publish">
            <div className="rounded-3xl border border-ink-900/[0.06] bg-surface shadow-soft p-5">
              <p className="text-sm text-muted-foreground">Open your store, sign in as a customer and try: “What do you have in stock?”, then tell Nia a preference like your size. You’ll see Nia remember it — for real, on Walrus.</p>
              <Link href={`/s/${m.slug}/chat`} target="_blank" className={buttonClasses({ className: "mt-4" })}>
                Open my store’s chat
              </Link>
            </div>
            <PublishCard merchantId={m.id} status={m.status} storeUrl={`${appUrl()}/s/${m.slug}`} canPublish />
            <Link href={`/dashboard/${m.id}`} className={buttonClasses({ variant: "secondary", size: "lg" })}>
              Go to dashboard
            </Link>
          </StepShell>
        ) : null}
      </main>
    </div>
  );
}

function StepShell({ title, children, nextHref }: { title: string; children: React.ReactNode; nextHref?: string }) {
  return (
    <div className="space-y-5">
      <h1 className="text-[clamp(1.75rem,3vw,2.35rem)] leading-tight font-extrabold tracking-[-0.035em] text-balance">{title}</h1>
      {children}
      {nextHref ? (
        <div className="flex justify-end">
          <Link href={nextHref} className={buttonClasses({ size: "lg" })}>
            Continue
          </Link>
        </div>
      ) : null}
    </div>
  );
}

async function SellStep({ merchantId, nextHref }: { merchantId: string; nextHref: string }) {
  const [[p], [s]] = await Promise.all([
    db().select({ n: count() }).from(products).where(eq(products.merchantId, merchantId)),
    db().select({ n: count() }).from(services).where(eq(services.merchantId, merchantId)),
  ]);
  return (
    <StepShell title="What do you sell?" nextHref={nextHref}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-3xl border border-ink-900/[0.06] bg-surface shadow-soft p-5">
          <p className="font-semibold">Products</p>
          <p className="mt-1 text-sm text-muted-foreground">{p?.n ? `${p.n} in your catalog.` : "Items with prices, options (colour, size, volume) and stock."}</p>
          <Link href={`/dashboard/${merchantId}/catalog/products/new`} target="_blank" className={buttonClasses({ variant: "secondary", size: "sm", className: "mt-4" })}>
            Add a product
          </Link>
        </div>
        <div className="rounded-3xl border border-ink-900/[0.06] bg-surface shadow-soft p-5">
          <p className="font-semibold">Services & appointments</p>
          <p className="mt-1 text-sm text-muted-foreground">{s?.n ? `${s.n} in your catalog.` : "Bookable services with duration, deposit and availability."}</p>
          <Link href={`/dashboard/${merchantId}/catalog/services/new`} target="_blank" className={buttonClasses({ variant: "secondary", size: "sm", className: "mt-4" })}>
            Add a service
          </Link>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">Nia will only ever recommend what you list, at the prices and availability you set.</p>
    </StepShell>
  );
}

async function PoliciesStep({ merchantId, nextHref }: { merchantId: string; nextHref: string }) {
  const entries = await db().select().from(merchantKnowledge).where(eq(merchantKnowledge.merchantId, merchantId)).orderBy(asc(merchantKnowledge.createdAt));
  return (
    <StepShell title="Policies Nia should know" nextHref={nextHref}>
      <KnowledgeManager
        merchantId={merchantId}
        walrusReady={walrusConfig().configured}
        entries={entries.map((k) => ({ id: k.id, category: k.category, title: k.title, body: k.body, rememberInWalrus: k.rememberInWalrus, memoryStatus: null }))}
      />
    </StepShell>
  );
}
