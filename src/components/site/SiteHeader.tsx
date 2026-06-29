"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Logo } from "./Logo";
import { DEMO_URL, NAV_LINKS } from "./constants";

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const listRef = useRef<HTMLUListElement | null>(null);
  const [pill, setPill] = useState<{ left: number; width: number; opacity: number }>({
    left: 0,
    width: 0,
    opacity: 0,
  });

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const moveTo = (el: HTMLElement | null) => {
    if (!el || !listRef.current) return;
    const parent = listRef.current.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    setPill({ left: r.left - parent.left, width: r.width, opacity: 1 });
  };
  const hidePill = () => setPill((p) => ({ ...p, opacity: 0 }));

  const isActive = (to: string) => pathname === to || pathname.startsWith(`${to}/`);

  return (
    <header
      className={`sticky top-0 z-40 border-b transition-all duration-500 ${
        scrolled
          ? "border-border/70 bg-background/80 backdrop-blur-xl shadow-[0_8px_24px_-20px_rgba(0,0,0,0.25)]"
          : "border-transparent bg-background/60 backdrop-blur-md"
      }`}
    >
      <nav
        className={`mx-auto flex max-w-7xl items-center justify-between px-6 transition-all duration-500 ${
          scrolled ? "py-2.5" : "py-4"
        }`}
      >
        <Logo />
        <ul
          ref={listRef}
          onMouseLeave={hidePill}
          className="relative hidden items-center gap-1 text-sm text-muted-foreground lg:flex"
        >
          <span
            aria-hidden
            className="pointer-events-none absolute top-1/2 -z-0 h-9 -translate-y-1/2 rounded-full bg-secondary transition-all duration-[420ms] ease-[cubic-bezier(.22,1,.36,1)]"
            style={{ left: pill.left, width: pill.width, opacity: pill.opacity }}
          />
          {NAV_LINKS.map((l) => (
            <li key={l.to} className="relative">
              <Link
                href={l.to}
                onMouseEnter={(e) => moveTo(e.currentTarget)}
                onFocus={(e) => moveTo(e.currentTarget)}
                className={`relative z-10 inline-flex items-center rounded-full px-3.5 py-2 transition-colors duration-300 hover:text-ink ${
                  isActive(l.to) ? "text-ink font-medium" : ""
                }`}
              >
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="flex items-center gap-2">
          <Link
            href="/sign-in"
            className="hidden items-center gap-1.5 text-sm text-muted-foreground transition hover:text-ink md:inline-flex"
          >
            <span aria-hidden className="inline-block h-1.5 w-1.5 rounded-full bg-soul" />
            Login
          </Link>
          <a
            href={DEMO_URL}
            target="_blank"
            rel="noreferrer"
            className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full bg-ink px-4 py-2 text-sm font-medium text-paper transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_10px_30px_-10px_oklch(0.72_0.16_55_/_0.6)]"
          >
            <span
              className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-soul/50 to-transparent transition-transform duration-700 group-hover:translate-x-full"
              aria-hidden
            />
            <span className="relative">Demo buchen</span>
            <span aria-hidden className="relative transition-transform duration-300 group-hover:translate-x-1">→</span>
          </a>
          <button
            type="button"
            className="ml-1 inline-flex h-9 w-9 items-center justify-center rounded-full border border-border transition hover:bg-secondary lg:hidden"
            onClick={() => setOpen(!open)}
            aria-label="Menü"
            aria-expanded={open}
          >
            <div className="relative h-3.5 w-4">
              <span
                className={`absolute left-0 top-0 h-[2px] w-full origin-center bg-current transition-all duration-300 ${
                  open ? "translate-y-[6px] rotate-45" : ""
                }`}
              />
              <span
                className={`absolute left-0 top-[6px] h-[2px] w-full bg-current transition-all duration-300 ${
                  open ? "scale-x-0 opacity-0" : ""
                }`}
              />
              <span
                className={`absolute left-0 top-[12px] h-[2px] w-full origin-center bg-current transition-all duration-300 ${
                  open ? "-translate-y-[6px] -rotate-45" : ""
                }`}
              />
            </div>
          </button>
        </div>
      </nav>
      <div
        className={`overflow-hidden border-border bg-background/95 backdrop-blur-xl transition-[max-height,border-color,opacity] duration-500 ease-[cubic-bezier(.22,1,.36,1)] lg:hidden ${
          open ? "max-h-[480px] border-t opacity-100" : "max-h-0 border-transparent opacity-0"
        }`}
      >
        <ul className="mx-auto flex max-w-7xl flex-col gap-1 px-6 py-3 text-sm">
          {NAV_LINKS.map((l, i) => (
            <li
              key={l.to}
              className="opacity-0"
              style={{
                animation: open
                  ? `fade-in .45s cubic-bezier(.22,1,.36,1) ${0.05 + i * 0.05}s forwards`
                  : undefined,
              }}
            >
              <Link
                href={l.to}
                className="group flex items-center justify-between rounded-xl px-3 py-3 text-muted-foreground transition-all duration-300 hover:translate-x-1 hover:bg-secondary hover:text-ink"
                onClick={() => setOpen(false)}
              >
                <span>{l.label}</span>
                <span
                  aria-hidden
                  className="-translate-x-2 opacity-0 transition-all duration-300 group-hover:translate-x-0 group-hover:opacity-100"
                >
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </header>
  );
}
