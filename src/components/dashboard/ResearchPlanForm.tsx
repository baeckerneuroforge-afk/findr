"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
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

/**
 * Form for creating a new research plan. Spirit-spiegelt ManualDealForm:
 * use-client component, useState for form/submitting/error, inline Field
 * helpers, fetch POST to /api/research/plans, redirect to detail on success.
 *
 * KI-LEITFADEN-AFFORDANZ (zusätzlich, optional):
 *   Das Formular hat einen "Leitfaden mit KI generieren"-Block. Er ist
 *   stand-alone und ändert das normale Create-Verhalten NICHT, solange der
 *   Nutzer ihn nicht benutzt. Wenn er ihn benutzt:
 *     1. Titel + Objective müssen ausgefüllt sein.
 *     2. Form legt einen DRAFT-Plan an (POST /api/research/plans mit
 *        den aktuellen Feldern + leeren Topics).
 *     3. Mit dem frischen planId wird POST /[id]/guide aufgerufen — der
 *        Server generiert den Leitfaden + schreibt die Topics direkt in
 *        die DB.
 *     4. UI füllt den TopicEditor mit der gemappten Shape vor (label →
 *        topic, goalLink → intent, probes → hypotheses) — der Nutzer kann
 *        VOR dem finalen Speichern editieren.
 *     5. Der "Create plan"-Button wechselt zu "Save plan" und PATCH'ed
 *        den existierenden Draft (statt einen neuen anzulegen).
 *   Wenn der Nutzer die Affordanz nicht benutzt: alter Pfad, single POST.
 *
 * Der Trade-off: ein Draft wird angelegt SOBALD der Nutzer den Generator
 * benutzt — verlässt er die Seite ohne Save, bleibt der Draft als
 * 'draft'-Status in der Plan-Liste. Bewusst gewählt, weil der API-Vertrag
 * `/[id]/guide` einen planId verlangt (Auth + Ownership) und das die
 * sauberste Brücke zwischen Create-Form und planId-gebundenem Generate
 * ist.
 */

interface FormState {
  title: string;
  objective: string;
  persona: string;
  sampleTarget: string;
  // Visual-Intelligence opt-in. Default OFF. Sent as `visualCaptureEnabled`
  // (exact key) in the create/update body — the backend flag + interview-gate
  // already exist; this form only fills the value.
  visualCaptureEnabled: boolean;
  topics: TopicDraft[];
}

/** Optional Generator-Inputs — leer wenn ungenutzt. */
interface GenInputs {
  segment: string;
  role: string;
  topicCount: string;
}

const INITIAL_GEN: GenInputs = { segment: "", role: "", topicCount: "" };

/** Shape returned by POST /api/research/plans/[id]/guide — kept inline
 *  here so the UI doesn't import the engine module (which is server-only).
 *  Must match InterviewGuide in src/lib/research/guide-generator.ts. */
interface GeneratedGuide {
  title: string;
  objective: string;
  estimatedMinutes: number;
  topics: Array<{
    id: string;
    label: string;
    goalLink: string;
    mainQuestion: string;
    probes: string[];
  }>;
  screeningQuestions?: string[];
}

const INITIAL_FORM: FormState = {
  title: "",
  objective: "",
  persona: "",
  sampleTarget: "",
  // Default OFF — VI is opt-in per study; an untouched form sends false.
  visualCaptureEnabled: false,
  // Start with one empty topic so the editor isn't blank — encourages the
  // user to fill at least one in. Empty topics are dropped at submit time.
  topics: [emptyTopicDraft()],
};

/**
 * M3 — the SAME form serves both research areas. `studyType` decides exactly
 * two things: (1) the create payload stamps 'market_research' (omitted for the
 * default product_discovery path → byte-identical discovery create), and (2)
 * the post-create redirect lands in the matching area. Everything else — the
 * fields, the AI guide generator, validation — is shared verbatim.
 */
type FormStudyType = "product_discovery" | "market_research";

