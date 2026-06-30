"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import type { ResearchTopic } from "@/lib/voice-agent/interviewer";
import { Button } from "@/components/ui/Button";
import {
  Field,
  FIELD_INPUT_CLASS,
  FIELD_TEXTAREA_CLASS,
} from "@/components/ui/Field";
import {
  TopicEditor,
  emptyTopicDraft,
  topicDraftsToResearchTopics,
  type TopicDraft,
} from "./TopicEditor";
import {
  estimateInterviewMinutes,
  isDurationFromTimeCap,
  resolveExpectedQuestions,
  type InterviewDepth,
} from "@/lib/research/interview-duration";
import {
  PROTOTYPE_HOSTING,
  type PrototypeHosting,
  type TaskDefinition,
} from "@/lib/research/task";

/**
 * EditStudyForm — bearbeitet eine BESTEHENDE Studie (research plan / market
 * campaign) über PATCH /api/research/plans/[id]. Bewusst getrennt vom großen
 * create-only `ResearchPlanForm`: der Edit-Pfad fasst NUR die Kern-Konfiguration
 * an (Titel, Ziel, Zielgruppe, Stichprobe, Leitfaden, Interview-Einstellungen)
 * und lässt die create-spezifische Maschinerie (Stimulus-Upload, KI-Leitfaden-
 * Generator, Studientyp-Stempel) unangetastet — die haben eigene Affordances
 * bzw. sind Anlege-Zeit-Belange. So kann der robuste, byte-identisch
 * abgesicherte Create-Flow nicht regredieren.
 *
 * Die Server-Validierung der PATCH-Route ist die einzige Wahrheit; dieses
 * Formular fragt nur Werte ab und spiegelt die i18n-Keys + Feld-Optik des
 * Create-Formulars wieder, damit keine zweite Validierungs-/Label-Quelle
 * entsteht.
 *
 * Gating ("nur solange noch nicht durchgeführt") sitzt im Server-Page-Wrapper:
 * der rendert dieses Formular gar nicht erst, sobald die Studie abgeschlossene
 * Interviews trägt. Hier kein erneuter Count-Check.
 */

type UseCase =
  | "general_survey"
  | "brand_research"
  | "creative_test"
  | "concept_test"
  | "usability_test";

const USE_CASES: readonly UseCase[] = [
  "general_survey",
  "brand_research",
  "creative_test",
  "concept_test",
  "usability_test",
];

/** Pill-Label-Key pro Use-Case (research.plans Namespace, wie im Create-Form). */
const USE_CASE_TITLE_KEY: Record<UseCase, string> = {
  general_survey: "ucGeneralSurveyTitle",
  brand_research: "ucBrandResearchTitle",
  creative_test: "ucCreativeTestTitle",
  concept_test: "ucConceptTestTitle",
  usability_test: "ucUsabilityTestTitle",
};

/** Reaktiver Methodik-Hinweis pro Use-Case — reiner Read, kein State-Write. */
const METHOD_NOTE_KEY: Record<UseCase, string> = {
  general_survey: "methodNoteGeneral",
  brand_research: "methodNoteBrand",
  creative_test: "methodNoteCreative",
  concept_test: "methodNoteConcept",
  usability_test: "methodNoteUsability",
};

/** Minimaler Plan-Ausschnitt, den das Edit-Formular vorbefüllt. Der Server-Page
 *  mappt den ResearchPlanRecord auf diese Form — so muss der server-only
 *  plans-service-Typ nicht in den Client wandern. */
export interface EditStudyInitial {
  id: string;
  studyType: "product_discovery" | "market_research";
  title: string;
  objective: string;
  persona: string | null;
  sampleTarget: number | null;
  topics: ResearchTopic[];
  language: "de" | "en";
  voiceEnabled: boolean;
  ttsEnabled: boolean;
  visualCaptureEnabled: boolean;
  eventTrackingEnabled: boolean;
  signalsEnabled: boolean;
  useCase: UseCase | null;
  audienceType: "b2b" | "b2c";
  maxRounds: number | null;
  maxDurationSeconds: number | null;
  interviewDepth: InterviewDepth | null;
  // Usability task (Phase 1). null for every non-usability study. Only the
  // usability_test path edits it; PATCH only sends it when present.
  taskDefinition: TaskDefinition | null;
}

