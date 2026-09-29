import Link from "next/link";
import { NiaLogo } from "@/components/brand";
import { Container } from "./ui";

const REPO = "https://github.com/Olalekan2345/nia";

export function SiteFooter({ telegramUrl }: { telegramUrl: string | null }) {
  const links: { label: string; href: string; external?: boolean }[] = [
    { label: "Walrus Market", href: "/market" },
    { label: "For businesses", href: "/signin?next=/onboarding" },
    ...(telegramUrl ? [{ label: "Telegram", href: telegramUrl, external: true }] : []),
    { label: "Memory", href: "#memory" },
    { label: "Privacy", href: "#privacy" },
    { label: "GitHub", href: REPO, external: true },
    { label: "Documentation", href: `${REPO}#readme`, external: true },
  ];
  return (
    <footer className="border-t border-ink-900/[0.06] bg-white py-16 sm:py-20">
      <Container>
        <div className="flex flex-col gap-10 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-xs">
            <NiaLogo />
            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">The shopping and service assistant that remembers your customers.</p>
          </div>
          <nav aria-label="Footer">
            <ul className="grid grid-cols-2 gap-x-12 gap-y-4 text-[15px] sm:grid-cols-4">
              {links.map((l) => (
                <li key={l.label}>
                  {l.external ? (
                    <a href={l.href} target="_blank" rel="noopener noreferrer" className="font-medium text-ink-900/70 hover:text-ink-900">
                      {l.label}
                    </a>
                  ) : l.href.startsWith("#") ? (
                    <a href={l.href} className="font-medium text-ink-900/70 hover:text-ink-900">
                      {l.label}
                    </a>
                  ) : (
                    <Link href={l.href} className="font-medium text-ink-900/70 hover:text-ink-900">
                      {l.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        </div>
        <div className="mt-14 flex flex-col gap-2 border-t border-ink-900/[0.06] pt-8 text-sm text-muted-foreground sm:flex-row sm:justify-between">
          <p>Demo shops are fictional businesses for trying Nia. Memories you create in them are real.</p>
          <p>Memory powered by Walrus Memory.</p>
        </div>
      </Container>
    </footer>
  );
}