export function ResearchPlanForm({
  studyType = "product_discovery",
}: {
  studyType?: FormStudyType;
} = {}) {
  const router = useRouter();
  const t = useTranslations("research.plans");
  const tc = useTranslations("research.common");
  const isMarket = studyType === "market_research";
  // The two areas share one create form but redirect into their own detail
  // route after save. Discovery → byte-identical to pre-M3.
  const detailBase = isMarket
    ? "/dashboard/market-research"
    : "/dashboard/research-plans";
  // Market-only create-payload key — see createResearchPlan: omitting it on the
  // discovery path keeps that POST body + DB row byte-identical.
  const studyTypePayload = isMarket
    ? ({ studyType: "market_research" } as const)
    : ({} as const);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // KI-Generator state. `planId` flips the form into edit-mode (PATCH) once
  // a draft has been created via the generator. `lastGuide` is shown as a
  // preview block so the user sees the generated mainQuestion + probes
  // (which the TopicEditor's lossy shape doesn't expose).
  const [genInputs, setGenInputs] = useState<GenInputs>(INITIAL_GEN);
  const [planId, setPlanId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [lastGuide, setLastGuide] = useState<GeneratedGuide | null>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateGen<K extends keyof GenInputs>(key: K, value: GenInputs[K]) {
    setGenInputs((current) => ({ ...current, [key]: value }));
  }

  /** Translates the rich InterviewGuide.topics into TopicDraft[] the existing
   *  editor knows how to render. Lossy on mainQuestion (kept in lastGuide for
   *  the preview block); the agent reads label/goalLink/probes via the
   *  topic/intent/hypotheses mapping already wired in plans-service. */
  function guideTopicsToDrafts(guide: GeneratedGuide): TopicDraft[] {
    return guide.topics.map((t) => ({
      topic: t.label,
      intent: t.goalLink,
      hypotheses: t.probes,
    }));
  }

  /**
   * "Leitfaden mit KI generieren" handler. Two-stage:
   *   1. If no planId yet → create a draft plan with the current form fields
   *      (empty topics) so we have an id to attach to /[id]/guide.
   *   2. POST /api/research/plans/[id]/guide with goal (= objective) +
   *      segment/role/topicCount. Server generates + writes topics. We
   *      receive the full guide and refresh local state.
   */
  async function handleGenerate() {
    setGenError(null);
    const title = form.title.trim();
    const objective = form.objective.trim();
    if (title.length < 3) {
      setGenError(t("errTitleGen"));
      return;
    }
    if (objective.length < 3) {
      setGenError(t("errObjectiveGen"));
      return;
    }

    // Optional topicCount: empty → engine uses its default (5). Out-of-range
    // is caught client-side so the user sees a precise message.
    let topicCount: number | undefined;
    if (genInputs.topicCount.trim() !== "") {
      const parsed = Number(genInputs.topicCount);
      if (!Number.isInteger(parsed) || parsed < 3 || parsed > 10) {
        setGenError(t("errTopicCount"));
        return;
      }
      topicCount = parsed;
    }

    setGenerating(true);
    try {
      // Stage 1: ensure a draft plan exists.
      let currentPlanId = planId;
      if (!currentPlanId) {
        const createRes = await fetch("/api/research/plans", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            objective,
            topics: [],
            persona: form.persona.trim() === "" ? null : form.persona.trim(),
            sampleTarget: null,
            visualCaptureEnabled: form.visualCaptureEnabled,
            ...studyTypePayload,
          }),
        });
        const createData = (await createRes.json().catch(() => ({}))) as {
          error?: string;
          planId?: string;
        };
        if (!createRes.ok || !createData.planId) {
          throw new Error(createData.error ?? t("errCreateDraft"));
        }
        currentPlanId = createData.planId;
        setPlanId(currentPlanId);
      }

      // Stage 2: generate the guide on that plan.
      const res = await fetch(
        `/api/research/plans/${encodeURIComponent(currentPlanId)}/guide`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            goal: objective,
            segment:
              genInputs.segment.trim() === ""
                ? undefined
                : genInputs.segment.trim(),
            role:
              genInputs.role.trim() === "" ? undefined : genInputs.role.trim(),
            topicCount,
            language: "de",
          }),
        },
      );
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        guide?: GeneratedGuide;
        error?: string;
        detail?: string;
      };
      if (!res.ok || !data.success || !data.guide) {
        const message =
          res.status === 404
            ? tc("errPlanNotFound")
            : res.status === 401 || res.status === 403
              ? tc("errNoAccessPlan")
              : res.status === 400
                ? (data.error ?? tc("errInvalidRequest"))
                : (data.detail ?? data.error ?? t("errGuideGen"));
        throw new Error(message);
      }

      // Prefill the topic editor + remember the rich guide for the preview.
      update("topics", guideTopicsToDrafts(data.guide));
      setLastGuide(data.guide);
    } catch (err) {
      setGenError(err instanceof Error ? err.message : t("errGuideGen"));
    } finally {
      setGenerating(false);
    }
  }

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

    // Optional sampleTarget: empty string -> null. Non-numeric / out-of-range
    // is rejected here so the user sees a precise message instead of a
    // generic 400 from the API's Zod validation.
    let sampleTarget: number | null = null;
    if (form.sampleTarget.trim() !== "") {
      const parsed = Number(form.sampleTarget);
      if (!Number.isInteger(parsed) || parsed < 1 || parsed > 1000) {
        setError(t("errSampleTarget"));
        return;
      }
      sampleTarget = parsed;
    }

    const topics = topicDraftsToResearchTopics(form.topics);

    setSubmitting(true);
    try {
      // Branch: if the generator already created a draft, PATCH it instead
      // of creating a second plan. Otherwise plain POST as before. The PATCH
      // path mirrors the existing update flow; both end on the same detail
      // redirect.
      if (planId) {
        const res = await fetch(
          `/api/research/plans/${encodeURIComponent(planId)}`,
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
            }),
          },
        );
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        if (!res.ok) {
          throw new Error(data.error ?? t("errSavePlan"));
        }
        router.push(`${detailBase}/${planId}`);
        return;
      }

      const res = await fetch("/api/research/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          objective,
          topics,
          persona: form.persona.trim() === "" ? null : form.persona.trim(),
          sampleTarget,
          visualCaptureEnabled: form.visualCaptureEnabled,
          ...studyTypePayload,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        planId?: string;
      };
      if (!res.ok || !data.planId) {
        throw new Error(data.error ?? t("errCreatePlan"));
      }
      // Hand off to the detail page; status starts as 'draft' there.
      router.push(`${detailBase}/${data.planId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errCreatePlan"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
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
              value={form.sampleTarget}
              onChange={(e) => update("sampleTarget", e.target.value)}
              placeholder={t("phSampleTarget")}
              inputMode="numeric"
              disabled={submitting}
              className={FIELD_INPUT_CLASS}
            />
          </Field>
        </div>

        {/* Visual-Intelligence opt-in (default OFF). Shown for BOTH study
            types — there's no stimulus field in the data model to gate on, so
            the hint sets the expectation that it only helps when participants
            demonstrate on-screen. Writes `visualCaptureEnabled` (exact key) in
            the submit body; the backend flag + interview-gate already exist. */}
        <div className="rounded-lg border border-neutral-200 bg-white p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <span className="block text-body-strong text-neutral-900">
                {t("fldVisualCapture")}
              </span>
              <span className="mt-1 block text-caption text-neutral-500">
                {t("visualCaptureHint")}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="text-caption text-neutral-500">
                {form.visualCaptureEnabled
                  ? t("visualCaptureOn")
                  : t("visualCaptureOff")}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={form.visualCaptureEnabled}
                aria-label={t("fldVisualCapture")}
                onClick={() =>
                  update("visualCaptureEnabled", !form.visualCaptureEnabled)
                }
                disabled={submitting}
                className={`relative inline-flex h-6 w-11 items-center rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary-500/40 disabled:opacity-60 ${
                  form.visualCaptureEnabled
                    ? "bg-primary-600"
                    : "bg-neutral-300"
                }`}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-sm transition-transform ${
                    form.visualCaptureEnabled
                      ? "translate-x-5"
                      : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* KI-Leitfaden-Generator — optional, ändert das Standard-Verhalten
          nicht, wenn nicht benutzt. Setzt sich VOR den Topic-Editor, damit
          das Ergebnis direkt sichtbar in die Topic-Liste darunter fließt. */}
      <section className="space-y-3 rounded-lg border border-primary-200 bg-primary-50/40 p-4">
        <div>
          <h2 className="text-h3 text-neutral-900">{t("genTitle")}</h2>
          <p className="mt-0.5 text-small text-neutral-600">{t("genDesc")}</p>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <Field label={t("genFldSegment")} hint={t("genSegmentHint")}>
            <input
              value={genInputs.segment}
              onChange={(e) => updateGen("segment", e.target.value)}
              placeholder={t("phSegment")}
              disabled={generating || submitting}
              className={FIELD_INPUT_CLASS}
            />
          </Field>
          <Field label={t("genFldRole")} hint={t("genRoleHint")}>
            <input
              value={genInputs.role}
              onChange={(e) => updateGen("role", e.target.value)}
              placeholder={t("phRole")}
              disabled={generating || submitting}
              className={FIELD_INPUT_CLASS}
            />
          </Field>
          <Field label={t("genFldTopicCount")} hint={t("genTopicCountHint")}>
            <input
              value={genInputs.topicCount}
              onChange={(e) => updateGen("topicCount", e.target.value)}
              placeholder={t("phTopicCount")}
              inputMode="numeric"
              disabled={generating || submitting}
              className={FIELD_INPUT_CLASS}
            />
          </Field>
        </div>

        <div className="flex items-center justify-between gap-3">
          {genError ? (
            <span className="max-w-md text-caption text-danger-700">
              {genError}
            </span>
          ) : planId ? (
            <span className="text-caption text-neutral-500">
              {t("genStatusDraft")}
            </span>
          ) : (
            <span className="text-caption text-neutral-500">
              {t("genStatusNew")}
            </span>
          )}
          <Button
            type="button"
            variant="secondary"
            onClick={handleGenerate}
            disabled={generating || submitting}
          >
            {generating
              ? t("genBtnGenerating")
              : planId
                ? t("genBtnRegen")
                : t("genBtn")}
          </Button>
        </div>

        {/* Preview of mainQuestion + screening — TopicEditor's lossy shape
            doesn't show these, but they're the most concrete output of the
            generator. Read-only block, purely informational. */}
        {lastGuide && (
          <div className="space-y-3 border-t border-primary-200/60 pt-3">
            <p className="text-caption font-medium uppercase tracking-wider text-neutral-500">
              {t("genPreviewTitle", {
                count: lastGuide.topics.length,
                minutes: lastGuide.estimatedMinutes,
              })}
            </p>
            <ul className="space-y-2">
              {lastGuide.topics.map((topic) => (
                <li
                  key={topic.id}
                  className="rounded-md border border-neutral-200 bg-white p-3"
                >
                  <p className="text-small font-medium text-neutral-900">
                    {topic.label}
                  </p>
                  <p className="mt-1 text-small italic text-neutral-700">
                    „{topic.mainQuestion}"
                  </p>
                </li>
              ))}
            </ul>
            {lastGuide.screeningQuestions &&
              lastGuide.screeningQuestions.length > 0 && (
                <div>
                  <p className="text-caption font-medium uppercase tracking-wider text-neutral-500">
                    {t("genScreeningTitle")}
                  </p>
                  <ul className="mt-1 list-disc space-y-1 pl-5">
                    {lastGuide.screeningQuestions.map((q, i) => (
                      <li key={i} className="text-small text-neutral-700">
                        {q}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-h3 text-neutral-900">{t("topicsFormTitle")}</h2>
          <p className="mt-0.5 text-small text-neutral-500">
            {t("topicsFormDesc")}
          </p>
        </div>
        <TopicEditor
          topics={form.topics}
          onChange={(topics) => update("topics", topics)}
          disabled={submitting}
        />
      </section>

      {error && (
        <div className="rounded-md border border-danger-500/20 bg-danger-50 px-3 py-2 text-small text-danger-700">
          {error}
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={submitting || generating}>
          {submitting
            ? planId
              ? t("submitSaving")
              : t("submitCreating")
            : planId
              ? t("submitSave")
              : t("submitCreate")}
        </Button>
        <span className="text-small text-neutral-500">
          {planId ? t("submitHelpEdit") : t("submitHelpNew")}
        </span>
      </div>
    </form>
  );
}