interface FormState {
  title: string;
  objective: string;
  persona: string;
  sampleTarget: string;
  language: "de" | "en";
  voiceEnabled: boolean;
  ttsEnabled: boolean;
  visualCaptureEnabled: boolean;
  eventTrackingEnabled: boolean;
  signalsEnabled: boolean;
  useCase: UseCase;
  audienceType: "b2b" | "b2c";
  maxRounds: number | null;
  interviewDepth: InterviewDepth | null;
  maxDurationMinutes: number | null;
  taskInstruction: string;
  taskSuccessCriterion: string;
  taskTargetUrl: string;
  taskPrototypeHosting: PrototypeHosting;
  topics: TopicDraft[];
}

function initialFormState(plan: EditStudyInitial): FormState {
  const topics: TopicDraft[] =
    plan.topics.length > 0
      ? plan.topics.map((t) => ({
          topic: t.topic,
          intent: t.intent,
          hypotheses: t.hypotheses ?? [],
        }))
      : [emptyTopicDraft()];
  return {
    title: plan.title,
    objective: plan.objective,
    persona: plan.persona ?? "",
    sampleTarget: plan.sampleTarget !== null ? String(plan.sampleTarget) : "",
    language: plan.language,
    voiceEnabled: plan.voiceEnabled,
    ttsEnabled: plan.ttsEnabled,
    visualCaptureEnabled: plan.visualCaptureEnabled,
    eventTrackingEnabled: plan.eventTrackingEnabled,
    signalsEnabled: plan.signalsEnabled,
    // Fallback general_survey: legacy/Discovery-Pläne tragen useCase=null; der
    // Wert wird auf dem Discovery-Pfad ohnehin nie gesendet.
    useCase: plan.useCase ?? "general_survey",
    audienceType: plan.audienceType,
    maxRounds: plan.maxRounds,
    interviewDepth: plan.interviewDepth,
    maxDurationMinutes:
      plan.maxDurationSeconds !== null
        ? Math.round(plan.maxDurationSeconds / 60)
        : null,
    taskInstruction: plan.taskDefinition?.instruction ?? "",
    taskSuccessCriterion: plan.taskDefinition?.successCriterion ?? "",
    taskTargetUrl: plan.taskDefinition?.targetUrl ?? "",
    taskPrototypeHosting:
      plan.taskDefinition?.prototypeHosting ?? "first_party_iframe",
    topics,
  };
}

