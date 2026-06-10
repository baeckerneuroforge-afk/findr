"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * O6 (Konsole-v5): leises Live-Gefühl ohne Streaming und ohne neues Backend.
 * Ruft im festen Intervall router.refresh() auf — die Server-Komponente
 * liest ihre vorhandenen Queries neu, React patcht nur Geändertes:
 * Client-State, Formulareingaben und Fokus bleiben erhalten, und das
 * template.tsx remountet bei refresh nicht (kein erneutes Eintritts-Rise
 * alle 30 Sekunden).
 *
 * Höflich gegenüber Akku und Server: gepollt wird nur bei sichtbarem Tab;
 * wird der Tab wieder sichtbar, refresht es sofort — wer zurückkommt,
 * sieht frische Zahlen statt fast abgelaufener.
 *
 * Rendert nichts.
 */
export function AutoRefresh({
  intervalMs = 30_000,
}: {
  intervalMs?: number;
}) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, intervalMs);
    const onVisibility = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [router, intervalMs]);

  return null;
}
