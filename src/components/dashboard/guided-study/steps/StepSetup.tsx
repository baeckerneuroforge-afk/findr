"use client";

import { useTranslations } from "next-intl";
import { BUSINESS_CONTEXT_MAX_CHARS } from "@/lib/settings/org-settings-shared";
import { DEPTHS, USE_CASES, getUseCaseMeta, type WizardState } from "../types";
import { MaterialSection } from "../MaterialSection";
import { type StimulusItem } from "../StimulusUploader";
import {
  ArrowRightIcon,
  Card,
  ChatIcon,
  ChoiceCard,
  Chip,
  Collapsible,
  ErrorNote,
  Field,
  GhostButton,
  MicIcon,
  PrimaryButton,
  SparkleIcon,
  TextArea,
  TextInput,
  ThinkingState,
  ToggleRow,
} from "../wizard-ui";

/**
 * Schritt 1 — Setup. Sammelt ALLE Signale, die den Leitfaden formen, BEVOR die
 * KI ihn baut: Briefing (Ziel), optionaler Titel, Zielgruppe (Persona + B2C/B2B
 * + Art der Studie) und die Interview-Form (Modus + Tiefe, Feineinstellungen
 * eingeklappt). Der Abschluss-CTA „Leitfaden erstellen" löst die Generierung
 * aus — dadurch fließen Zielgruppe/Art/Tiefe TATSÄCHLICH in den Generierungs-
 * Prompt (vorher standen sie noch auf Defaults). „Ohne KI" überspringt die
 * Generierung und geht mit leerem Leitfaden weiter.
 */
