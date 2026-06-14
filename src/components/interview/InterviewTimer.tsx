"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

/**
 * Sichtbarer Countdown für das per-Studie konfigurierte Zeitlimit
 * (max_duration_seconds). Rein darstellend + rein clientseitig: die verbleibende
 * Zeit ergibt sich aus startedAt + maxDurationSeconds.
 *
 * SSR-sicher: vor dem Mount ist `now` null → es wird NICHTS gerendert (kein
 * Date.now() im ersten Render → keine Hydration-Mismatch). Rendert auch nichts,
 * wenn kein Limit gesetzt ist (maxDurationSeconds/startedAt null) oder die
 * Session nicht mehr aktiv ist (`active=false`).
 *
 * Es ist NUR ein Hinweis: bei TEXT-Interviews schließt der Server beim nächsten
 * Senden nach Ablauf (kein Auto-Submit hier — ein untätig offenes Interview
 * bleibt offen); bei VOICE beendet der Agent das Gespräch hart per Timer. Bei
 * ≤0 zeigt die Anzeige „Zeit abgelaufen".
 */
export function InterviewTimer({
  startedAt,
  maxDurationSeconds,
  active,
}: {
  startedAt: string | null;
  maxDurationSeconds: number | null;
  active: boolean;
}) {
  const t = useTranslations("interview");
  const [now, setNow] = useState<number | null>(null);

  const startedMs = startedAt ? new Date(startedAt).getTime() : NaN;
  const deadlineMs =
    startedAt && maxDurationSeconds && !Number.isNaN(startedMs)
      ? startedMs + maxDurationSeconds * 1000
      : null;

  useEffect(() => {
    if (!active || deadlineMs === null) return;
    const tick = () => setNow(Date.now());
    // Erster Tick asynchron (setTimeout 0) statt synchron im Effect-Body —
    // hält den Effect frei von einem synchronen setState (kein
    // set-state-in-effect / Hydration-Mismatch) und füllt `now` quasi sofort.
    const kickoff = setTimeout(tick, 0);
    const id = setInterval(tick, 1000);
    return () => {
      clearTimeout(kickoff);
      clearInterval(id);
    };
  }, [active, deadlineMs]);

  if (deadlineMs === null || !active || now === null) return null;

  const remainingMs = deadlineMs - now;
  const expired = remainingMs <= 0;
  const remainingMin = Math.max(0, Math.ceil(remainingMs / 60000));

  const label = expired
    ? t("timer.expired")
    : remainingMin <= 1
      ? t("timer.lastMinute")
      : t("timer.remaining", { minutes: remainingMin });

  return (
    <div
      role="timer"
      aria-live="off"
      className="mb-4 flex items-center gap-1.5 text-[11px] font-medium tabular-nums"
      style={{ color: expired ? "#9B5675" : "#8A85A0" }}
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
      <span>{label}</span>
    </div>
  );
}
