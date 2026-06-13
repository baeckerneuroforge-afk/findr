"use client";

import { useTranslations } from "next-intl";

/**
 * Universeller Interview-Fortschrittsbalken (Text, Push-to-Talk, LiveKit-Voice).
 *
 * Rein darstellend: `percent` leitet der Aufrufer aus der schon vorhandenen
 * System-Obergrenze ab (gestellte Agent-Fragen ÷ Decke), NIE aus einer fest
 * gesetzten Rundenzahl — das Interview bleibt sättigungsgesteuert. Der Wert ist
 * bewusst eine ehrliche Näherung: solange das Gespräch läuft, deckelt der
 * Aufrufer ihn unter 100 %, bei (auch frühem) Abschluss springt er sauber auf
 * 100 %. Es wird KEINE "Frage X von Y"-Anzeige gerendert → die konkrete
 * Fragenanzahl bleibt verborgen (Demand-Effekt-Disziplin der Engine); nur eine
 * Prozentzahl plus Balken.
 */
export function InterviewProgress({
  percent,
  accentColor,
}: {
  percent: number;
  accentColor: string;
}) {
  const t = useTranslations("interview");
  const value = Math.max(0, Math.min(100, Math.round(percent)));

  return (
    <div className="mb-5">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-wider text-[#8A85A0]">
          {t("progress.label")}
        </span>
        <span className="text-[11px] font-semibold tabular-nums text-[#6B6680]">
          {value}%
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t("progress.aria", { percent: value })}
        className="h-1.5 w-full overflow-hidden rounded-full bg-[#E8E4F2]"
      >
        <div
          className="h-full rounded-full transition-[width] duration-700 ease-out motion-reduce:transition-none"
          style={{ width: `${value}%`, backgroundColor: accentColor }}
        />
      </div>
    </div>
  );
}
