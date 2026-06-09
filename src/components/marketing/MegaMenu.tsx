"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useReducedMotion } from "framer-motion";
import { ICONS, ChevronDownIcon } from "./icons";
import type { NavEntry, NavGroup, NavLeaf } from "./nav-data";

/**
 * Desktop mega-menu — the second "use client" island in the otherwise-static
 * marketing header (the first is MobileNav). Hidden < md, where MobileNav's
 * accordion takes over.
 *
 * A11y: this is a DISCLOSURE, not an application menu — `<button aria-expanded
 * aria-controls>` triggers reveal full-width panels of REAL `<a>` links. We do
 * NOT use role="menu"/menuitem (that hijacks Tab and strips link semantics).
 *   • Enter/Space (native button) toggles the panel.
 *   • Tab / Shift+Tab walk the panel's links in DOM order — the panel is the
 *     trigger's next sibling, so focus flows straight in and back out. Tab does
 *     NOT close; focus leaving the trigger+panel subtree (focusout) does.
 *   • Escape closes AND returns focus to the trigger.
 *   • Pointerdown outside closes (no focus-trapping overlay).
 *   • Hover-intent (pointerenter opens, pointerleave closes after a short grace
 *     period that re-entering cancels) is wired ONLY on fine-pointer + hover
 *     devices (matchMedia). On touch the trigger is pure click-disclosure.
 *
 * Motion: panel fades in via the existing `animate-fade-in-panel` keyframe,
 * gated by framer's useReducedMotion() → prefers-reduced-motion gets the panel
 * instantly, no movement (only opacity/transform animate anyway).
 */

const CLOSE_DELAY_MS = 150;