export function EditStudyForm({
  plan,
  voiceAvailable,
}: {
  plan: EditStudyInitial;
  voiceAvailable: boolean;
}) {
  const router = useRouter();
  const t = useTranslations("research.plans");

  const isMarket = plan.studyType === "market_research";
  const detailBase = isMarket
    ? "/dashboard/market-research"
    : "/dashboard/research-plans";

  const [form, setForm] = useState<FormState>(() => initialFormState(plan));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  // Wechsel auf Voice nimmt die Vorlesefunktion (TTS) zurück — die gehört zum
  // Text-Interview (der Voice-Agent spricht ohnehin). Spiegelt setVoiceMode im
  // Create-Formular.
  function setVoiceMode(voice: boolean) {
    setForm((prev) => ({
      ...prev,
      voiceEnabled: voice,
      ttsEnabled: voice ? false : prev.ttsEnabled,
    }));
  }

  // Use-Case + Audience reisen NUR auf dem Market-Pfad mit (wie im Create-Form);
  // auf dem Discovery-Pfad bleibt der PATCH-Body diese Felder schuldig, sodass
  // DB-Defaults gelten.
  const useCasePayload = isMarket ? { useCase: form.useCase } : {};
  const audienceTypePayload = isMarket
    ? { audienceType: form.audienceType }
    : {};
  // Usability-Aufgabe — true NUR für usability_test; steuert Task-Block +
  // Pflicht. Nur gesetzt, wenn eine Instruktion getippt ist → sonst {} (der
  // PATCH lässt task_definition unberührt; eine bestehende Aufgabe bleibt).
  const needsTask = form.useCase === "usability_test";
  const taskDefinitionPayload =
    isMarket && needsTask && form.taskInstruction.trim() !== ""
      ? {
          taskDefinition: {
            instruction: form.taskInstruction.trim(),
            successCriterion:
              form.taskSuccessCriterion.trim() === ""
                ? null
                : form.taskSuccessCriterion.trim(),
            targetUrl:
              form.taskTargetUrl.trim() === ""
                ? null
                : form.taskTargetUrl.trim(),
            prototypeHosting: form.taskPrototypeHosting,
          },
        }
      : {};

  // EINE Wahrheit für die angezeigte Interviewdauer (Längen-Readout) — Zeitlimit
  // gewinnt, sonst aus der Fragen-Obergrenze. Identische Funktionen wie Vorschau
  // + E-Mail. Reiner Read.
  const topicCount = topicDraftsToResearchTopics(form.topics).length;
  const durationCfg = {
    maxRounds: form.maxRounds,
    depth: form.interviewDepth,
    topicCount,
    maxDurationSeconds:
      form.maxDurationMinutes != null ? form.maxDurationMinutes * 60 : null,
  };
  const estimatedMinutes = estimateInterviewMinutes(durationCfg);
  const questionCeiling = resolveExpectedQuestions({
    maxRounds: form.maxRounds,
    depth: form.interviewDepth,
    topicCount,
  });
  const durationCapped = isDurationFromTimeCap(durationCfg);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const title = form.title.trim();
    const objective = form.objective.trim();
    if (title.length < 3) {
      setError(t("errTitleShort"));
      return;
    }
    if (objective.length < 3) {
      setError(t("errObjectiveShort"));
      return;
    }

    let sampleTarget: number | null = null;
    if (form.sampleTarget.trim() !== "") {
      const parsed = Number(form.sampleTarget);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 1000) {
        setError(t("errSampleTarget"));
        return;
      }
      sampleTarget = parsed;
    }

    if (
      form.maxRounds !== null &&
      (!Number.isInteger(form.maxRounds) ||
        form.maxRounds < 2 ||
        form.maxRounds > 15)
    ) {
      setError(t("errMaxRounds"));
      return;
    }

    if (
      form.maxDurationMinutes !== null &&
      (!Number.isInteger(form.maxDurationMinutes) ||
        form.maxDurationMinutes < 3 ||
        form.maxDurationMinutes > 60)
    ) {
      setError(t("errMaxDuration"));
      return;
    }

    if (needsTask && form.taskInstruction.trim() === "") {
      setError(t("errTaskInstruction"));
      return;
    }

    const topics = topicDraftsToResearchTopics(form.topics);

    setSubmitting(true);
    try {
      const res = await fetch(
        `/api/research/plans/${encodeURIComponent(plan.id)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            objective,
            topics,
            persona: form.persona.trim() === "" ? null : form.persona.trim(),
            sampleTarget,
            visualCaptureEnabled: form.visualCaptureEnabled,
            eventTrackingEnabled: form.eventTrackingEnabled,
            voiceEnabled: form.voiceEnabled,
            ttsEnabled: form.ttsEnabled,
            signalsEnabled: form.signalsEnabled,
            language: form.language,
            maxRounds: form.maxRounds,
            maxDurationSeconds:
              form.maxDurationMinutes != null
                ? form.maxDurationMinutes * 60
                : null,
            interviewDepth: form.interviewDepth,
            ...useCasePayload,
            ...audienceTypePayload,
            ...taskDefinitionPayload,
          }),
        },
      );
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(data.error ?? t("errSavePlan"));
      }
      router.push(`${detailBase}/${plan.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errSavePlan"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Use-Case + Methodik + Zielgruppen-Typ — NUR Market. Anders als beim
          Anlegen wendet die Pill hier KEIN Preset an (das würde den bestehenden
          Leitfaden überschreiben); sie setzt nur den methodischen Fokus. */}
      {isMarket && (
        <section className="space-y-3">
          <div>
            <h2 className="text-h3 text-neutral-900">{t("ucSelectorTitle")}</h2>
            <p className="mt-0.5 text-small text-neutral-500">
              {t("ucSelectorDesc")}
            </p>
          </div>
          <div
            role="radiogroup"
            aria-label={t("ucSelectorTitle")}
            className="flex flex-wrap gap-2"
          >
            {USE_CASES.map((uc) => {
              const selected = form.useCase === uc;
              return (
                <button
                  key={uc}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => update("useCase", uc)}
                  disabled={submitting}
                  className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-small outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary-500/40 disabled:opacity-60 ${
                    selected
                      ? "border-primary-200 bg-primary-50 font-medium text-primary-700"
                      : "border-neutral-200 bg-card text-neutral-600 hover:border-neutral-300 hover:text-neutral-900"
                  }`}
                >
                  {t(USE_CASE_TITLE_KEY[uc])}
                </button>
              );
            })}
          </div>
          <p className="rounded-r-md border-l-2 border-primary-600 bg-neutral-50 px-3 py-2 text-caption text-neutral-600">
            {t(METHOD_NOTE_KEY[form.useCase])}
          </p>
          <Field label={t("genFldAudience")} hint={t("genAudienceHint")}>
            <div
              role="radiogroup"
              aria-label={t("genFldAudience")}
              className="flex flex-wrap gap-2"
            >
              {(["b2c", "b2b"] as const).map((aud) => {
                const selected = form.audienceType === aud;
                return (
                  <button
                    key={aud}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => update("audienceType", aud)}
                    disabled={submitting}
                    className={`rounded-full border px-3.5 py-1.5 text-small outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary-500/40 disabled:opacity-60 ${
                      selected
                        ? "border-primary-200 bg-primary-50 font-medium text-primary-700"
                        : "border-neutral-200 bg-card text-neutral-600 hover:border-neutral-300 hover:text-neutral-900"
                    }`}
                  >
                    {t(aud === "b2c" ? "genAudienceB2c" : "genAudienceB2b")}
                  </button>
                );
              })}
            </div>
          </Field>
        </section>
      )}

      {/* Usability-Aufgabe — NUR bei needsTask (usability_test). Wie im Create-
          Form: reine Metadaten (Instruktion + Erfolgskriterium + Prototyp-URL +
          Hosting); KEINE Aufzeichnung/Instrumentierung in Phase 1. */}
      {needsTask && (
        <section className="space-y-4 rounded-lg border border-neutral-200 bg-card p-4">
          <div className="min-w-0">
            <span className="block text-body-strong text-neutral-900">
              {t("taskSectionTitle")}
            </span>
            <span className="mt-1 block text-caption text-neutral-500">
              {t("taskSectionDesc")}
            </span>
          </div>
          <Field label={t("fldTaskInstruction")} required>
            <textarea
              value={form.taskInstruction}
              onChange={(e) => update("taskInstruction", e.target.value)}
              placeholder={t("phTaskInstruction")}
              rows={2}
              disabled={submitting}
              className={FIELD_TEXTAREA_CLASS}
            />
          </Field>
          <Field label={t("fldTaskSuccess")} hint={t("taskSuccessHint")}>
            <input
              value={form.taskSuccessCriterion}
              onChange={(e) => update("taskSuccessCriterion", e.target.value)}
              placeholder={t("phTaskSuccess")}
              disabled={submitting}
              className={FIELD_INPUT_CLASS}
            />
          </Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label={t("fldTaskUrl")} hint={t("taskUrlHint")}>
              <input
                value={form.taskTargetUrl}
                onChange={(e) => update("taskTargetUrl", e.target.value)}
                placeholder={t("phTaskUrl")}
                inputMode="url"
                disabled={submitting}
                className={FIELD_INPUT_CLASS}
              />
            </Field>
            <Field label={t("fldPrototypeHosting")}>
              <select
                value={form.taskPrototypeHosting}
                onChange={(e) =>
                  update(
                    "taskPrototypeHosting",
                    e.target.value as PrototypeHosting,
                  )
                }
                disabled={submitting}
                className={FIELD_INPUT_CLASS}
              >
                {PROTOTYPE_HOSTING.map((h) => (
                  <option key={h} value={h}>
                    {t(`prototypeHosting_${h}`)}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </section>
      )}

      {/* Grundlagen */}
      <section className="space-y-4">
        <Field label={t("fldTitle")} required>
          <input
            value={form.title}
            onChange={(e) => update("title", e.target.value)}
            placeholder={t("phTitle")}
            disabled={submitting}
            className={FIELD_INPUT_CLASS}
          />
        </Field>

        <Field label={t("fldObjective")} required hint={t("objectiveHint")}>
          <textarea
            value={form.objective}
            onChange={(e) => update("objective", e.target.value)}
            placeholder={t("phObjective")}
            rows={3}
            disabled={submitting}
            className={FIELD_TEXTAREA_CLASS}
          />
        </Field>

        <div className="grid gap-4 md:grid-cols-2">
          <Field label={t("fldTargetPersona")} hint={t("personaHint")}>
            <textarea
              value={form.persona}
              onChange={(e) => update("persona", e.target.value)}
              placeholder={t("phPersona")}
              rows={2}
              disabled={submitting}
              className={FIELD_TEXTAREA_CLASS}
            />
          </Field>
          <Field label={t("fldSampleTarget")} hint={t("sampleTargetHint")}>
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={1000}
              value={form.sampleTarget}
              onChange={(e) => update("sampleTarget", e.target.value)}
              placeholder={t("phSampleTarget")}
              disabled={submitting}
              className={FIELD_INPUT_CLASS}
            />
          </Field>
        </div>

        <Field label={t("fldLanguage")} hint={t("languageHint")}>
          <div
            role="radiogroup"
            aria-label={t("fldLanguage")}
            className="flex flex-wrap gap-2"
          >
            {(["de", "en"] as const).map((lng) => {
              const selected = form.language === lng;
              return (
                <button
                  key={lng}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => update("language", lng)}
                  disabled={submitting}
                  className={`rounded-full border px-3.5 py-1.5 text-small outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary-500/40 disabled:opacity-60 ${
                    selected
                      ? "border-primary-200 bg-primary-50 font-medium text-primary-700"
                      : "border-neutral-200 bg-card text-neutral-600 hover:border-neutral-300 hover:text-neutral-900"
                  }`}
                >
                  {t(lng === "de" ? "languageDe" : "languageEn")}
                </button>
              );
            })}
          </div>
        </Field>
      </section>

      {/* Leitfaden (Topics) */}
      <section className="space-y-2">
        <div>
          <h2 className="text-h3 text-neutral-900">{t("topicsFormTitle")}</h2>
          <p className="text-small text-neutral-500">{t("topicsFormDesc")}</p>
        </div>
        <TopicEditor
          topics={form.topics}
          onChange={(topics) => update("topics", topics)}
          disabled={submitting}
        />
      </section>

      {/* Interview-Einstellungen */}
      <section className="space-y-4">
        {/* Interaktionsmodus (Text / Voice) */}
        <div className="rounded-lg border border-neutral-200 bg-card p-4">
          <span className="block text-body-strong text-neutral-900">
            {t("fldInteractionMode")}
          </span>
          <span className="mt-1 block text-caption text-neutral-500">
            {t("interactionModeHint")}
          </span>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              role="radio"
              aria-checked={!form.voiceEnabled}
              onClick={() => setVoiceMode(false)}
              disabled={submitting}
              className={`rounded-lg border p-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary-500/40 disabled:opacity-60 ${
                !form.voiceEnabled
                  ? "border-primary-200 bg-primary-50"
                  : "border-neutral-200 bg-card hover:border-neutral-300"
              }`}
            >
              <span
                className={`block text-small font-medium ${
                  !form.voiceEnabled ? "text-primary-700" : "text-neutral-900"
                }`}
              >
                {t("modeTextLabel")}
              </span>
              <span className="mt-0.5 block text-caption text-neutral-500">
                {t("modeTextDesc")}
              </span>
            </button>
            <button
              type="button"
              role="radio"
              aria-checked={form.voiceEnabled}
              onClick={() => voiceAvailable && setVoiceMode(true)}
              disabled={submitting || !voiceAvailable}
              className={`rounded-lg border p-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary-500/40 disabled:opacity-60 ${
                form.voiceEnabled
                  ? "border-primary-200 bg-primary-50"
                  : "border-neutral-200 bg-card hover:border-neutral-300"
              }`}
            >
              <span
                className={`block text-small font-medium ${
                  form.voiceEnabled ? "text-primary-700" : "text-neutral-900"
                }`}
              >
                {t("modeVoiceLabel")}
              </span>
              <span className="mt-0.5 block text-caption text-neutral-500">
                {voiceAvailable ? t("modeVoiceDesc") : t("modeVoiceUnavailable")}
              </span>
            </button>
          </div>
        </div>

        {/* Interview-Tiefe + Experten-Override */}
        <div className="rounded-lg border border-neutral-200 bg-card p-4">
          <span className="block text-body-strong text-neutral-900">
            {t("fldInterviewLength")}
          </span>
          <span className="mt-1 block text-caption text-neutral-500">
            {t("interviewLengthHint")}
          </span>
          <div
            role="radiogroup"
            aria-label={t("fldInterviewLength")}
            className="mt-3 grid gap-2 sm:grid-cols-3"
          >
            {(
              [
                {
                  depth: "flach" as InterviewDepth,
                  labelKey: "lengthShortLabel",
                  descKey: "lengthShortDesc",
                },
                {
                  depth: "mittel" as InterviewDepth,
                  labelKey: "lengthStandardLabel",
                  descKey: "lengthStandardDesc",
                },
                {
                  depth: "tief" as InterviewDepth,
                  labelKey: "lengthDeepLabel",
                  descKey: "lengthDeepDesc",
                },
              ] as const
            ).map((preset) => {
              const selected = form.interviewDepth === preset.depth;
              return (
                <button
                  key={preset.depth}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => {
                    update("interviewDepth", preset.depth);
                    update("maxRounds", null);
                  }}
                  disabled={submitting}
                  className={`rounded-lg border p-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary-500/40 disabled:opacity-60 ${
                    selected
                      ? "border-primary-200 bg-primary-50"
                      : "border-neutral-200 bg-card hover:border-neutral-300"
                  }`}
                >
                  <span
                    className={`block text-small font-medium ${
                      selected ? "text-primary-700" : "text-neutral-900"
                    }`}
                  >
                    {t(preset.labelKey)}
                  </span>
                  <span className="mt-0.5 block text-caption text-neutral-500">
                    {t(preset.descKey)}
                  </span>
                </button>
              );
            })}
          </div>
          <details className="mt-3" open={form.maxRounds !== null}>
            <summary className="cursor-pointer text-caption text-neutral-500 outline-none hover:text-neutral-700 focus-visible:ring-2 focus-visible:ring-primary-500/40">
              {t("lengthAdvancedSummary")}
            </summary>
            <div className="mt-2">
              <label
                htmlFor="maxRounds"
                className="block text-caption text-neutral-600"
              >
                {t("lengthCustomLabel")}
              </label>
              <div className="mt-1 w-28">
                <input
                  id="maxRounds"
                  type="number"
                  inputMode="numeric"
                  min={2}
                  max={15}
                  value={form.maxRounds ?? ""}
                  onChange={(e) => {
                    const raw = e.target.value.trim();
                    if (raw === "") {
                      update("maxRounds", null);
                      return;
                    }
                    const n = Number(raw);
                    update("maxRounds", Number.isNaN(n) ? null : n);
                  }}
                  placeholder="6"
                  disabled={submitting}
                  className={FIELD_INPUT_CLASS}
                />
              </div>
              <p className="mt-1 text-caption text-neutral-500">
                {t("lengthCustomHint")}
              </p>
            </div>
          </details>
          <p className="mt-3 text-caption text-neutral-600">
            {durationCapped
              ? t("lengthLiveEstimateCapped", {
                  questions: questionCeiling,
                  minutes: estimatedMinutes,
                })
              : t("lengthLiveEstimate", {
                  questions: questionCeiling,
                  minutes: estimatedMinutes,
                })}
          </p>
        </div>

        {/* Zeitlimit */}
        <div className="rounded-lg border border-neutral-200 bg-card p-4">
          <span className="block text-body-strong text-neutral-900">
            {t("fldTimeLimit")}
          </span>
          <span className="mt-1 block text-caption text-neutral-500">
            {t("timeLimitHint")}
          </span>
          <div className="mt-3 flex items-center gap-2">
            <div className="w-24">
              <input
                id="maxDurationMinutes"
                type="number"
                inputMode="numeric"
                min={3}
                max={60}
                value={form.maxDurationMinutes ?? ""}
                onChange={(e) => {
                  const raw = e.target.value.trim();
                  if (raw === "") {
                    update("maxDurationMinutes", null);
                    return;
                  }
                  const n = Number(raw);
                  update("maxDurationMinutes", Number.isNaN(n) ? null : n);
                }}
                placeholder="—"
                disabled={submitting}
                className={FIELD_INPUT_CLASS}
                aria-label={t("fldTimeLimit")}
              />
            </div>
            <span className="text-small text-neutral-600">
              {t("timeLimitUnit")}
            </span>
          </div>
        </div>

        {/* Vorlesefunktion (TTS) — nur im Text-Modus sichtbar (gehört zum
            Text-Interview; der Voice-Agent spricht ohnehin). */}
        {!form.voiceEnabled && (
          <label className="flex items-start gap-3 rounded-lg border border-neutral-200 bg-card p-4">
            <input
              type="checkbox"
              checked={form.ttsEnabled}
              onChange={(e) => update("ttsEnabled", e.target.checked)}
              disabled={submitting}
              className="mt-0.5 h-4 w-4 shrink-0"
            />
            <span>
              <span className="block text-body-strong text-neutral-900">
                {t("fldTts")} — {form.ttsEnabled ? t("ttsOn") : t("ttsOff")}
              </span>
              <span className="mt-0.5 block text-caption text-neutral-500">
                {t("ttsHint")}
              </span>
            </span>
          </label>
        )}

        {/* Visual-Intelligence-Capture */}
        <label className="flex items-start gap-3 rounded-lg border border-neutral-200 bg-card p-4">
          <input
            type="checkbox"
            checked={form.visualCaptureEnabled}
            onChange={(e) => update("visualCaptureEnabled", e.target.checked)}
            disabled={submitting}
            className="mt-0.5 h-4 w-4 shrink-0"
          />
          <span>
            <span className="block text-body-strong text-neutral-900">
              {t("fldVisualCapture")} —{" "}
              {form.visualCaptureEnabled
                ? t("visualCaptureOn")
                : t("visualCaptureOff")}
            </span>
            <span className="mt-0.5 block text-caption text-neutral-500">
              {t("visualCaptureHint")}
            </span>
          </span>
        </label>

        {/* Event-Tracking */}
        <label className="flex items-start gap-3 rounded-lg border border-neutral-200 bg-card p-4">
          <input
            type="checkbox"
            checked={form.eventTrackingEnabled}
            onChange={(e) => update("eventTrackingEnabled", e.target.checked)}
            disabled={submitting}
            className="mt-0.5 h-4 w-4 shrink-0"
          />
          <span>
            <span className="block text-body-strong text-neutral-900">
              {t("fldEventTracking")} —{" "}
              {form.eventTrackingEnabled
                ? t("eventTrackingOn")
                : t("eventTrackingOff")}
            </span>
            <span className="mt-0.5 block text-caption text-neutral-500">
              {t("eventTrackingHint")}
            </span>
          </span>
        </label>

        {/* Interaction signals are only captured in TEXT interviews — the voice
            path has no DOM event collector. Warn so the choice is visible. */}
        {form.eventTrackingEnabled && form.voiceEnabled && needsTask && (
          <div className="rounded-lg border border-warning-500/40 bg-warning-50 p-3">
            <p className="text-caption text-warning-700">
              {t("eventTrackingVoiceWarning")}
            </p>
          </div>
        )}

        {/* Turn-Signale */}
        <label className="flex items-start gap-3 rounded-lg border border-neutral-200 bg-card p-4">
          <input
            type="checkbox"
            checked={form.signalsEnabled}
            onChange={(e) => update("signalsEnabled", e.target.checked)}
            disabled={submitting}
            className="mt-0.5 h-4 w-4 shrink-0"
          />
          <span>
            <span className="block text-body-strong text-neutral-900">
              {t("fldSignals")} —{" "}
              {form.signalsEnabled ? t("signalsOn") : t("signalsOff")}
            </span>
            <span className="mt-0.5 block text-caption text-neutral-500">
              {t("signalsHint")}
            </span>
          </span>
        </label>
      </section>

      {error && (
        <div className="rounded-md border border-danger-500/20 bg-danger-50 px-3 py-2 text-small text-danger-700">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="primary" disabled={submitting}>
          {submitting ? t("submitSaving") : t("submitSave")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={submitting}
          onClick={() => router.push(`${detailBase}/${plan.id}`)}
        >
          {t("editCancel")}
        </Button>
      </div>
    </form>
  );
}
