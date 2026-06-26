import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Card, CardHeader } from "@/components/ui/Card";
import { Konsoul } from "@/components/dashboard/Konsoul";
import type {
  KonsoulSignal,
  KonsoulSignalKind,
} from "@/lib/konsoul/signals";

/**
 * „Konsoul schlägt vor" — die proaktive Coach-Sektion auf „Heute" (Plan §4B /
 * Surface A). STRENG ADDITIV neben „Nächste Schritte": dieselbe Karten-Grammatik
 * (Kopf mit h2 + Hinweis, Zeilen mit Vorschlags-Text · Evidenz · CTA-Link), aber
 * JEDE Karte trägt ihre Evidenz inline („Beleg: 12 Interviews" / „Beleg: 3
 * Studien").
 *
 * Ehrlichkeits-Vertrag (nicht verhandelbar): Konsoul zeigt nur Zahlen, die der
 * deterministische `SignalEngine` (signals.ts) aus der DB gezählt hat — nie
 * erfundene. `signal.count` und `signal.evidence` kommen unverändert aus dem
 * Signal; der Vorschlags-Satz wird aus EXAKT diesen Werten via i18n geformt.
 * Eine geerdete Empfehlung (`signal.grounded === true` — vom Engine bestimmt)
 * bekommt die normale Tinte; ein wiederkehrendes Thema mit nur EINER Studie
 * (`grounded === false`) ist eine Interpretation und bekommt das
 * gestrichelt-amberne „nicht direkt belegt"-Gewand (gleiche Grammatik wie
 * Konsouls hedge-Gesicht), NIE die geerdete Behandlung.
 *
 * Server-Komponente — keine Client-Interaktivität in v1. Die Priorisierung
 * (severity) und Sortierung passiert im Engine; hier wird nur defensiv auf
 * max. 3 gekappt.
 */

export const MAX_CARDS = 3;

/** Pro Signal-Kind: i18n-Schlüssel des Vorschlags-Satzes + des CTA-Buttons.
 *  Die Hrefs zeigen NUR auf sichere, lesende/anlegende Routen — nie
 *  Teilnehmer-Daten, Versand oder destruktive Aktionen (Plan §6):
 *    persona_gate/quality  → /dashboard/research-plans/{id}/synthesis
 *    recurring_theme       → /dashboard/market-research/new
 *  persona_gate und persona_quality bekommen BEWUSST eigene Texte: der Gate-Tip
 *  („brauchst 10") gilt nur < 10; der Quality-Tip (10–14) sagt ehrlich, dass
 *  Personas schon möglich sind und ab 15 robuster werden — nie „erst N, brauchst 10". */
const TIP_KEY: Record<KonsoulSignalKind, string> = {
  persona_gate: "tipPersonaGate",
  persona_quality: "tipPersonaQuality",
  recurring_theme: "tipRecurringTheme",
};

const CTA_KEY: Record<KonsoulSignalKind, string> = {
  persona_gate: "ctaStudy",
  persona_quality: "ctaStudy",
  recurring_theme: "ctaNewStudy",
};

/** Ziel-Route aus dem Signal — ausschließlich aus seiner Evidenz abgeleitet
 *  (planId für plan-getragene Signale), nie geraten. */
function hrefForSignal(signal: KonsoulSignal): string {
  if (signal.evidence.type === "plan") {
    // persona_gate / persona_quality → die Studien-Synthese-Seite, wo
    // Interview-Stand + Persona-Erzeugung leben.
    return `/dashboard/research-plans/${signal.evidence.planId}/synthesis`;
  }
  // theme-Evidenz (recurring_theme) → nächste Studie vorschlagen.
  return "/dashboard/market-research/new";
}

/** ICU-Argumente für den Vorschlags-Satz — kommen DIREKT aus dem Signal
 *  (deterministisch), werden nie umformuliert. plan-getragene Tips wollen
 *  {title, count}; das Thema-Tip will {theme, count}. */
