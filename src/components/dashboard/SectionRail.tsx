"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Gruppierte Sektions-Navigation der Studien-Detailseite (Konsole-v5 E4,
 * Plan-E4 „SectionRail“). Rein additiv: kennt nur Anker-IDs + Labels — die
 * Sektionen selbst bleiben unverändert.
 *
 * Scroll-Spy über einen rAF-gedrosselten window-Scroll-Listener statt
 * IntersectionObserver: bei ~13 bekannten Ankern ist der lineare
 * getBoundingClientRect-Sweep trivial billig und das „aktiv = letzte Sektion
 * über der Lesekante“-Verhalten exakt deterministisch.
 *
 * Unter lg ausgeblendet (die Seite bleibt dort die gewohnte eine Spalte).
 */

export interface RailGroup {
  label: string;
  items: Array<{ id: string; label: string }>;
}

/** Lesekante: 56px Header + 48px Sticky-Subbar + Luft. Muss zur
 *  scroll-mt-28-Klasse (112px) auf den Sektionen passen. */
const SPY_OFFSET_PX = 120;

export function SectionRail({
  groups,
  ariaLabel,
}: {
  groups: RailGroup[];
  ariaLabel: string;
}) {
  const groupsRef = useRef(groups);
  const [active, setActive] = useState<string | null>(
    groups[0]?.items[0]?.id ?? null,
  );
  // Nach einem Klick-Sprung übernimmt kurz das Ziel — sonst flackert der
  // Spy während des Smooth-Scrolls durch alle Zwischen-Sektionen. Der Pin
  // läuft über einen Timeout statt Zeitstempel-Vergleich.
  const pinned = useRef(false);
  const pinTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const ids = groupsRef.current.flatMap((g) => g.items.map((i) => i.id));
    let ticking = false;

    const compute = () => {
      ticking = false;
      if (pinned.current) return;
      let current: string | null = ids[0] ?? null;
      for (const id of ids) {
        const el = document.getElementById(id);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= SPY_OFFSET_PX) current = id;
      }
      setActive(current);
    };
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(compute);
    };

    compute();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (pinTimer.current) clearTimeout(pinTimer.current);
    };
  }, []);

  const jump = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    setActive(id);
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    pinned.current = true;
    if (pinTimer.current) clearTimeout(pinTimer.current);
    pinTimer.current = setTimeout(
      () => {
        pinned.current = false;
      },
      reduce ? 150 : 700,
    );
    el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };

  return (
    <nav
      aria-label={ariaLabel}
      className="hidden lg:sticky lg:top-24 lg:block lg:self-start"
    >
      <div className="space-y-4">
        {groups.map((group) => (
          <div key={group.label}>
            <p className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = active === item.id;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => jump(item.id)}
                      aria-current={isActive ? "true" : undefined}
                      className={`block w-full rounded-lg px-3 py-1.5 text-left text-small transition-colors ${
                        isActive
                          ? "bg-primary-50 font-medium text-primary-700"
                          : "text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900"
                      }`}
                    >
                      {item.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </nav>
  );
}
