"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { ScreeningQuestion } from "@/lib/schemas/screening";

/**
 * Participant-facing screening form (Etappe 4 — WIRED).
 *
 * Renders the three question types white-label (inputs inherit `--brand-accent`).
 * On submit it client-validates that every REQUIRED question is answered (so an
 * incomplete form never produces a spurious "rejected" quote row), normalizes
 * number_range answers to numbers, and hands the answers to `onComplete` — the
 * gate POSTs them to /api/interview/[token]/screen, where the deterministic
 * evaluateScreening (the authority) decides qualified vs rejected.
 */

/** Submitted shape: number_range is normalized to a number; choices stay
 *  string / string[]. Matches ScreeningAnswersSchema on the server. */
type AnswerMap = Record<string, string | string[] | number>;
/** Internal form state — inputs only ever produce strings / string[]. */
type DraftValue = string | string[];

export function ScreeningForm({
  questions,
  planTitle = null,
  submitting = false,
  error = null,
  onComplete,
}: {
  questions: ScreeningQuestion[];
  planTitle?: string | null;
  submitting?: boolean;
  error?: string | null;
  onComplete: (answers: AnswerMap) => void;
}) {
  const t = useTranslations("interview");
  const [answers, setAnswers] = useState<Record<string, DraftValue>>({});
  const [validationError, setValidationError] = useState<string | null>(null);

  function setAnswer(id: string, value: DraftValue) {
    setAnswers((a) => ({ ...a, [id]: value }));
  }
  function toggleMulti(id: string, option: string) {
    setAnswers((a) => {
      const cur = Array.isArray(a[id]) ? (a[id] as string[]) : [];
      return {
        ...a,
        [id]: cur.includes(option)
          ? cur.filter((o) => o !== option)
          : [...cur, option],
      };
    });
  }

  function isAnswered(q: ScreeningQuestion): boolean {
    const a = answers[q.id];
    if (q.type === "multi_choice") return Array.isArray(a) && a.length > 0;
    return typeof a === "string" && a.trim() !== "";
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;

    // Client-side completeness guard: every REQUIRED question must be answered.
    // Keeps an unfinished form from being POSTed and counted as a rejection —
    // "incomplete" ≠ "doesn't fit the profile". The server still fail-closes.
    const missingRequired = questions.some((q) => q.required && !isAnswered(q));
    if (missingRequired) {
      setValidationError(t("screening.errRequired"));
      return;
    }
    setValidationError(null);

    // Normalize the payload: number_range → number; drop empty entries.
    const payload: AnswerMap = {};
    for (const q of questions) {
      const a = answers[q.id];
      if (a === undefined) continue;
      if (q.type === "number_range") {
        if (typeof a === "string" && a.trim() !== "") payload[q.id] = Number(a);
      } else {
        payload[q.id] = a;
      }
    }
    onComplete(payload);
  }

  const shownError = validationError ?? error;

  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-6">
        <h1 className="text-[18px] font-semibold">
          {planTitle || t("screening.title")}
        </h1>
        <p className="mt-1 text-[14px] leading-relaxed text-[#6B6680]">
          {t("screening.intro")}
        </p>
      </div>

      <div className="space-y-6">
        {questions.map((q) => (
          <fieldset key={q.id} className="space-y-2 border-0 p-0">
            <legend className="mb-1 text-[15px] font-medium text-[#0E0A1F]">
              {q.prompt}
              {q.required && (
                <span className="ml-1 text-[#C9442F]" aria-hidden>
                  *
                </span>
              )}
            </legend>

            {q.type === "single_choice" &&
              q.options.map((opt) => (
                <label
                  key={opt}
                  className="flex items-center gap-2 text-[14px] text-[#0E0A1F]"
                >
                  <input
                    type="radio"
                    name={q.id}
                    value={opt}
                    checked={answers[q.id] === opt}
                    onChange={() => setAnswer(q.id, opt)}
                    disabled={submitting}
                    className="accent-[var(--brand-accent)]"
                  />
                  {opt}
                </label>
              ))}

            {q.type === "multi_choice" &&
              q.options.map((opt) => {
                const cur = Array.isArray(answers[q.id])
                  ? (answers[q.id] as string[])
                  : [];
                return (
                  <label
                    key={opt}
                    className="flex items-center gap-2 text-[14px] text-[#0E0A1F]"
                  >
                    <input
                      type="checkbox"
                      checked={cur.includes(opt)}
                      onChange={() => toggleMulti(q.id, opt)}
                      disabled={submitting}
                      className="accent-[var(--brand-accent)]"
                    />
                    {opt}
                  </label>
                );
              })}

            {q.type === "number_range" && (
              <input
                type="number"
                inputMode="numeric"
                min={q.min}
                max={q.max}
                value={typeof answers[q.id] === "string" ? (answers[q.id] as string) : ""}
                onChange={(e) => setAnswer(q.id, e.target.value)}
                disabled={submitting}
                placeholder={`${q.min} – ${q.max}`}
                className="w-40 rounded-xl border border-[#E8E4F2] px-4 py-3 text-[15px] outline-none transition-colors focus:border-[var(--brand-accent)] disabled:opacity-60"
              />
            )}
          </fieldset>
        ))}
      </div>

      <div className="sticky bottom-0 mt-8 bg-white pb-6 pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="h-[46px] rounded-xl bg-[var(--brand-accent)] px-5 text-[14px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? t("screening.submitting") : t("screening.submit")}
        </button>
        <p className="mt-3 text-[11px] text-[#9B9BA3]">{t("screening.note")}</p>
        {shownError && (
          <div className="mt-3 rounded-lg border border-[#FFD7D0] bg-[#FFF3F1] px-4 py-2 text-[13px] text-[#C9442F]">
            {shownError}
          </div>
        )}
      </div>
    </form>
  );
}
