"use client";

import { useTranslations } from "next-intl";
import { DEPTHS, getUseCaseMeta, type WizardState } from "../types";
import {
  ArrowRightIcon,
  Card,
  ErrorNote,
  GhostButton,
  PrimaryButton,
} from "../wizard-ui";

/**
 * Schritt 3 — ruhige Zusammenfassung + „Studie starten". Im 3-Schritt-Flow
 * leben alle Eingaben (Ziel, Zielgruppe, Art, Interview-Form) im Setup-Schritt
 * (0) und der Leitfaden im Leitfaden-Schritt (1); hier werden sie nur
 * gespiegelt. Die „Ändern"-Links springen entsprechend zurück.
 */
export function StepReview({
  state,
  finalizing,
  formError,
  onBack,
  onEdit,
  onStart,
}: {
  state: WizardState;
  finalizing: boolean;
  formError: string | null;
  onBack: () => void;
  onEdit: (step: number) => void;
  onStart: () => void;
}) {
  const tw = useTranslations("research.wizard");

  const toneLabel = tw(state.audienceType === "b2c" ? "toneB2c" : "toneB2b");
  const kindLabel = tw(getUseCaseMeta(state.useCase).labelKey);
  const depthLabel = tw(DEPTHS.find((d) => d.id === state.interviewDepth)?.labelKey ?? "depthMittel");
  const modeLabel = tw(state.voiceEnabled ? "modeVoiceTitle" : "modeTextTitle");
  const langLabel = tw(state.language === "de" ? "langDe" : "langEn");

  const activeAnalytics: string[] = [
    state.visualCaptureEnabled ? tw("togVisual") : null,
    state.eventTrackingEnabled ? tw("togEvents") : null,
    state.signalsEnabled ? tw("togSignals") : null,
    state.ttsEnabled ? tw("togTts") : null,
  ].filter((x): x is string => x !== null);

  const sampleValue =
    state.sampleTarget.trim() !== ""
      ? tw("sampleValue", { n: state.sampleTarget.trim(), tone: toneLabel })
      : toneLabel;

  return (
    <div className="st-rise" style={{ "--st": 0 } as React.CSSProperties}>
      <p className="text-caption font-medium uppercase tracking-wide text-primary-600">
        {tw("stepCounter", { n: 3 })}
      </p>
      <h1 className="mt-1 text-display text-neutral-900">{tw("s4Title")}</h1>
      <p className="mt-2 max-w-[52ch] text-body text-neutral-500">{tw("s4Desc")}</p>

      <Card className="mt-7 p-0">
        {/* Setup-Schritt (0): Ziel, Zielgruppe, Art der Studie und die
            Interview-Form — alles, was den Leitfaden formt. */}
        <Group title={tw("grpSetup")} onEdit={() => onEdit(0)}>
          <Row label={tw("rowBriefing")} value={state.briefing} />
          <Row label={tw("rowKind")} value={kindLabel} />
          {state.persona.trim() !== "" ? (
            <Row label={tw("rowAudience")} value={state.persona} />
          ) : null}
          <Row label={tw("rowSample")} value={sampleValue} />
          <Row label={tw("rowMode")} value={modeLabel} />
          <Row label={tw("rowDepth")} value={depthLabel} />
          <Row label={tw("rowLanguage")} value={langLabel} />
          {state.maxDurationMinutes.trim() !== "" ? (
            <Row label={tw("rowTimeLimit")} value={tw("timeValue", { n: state.maxDurationMinutes.trim() })} />
          ) : null}
          <Row
            label={tw("rowAnalysis")}
            value={activeAnalytics.length ? activeAnalytics.join(", ") : tw("analysisNone")}
          />
        </Group>
        {/* Leitfaden-Schritt (1): Titel + generierte Themen. */}
        <Group title={tw("grpGuide")} onEdit={() => onEdit(1)} last>
          <Row label={tw("rowTitle")} value={state.title} />
          <Row label={tw("rowGuide")} value={tw("topicsValue", { n: state.topics.length })} />
        </Group>
      </Card>

      <p className="mt-4 rounded-lg border border-primary-200 bg-primary-50 px-3 py-2.5 text-small text-primary-700">
        {tw("reviewNextHint")}
      </p>

      {formError ? <ErrorNote>{formError}</ErrorNote> : null}

      <div className="mt-8 flex items-center justify-between gap-4">
        <GhostButton onClick={onBack} disabled={finalizing}>
          {tw("back")}
        </GhostButton>
        <PrimaryButton onClick={onStart} disabled={finalizing}>
          {finalizing ? tw("starting") : tw("startCta")}
          {!finalizing ? <ArrowRightIcon className="h-4 w-4" /> : null}
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
  const tw = useTranslations("research.wizard");
  return (
    <div className={last ? "p-5" : "border-b border-neutral-100 p-5"}>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-caption font-semibold uppercase tracking-wide text-neutral-400">{title}</h2>
        <button
          type="button"
          onClick={onEdit}
          className="text-caption font-medium text-primary-600 hover:text-primary-700"
        >
          {tw("change")}
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
