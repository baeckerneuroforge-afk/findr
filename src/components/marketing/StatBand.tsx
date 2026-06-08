"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

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
  const reduce = useReducedMotion();
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
    <section className="py-20 sm:py-28">
      <div className="mx-auto w-full max-w-[1180px] px-6 sm:px-8">
        <div
          ref={ref}
          className="grid grid-cols-2 gap-px overflow-hidden rounded border border-neutral-200 bg-neutral-200 lg:grid-cols-4"
        >
          {STATS.map((s, i) => (
            <div
              key={s.label}
              className="flex flex-col items-center gap-2 bg-white px-6 py-10 text-center"
            >
              {/* Whole stat reads in one ink colour — no violet number/suffix
                  accent (the suffix inherits neutral-900 from the parent). */}
              <div className="font-marketing text-[clamp(40px,6vw,60px)] font-semibold leading-none tracking-[-0.02em] text-neutral-900 tabular-nums">
                {counts[i]}
                {s.suffix}
              </div>
              <div className="max-w-[18ch] text-sm leading-snug text-neutral-500">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
