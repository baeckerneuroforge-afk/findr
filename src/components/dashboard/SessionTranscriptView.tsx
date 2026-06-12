import { Fragment } from "react";

import { getLocale, getTranslations } from "next-intl/server";

import { toBcp47 } from "@/i18n/locale";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Card, CardBody } from "@/components/ui/Card";
import type {
  PlanSessionStatus,
  PlanSessionTranscript,
} from "@/lib/research/plans-service";
import type {
  AffectState,
  DirectnessLevel,
  TurnSignal,
} from "@/lib/schemas/turn-signals";

/**
 * E7b (Konsole-v5): gemeinsame Transkript-Darstellung — aus der
 * Voll-Seite (market-research/[id]/sessions/[sessionId]) extrahiert,
 * Markup unverändert, damit Voll-Seite und Intercepting-Drawer nie
 * driften. Zwei Bausteine statt einem, weil die Voll-Seite die
 * Badge-Zeile IM Seitenkopf trägt (mt-3 unter dem Titel), der Drawer
 * sie in seinem Scroll-Bereich: beide setzen die Bausteine an ihre
 * Stelle, der Inhalt bleibt identisch.
 */

const SESSION_STATUS_VARIANT: Record<PlanSessionStatus, BadgeVariant> = {
  open: "default",
  completed: "success",
  abandoned: "default",
};

/**
 * E2 Turn-Signale — Chip-Farben. COPY-REGEL (Plan §4.4): Signale sind
 * „Hinweis aus dem Wortlaut", nie ein Urteil — deshalb bewusst KEIN
 * `critical`-Rot, und `declined` bleibt NEUTRAL grau (nicht antworten zu
 * wollen ist eine legitime Antwort, kein schlechtes Signal). `neutral` und
 * `direct` werden gar nicht erst gechipt (Default-Zustand ist kein Befund) —
 * das hält das Transkript ruhig und macht jeden Chip bedeutsam.
 */
const AFFECT_VARIANT: Record<Exclude<AffectState, "neutral">, BadgeVariant> = {
  enthusiasm: "success",
  interest: "default",
  uncertainty: "medium",
  frustration: "high",
  discomfort: "high",
};

const DIRECTNESS_VARIANT: Record<
  Exclude<DirectnessLevel, "direct">,
  BadgeVariant
> = {
  partial: "medium",
  evasive: "high",
  declined: "default",
};

