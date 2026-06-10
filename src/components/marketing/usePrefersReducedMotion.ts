"use client";

import { useSyncExternalStore } from "react";

/**
 * Live prefers-reduced-motion subscription für die Marketing-Komponenten.
 * Ersetzt framer-motions `useReducedMotion` (Perf-Audit 1.3): sieben
 * Komponenten brauchten NUR dieses Boolean, zogen über den Import aber die
 * volle Animations-Engine (~38 KB gz) in jedes Marketing-Bundle. SSR-safe
 * (Server-Snapshot = false) via useSyncExternalStore — kein Hydration-
 * Mismatch; gleiches Muster wie im Interview-Client.
 */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
}
