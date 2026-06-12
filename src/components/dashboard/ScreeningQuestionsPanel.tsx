"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/Button";
import { FIELD_INPUT_CLASS } from "@/components/ui/Field";
import type { ScreeningQuestion } from "@/lib/schemas/screening";

/**
 * Researcher-Editor für die Screening-Fragen einer Studie (Etappe 2).
 *
 * Self-contained wie PlanQuotaPanel (lokaler State + fetch + router.refresh) und
 * inline-editierbar wie TopicEditor: die ganze Liste ist eine Arbeitskopie,
 * "Speichern" persistiert sie als Ganzes über
 * POST /api/research/plans/[id]/screening-questions (REPLACE).
 *
 * Drei Typen: single_choice / multi_choice (Optionsliste; je Option ein
 * "akzeptiert"-Häkchen → accepted bzw. acceptedAny) und number_range (min/max).
 * Reine Config, KEINE KI — die deterministische Auswertung lebt in
 * src/lib/screening/evaluate.ts (Etappe 4).
 */

type QuestionType = "single_choice" | "multi_choice" | "number_range";

interface OptionDraft {
  label: string;
  accepted: boolean;
}

interface QuestionDraft {
  id: string;
  type: QuestionType;
  prompt: string;
  required: boolean;
  options: OptionDraft[]; // choice-Typen
  min: string; // number_range (String fürs Input-Feld)
  max: string;
}

const TYPES: QuestionType[] = ["single_choice", "multi_choice", "number_range"];

const TYPE_LABEL_KEY: Record<QuestionType, string> = {
  single_choice: "screeningTypeSingle",
  multi_choice: "screeningTypeMulti",
  number_range: "screeningTypeRange",
};

function newId(): string {
  return crypto.randomUUID();
}

function toDraft(q: ScreeningQuestion): QuestionDraft {
  if (q.type === "number_range") {
    return {
      id: q.id,
      type: "number_range",
      prompt: q.prompt,
      required: q.required,
      options: [],
      min: String(q.min),
      max: String(q.max),
    };
  }
  const accepted = q.type === "single_choice" ? q.accepted : q.acceptedAny;
  return {
    id: q.id,
    type: q.type,
    prompt: q.prompt,
    required: q.required,
    options: q.options.map((label) => ({
      label,
      accepted: accepted.includes(label),
    })),
    min: "",
    max: "",
  };
}

function emptyDraft(): QuestionDraft {
  return {
    id: newId(),
    type: "single_choice",
    prompt: "",
    required: true,
    options: [{ label: "", accepted: false }],
    min: "",
    max: "",
  };
}

/** Nie ausgefüllte Zeile (add geklickt, leer gelassen) — beim Speichern still
 *  verwerfen, wie topicDraftsToResearchTopics. */
function isBlank(d: QuestionDraft): boolean {
  const noPrompt = d.prompt.trim() === "";
  if (d.type === "number_range") {
    return noPrompt && d.min.trim() === "" && d.max.trim() === "";
  }
  return noPrompt && d.options.every((o) => o.label.trim() === "");
}

type Conversion =
  | { ok: true; question: ScreeningQuestion }
  | { ok: false; reason: "prompt" | "options" | "accepted" | "range" };

/** Draft → kanonische ScreeningQuestion (client-seitige Vorvalidierung; das
 *  Server-Zod ist der finale Gate). */
function draftToQuestion(d: QuestionDraft): Conversion {
  const prompt = d.prompt.trim();
  if (!prompt) return { ok: false, reason: "prompt" };

  if (d.type === "number_range") {
    const min = Number(d.min);
    const max = Number(d.max);
    if (
      d.min.trim() === "" ||
      d.max.trim() === "" ||
      !Number.isFinite(min) ||
      !Number.isFinite(max) ||
      min > max
    ) {
      return { ok: false, reason: "range" };
    }
    return {
      ok: true,
      question: { id: d.id, type: "number_range", prompt, required: d.required, min, max },
    };
  }

  const options = d.options.map((o) => o.label.trim()).filter(Boolean);
  const accepted = d.options
    .filter((o) => o.label.trim() !== "" && o.accepted)
    .map((o) => o.label.trim());
  if (options.length < 1) return { ok: false, reason: "options" };
  if (accepted.length < 1) return { ok: false, reason: "accepted" };

  if (d.type === "single_choice") {
    return {
      ok: true,
      question: {
        id: d.id,
        type: "single_choice",
        prompt,
        required: d.required,
        options,
        accepted,
      },
    };
  }
  return {
    ok: true,
    question: {
      id: d.id,
      type: "multi_choice",
      prompt,
      required: d.required,
      options,
      acceptedAny: accepted,
    },
  };
}

