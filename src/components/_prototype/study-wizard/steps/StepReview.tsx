"use client";

import {
  DEPTHS,
  audienceLabel,
  useCaseMeta,
  type AnalyticsToggles,
  type Depth,
  type InterviewMode,
  type Proposal,
} from "../data";
import { ArrowRightIcon, Card, GhostButton, PrimaryButton } from "../ui";

const ANALYTICS_LABELS: Record<keyof AnalyticsToggles, string> = {
  visualCapture: "Bildschirm-Aufzeichnung",
  eventTracking: "Verhaltens-Events",
  turnSignals: "Gesprächs-Signale",
  tts: "Vorlesen",
};

/**
 * Schritt 4 — ruhige Zusammenfassung aller Entscheidungen + „Studie starten".
 * Die optionalen Analyse-Schalter leben jetzt im Interview-Schritt; hier werden
 * sie nur noch als Ergebnis gespiegelt (falls aktiv), nicht mehr bedient.
 */
export function StepReview({
  briefing,
  proposal,
  mode,
  depth,
  language,
  durationMin,
  analytics,
  onBack,
  onStart,
  onEdit,
}: {
  briefing: string;
  proposal: Proposal;
  mode: InterviewMode;
  depth: Depth;
  language: "de" | "en";
  durationMin: number | null;
  analytics: AnalyticsToggles;
  onBack: () => void;
  onStart: () => void;
  onEdit: (step: number) => void;
}) {
  const depthMeta = DEPTHS.find((d) => d.id === depth);
  const activeAnalytics = (
    Object.keys(analytics) as (keyof AnalyticsToggles)[]
  ).filter((k) => analytics[k]);

  return (
    <div className="st-rise" style={{ "--st": 0 } as React.CSSProperties}>
      <p className="text-caption font-medium uppercase tracking-wide text-primary-600">
        Schritt 4 von 4
      </p>
      <h1 className="mt-1 text-display text-neutral-900">Übersicht & Start</h1>
      <p className="mt-2 max-w-[52ch] text-body text-neutral-500">
        Ein letzter Blick — dann kann die Studie starten.
      </p>

      <Card className="mt-7 p-0">
        <Group title="Ziel" onEdit={() => onEdit(0)}>
          <Row label="Briefing" value={briefing} />
        </Group>
        <Group title="Vorschlag" onEdit={() => onEdit(1)}>
          <Row label="Titel" value={proposal.title} />
          <Row label="Art" value={useCaseMeta(proposal.useCase).label} />
          <Row label="Zielgruppe" value={proposal.persona} />
          <Row
            label="Stichprobe"
            value={`${proposal.sampleTarget} Interviews · ${audienceLabel(
              proposal.audienceType,
            )}`}
          />
          <Row label="Leitfaden" value={`${proposal.topics.length} Themen`} />
        </Group>
        <Group title="Interview" onEdit={() => onEdit(2)} last>
          <Row
            label="Modus"
            value={mode === "text" ? "Text-Interview" : "Voice-Interview"}
          />
          <Row
            label="Tiefe"
            value={
              depthMeta
                ? `${depthMeta.label} · ${depthMeta.approxQuestions}`
                : depth
            }
          />
          <Row label="Sprache" value={language === "de" ? "Deutsch" : "Englisch"} />
          {durationMin ? (
            <Row label="Zeitlimit" value={`${durationMin} Min`} />
          ) : null}
          <Row
            label="Analyse"
            value={
              activeAnalytics.length
                ? activeAnalytics.map((k) => ANALYTICS_LABELS[k]).join(", ")
                : "keine"
            }
          />
        </Group>
      </Card>

      <div className="mt-8 flex items-center justify-between gap-4">
        <GhostButton onClick={onBack}>Zurück</GhostButton>
        <PrimaryButton onClick={onStart}>
          Studie starten <ArrowRightIcon className="h-4 w-4" />
        </PrimaryButton>
      </div>
    </div>
  );
}

function Group({
  title,
  onEdit,
  last,
  children,
}: {
  title: string;
  onEdit: () => void;
  last?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={last ? "p-5" : "border-b border-neutral-100 p-5"}>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-caption font-semibold uppercase tracking-wide text-neutral-400">
          {title}
        </h2>
        <button
          type="button"
          onClick={onEdit}
          className="text-caption font-medium text-primary-600 hover:text-primary-700"
        >
          Ändern
        </button>
      </div>
      <dl className="space-y-1.5">{children}</dl>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 text-body">
      <dt className="w-28 shrink-0 text-neutral-400">{label}</dt>
      <dd className="min-w-0 flex-1 text-neutral-800">{value}</dd>
    </div>
  );
}
