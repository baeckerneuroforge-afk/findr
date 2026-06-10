"use client";

import { useEffect, useState, type RefObject } from "react";

/**
 * Einmaliges in-View-Signal via IntersectionObserver — Ersatz für framer-
 * motions `useInView(ref, { once: true, margin })` (Perf-Audit 1.3, gleiche
 * Semantik: feuert einmal, bleibt dann true). Ohne IO-Support (sehr alte
 * Browser) sofort true → Inhalt zeigt sich statisch statt nie.
 */
export function useInViewOnce(
  ref: RefObject<Element | null>,
  rootMargin = "-100px",
): boolean {
  const [inView, setInView] = useState(false);

  useEffect(() => {
    if (inView) return;
    const el = ref.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) {
      // Async statt synchron im Effect-Body (react-hooks/set-state-in-effect):
      // der nächste Frame zeigt den Inhalt statisch.
      const raf = requestAnimationFrame(() => setInView(true));
      return () => cancelAnimationFrame(raf);
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        setInView(true);
        io.disconnect();
      },
      { rootMargin },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [ref, rootMargin, inView]);

  return inView;
}
