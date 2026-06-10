"use client";

import { useSyncExternalStore } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toBcp47 } from "@/i18n/locale";

/**
 * Begrüßung + Datumszeile der „Heute“-Startseite (Konsole-v5 E2.5).
 *
 * Tageszeit und Datum kommen von der CLIENT-Uhr: der Server rendert in UTC
 * und kennt die Zeitzone des Nutzers nicht — eine serverseitige Begrüßung
 * wäre morgens/abends regelmäßig falsch. useSyncExternalStore liefert dafür
 * den hydration-sicheren Pfad (bewährtes Muster im Repo): der Server-Snapshot
 * ist neutral („Guten Tag“, leere Datumszeile, per min-h ohne Layout-Sprung),
 * React tauscht nach der Hydration ohne Mismatch-Warnung auf die lokalen
 * Werte.
 */

type Daypart = "morning" | "day" | "evening";

const noopSubscribe = () => () => {};

function clientDaypart(): Daypart {
  const hour = new Date().getHours();
  if (hour < 11) return "morning";
  if (hour < 17) return "day";
  return "evening";
}

const GREETING_KEY: Record<Daypart, string> = {
  morning: "greetingMorning",
  day: "greetingDay",
  evening: "greetingEvening",
};

export function HeuteGreeting({ name }: { name: string | null }) {
  const t = useTranslations("heute");
  const locale = useLocale();

  const daypart = useSyncExternalStore<Daypart>(
    noopSubscribe,
    clientDaypart,
    () => "day",
  );
  const dateLine = useSyncExternalStore(
    noopSubscribe,
    () =>
      new Intl.DateTimeFormat(toBcp47(locale), {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }).format(new Date()),
    () => "",
  );

  return (
    <div>
      <p className="min-h-[16px] text-caption uppercase tracking-wider text-neutral-400">
        {dateLine}
      </p>
      <h1 className="mt-1 text-display text-neutral-900">
        {t(GREETING_KEY[daypart])}
        {name ? `, ${name}` : ""}.
      </h1>
    </div>
  );
}
