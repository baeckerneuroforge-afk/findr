import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { Card, CardHeader } from "@/components/ui/Card";
import {
  KonsoulSuggestions,
  MAX_CARDS,
} from "@/components/dashboard/KonsoulSuggestions";
import type { KonsoulSignal } from "@/lib/konsoul/signals";
import { konsoulCoach } from "@/lib/konsoul/coach/service";

/** Ein regelbasierter „Nächster Schritt" auf der Heute-Seite — rein aus
 *  Status + Zählungen abgeleitet, kein Score, keine Heuristik-Magie. Die
 *  Felder `action`/`desc`/`cta` sind bereits i18n-aufgelöst; `desc` trägt jede
 *  Zahl. (Einzige Quelle der Wahrheit für den Typ — die Seite importiert ihn.) */
export interface HeuteNextStep {
  key: string;
  planTitle: string;
  action: string;
  desc: string;
  cta: string;
  href: string;
}

interface SectionsProps {
  topSteps: HeuteNextStep[];
  konsoulSignals: KonsoulSignal[];
  /** P4 (Coach): anchor-gefilterte Opus-Kopfzeilen je Item-key. Fehlt ein
   *  Eintrag, bleibt der deterministische Text. Ohne Map (Fallback/Flag aus)
   *  rendert diese Komponente byte-gleich zum P1-Stand. */
  frames?: Map<string, string>;
}

/**
 * Die beiden proaktiven „Heute"-Sektionen — „Nächste Schritte" (R1/R2/R3, --st 2)
 * und „Konsoul schlägt vor" (Signale, --st 3) — als EINE Einheit, damit der Coach
 * (P4) beide mit derselben Frame-Map progressiv aufwerten kann. STRENG ADDITIV:
 * ohne `frames` ist die Ausgabe identisch zum vorherigen Inline-Render der Seite.
 *
 * Honesty-Vertrag: `frames.get(step.key)` ersetzt NUR die imperative
 * `action`-Kopfzeile (ziffernfrei, anchor-gefiltert in coach/engine.ts). Der
 * angehängte `planTitle` und die `desc`-Zeile mit der echten Zählung bleiben
 * deterministisch und unverändert.
 */
export async function HeuteCoachSections({
  topSteps,
  konsoulSignals,
  frames,
}: SectionsProps) {
  const t = await getTranslations("heute");

  return (
    <>
      {topSteps.length > 0 && (
        <Card className="st-rise" style={{ "--st": 2 } as React.CSSProperties}>
          <CardHeader className="flex items-center justify-between gap-4">
            <h2 className="text-h3 text-neutral-900">{t("nextTitle")}</h2>
            <span className="text-caption text-neutral-400">
              {t("nextHint")}
            </span>
          </CardHeader>
          {topSteps.map((step) => (
            <div
              key={step.key}
              className="flex items-center justify-between gap-4 border-b border-neutral-100 px-5 py-4 last:border-b-0"
            >
              <div className="min-w-0">
                <p className="text-body-strong text-neutral-900">
                  {frames?.get(step.key) ?? step.action}
                  <span className="font-normal text-neutral-500">
                    {" "}
                    — {step.planTitle}
                  </span>
                </p>
                <p className="mt-0.5 text-small text-neutral-500">
                  {step.desc}
                </p>
              </div>
              <Link
                href={step.href}
                className="inline-flex h-8 shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-card px-3 text-small font-medium text-neutral-900 transition-colors hover:bg-neutral-50"
              >
                {step.cta}
              </Link>
            </div>
          ))}
        </Card>
      )}

      {konsoulSignals.length > 0 && (
        <div className="st-rise" style={{ "--st": 3 } as React.CSSProperties}>
          <KonsoulSuggestions signals={konsoulSignals} frames={frames} />
        </div>
      )}
    </>
  );
}

interface LoaderProps {
  orgId: string;
  locale: string;
  topSteps: HeuteNextStep[];
  konsoulSignals: KonsoulSignal[];
}

/**
 * Async-Loader (P4): holt die anchor-gefilterten Coach-Frames (flag-gated,
 * gecacht, fail-open) und rendert dieselben Sektionen aufgewertet. In der Seite
 * in eine <Suspense>-Grenze gehängt, deren Fallback dieselbe Komponente OHNE
 * Frames ist — so malen die deterministischen Karten sofort und der Coach
 * verbessert progressiv. Flag aus ⇒ konsoulCoach gibt sofort eine leere Map
 * zurück (kein Opus) ⇒ keine spürbare Verzögerung, Ausgabe byte-gleich.
 */
export async function CoachedHeuteSections({
  orgId,
  locale,
  topSteps,
  konsoulSignals,
}: LoaderProps) {
  // Frame ONLY what the cards actually render: topSteps is already ≤3 and
  // KonsoulSuggestions renders filter(grounded).slice(0, MAX_CARDS). Capping the
  // coach input the same way (a) never frames an invisible signal and (b) keeps
  // the item count ≤6, safely under the model's frames-array bound — so a
  // power-user portfolio with many signals can't overflow it and lose ALL frames.
  const frames = await konsoulCoach({
    orgId,
    locale,
    nextSteps: topSteps,
    signals: konsoulSignals.filter((s) => s.grounded).slice(0, MAX_CARDS),
  });
  return (
    <HeuteCoachSections
      topSteps={topSteps}
      konsoulSignals={konsoulSignals}
      frames={frames}
    />
  );
}