function formatDateTime(iso: string, locale: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(toBcp47(locale), {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Status / Voice / Turn-Zahl / Zeitstempel einer Session. */
export async function SessionMetaBadges({
  session,
  className,
}: {
  session: PlanSessionTranscript;
  className?: string;
}) {
  const tm = await getTranslations("research.market");
  const locale = await getLocale();

  return (
    <div
      className={`flex flex-wrap items-center gap-2 ${className ?? ""}`.trim()}
    >
      <Badge variant={SESSION_STATUS_VARIANT[session.status]}>
        {tm(`sessionStatus.${session.status}`)}
      </Badge>
      {session.mode === "voice" && (
        <Badge variant="default">
          <svg
            className="h-3 w-3 shrink-0"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
            <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
            <line x1="12" x2="12" y1="19" y2="22" />
          </svg>
          {tm("sessionVoiceBadge")}
        </Badge>
      )}
      <span className="text-small text-neutral-500">
        {tm("sessionTurnCount", { count: session.conversation.length })}
      </span>
      <span className="text-small text-neutral-400">
        {session.completedAt
          ? tm("transcriptCompletedAt", {
              date: formatDateTime(session.completedAt, locale),
            })
          : tm("transcriptStartedAt", {
              date: formatDateTime(session.createdAt, locale),
            })}
      </span>
    </div>
  );
}

/** E2 — Signal-Chips + Beleg-Disclosure einer Teilnehmer-Antwort. Rendert
 *  NUR Abweichungen vom Default (neutral/direct = chip-frei), das Beleg-Zitat
 *  + Konfidenz hinter einem nativen details-Disclosure (kein Client-JS, kein
 *  Hydration-Risiko in der Server-Komponente). */
function TurnSignalChips({
  signal,
  labels,
}: {
  signal: TurnSignal;
  labels: {
    affect: (a: Exclude<AffectState, "neutral">) => string;
    intensity: (i: TurnSignal["affectIntensity"]) => string;
    directness: (d: Exclude<DirectnessLevel, "direct">) => string;
    details: string;
    evidence: string;
    openAspect: (aspect: string) => string;
    confidence: (pct: number) => string;
  };
}) {
  // Ternary-Narrows statt boolean-Flags — TypeScript trägt das Narrowing
  // einer Union nicht über ein separates boolean in den JSX-Zweig.
  const affect = signal.affect === "neutral" ? null : signal.affect;
  const directness =
    signal.directness === "direct" ? null : signal.directness;
  if (affect === null && directness === null) return null;

  const hasDisclosure =
    (affect !== null && signal.affectEvidence !== null) ||
    signal.unansweredAspect !== null;

  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {affect !== null && (
          <Badge variant={AFFECT_VARIANT[affect]}>
            {labels.affect(affect)}
            <span className="font-normal opacity-70">
              · {labels.intensity(signal.affectIntensity)}
            </span>
          </Badge>
        )}
        {directness !== null && (
          <Badge variant={DIRECTNESS_VARIANT[directness]}>
            {labels.directness(directness)}
          </Badge>
        )}
      </div>
      {hasDisclosure && (
        <details className="mt-1.5">
          <summary className="cursor-pointer select-none text-caption text-neutral-400 transition-colors hover:text-neutral-600">
            {labels.details}
          </summary>
          <div className="mt-1 space-y-0.5 text-caption text-neutral-500">
            {affect !== null && signal.affectEvidence !== null && (
              <p>
                {labels.evidence}: „{signal.affectEvidence}“
              </p>
            )}
            {signal.unansweredAspect !== null && (
              <p>{labels.openAspect(signal.unansweredAspect)}</p>
            )}
            <p>{labels.confidence(Math.round(signal.confidence * 100))}</p>
          </div>
        </details>
      )}
    </div>
  );
}

/** E2 — kompakter Signal-Block überm Transkript: Affektbogen + Zählzeile +
 *  Hinweis-Copy. Rendert NUR, wenn die Session ein Sidecar-Ergebnis trägt —
 *  ältere Sessions / Toggle aus → null → Seite byte-identisch zu vorher. */
export async function SessionSignalsCard({
  session,
}: {
  session: PlanSessionTranscript;
}) {
  const record = session.turnSignals;
  if (!record || record.turns.length === 0) return null;
  const tm = await getTranslations("research.market");

  return (
    <Card>
      <CardBody>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="text-body-strong text-neutral-900">
            {tm("signalsTitle")}
          </h2>
          <span className="text-caption text-neutral-500">
            {tm("signalsSummary", {
              direct: record.session.directCount,
              evasive: record.session.evasiveCount,
              total: record.turns.length,
            })}
          </span>
        </div>
        <p className="mt-2 text-body text-neutral-700">
          {record.session.affectArc}
        </p>
        <p className="mt-2 text-caption text-neutral-400">
          {tm("signalsDisclaimer")}
        </p>
      </CardBody>
    </Card>
  );
}

/** Der Gesprächsverlauf — Interviewer links (neutral), Teilnehmer rechts
 *  (primary-Fläche), gespiegelte Chat-Leserichtung der Teilnehmer-Ansicht.
 *  E2: trägt die Session Turn-Signale, bekommen Teilnehmer-Antworten ihre
 *  Chips + Beleg-Disclosure; ohne Signale ist das Markup byte-identisch. */
export async function SessionConversationCard({
  session,
  stimuli = [],
}: {
  session: PlanSessionTranscript;
  /** E7 Multi-Stimulus — das Set der Studie (Position + Label) für die
   *  Reveal-Marker („— Stimulus 2 ‚Variante B' eingeblendet —") an
   *  Agent-Turns mit persistiertem shownStimulusPosition. Leer/fehlend →
   *  Markup byte-identisch (Studien ohne Set tragen nie Marker). */
  stimuli?: Array<{ position: number; label: string | null }>;
}) {
  const tm = await getTranslations("research.market");
  const stimulusLabelByPosition = new Map(
    stimuli.map((item) => [item.position, item.label]),
  );

  // index → Signal; der Sidecar garantiert customer-Turn-Indizes (seal).
  const signalsByIndex = new Map<number, TurnSignal>(
    (session.turnSignals?.turns ?? []).map((t) => [t.index, t]),
  );
  const chipLabels = {
    affect: (a: Exclude<AffectState, "neutral">) => tm(`signalsAffect.${a}`),
    intensity: (i: TurnSignal["affectIntensity"]) =>
      tm(`signalsIntensity.${i}`),
    directness: (d: Exclude<DirectnessLevel, "direct">) =>
      tm(`signalsDirectness.${d}`),
    details: tm("signalsDetails"),
    evidence: tm("signalsEvidence"),
    openAspect: (aspect: string) => tm("signalsOpenAspect", { aspect }),
    confidence: (pct: number) => tm("signalsConfidence", { pct }),
  };
  // Fußnote nur, wenn mindestens ein Chip sichtbar ist (Abweichung vom
  // Default) — die Copy-Regel begleitet die Signale, nicht das Transkript.
  const hasVisibleSignal = [...signalsByIndex.values()].some(
    (s) => s.affect !== "neutral" || s.directness !== "direct",
  );

  return (
    <Card>
      <CardBody>
        {session.conversation.length === 0 ? (
          <p className="py-4 text-center text-body text-neutral-500">
            {tm("transcriptEmpty")}
          </p>
        ) : (
          <>
            <ol className="space-y-4">
              {session.conversation.map((turn, i) => {
                const signal =
                  turn.role === "customer" ? signalsByIndex.get(i) : undefined;
                // E7 — Reveal-Marker VOR der Agent-Bubble, die den Stimulus
                // eingeblendet hat (nur Set-Studien; geklemmte Persistenz).
                const shownPosition =
                  turn.role === "agent" &&
                  typeof turn.shownStimulusPosition === "number" &&
                  stimulusLabelByPosition.has(turn.shownStimulusPosition)
                    ? turn.shownStimulusPosition
                    : null;
                const shownLabel =
                  shownPosition !== null
                    ? (stimulusLabelByPosition.get(shownPosition) ?? null)
                    : null;
                const bubble = (
                  <li
                    key={i}
                    className={`flex ${
                      turn.role === "customer" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[85%] rounded-lg px-4 py-2.5 md:max-w-[70%] ${
                        turn.role === "customer"
                          ? "bg-primary-50 text-neutral-900"
                          : "bg-neutral-100 text-neutral-900"
                      }`}
                    >
                      <div
                        className={`text-caption font-medium uppercase tracking-wider ${
                          turn.role === "customer"
                            ? "text-primary-700"
                            : "text-neutral-400"
                        }`}
                      >
                        {turn.role === "customer"
                          ? tm("transcriptParticipantLabel")
                          : tm("transcriptInterviewerLabel")}
                      </div>
                      <p className="mt-0.5 whitespace-pre-wrap text-body text-neutral-700">
                        {turn.text}
                      </p>
                      {signal && (
                        <TurnSignalChips signal={signal} labels={chipLabels} />
                      )}
                      {/* E3 Frage-Rationale — die echte Begründung des Agenten
                          zum Entscheidungszeitpunkt (WHY:-Header), nur an
                          Agent-Turns und nur in dieser FORSCHER-Ansicht
                          (Teilnehmer-Payloads strippen das Feld). Dezentes
                          natives Disclosure, Optik der Signal-Details. */}
                      {turn.role === "agent" && turn.why && (
                        <details className="mt-1.5">
                          <summary className="cursor-pointer select-none text-caption text-neutral-400 transition-colors hover:text-neutral-600">
                            {tm("whyDisclosure")}
                          </summary>
                          <p className="mt-1 text-caption text-neutral-500">
                            {turn.why}
                          </p>
                        </details>
                      )}
                    </div>
                  </li>
                );
                if (shownPosition === null) return bubble;
                return (
                  <Fragment key={`f-${i}`}>
                    <li
                      aria-hidden="true"
                      className="flex items-center gap-3 text-caption text-neutral-400"
                    >
                      <span className="h-px flex-1 bg-neutral-200" />
                      <span className="shrink-0">
                        {shownLabel
                          ? tm("stimulusShownMarkerLabeled", {
                              position: shownPosition,
                              label: shownLabel,
                            })
                          : tm("stimulusShownMarker", {
                              position: shownPosition,
                            })}
                      </span>
                      <span className="h-px flex-1 bg-neutral-200" />
                    </li>
                    {bubble}
                  </Fragment>
                );
              })}
            </ol>
            {hasVisibleSignal && (
              <p className="mt-4 border-t border-neutral-100 pt-3 text-caption text-neutral-400">
                {tm("signalsDisclaimer")}
              </p>
            )}
          </>
        )}
      </CardBody>
    </Card>
  );
}
