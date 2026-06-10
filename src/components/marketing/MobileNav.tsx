"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";
import { CtaLink } from "./CtaLink";
import { ICONS, ChevronDownIcon } from "./icons";
import type { NavEntry } from "./nav-data";

/**
 * Mobile burger menu — a "use client" island (the desktop counterpart is
 * MegaMenu). Toggles a full-width panel under the bar. Hidden ≥ md.
 *
 * Items WITH a panel become a tap-disclosure accordion section (`<button
 * aria-expanded aria-controls>` + a sublist grouped by heading + the section's
 * overview link); items WITHOUT (Preise, Insights) stay flat links like before.
 * One section open at a time. No hover (touch surface). Escape closes the whole
 * menu and Body-Scroll-Lock both stay; the panel itself scrolls when the open
 * sections outgrow the viewport.
 */
export function MobileNav({ nav }: { nav: NavEntry[] }) {
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<string | null>(null);
  const reduceMotion = usePrefersReducedMotion();
  const burgerRef = useRef<HTMLButtonElement>(null);

  // Closing the menu always collapses any expanded section (so the next open
  // starts clean) — done at the call sites, not in an effect.
  const closeAll = () => {
    setOpen(false);
    setSection(null);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setSection(null);
        // Disclosure pattern: Escape returns focus to the trigger.
        burgerRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  const leafLinkCls =
    "rounded px-2 py-3 text-base text-neutral-700 hover:bg-neutral-50 hover:text-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-2";

  return (
    <div className="md:hidden">
      <button
        type="button"
        ref={burgerRef}
        aria-label={open ? "Menü schließen" : "Menü öffnen"}
        aria-expanded={open}
        aria-controls="mobile-nav"
        onClick={() => {
          if (open) {
            closeAll();
          } else {
            setOpen(true);
          }
        }}
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
            onClick={closeAll}
            className="fixed inset-0 top-16 z-30 cursor-default bg-neutral-900/10"
          />
          <div
            id="mobile-nav"
            className="fixed inset-x-0 top-16 z-40 max-h-[calc(100dvh-4rem)] overflow-y-auto border-b border-neutral-200 bg-white"
          >
            <nav
              className="flex flex-col gap-1 px-6 py-4"
              aria-label="Mobile-Navigation"
            >
              {nav.map((entry) => {
                if (entry.kind === "flat") {
                  return (
                    <Link
                      key={entry.href}
                      href={entry.href}
                      onClick={closeAll}
                      className={leafLinkCls}
                    >
                      {entry.label}
                    </Link>
                  );
                }

                const expanded = section === entry.id;
                const sectionId = `mobile-section-${entry.id}`;
                return (
                  <div key={entry.id}>
                    <button
                      type="button"
                      aria-expanded={expanded}
                      aria-controls={sectionId}
                      onClick={() =>
                        setSection((cur) => (cur === entry.id ? null : entry.id))
                      }
                      className={`flex w-full items-center justify-between rounded px-2 py-3 text-base transition-colors hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-2 ${
                        expanded ? "text-primary-700" : "text-neutral-700 hover:text-primary-700"
                      }`}
                    >
                      <span>{entry.label}</span>
                      <ChevronDownIcon
                        className={`h-4 w-4 text-neutral-500 transition-transform duration-150 ${
                          expanded ? "rotate-180" : ""
                        }`}
                      />
                    </button>

                    {expanded ? (
                      <div
                        id={sectionId}
                        className={`flex flex-col gap-3 pb-2 pl-2 ${
                          reduceMotion ? "" : "animate-fade-in-panel"
                        }`}
                      >
                        {entry.groups.map((group, gi) => (
                          <div
                            key={group.heading ?? gi}
                            className="flex flex-col gap-0.5"
                          >
                            {group.heading ? (
                              <div className="px-2 pt-2 text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-500">
                                {group.heading}
                              </div>
                            ) : null}

                            {group.items.map((leaf) => {
                              const Icon = ICONS[leaf.icon];
                              return (
                                <Link
                                  key={leaf.href}
                                  href={leaf.href}
                                  onClick={closeAll}
                                  className="flex items-center gap-2.5 rounded px-2 py-2.5 text-[15px] text-neutral-700 hover:bg-neutral-50 hover:text-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-2"
                                >
                                  <Icon className="h-[18px] w-[18px] shrink-0 text-primary-600" />
                                  {leaf.label}
                                </Link>
                              );
                            })}

                            {group.overview ? (
                              <Link
                                href={group.overview.href}
                                onClick={closeAll}
                                className="mt-0.5 inline-flex items-center gap-1.5 rounded px-2 py-2 text-sm font-medium text-primary-700 transition-colors hover:text-primary-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-2"
                              >
                                {group.overview.label}
                                <span aria-hidden>→</span>
                              </Link>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                );
              })}

              <div className="mt-3 flex flex-col gap-2 border-t border-neutral-200 pt-4">
                <Link
                  href="/sign-in"
                  onClick={closeAll}
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