const REASON_KEY: Record<Exclude<Conversion, { ok: true }>["reason"], string> = {
  prompt: "errScreeningPrompt",
  options: "errScreeningOptions",
  accepted: "errScreeningAccepted",
  range: "errScreeningRange",
};

export function ScreeningQuestionsPanel({
  planId,
  initialQuestions,
  disabled = false,
}: {
  planId: string;
  initialQuestions: ScreeningQuestion[];
  disabled?: boolean;
}) {
  const router = useRouter();
  const t = useTranslations("research.plans");
  const tc = useTranslations("research.common");
  const [drafts, setDrafts] = useState<QuestionDraft[]>(() =>
    initialQuestions.map(toDraft),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function patch(index: number, p: Partial<QuestionDraft>) {
    setSaved(false);
    setDrafts((ds) => ds.map((d, i) => (i === index ? { ...d, ...p } : d)));
  }
  function removeQuestion(index: number) {
    setSaved(false);
    setDrafts((ds) => ds.filter((_, i) => i !== index));
  }
  function addQuestion() {
    setSaved(false);
    setError(null);
    setDrafts((ds) => [...ds, emptyDraft()]);
  }

  function setOption(qi: number, oi: number, p: Partial<OptionDraft>) {
    setSaved(false);
    setDrafts((ds) =>
      ds.map((d, i) =>
        i === qi
          ? { ...d, options: d.options.map((o, j) => (j === oi ? { ...o, ...p } : o)) }
          : d,
      ),
    );
  }
  function addOption(qi: number) {
    setSaved(false);
    setDrafts((ds) =>
      ds.map((d, i) =>
        i === qi
          ? { ...d, options: [...d.options, { label: "", accepted: false }] }
          : d,
      ),
    );
  }
  function removeOption(qi: number, oi: number) {
    setSaved(false);
    setDrafts((ds) =>
      ds.map((d, i) =>
        i === qi ? { ...d, options: d.options.filter((_, j) => j !== oi) } : d,
      ),
    );
  }

  async function handleSave() {
    setError(null);
    setSaved(false);

    const questions: ScreeningQuestion[] = [];
    for (let i = 0; i < drafts.length; i++) {
      const d = drafts[i];
      if (isBlank(d)) continue;
      const conv = draftToQuestion(d);
      if (!conv.ok) {
        setError(t(REASON_KEY[conv.reason], { n: i + 1 }));
        return;
      }
      questions.push(conv.question);
    }

    setSaving(true);
    try {
      const res = await fetch(
        `/api/research/plans/${planId}/screening-questions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ questions }),
        },
      );
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        success?: boolean;
      };
      if (!res.ok || !data.success) {
        throw new Error(data.error ?? t("errSaveScreening"));
      }
      // Verworfene Leerzeilen wegnormalisieren → Anzeige == Persistiertes.
      setDrafts(questions.map(toDraft));
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errSaveScreening"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {drafts.length === 0 ? (
        <p className="rounded-md border border-dashed border-neutral-200 bg-neutral-50 px-3 py-4 text-center text-small text-neutral-500">
          {t("screeningEmpty")}
        </p>
      ) : (
        <ul className="space-y-4">
          {drafts.map((d, i) => (
            <li
              key={d.id}
              className="space-y-3 rounded-lg border border-neutral-200 bg-card p-4"
            >
              <div className="flex items-center justify-between">
                <span className="text-caption font-medium uppercase tracking-wider text-neutral-400">
                  {t("screeningQuestionN", { n: i + 1 })}
                </span>
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => removeQuestion(i)}
                    className="text-caption text-neutral-500 transition-colors hover:text-danger-700 disabled:opacity-50"
                  >
                    {tc("remove")}
                  </button>
                )}
              </div>

              <label className="block">
                <span className="mb-1.5 block text-small font-medium text-neutral-700">
                  {t("fldScreeningPrompt")}
                </span>
                <input
                  value={d.prompt}
                  onChange={(e) => patch(i, { prompt: e.target.value })}
                  placeholder={t("phScreeningPrompt")}
                  disabled={disabled}
                  className={FIELD_INPUT_CLASS}
                />
              </label>

              <div className="flex flex-wrap items-end gap-4">
                <label className="block">
                  <span className="mb-1.5 block text-small font-medium text-neutral-700">
                    {t("fldScreeningType")}
                  </span>
                  <select
                    value={d.type}
                    onChange={(e) =>
                      patch(i, { type: e.target.value as QuestionType })
                    }
                    disabled={disabled}
                    className={FIELD_INPUT_CLASS}
                  >
                    {TYPES.map((tp) => (
                      <option key={tp} value={tp}>
                        {t(TYPE_LABEL_KEY[tp])}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2 pb-2 text-small text-neutral-700">
                  <input
                    type="checkbox"
                    checked={d.required}
                    onChange={(e) => patch(i, { required: e.target.checked })}
                    disabled={disabled}
                  />
                  {t("fldScreeningRequired")}
                </label>
              </div>

              {d.type === "number_range" ? (
                <div className="flex flex-wrap items-end gap-3">
                  <label className="block">
                    <span className="mb-1.5 block text-small font-medium text-neutral-700">
                      {t("fldScreeningMin")}
                    </span>
                    <input
                      type="number"
                      value={d.min}
                      onChange={(e) => patch(i, { min: e.target.value })}
                      disabled={disabled}
                      className={`${FIELD_INPUT_CLASS} w-32`}
                    />
                  </label>
                  <label className="block">
                    <span className="mb-1.5 block text-small font-medium text-neutral-700">
                      {t("fldScreeningMax")}
                    </span>
                    <input
                      type="number"
                      value={d.max}
                      onChange={(e) => patch(i, { max: e.target.value })}
                      disabled={disabled}
                      className={`${FIELD_INPUT_CLASS} w-32`}
                    />
                  </label>
                </div>
              ) : (
                <div>
                  <span className="mb-1 block text-small font-medium text-neutral-700">
                    {t("fldScreeningOptions")}
                  </span>
                  <p className="mb-2 text-caption text-neutral-500">
                    {t("screeningAcceptedHint")}
                  </p>
                  <ul className="space-y-2">
                    {d.options.map((o, oi) => (
                      <li key={oi} className="flex items-center gap-2">
                        <input
                          value={o.label}
                          onChange={(e) =>
                            setOption(i, oi, { label: e.target.value })
                          }
                          placeholder={t("phScreeningOption")}
                          disabled={disabled}
                          className={FIELD_INPUT_CLASS}
                        />
                        <label className="flex items-center gap-1 whitespace-nowrap text-caption text-neutral-600">
                          <input
                            type="checkbox"
                            checked={o.accepted}
                            onChange={(e) =>
                              setOption(i, oi, { accepted: e.target.checked })
                            }
                            disabled={disabled}
                          />
                          {t("screeningAcceptedLabel")}
                        </label>
                        {!disabled && (
                          <button
                            type="button"
                            onClick={() => removeOption(i, oi)}
                            className="text-caption text-neutral-500 transition-colors hover:text-danger-700 disabled:opacity-50"
                          >
                            {tc("remove")}
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                  {!disabled && (
                    <button
                      type="button"
                      onClick={() => addOption(i)}
                      className="mt-2 text-caption text-primary-700 transition-colors hover:text-primary-900 disabled:opacity-50"
                    >
                      {t("addScreeningOption")}
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {!disabled && (
        <div className="flex flex-wrap items-center gap-3 border-t border-neutral-100 pt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={addQuestion}
            disabled={saving}
          >
            {t("addScreeningQuestion")}
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? tc("saving") : t("screeningSave")}
          </Button>
          {saved && (
            <span className="text-small text-success-700">
              {t("screeningSaved")}
            </span>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-md border border-danger-500/20 bg-danger-50 px-3 py-2 text-small text-danger-700">
          {error}
        </div>
      )}
    </div>
  );
}
