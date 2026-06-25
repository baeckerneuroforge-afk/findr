"use client";

import { useTranslations } from "next-intl";
import { DEPTHS, type WizardState } from "../types";
import {
  ArrowRightIcon,
  ChatIcon,
  ChoiceCard,
  Collapsible,
  Field,
  GhostButton,
  MicIcon,
  PrimaryButton,
  TextInput,
  ToggleRow,
} from "../wizard-ui";

/**
 * Schritt 3 — Interview-Modus + Tiefe als KI-Empfehlung mit gesetztem Default.
 * Die optionalen Analyse-Schalter und die Feineinstellungen liegen EINGEKLAPPT
 * darunter, getrennt von der Kern-Entscheidung.
 */
export function StepInterview({
  state,
  patch,
  voiceAvailable = true,
  onBack,
  onNext,
}: {
  state: WizardState;
  patch: (p: Partial<WizardState>) => void;
  voiceAvailable?: boolean;
  onBack: () => void;
  onNext: () => void;
}) {
  const tw = useTranslations("research.wizard");

  const enabledCount = [
    state.visualCaptureEnabled,
    state.eventTrackingEnabled,
    state.signalsEnabled,
    state.ttsEnabled,
  ].filter(Boolean).length;

  /** Voice-Wechsel löscht TTS (gehört zum Text-Interview) — wie die echte Form. */
  function setMode(voice: boolean) {
    patch({ voiceEnabled: voice, ttsEnabled: voice ? false : state.ttsEnabled });
  }

  return (
    <div className="st-rise" style={{ "--st": 0 } as React.CSSProperties}>
      <p className="text-caption font-medium uppercase tracking-wide text-primary-600">
        {tw("stepCounter", { n: 3 })}
      </p>
      <h1 className="mt-1 text-display text-neutral-900">{tw("s3Title")}</h1>
      <p className="mt-2 max-w-[52ch] text-body text-neutral-500">{tw("s3Desc")}</p>

      {/* Modus */}
      <div className="mt-7 grid gap-3 sm:grid-cols-2">
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

      {/* Tiefe */}
      <h2 className="mt-7 text-h3 text-neutral-900">{tw("depthHeading")}</h2>
      <div className="mt-2.5 grid gap-3 sm:grid-cols-3">
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

      {/* Erweitert + Optionale Analyse (eingeklappt) */}
      <div className="mt-7 space-y-3">
        <Collapsible title={tw("advancedTitle")} subtitle={tw("advancedSub")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={tw("langLabel")}>
              <select
                value={state.language}
                onChange={(e) => patch({ language: e.target.value as "de" | "en" })}
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
          subtitle={enabledCount > 0 ? tw("analyticsSubOn", { n: enabledCount }) : tw("analyticsSubOff")}
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
        </Collapsible>
      </div>

      <div className="mt-8 flex items-center justify-between gap-4">
        <GhostButton onClick={onBack}>{tw("back")}</GhostButton>
        <PrimaryButton onClick={onNext}>
          {tw("next")} <ArrowRightIcon className="h-4 w-4" />
        </PrimaryButton>
      </div>
    </div>
  );
}
