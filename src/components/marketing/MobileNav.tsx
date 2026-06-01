"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CtaLink } from "./CtaLink";

/**
 * Mobile burger menu — the one interactive ('use client') island in the
 * otherwise-static header. Toggles a full-width panel under the bar. Locks body
 * scroll and closes on Escape / link tap. Hidden ≥ md (desktop nav takes over).
 */
export function MobileNav({
  navLinks,
}: {
  navLinks: { label: string; href: string }[];
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-label={open ? "Menü schließen" : "Menü öffnen"}
        aria-expanded={open}
        aria-controls="mobile-nav"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-10 w-10 items-center justify-center rounded text-neutral-900 hover:bg-neutral-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-2"
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          aria-hidden
        >
          {open ? (
            <path d="M6 6 18 18M18 6 6 18" />
          ) : (
            <path d="M3 6h18M3 12h18M3 18h18" />
          )}
        </svg>
      </button>

      {open ? (
        <>
          <button
            type="button"
            aria-hidden
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 top-16 z-30 cursor-default bg-neutral-900/10"
          />
          <div
            id="mobile-nav"
            className="fixed inset-x-0 top-16 z-40 border-b border-neutral-200 bg-white"
          >
            <nav className="flex flex-col gap-1 px-6 py-4" aria-label="Mobile-Navigation">
              {navLinks.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="rounded px-2 py-3 text-base text-neutral-700 hover:bg-neutral-50 hover:text-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-2"
                >
                  {l.label}
                </Link>
              ))}
              <div className="mt-3 flex flex-col gap-2 border-t border-neutral-200 pt-4">
                <Link
                  href="/sign-in"
                  onClick={() => setOpen(false)}
                  className="rounded px-2 py-3 text-base text-neutral-700 hover:text-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-2"
                >
                  Log in
                </Link>
                <CtaLink href="/sign-up" variant="secondary" className="w-full">
                  Kostenlos testen
                </CtaLink>
                <CtaLink href="/demo" variant="primary" className="w-full">
                  Demo buchen
                </CtaLink>
              </div>
            </nav>
          </div>
        </>
      ) : null}
    </div>
  );
}
