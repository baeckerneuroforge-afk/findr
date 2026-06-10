"use client";

import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

/** Honest positioning anchors — NO invented volume/customer numbers. The values
 *  are factual ratios (100 % EU-hosting, 0 US-cloud, 100 % German, 14-day trial),
 *  not made-up metrics. */
const STATS = [
  { target: 100, suffix: "%", label: "In der EU gehostet · DSGVO-konform" },
  { target: 100, suffix: "%", label: "Auf Deutsch geführt · DACH-Kontext" },
  { target: 0, suffix: "", label: "US-Cloud · kein Datentransfer in die USA" },
  { target: 14, suffix: "d", label: "Gratis testen · ohne Kreditkarte" },
];

/**
 * Count-up stat band. SSR / no-JS / reduced-motion all render the FINAL values
 * (initial state = targets, matching server output → no hydration mismatch). For
 * motion users the numbers animate 0 → target once the band scrolls into view
 * (it sits below the fold, so the brief reset to 0 is never visible).
 */
export function StatBand() {
  const reduce = usePrefersReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [counts, setCounts] = useState<number[]>(() => STATS.map((s) => s.target));

  useEffect(() => {
    if (reduce) return; // keep final values, no animation
    const node = ref.current;
    if (!node) return;

    let raf = 0;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries[0]?.isIntersecting) return;
        io.disconnect();
        const start = performance.now();
        const dur = 1200;
        setCounts(STATS.map(() => 0));
        const tick = (now: number) => {
          const p = Math.min(1, (now - start) / dur);
          const eased = 1 - Math.pow(1 - p, 3);
          setCounts(STATS.map((s) => Math.round(s.target * eased)));
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
  }, [reduce]);

  return (
    // Studio-Zahlenband: riesige Bricolage-Ziffern zwischen Tinten-Hairlines
    // (st-numbers, studio.css) — gleiche Mechanik (Count-up, SSR = Endwerte).
    <section className="st-numbers">
      <div ref={ref} className="st-numbers-grid">
        {STATS.map((s, i) => (
          <div key={s.label} className="st-num">
            <div className="st-v">
              {counts[i]}
              {s.suffix ? <small>{s.suffix}</small> : null}
            </div>
            <div className="st-l">{s.label}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