export function StepSetup({
  state,
  patch,
  voiceAvailable = true,
  generating,
  genError,
  onGenerate,
  onManual,
  planId,
  ensureDraftPlanId,
  stimuli,
  setStimuli,
  contextPrefilled = false,
}: {
  state: WizardState;
  patch: (p: Partial<WizardState>) => void;
  voiceAvailable?: boolean;
  generating: boolean;
  genError: string | null;
  onGenerate: () => void;
  onManual: () => void;
  /** E2 — Material-Upload schon im Setup (needsStimulus-Use-Cases), damit die
   *  persistierte Stimulus-Analyse in die ERSTE Generierung einfließt. Gleiche
   *  server-synchronisierte Props wie in StepGuide; nur ein Schritt rendert
   *  gleichzeitig, das Set lebt im Wizard. */
  planId: string | null;
  ensureDraftPlanId: () => Promise<string>;
  stimuli: StimulusItem[];
  setStimuli: React.Dispatch<React.SetStateAction<StimulusItem[]>>;
  /** E3 — true, wenn das Kontextfeld aus dem Org-Profil vorbefüllt wurde. */
  contextPrefilled?: boolean;
}) {
  const tw = useTranslations("research.wizard");
  const meta = getUseCaseMeta(state.useCase);
  const canGo = state.briefing.trim().length >= 8;

  const enabledCount = [
    state.visualCaptureEnabled,
    state.eventTrackingEnabled,
    state.signalsEnabled,
    state.ttsEnabled,
  ].filter(Boolean).length;

  /** Voice-Wechsel löscht TTS (gehört zum Text-Interview). */
  function setMode(voice: boolean) {
    patch({ voiceEnabled: voice, ttsEnabled: voice ? false : state.ttsEnabled });
  }

  if (generating) {
    return <ThinkingState label={tw("s1Thinking")} />;
  }

  return (
    <div className="st-rise" style={{ "--st": 0 } as React.CSSProperties}>
      <p className="text-caption font-medium uppercase tracking-wide text-primary-600">
        {tw("stepCounter", { n: 1 })}
      </p>
      <h1 className="mt-1 text-display text-neutral-900">{tw("setupTitle")}</h1>
      <p className="mt-2 max-w-[54ch] text-body text-neutral-500">
        {tw("setupDesc")}
      </p>

      {/* Briefing — das Kern-Ziel */}
      <section className="mt-7">
        <label className="mb-1.5 block text-small font-medium text-neutral-700">
          {tw("s1Title")}
        </label>
        <TextArea
          rows={3}
          autoFocus
          value={state.briefing}
          onChange={(e) => patch({ briefing: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && canGo) {
              onGenerate();
            }
          }}
          placeholder={tw("s1Placeholder")}
          className="text-body"
        />
      </section>

      {/* E1 — Unternehmens-/Produkt-Kontext (optional). Der legitime Kanal für
          Spezifika: was hier steht, DARF die KI in Fragen verwenden; alles
          darüber hinaus bleibt unter dem Erfindungs-Verbot. */}
      <section className="mt-6">
        <label className="mb-1.5 block text-small font-medium text-neutral-700">
          {tw("setupContextLabel")}
        </label>
        <TextArea
          rows={3}
          maxLength={BUSINESS_CONTEXT_MAX_CHARS}
          value={state.businessContext}
          onChange={(e) => patch({ businessContext: e.target.value })}
          placeholder={tw("setupContextPh")}
        />
        <p className="mt-1 text-caption text-neutral-400">
          {contextPrefilled ? tw("setupContextPrefilled") : tw("setupContextHint")}
        </p>
      </section>

      {/* Titel (optional — KI schlägt sonst einen vor) */}
      <section className="mt-6">
        <label className="mb-1.5 block text-small font-medium text-neutral-700">
          {tw("s2TitleLabel")}
        </label>
        <TextInput
          value={state.title}
          onChange={(e) => patch({ title: e.target.value })}
          placeholder={tw("setupTitlePh")}
        />
        <p className="mt-1 text-caption text-neutral-400">
          {tw("setupTitleHint")}
        </p>
      </section>

      {/* Zielgruppe + Art der Studie */}
      <section className="mt-7">
        <h2 className="text-h3 text-neutral-900">{tw("s2AudienceHeading")}</h2>
        <Card className="mt-2.5">
          <label className="mb-1.5 block text-small font-medium text-neutral-700">
            {tw("s2PersonaLabel")}
          </label>
          <TextArea
            rows={2}
            value={state.persona}
            onChange={(e) => patch({ persona: e.target.value })}
            placeholder={tw("setupPersonaPh")}
          />

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-small font-medium text-neutral-700">
                {tw("s2SampleLabel")}
              </label>
              <TextInput
                type="number"
                min={1}
                max={1000}
                inputMode="numeric"
                value={state.sampleTarget}
                onChange={(e) => patch({ sampleTarget: e.target.value })}
                className="max-w-[8rem]"
              />
            </div>
            <div>
              <span className="mb-1.5 block text-small font-medium text-neutral-700">
                {tw("s2ToneLabel")}
              </span>
              <div className="flex gap-2">
                <Chip
                  selected={state.audienceType === "b2c"}
                  onSelect={() => patch({ audienceType: "b2c" })}
                >
                  {tw("toneB2c")}
                </Chip>
                <Chip
                  selected={state.audienceType === "b2b"}
                  onSelect={() => patch({ audienceType: "b2b" })}
                >
                  {tw("toneB2b")}
                </Chip>
              </div>
            </div>
          </div>

          <div className="mt-4">
            <span className="mb-1.5 block text-small font-medium text-neutral-700">
              {tw("s2KindLabel")}
            </span>
            <div className="flex flex-wrap gap-2">
              {USE_CASES.map((u) => (
                <Chip
                  key={u.id}
                  selected={state.useCase === u.id}
                  onSelect={() => patch({ useCase: u.id })}
                >
                  {tw(u.labelKey)}
                </Chip>
              ))}
            </div>
            <p className="mt-1.5 text-caption text-neutral-400">
              {tw(meta.hintKey)}
            </p>
          </div>
        </Card>
      </section>

      {/* E2 — Material schon im Setup (Konzept-/Creative-Test): so fließt die
          Stimulus-Analyse bereits in die ERSTE Leitfaden-Generierung ein.
          uploadLocked bis das Briefing steht — der Uploader legt sonst einen
          Draft mit leerem objective an (POST-Zod min 3 → 400). */}
      {meta.needsStimulus ? (
        <MaterialSection
          title={tw("s2MaterialTitle", { kind: tw(meta.labelKey) })}
          hint={tw("setupMaterialHint")}
          planId={planId}
          ensureDraftPlanId={ensureDraftPlanId}
          stimuli={stimuli}
          setStimuli={setStimuli}
          uploadLocked={!canGo}
        />
      ) : null}

      {/* Interview-Form — Modus + Tiefe (formen mit den Leitfaden) */}
      <section className="mt-7">
        <h2 className="text-h3 text-neutral-900">{tw("s3Title")}</h2>
        <div className="mt-2.5 grid gap-3 sm:grid-cols-2">
          <ChoiceCard
            selected={!state.voiceEnabled}
            onSelect={() => setMode(false)}
            icon={<ChatIcon className="h-5 w-5 text-primary-600" />}
            title={tw("modeTextTitle")}
            desc={tw("modeTextDesc")}
            badge={!state.voiceEnabled ? tw("recommended") : undefined}
          />
          <ChoiceCard
            selected={state.voiceEnabled}
            onSelect={() => setMode(true)}
            disabled={!voiceAvailable}
            icon={<MicIcon className="h-5 w-5 text-primary-600" />}
            title={tw("modeVoiceTitle")}
            desc={voiceAvailable ? tw("modeVoiceDesc") : tw("modeVoiceUnavailable")}
          />
        </div>

        <h3 className="mt-6 text-small font-medium text-neutral-700">
          {tw("depthHeading")}
        </h3>
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          {DEPTHS.map((d) => (
            <ChoiceCard
              key={d.id}
              selected={state.interviewDepth === d.id}
              onSelect={() => patch({ interviewDepth: d.id })}
              title={tw(d.labelKey)}
              desc={tw(d.metaKey)}
              badge={d.id === "mittel" ? tw("recommended") : undefined}
            />
          ))}
        </div>
      </section>

      {/* Erweitert + Optionale Analyse (eingeklappt) */}
      <div className="mt-7 space-y-3">
        <Collapsible title={tw("advancedTitle")} subtitle={tw("advancedSub")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={tw("langLabel")}>
              <select
                value={state.language}
                onChange={(e) =>
                  patch({ language: e.target.value as "de" | "en" })
                }
                className="w-full rounded-lg border border-neutral-200 bg-card px-3 py-2 text-body text-neutral-900 outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-500/20"
              >
                <option value="de">{tw("langDe")}</option>
                <option value="en">{tw("langEn")}</option>
              </select>
            </Field>
            <Field label={tw("timeLabel")} hint={tw("timeHint")}>
              <TextInput
                type="number"
                min={3}
                max={60}
                inputMode="numeric"
                value={state.maxDurationMinutes}
                onChange={(e) => patch({ maxDurationMinutes: e.target.value })}
                placeholder="—"
                className="max-w-[8rem]"
              />
            </Field>
            <Field label={tw("maxRoundsLabel")} hint={tw("maxRoundsHint")}>
              <TextInput
                type="number"
                min={2}
                max={15}
                inputMode="numeric"
                value={state.maxRounds}
                onChange={(e) => patch({ maxRounds: e.target.value })}
                placeholder="auto"
                className="max-w-[8rem]"
              />
            </Field>
          </div>
        </Collapsible>

        <Collapsible
          title={tw("analyticsTitle")}
          subtitle={
            enabledCount > 0
              ? tw("analyticsSubOn", { n: enabledCount })
              : tw("analyticsSubOff")
          }
        >
          <div className="divide-y divide-neutral-100">
            <ToggleRow
              checked={state.visualCaptureEnabled}
              onChange={(v) => patch({ visualCaptureEnabled: v })}
              title={tw("togVisual")}
              desc={tw("togVisualDesc")}
            />
            <ToggleRow
              checked={state.eventTrackingEnabled}
              onChange={(v) => patch({ eventTrackingEnabled: v })}
              title={tw("togEvents")}
              desc={tw("togEventsDesc")}
            />
            <ToggleRow
              checked={state.signalsEnabled}
              onChange={(v) => patch({ signalsEnabled: v })}
              title={tw("togSignals")}
              desc={tw("togSignalsDesc")}
            />
            <ToggleRow
              checked={state.ttsEnabled}
              onChange={(v) => patch({ ttsEnabled: v })}
              title={tw("togTts")}
              desc={tw("togTtsDesc")}
            />
          </div>
          {state.eventTrackingEnabled &&
            state.voiceEnabled &&
            state.useCase === "usability_test" && (
              <p className="px-1 pt-3 text-caption text-warning-700">
                {tw("togEventsVoiceWarning")}
              </p>
            )}
        </Collapsible>
      </div>

      {genError ? <ErrorNote>{genError}</ErrorNote> : null}

      <div className="mt-8 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="hidden text-caption text-neutral-400 sm:inline">
            {tw("s1Hint")}
          </span>
          <GhostButton onClick={onManual}>{tw("s1Manual")}</GhostButton>
        </div>
        <PrimaryButton onClick={onGenerate} disabled={!canGo}>
          <SparkleIcon className="h-4 w-4" />
          {tw("setupGenerateCta")}
          <ArrowRightIcon className="h-4 w-4" />
        </PrimaryButton>
      </div>
    </div>
  );
}
