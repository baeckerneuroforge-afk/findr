"use client";

import { useTranslations } from "next-intl";
import { emptyTopicDraft, type TopicDraft } from "@/components/dashboard/TopicEditor";
import { USE_CASES, getUseCaseMeta, type WizardState } from "../types";
import {
  ArrowRightIcon,
  Card,
  Chip,
  ErrorNote,
  GhostButton,
  PrimaryButton,
  SparkleIcon,
  TextArea,
  TextInput,
} from "../wizard-ui";

/**
 * Schritt 2 — „Dein Studienvorschlag". Verschmilzt Zielgruppe + Leitfaden zu
 * einem Screen. Titel + Themen sind KI-vorbefüllt; Zielgruppe/Art bestätigt der
 * Nutzer. Bedingtes Material (Stimulus/Aufgabe) erscheint nur inline, wenn der
 * Use-Case es braucht.
 */
export function StepProposal({
  state,
  patch,
  genError,
  onBack,
  onNext,
}: {
  state: WizardState;
  patch: (p: Partial<WizardState>) => void;
  voiceAvailable?: boolean;
  genError: string | null;
  onBack: () => void;
  onNext: () => void;
}) {
  const tw = useTranslations("research.wizard");
  const meta = getUseCaseMeta(state.useCase);

  function patchTopic(i: number, t: Partial<TopicDraft>) {
    patch({ topics: state.topics.map((x, idx) => (idx === i ? { ...x, ...t } : x)) });
  }

  return (
    <div className="st-rise" style={{ "--st": 0 } as React.CSSProperties}>
      <p className="inline-flex items-center gap-1.5 text-caption font-medium uppercase tracking-wide text-primary-600">
        <SparkleIcon className="h-3.5 w-3.5" /> {tw("stepCounter", { n: 2 })} · {tw("s2Badge")}
      </p>
      <h1 className="mt-1 text-display text-neutral-900">{tw("s2Title")}</h1>
      <p className="mt-2 max-w-[54ch] text-body text-neutral-500">{tw("s2Desc")}</p>

      {genError ? <ErrorNote>{genError}</ErrorNote> : null}

      {/* Titel */}
      <div className="mt-7">
        <label className="mb-1.5 block text-small font-medium text-neutral-700">
          {tw("s2TitleLabel")}
        </label>
        <TextInput value={state.title} onChange={(e) => patch({ title: e.target.value })} />
      </div>

      {/* Zielgruppe */}
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
                <Chip selected={state.audienceType === "b2c"} onSelect={() => patch({ audienceType: "b2c" })}>
                  {tw("toneB2c")}
                </Chip>
                <Chip selected={state.audienceType === "b2b"} onSelect={() => patch({ audienceType: "b2b" })}>
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
                <Chip key={u.id} selected={state.useCase === u.id} onSelect={() => patch({ useCase: u.id })}>
                  {tw(u.labelKey)}
                </Chip>
              ))}
            </div>
            <p className="mt-1.5 text-caption text-neutral-400">{tw(meta.hintKey)}</p>
          </div>

          {/* Bedingtes Material */}
          {meta.needsStimulus ? (
            <div className="mt-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
              <p className="text-small font-medium text-neutral-700">
                {tw("s2MaterialTitle", { kind: tw(meta.labelKey) })}
              </p>
              <p className="mt-0.5 text-caption text-neutral-400">{tw("s2MaterialDesc")}</p>
              <label className="mb-1.5 mt-3 block text-small font-medium text-neutral-700">
                {tw("s2MaterialLinkLabel")}
              </label>
              <TextInput
                type="url"
                inputMode="url"
                placeholder={tw("s2MaterialLinkPh")}
                value={state.stimulusUrl}
                onChange={(e) => patch({ stimulusUrl: e.target.value })}
              />
              <TextArea
                rows={2}
                className="mt-3"
                value={state.stimulusDescription}
                onChange={(e) => patch({ stimulusDescription: e.target.value })}
              />
            </div>
          ) : null}
          {meta.needsTask ? (
            <div className="mt-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
              <label className="mb-1.5 block text-small font-medium text-neutral-700">
                {tw("s2TaskLabel")}
              </label>
              <TextArea
                rows={2}
                placeholder={tw("s2TaskPh")}
                value={state.taskInstruction}
                onChange={(e) => patch({ taskInstruction: e.target.value })}
              />
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
            </div>
          ) : null}
        </Card>
      </section>

      {/* Leitfaden */}
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
                            onClick={() => patchTopic(i, { hypotheses: t.hypotheses.filter((_, x) => x !== hi) })}
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
                      onClick={() => patchTopic(i, { hypotheses: [...t.hypotheses, ""] })}
                      className="text-caption font-medium text-primary-600 hover:text-primary-700"
                    >
                      {tw("s2AddProbe")}
                    </button>
                    <button
                      type="button"
                      onClick={() => patch({ topics: state.topics.filter((_, x) => x !== i) })}
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
        <PrimaryButton onClick={onNext}>
          {tw("next")} <ArrowRightIcon className="h-4 w-4" />
        </PrimaryButton>
      </div>
    </div>
  );
}