export function MegaMenu({ nav }: { nav: NavEntry[] }) {
  const [openId, setOpenId] = useState<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hoverCapable = useRef(false);
  const triggerRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const rootRef = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();

  // Hover-intent only on a real mouse (fine pointer + hover). On touch/coarse
  // pointers the menu stays click-only. Re-check on change for hybrid devices.
  useEffect(() => {
    const mq = window.matchMedia("(hover: hover) and (pointer: fine)");
    const sync = () => {
      hoverCapable.current = mq.matches;
    };
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const clearTimer = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const open = useCallback(
    (id: string) => {
      clearTimer();
      setOpenId(id);
    },
    [clearTimer],
  );

  const close = useCallback(() => {
    clearTimer();
    setOpenId(null);
  }, [clearTimer]);

  const scheduleClose = useCallback(() => {
    clearTimer();
    closeTimer.current = setTimeout(() => setOpenId(null), CLOSE_DELAY_MS);
  }, [clearTimer]);

  const toggle = useCallback(
    (id: string) => {
      clearTimer();
      setOpenId((cur) => (cur === id ? null : id));
    },
    [clearTimer],
  );

  // Escape (close + restore focus to trigger) and outside-pointerdown (close).
  useEffect(() => {
    if (!openId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        const id = openId;
        close();
        triggerRefs.current[id]?.focus();
      }
    };
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) close();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [openId, close]);

  // Drop any pending grace-timer on unmount.
  useEffect(() => () => clearTimer(), [clearTimer]);

  return (
    <nav
      ref={rootRef}
      aria-label="Hauptnavigation"
      className="hidden items-center gap-8 md:flex"
    >
      {nav.map((entry) => {
        if (entry.kind === "flat") {
          return (
            <Link
              key={entry.href}
              href={entry.href}
              className="rounded font-mono text-[11.5px] uppercase tracking-[0.14em] text-neutral-500 transition-colors hover:text-neutral-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-2"
            >
              {entry.label}
            </Link>
          );
        }

        const isOpen = openId === entry.id;
        const panelId = `mega-panel-${entry.id}`;
        return (
          <div
            key={entry.id}
            // Full header height so the wrapper's bottom edge meets the panel's
            // top (top-16) with no gap. The panel is a fixed-positioned DESCENDANT,
            // so a contiguous wrapper→panel hit area means pointerleave never
            // fires while travelling trigger → panel (no flicker; the grace-timer
            // only ever runs when truly leaving both).
            className="flex h-16 items-center"
            onPointerEnter={() => {
              if (hoverCapable.current) open(entry.id);
            }}
            onPointerLeave={() => {
              if (hoverCapable.current) scheduleClose();
            }}
            // Close once focus leaves the trigger+panel subtree (Tab past the
            // last link). Staying inside (relatedTarget within) keeps it open.
            onBlur={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                scheduleClose();
              }
            }}
          >
            <button
              type="button"
              ref={(el) => {
                triggerRefs.current[entry.id] = el;
              }}
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => toggle(entry.id)}
              className={`inline-flex items-center gap-1 rounded font-mono text-[11.5px] uppercase tracking-[0.14em] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-2 ${
                isOpen ? "text-neutral-900" : "text-neutral-500 hover:text-neutral-900"
              }`}
            >
              {entry.label}
              <ChevronDownIcon
                className={`h-4 w-4 text-neutral-500 transition-transform duration-150 ${
                  isOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {isOpen ? (
              <div
                id={panelId}
                className={`fixed inset-x-0 top-16 z-40 border-b border-neutral-200 bg-neutral-0 shadow-[0_40px_80px_-40px_rgba(60,45,25,0.4)] ${
                  reduceMotion ? "" : "animate-fade-in-panel"
                }`}
              >
                <div className="mx-auto w-full max-w-[1180px] px-6 py-8 sm:px-8">
                  <MegaPanel groups={entry.groups} onNavigate={close} />
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}

/** Panel body: one unheaded group (Plattform → 2×2 module grid) or several
 *  headed columns (Lösungen → roles / industries). */
function MegaPanel({
  groups,
  onNavigate,
}: {
  groups: NavGroup[];
  onNavigate: () => void;
}) {
  const multi = groups.length > 1;
  return (
    <div className={multi ? "grid gap-x-12 gap-y-8 sm:grid-cols-2" : ""}>
      {groups.map((group, gi) => (
        <div key={group.heading ?? gi} className="flex min-w-0 flex-col gap-4">
          {group.heading ? (
            <h2 className="font-mono text-[10.5px] font-medium uppercase tracking-[0.2em] text-neutral-500">
              {group.heading}
            </h2>
          ) : null}

          <ul className={multi ? "flex flex-col gap-1" : "grid gap-1 sm:grid-cols-2"}>
            {group.items.map((leaf) => (
              <li key={leaf.href}>
                <LeafLink leaf={leaf} onNavigate={onNavigate} />
              </li>
            ))}
          </ul>

          {group.overview ? (
            <div className={multi ? "pt-1" : "mt-1 border-t border-neutral-200 pt-3"}>
              <OverviewLink
                label={group.overview.label}
                href={group.overview.href}
                onNavigate={onNavigate}
              />
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/** A single panel entry: icon + single-ink title + muted one-liner. The whole
 *  row is the link target. */
function LeafLink({ leaf, onNavigate }: { leaf: NavLeaf; onNavigate: () => void }) {
  const Icon = ICONS[leaf.icon];
  return (
    <Link
      href={leaf.href}
      onClick={onNavigate}
      className="flex items-start gap-3 rounded-md p-3 transition-colors hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500"
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary-600" />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-sm font-medium text-neutral-900">{leaf.label}</span>
        <span className="line-clamp-2 text-[13px] leading-relaxed text-neutral-500">
          {leaf.desc}
        </span>
      </span>
    </Link>
  );
}

/** Foot-of-column "see all" link (violet, the only place the accent reads as a
 *  text colour — it's an explicit overview destination, not a heading recolour). */
function OverviewLink({
  label,
  href,
  onNavigate,
}: {
  label: string;
  href: string;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className="group/ov inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium text-primary-700 transition-colors hover:text-primary-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-2"
    >
      {label}
      <span aria-hidden className="transition-transform group-hover/ov:translate-x-0.5">
        →
      </span>
    </Link>
  );
}
