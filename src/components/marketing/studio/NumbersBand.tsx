"use client";

import { useEffect, useRef } from "react";
import {
  localizedContent,
  MARKETING_DEFAULT_LOCALE,
  type Locale,
} from "@/i18n/marketing-locale";

/**
 * Zahlen-Band: riesige Bricolage-Ziffern mit Count-up beim Einscrollen.
 * Ehrliche Positionierungs-Anker — KEINE erfundenen Volumen-/Kundenzahlen
 * (100 % EU-Hosting, 0 US-Cloud, 4 Methoden, 1 Engine).
 *
 * SSR-/no-JS-/reduced-motion-Muster wie überall: die ENDWERTE stehen bereits
 * im Markup; nur Motion-User sehen die Animation 0 → Ziel (das Band liegt
 * unter dem Fold, der kurze Reset auf 0 ist nie sichtbar).
 */

// German content. EN noch nicht getextet → DE-Fallback (EN=DE); nur die
// `label`-Strings sind übersetzbar, die Werte/Suffixe sind sprachneutral.
const STATS_DE: { value: number; suffix?: string; label: string }[] = [
  { value: 100, suffix: "%", label: "EU-gehostet · DSGVO-konform" },
  { value: 0, label: "US-Cloud · null Datentransfer" },
  { value: 4, label: "Methoden · alle live" },
  { value: 1, label: "Engine · alle Methoden" },
];

export function NumbersBand({
  lang = MARKETING_DEFAULT_LOCALE,
}: {
  // Optional: home + produkt pass the page locale; defaults to German.
  lang?: Locale;
}) {
  const stats = localizedContent(lang, { de: STATS_DE });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const node = ref.current;
    if (reduce || !node || !("IntersectionObserver" in window)) return;

    const spans = Array.from(
      node.querySelectorAll<HTMLElement>("[data-target]"),
    );
    let raf = 0;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        io.disconnect();
        const start = performance.now();
        const dur = 1300;
        spans.forEach((s) => (s.textContent = "0"));
        const tick = (now: number) => {
          const p = Math.min(1, (now - start) / dur);
          const eased = 1 - Math.pow(1 - p, 3);
          spans.forEach((s) => {
            s.textContent = String(
              Math.round(parseInt(s.dataset.target ?? "0", 10) * eased),
            );
          });
          if (p < 1) raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );
    io.observe(node);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <section className="st-numbers">
      <div ref={ref} className="st-numbers-grid">
        {stats.map((s) => (
          <div key={s.label} className="st-num">
            <div className="st-v">
              <span data-target={s.value}>{s.value}</span>
              {s.suffix ? <small>{s.suffix}</small> : null}
            </div>
            <div className="st-l">{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