function tipArgs(signal: KonsoulSignal): Record<string, string | number> {
  if (signal.evidence.type === "theme") {
    return { theme: signal.evidence.theme, count: signal.count };
  }
  return { title: signal.evidence.planTitle, count: signal.count };
}

export async function KonsoulSuggestions({
  signals,
  frames,
}: {
  signals: KonsoulSignal[];
  /** P4 (Coach): optionale, anchor-gefilterte Opus-Kopfzeile je signal.key. Fehlt
   *  ein Eintrag (Flag aus / LLM-Fehler / Filter-Reject), bleibt der
   *  deterministische i18n-Tip stehen. NIE eine Zahl — die Evidenz-Zeile darunter
   *  trägt die echte Zählung unverändert. */
  frames?: Map<string, string>;
}) {
  const t = await getTranslations("konsoulCoach");

  // Der Engine liefert bereits nach severity → count sortiert; hier nur (1) ein
  // defensiver Filter auf geerdete Signale — ein nicht belegbares dürfte nie als
  // sichere Empfehlung erscheinen (der Engine emittiert aktuell ohnehin nur
  // geerdete, das ist Gürtel + Hosenträger) — und (2) ein harter Deckel auf drei.
  const topSignals = signals.filter((s) => s.grounded).slice(0, MAX_CARDS);
  if (topSignals.length === 0) return null;

  return (
    <Card>
      <CardHeader className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {/* Kleines Konsoul-Gesicht (answer-Zustand, grüner Pip) als
              Sektions-Marke — aria-hidden, alle Bedeutung steht im Titel-Text. */}
          <Konsoul state="answer" className="hidden h-12 w-[120px] sm:block" />
          <h2 className="text-h3 text-neutral-900">{t("sectionTitle")}</h2>
        </div>
      </CardHeader>

      {topSignals.map((signal) => {
        // recurring_theme zählt Studien, alle anderen zählen Interviews/Tage —
        // das Evidenz-Label folgt der Evidenz-Art (theme vs. plan).
        const evidenceLabel =
          signal.evidence.type === "theme"
            ? t("evidenceStudies", { count: signal.count })
            : t("evidenceInterviews", { count: signal.count });

        return (
          <div
            key={signal.key}
            className={
              signal.grounded
                ? "flex items-center justify-between gap-4 border-b border-neutral-100 px-5 py-4 last:border-b-0"
                : // Interpretation: gestrichelter amberner Rahmen — EXAKT die
                  // „nicht direkt belegt"-Grammatik aus Konsouls eigenem Panel
                  // (CrossStudyAgentPanel InterpretationBlock), damit Heute und
                  // /insights eine Bild-Sprache teilen.
                  "m-3 flex items-center justify-between gap-4 rounded-md border border-dashed border-warning-500/40 bg-warning-50 px-4 py-3"
            }
          >
            <div className="min-w-0">
              {/* Bei einer Interpretation zuerst das ehrliche „nicht direkt
                  belegt"-Label (gleiche Caption-Optik wie im Konsoul-Panel). */}
              {!signal.grounded && (
                <p className="mb-1 text-caption font-medium uppercase tracking-wider text-warning-700">
                  {t("softLabel")}
                </p>
              )}
              <p className="text-body-strong text-neutral-900">
                {frames?.get(signal.key) ?? t(TIP_KEY[signal.kind], tipArgs(signal))}
              </p>
              <p
                className={
                  signal.grounded
                    ? "mt-0.5 text-small text-neutral-500"
                    : "mt-0.5 text-small text-warning-700"
                }
              >
                {evidenceLabel}
              </p>
            </div>
            <Link
              href={hrefForSignal(signal)}
              className="inline-flex h-8 shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-card px-3 text-small font-medium text-neutral-900 transition-colors hover:bg-neutral-50"
            >
              {t(CTA_KEY[signal.kind])}
            </Link>
          </div>
        );
      })}
    </Card>
  );
}

export default KonsoulSuggestions;
