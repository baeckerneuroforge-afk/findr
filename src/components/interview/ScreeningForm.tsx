"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import type { ScreeningQuestion } from "@/lib/schemas/screening";

/**
 * Participant-facing screening form (Etappe 3 — RENDER ONLY).
 *
 * Renders the three question types white-label (inputs use the inherited
 * `--brand-accent`). On submit it calls `onComplete` — in E3 a STUB that just
 * advances the local step so the interview render path is reachable. There is
 * NO endpoint call and NO evaluateScreening here; the real gate (POST
 * /api/interview/[token]/screen → evaluateScreening → qualified ? interview :
 * rejected, plus the anonymous research_screening_responses row) lands in E4.
 */

type AnswerValue = string | string[];
type AnswerMap = Record<string, AnswerValue>;

export function ScreeningForm({
  questions,
  planTitle = null,
  onComplete,
}: {
  questions: ScreeningQuestion[];
  planTitle?: string | null;
  onComplete: (answers: AnswerMap) => void;
}) {
  const t = useTranslations("interview");
  const [answers, setAnswers] = useState<AnswerMap>({});

  function setAnswer(id: string, value: AnswerValue) {
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

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // E3 STUB — no endpoint, no evaluateScreening. E4 wires the real gate.
    onComplete(answers);
  }

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
                placeholder={`${q.min} – ${q.max}`}
                className="w-40 rounded-xl border border-[#E8E4F2] px-4 py-3 text-[15px] outline-none transition-colors focus:border-[var(--brand-accent)]"
              />
            )}
          </fieldset>
        ))}
      </div>

      <div className="sticky bottom-0 mt-8 bg-white pb-6 pt-2">
        <button
          type="submit"
          className="h-[46px] rounded-xl bg-[var(--brand-accent)] px-5 text-[14px] font-medium text-white transition-opacity hover:opacity-90"
        >
          {t("screening.submit")}
        </button>
        <p className="mt-3 text-[11px] text-[#9B9BA3]">{t("screening.note")}</p>
      </div>
    </form>
  );
}
