"use client";

import { useTranslations } from "next-intl";
import { emptyTopicDraft, type TopicDraft } from "@/components/dashboard/TopicEditor";
import { getUseCaseMeta, type WizardState } from "../types";
import { MaterialSection } from "../MaterialSection";
import { type StimulusItem } from "../StimulusUploader";
import { PROTOTYPE_HOSTING } from "@/lib/research/task";
import {
  ArrowRightIcon,
  Card,
  ErrorNote,
  GhostButton,
  PrimaryButton,
  SparkleIcon,
  TextArea,
  TextInput,
  ThinkingState,
} from "../wizard-ui";

/**
 * Schritt 2 — Leitfaden. Zeigt den KI-generierten Leitfaden, der jetzt MIT den
 * Setup-Signalen (Zielgruppe, Art der Studie, Tiefe) gebaut wurde. Titel +
 * Themen sind editierbar; bedingtes Material (Concept-/Creative-Test) bzw. die
 * Usability-Aufgabe erscheinen hier, weil sie studientyp-abhängig sind und der
 * Draft-Plan zu diesem Zeitpunkt bereits existiert. Der Weiter-Button ist das
 * Absegnungs-Gate: erst wenn mindestens ein Thema steht, geht es zu „Start".
 */
export function StepGuide({
  state,
  patch,
  planId,
  ensureDraftPlanId,
  stimuli,
  setStimuli,
  genError,
  generating,
  onBack,
  onRegenerate,
  onApprove,
}: {
  state: WizardState;
  patch: (p: Partial<WizardState>) => void;
  planId: string | null;
  ensureDraftPlanId: () => Promise<string>;
  stimuli: StimulusItem[];
  setStimuli: React.Dispatch<React.SetStateAction<StimulusItem[]>>;
  genError: string | null;
  generating: boolean;
  onBack: () => void;
  onRegenerate: () => void;
  onApprove: () => void;
}) {
  const tw = useTranslations("research.wizard");
  // B2 — Hosting-Options-Labels teilen sich die Keys mit dem EditStudyForm
  // (research.plans.prototypeHosting_*): eine Quelle, keine Drift.
  const tp = useTranslations("research.plans");
  const meta = getUseCaseMeta(state.useCase);

  function patchTopic(i: number, t: Partial<TopicDraft>) {
    patch({
      topics: state.topics.map((x, idx) => (idx === i ? { ...x, ...t } : x)),
    });
  }

  const hasTopic = state.topics.some((t) => t.topic.trim() !== "");

  if (generating) {
    return <ThinkingState label={tw("s1Thinking")} />;
  }

  return (
    <div className="st-rise" style={{ "--st": 0 } as React.CSSProperties}>
      <p className="inline-flex items-center gap-1.5 text-caption font-medium uppercase tracking-wide text-primary-600">
        <SparkleIcon className="h-3.5 w-3.5" /> {tw("stepCounter", { n: 2 })} ·{" "}
        {tw("s2Badge")}
      </p>
      <h1 className="mt-1 text-display text-neutral-900">{tw("guideTitle")}</h1>
      <p className="mt-2 max-w-[54ch] text-body text-neutral-500">
        {tw("guideDesc")}
      </p>

      {genError ? <ErrorNote>{genError}</ErrorNote> : null}

      {/* Titel (KI-vorbefüllt, editierbar) */}
      <div className="mt-7">
        <label className="mb-1.5 block text-small font-medium text-neutral-700">
          {tw("s2TitleLabel")}
        </label>
        <TextInput
          value={state.title}
          onChange={(e) => patch({ title: e.target.value })}
        />
      </div>

      {/* Bedingtes Material / Usability-Aufgabe (studientyp-abhängig).
          Hier nie uploadLocked: dieser Schritt ist nur mit gültigem Briefing
          erreichbar (generate/manualContinue gaten ≥8 Zeichen). */}
      {meta.needsStimulus ? (
        <MaterialSection
          title={tw("s2MaterialTitle", { kind: tw(meta.labelKey) })}
          hint={tw("s2MaterialDesc")}
          planId={planId}
          ensureDraftPlanId={ensureDraftPlanId}
          stimuli={stimuli}
          setStimuli={setStimuli}
        />
      ) : null}
      {meta.needsTask ? (
        <div className="mt-6 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
          <label className="mb-1.5 block text-small font-medium text-neutral-700">
            {tw("s2TaskLabel")}
          </label>
          <TextArea
            rows={2}
            placeholder={tw("s2TaskPh")}
            value={state.taskInstruction}
            onChange={(e) => patch({ taskInstruction: e.target.value })}
          />
          {/* B2 (2026-07-02): Erfolgskriterium — Voraussetzung fürs advisory
              KI-Erfolgs-Urteil (Phase C); der Judge skippt ohne Kriterium
              still. Erreicht den Teilnehmer nie (researcher-only). */}
          <label className="mb-1.5 mt-3 block text-small font-medium text-neutral-700">
            {tw("s2TaskCriterionLabel")}
          </label>
          <TextArea
            rows={2}
            placeholder={tw("s2TaskCriterionPh")}
            value={state.taskSuccessCriterion}
            onChange={(e) => patch({ taskSuccessCriterion: e.target.value })}
          />
          <p className="mt-1 text-caption text-neutral-400">
            {tw("s2TaskCriterionHint")}
          </p>
          <label className="mb-1.5 mt-3 block text-small font-medium text-neutral-700">
            {tw("s2TaskUrlLabel")}
          </label>
          <TextInput
            type="url"
            inputMode="url"
            placeholder="https://"
            value={state.taskTargetUrl}
            onChange={(e) => patch({ taskTargetUrl: e.target.value })}
          />
          {/* B2: Hosting-Wahl — nur relevant mit URL. first_party_iframe
              rendert das messbare iframe-Panel in der Interview-Seite (Klicks
              zählbar, nur same-origin/embedbare Ziele); external_url = Link im
              neuen Tab (dort ist nichts messbar, nur Lifecycle). */}
          {state.taskTargetUrl.trim() !== "" && (
            <>
              <label className="mb-1.5 mt-3 block text-small font-medium text-neutral-700">
                {tw("s2TaskHostingLabel")}
              </label>
              <select
                value={state.taskPrototypeHosting}
                onChange={(e) =>
                  patch({
                    taskPrototypeHosting: e.target
                      .value as WizardState["taskPrototypeHosting"],
                  })
                }
                className="h-10 w-full rounded-md border border-neutral-200 bg-white px-3 text-body text-neutral-900 focus:border-primary-400 focus:outline-none"
              >
                {PROTOTYPE_HOSTING.map((h) => (
                  <option key={h} value={h}>
                    {tp(`prototypeHosting_${h}`)}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>
      ) : null}

      {/* Leitfaden — editierbare Themen */}
      <section className="mt-7">
        <div className="flex items-baseline justify-between">
          <h2 className="text-h3 text-neutral-900">{tw("s2GuideHeading")}</h2>
          <span className="text-caption text-neutral-400">
            {tw("s2GuideMeta", { n: state.topics.length })}
          </span>
        </div>

        <div className="mt-2.5 space-y-3">
          {state.topics.map((t, i) => (
            <Card key={i}>
              <div className="flex items-start gap-3">
                <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-50 font-mono text-caption text-primary-700">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <input
                    value={t.topic}
                    onChange={(e) => patchTopic(i, { topic: e.target.value })}
                    className="w-full border-0 bg-transparent p-0 text-body-strong text-neutral-900 outline-none focus:ring-0"
                  />
                  <TextArea
                    rows={2}
                    value={t.intent}
                    onChange={(e) => patchTopic(i, { intent: e.target.value })}
                    placeholder={tw("s2TopicMainPh")}
                    className="mt-2 text-small"
                  />
                  {t.hypotheses.length > 0 ? (
                    <ul className="mt-2 space-y-1.5">
                      {t.hypotheses.map((h, hi) => (
                        <li key={hi} className="flex items-center gap-2">
                          <span className="text-neutral-300">↳</span>
                          <input
                            value={h}
                            onChange={(e) => {
                              const hyp = [...t.hypotheses];
                              hyp[hi] = e.target.value;
                              patchTopic(i, { hypotheses: hyp });
                            }}
                            className="w-full rounded-md border border-transparent bg-neutral-50 px-2 py-1 text-small text-neutral-600 outline-none transition-colors hover:border-neutral-200 focus:border-primary-300 focus:bg-card"
                          />
                          <button
                            type="button"
                            aria-label={tw("s2RemoveTopic")}
                            onClick={() =>
                              patchTopic(i, {
                                hypotheses: t.hypotheses.filter(
                                  (_, x) => x !== hi,
                                ),
                              })
                            }
                            className="text-neutral-300 transition-colors hover:text-neutral-600"
                          >
                            ×
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <div className="mt-2 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        patchTopic(i, { hypotheses: [...t.hypotheses, ""] })
                      }
                      className="text-caption font-medium text-primary-600 hover:text-primary-700"
                    >
                      {tw("s2AddProbe")}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        patch({
                          topics: state.topics.filter((_, x) => x !== i),
                        })
                      }
                      className="text-caption text-neutral-400 hover:text-neutral-700"
                    >
                      {tw("s2RemoveTopic")}
                    </button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <button
          type="button"
          onClick={() => patch({ topics: [...state.topics, emptyTopicDraft()] })}
          className="mt-3 w-full rounded-lg border border-dashed border-neutral-300 py-2.5 text-small font-medium text-neutral-500 transition-colors hover:border-neutral-400 hover:text-neutral-700"
        >
          {tw("s2AddTopic")}
        </button>
      </section>

      <div className="mt-8 flex items-center justify-between gap-4">
        <GhostButton onClick={onBack}>{tw("back")}</GhostButton>
        <div className="flex items-center gap-3">
          <GhostButton onClick={onRegenerate}>{tw("guideRegenerate")}</GhostButton>
          <PrimaryButton onClick={onApprove} disabled={!hasTopic}>
            {tw("guideConfirmCta")} <ArrowRightIcon className="h-4 w-4" />
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}
