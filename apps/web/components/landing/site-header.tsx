"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { cn } from "@nia/ui";
import { NiaLogo } from "@/components/brand";

const LINKS = [
  ["How it works", "#how"],
  ["For businesses", "#business"],
  ["Memory", "#memory"],
  ["Telegram", "#telegram"],
] as const;

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        menuButton.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-[background-color,box-shadow,border-color] duration-300",
        scrolled || open ? "border-b border-ink-900/[0.06] bg-white/95 shadow-[0_8px_30px_-20px_rgb(27_26_75/0.25)] backdrop-blur-md" : "border-b border-transparent",
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-[1280px] items-center justify-between gap-4 px-5 sm:h-[72px] sm:px-8">
        <NiaLogo />
        <nav aria-label="Primary" className="hidden items-center gap-1 lg:flex">
          {LINKS.map(([label, href]) => (
            <a key={href} href={href} className="rounded-full px-4 py-2 text-[15px] font-medium text-ink-900/70 transition-colors duration-150 hover:text-ink-900">
              {label}
            </a>
          ))}
        </nav>
        <div className="flex items-center gap-1.5 sm:gap-2">
          <Link href="/market/signin" className="hidden h-10 items-center rounded-full px-4 text-[15px] font-semibold text-ink-900/80 hover:text-ink-900 sm:inline-flex">
            Sign in
          </Link>
          <Link href="/market/signin" className="inline-flex h-10 items-center rounded-full bg-ink-900 px-5 text-[15px] font-semibold text-white transition-colors duration-150 hover:bg-ink-800 focus-visible:outline-offset-4">
            Shop with Nia
          </Link>
          <button
            ref={menuButton}
            type="button"
            className="grid size-10 place-items-center rounded-full text-ink-900 hover:bg-ink-900/5 lg:hidden"
            aria-expanded={open}
            aria-controls="landing-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
          </button>
        </div>
      </div>
      <nav id="landing-menu" aria-label="Menu" hidden={!open} className="border-t border-ink-900/[0.06] bg-white px-5 pt-2 pb-6 lg:hidden">
        <ul className="grid gap-1">
          {[...LINKS, ["Walrus Market", "/market"] as const, ["Sign in", "/market/signin"] as const].map(([label, href]) => (
            <li key={href}>
              <a href={href} onClick={() => setOpen(false)} className="flex h-12 items-center rounded-2xl px-3 text-lg font-semibold text-ink-900 hover:bg-ink-900/5">
                {label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </header>
  );
}
