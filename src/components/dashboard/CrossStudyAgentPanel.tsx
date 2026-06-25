"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";

import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Konsoul, type KonsoulState } from "@/components/dashboard/Konsoul";

/**
 * Cross-Study-Agent — Panel (Bau 3). The AGENTIC sibling of MissionControlPanel:
 * posts to /api/cross-study-agent, where the engine RESEARCHES (lists studies,
 * loads the relevant ones on demand, counts themes deterministically) before
 * answering. Multi-turn, session-local (NOT persisted — navigation away clears
 * it; same posture as MissionControlPanel / ResearchAgentPanel).
 *
 * Renders THREE distinct kinds of content, on purpose:
 *  - the GROUNDED answer (answer + per-study citations linking to each source
 *    synthesis) — solid primary border, like the chat panel;
 *  - the INTERPRETATION field (Bau 2) — a soft cross-study observation the agent
 *    could NOT back with an exact count or per-study citations. Rendered as a
 *    visually DISTINCT, dashed warning-tinted block labelled "Interpretation
 *    (nicht direkt belegt)", so the user can tell grounded fact from speculation.
 *    If this looked the same as the answer, Bau 2's guardrail would be invisible;
 *  - the honest REFUSAL (answered=false) — a calm neutral card, never error-red
 *    (the danger-700 footer is reserved for HTTP/network failures).
 *
 * Mirrors MissionControlPanel's structure + auth/multi-turn/citation-link pattern;
 * the chat panel itself is unchanged. i18n: crossStudyAgent catalog (du-Form).
 */

interface AgentCitation {
  studyId: string;
  quote: string;
}

interface AgentResult {
  answered: boolean;
  /** The grounded German answer, or the honest refusal when answered=false. */
  answer: string;
  citations: AgentCitation[];
  /** Bau 2 — optional, NON-evidenced soft observation. Empty on refusal. */
  interpretation: string;
}

interface ChatTurn {
  id: number;
  role: "user" | "assistant";
  /** User turns: the question. Assistant turns: the grounded answer text (sent as
   *  history content for continuity — the interpretation is display-only). */
  content: string;
  result?: AgentResult;
}

interface StudyRef {
  studyId: string;
  studyTitle: string;
}

interface CrossStudyAgentPanelProps {
  /** All of the org's studies that have a synthesis — the citation universe +
   *  the {studyId → title} source for citation links. Empty → not-ready state. */
  studies: StudyRef[];
}

/** Keep each history turn under the route's 4000-char cap. */
const HISTORY_CONTENT_CAP = 3900;

export function CrossStudyAgentPanel({ studies }: CrossStudyAgentPanelProps) {
  const t = useTranslations("crossStudyAgent");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const turnIdRef = useRef(0);

  const ready = studies.length > 0;
  const titleByStudy = new Map(studies.map((s) => [s.studyId, s.studyTitle]));

  // Konsoul-Zustand — 1:1 aus dem Panel-State, kein neuer Datenpfad: loading →
  // recherchiert; beim Tippen → hört zu; sonst spiegelt die letzte Antwort
  // (belegt / Interpretation / ehrliche Ablehnung); sonst Ruhe.
  const lastResult = [...turns]
    .reverse()
    .find((turn) => turn.role === "assistant")?.result;
  const konsoulState: KonsoulState = loading
    ? "research"
    : question.trim() !== ""
      ? "listen"
      : lastResult
        ? !lastResult.answered
          ? "refuse"
          : lastResult.interpretation.trim() !== ""
            ? "hedge"
            : "answer"
        : "idle";

  function nextTurnId(): number {
    turnIdRef.current += 1;
    return turnIdRef.current;
  }

  function titleFor(studyId: string): string {
    const title = titleByStudy.get(studyId);
    return title && title.trim() !== "" ? title : t("untitledStudy");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = question.trim();
    if (!trimmed || loading) return;

    setError(null);
    const userTurn: ChatTurn = {
      id: nextTurnId(),
      role: "user",
      content: trimmed,
    };
    setTurns((prev) => [...prev, userTurn]);
    setQuestion("");
    setLoading(true);

    const historyPayload = turns.map((turn) => ({
      role: turn.role,
      content: turn.content.slice(0, HISTORY_CONTENT_CAP),
    }));

    try {
      const res = await fetch("/api/cross-study-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed, history: historyPayload }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        result?: AgentResult;
        error?: string;
        detail?: string;
      };
      if (!res.ok || !data.success || !data.result) {
        const message =
          res.status === 401 || res.status === 403
            ? t("errNoAccess")
            : res.status === 400
              ? (data.error ?? t("errInvalidRequest"))
              : (data.error ?? t("errEngine"));
        setError(message);
        console.error(
          "cross-study-agent failed:",
          data.detail ?? data.error ?? res.status,
        );
        return;
      }
      const result = data.result;
      const assistantTurn: ChatTurn = {
        id: nextTurnId(),
        role: "assistant",
        // Continuity content = the grounded answer text (refusal text when
        // answered=false). The interpretation is NOT threaded — it is soft.
        content: (result.answer.trim() === "" ? "—" : result.answer.trim()).slice(
          0,
          HISTORY_CONTENT_CAP,
        ),
        result,
      };
      setTurns((prev) => [...prev, assistantTurn]);
    } catch (err) {
      setError(t("errNetwork"));
      console.error("cross-study-agent failed:", err);
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    if (loading) return;
    setTurns([]);
    setError(null);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-h3 text-neutral-900">{t("title")}</h2>
            <p className="mt-1 text-small text-neutral-500">{t("subtitle")}</p>
          </div>
          {/* Konsoul — der Bot-Charakter spiegelt die Antwort-Stufe (belegt /
              Interpretation / Ablehnung), bevor man sie liest. Auf schmalen
              Screens ausgeblendet, damit der Header nicht überläuft. */}
          <div className="flex shrink-0 flex-col items-end gap-2">
            <Konsoul state={konsoulState} className="hidden sm:block" />
            {turns.length > 0 && (
              <button
                type="button"
                onClick={handleReset}
                disabled={loading}
                className="rounded-md border border-neutral-200 bg-card px-3 py-1.5 text-caption font-medium text-neutral-700 transition-colors hover:border-neutral-300 hover:bg-neutral-50 disabled:opacity-50"
              >
                {t("clear")}
              </button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardBody>
        {!ready ? (
          <p className="py-4 text-center text-body text-neutral-500">
            {t("notReady")}
          </p>
        ) : (
          <div className="space-y-4">
            {turns.length > 0 && (
              <ul className="space-y-3">
                {turns.map((turn) =>
                  turn.role === "user" ? (
                    <li key={turn.id}>
                      <div className="rounded-md bg-neutral-50 p-3">
                        <div className="mb-1 text-caption font-medium uppercase tracking-wider text-neutral-500">
                          {t("questionLabel")}
                        </div>
                        <p className="whitespace-pre-wrap text-body text-neutral-900">
                          {turn.content}
                        </p>
                      </div>
                    </li>
                  ) : (
                    <li key={turn.id}>
                      {turn.result && turn.result.answered ? (
                        <>
                          <AnswerBlock
                            result={turn.result}
                            answerLabel={t("answerLabel")}
                            sourcesLabel={t("sourcesLabel")}
                            openStudyHint={t("openStudyHint")}
                            titleFor={titleFor}
                          />
                          {turn.result.interpretation.trim() !== "" && (
                            <InterpretationBlock
                              text={turn.result.interpretation}
                              label={t("interpretationLabel")}
                            />
                          )}
                        </>
                      ) : (
                        <RefusalBlock
                          answer={turn.result?.answer ?? ""}
                          refusalLabel={t("refusalLabel")}
                        />
                      )}
                    </li>
                  ),
                )}
                {loading && (
                  <li>
                    <div className="rounded-md border border-primary-100 bg-primary-50/40 p-3">
                      <div className="mb-1 text-caption font-medium uppercase tracking-wider text-neutral-500">
                        {t("answerLabel")}
                      </div>
                      <p className="text-body italic text-neutral-500">
                        {t("thinking")}
                      </p>
                    </div>
                  </li>
                )}
              </ul>
            )}

            <form onSubmit={handleSubmit} className="space-y-2">
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder={t("placeholder")}
                rows={3}
                disabled={loading}
                className="block w-full resize-y rounded-md border border-neutral-200 bg-card px-3 py-2 text-body text-neutral-900 placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:opacity-50"
              />
              <div className="flex items-center justify-between gap-3">
                {error ? (
                  <span className="max-w-md text-caption text-danger-700">
                    {error}
                  </span>
                ) : (
                  <span className="text-caption text-neutral-400">
                    {t("anchoredHint")}
                  </span>
                )}
                <button
                  type="submit"
                  disabled={loading || question.trim() === ""}
                  className="shrink-0 rounded-md border border-primary-600 bg-primary-600 px-4 py-2 text-small font-medium text-white transition-colors hover:border-primary-hover hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? t("submitting") : t("submit")}
                </button>
              </div>
            </form>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

/** The GROUNDED answer — German prose + per-study citations, each linking to its
 *  source study's synthesis. Solid primary border = "this is evidenced". */
function AnswerBlock({
  result,
  answerLabel,
  sourcesLabel,
  openStudyHint,
  titleFor,
}: {
  result: AgentResult;
  answerLabel: string;
  sourcesLabel: string;
  openStudyHint: string;
  titleFor: (studyId: string) => string;
}) {
  return (
    <div className="rounded-md border border-primary-100 bg-primary-50/40 p-3">
      <div className="mb-1 text-caption font-medium uppercase tracking-wider text-neutral-500">
        {answerLabel}
      </div>
      <p className="whitespace-pre-wrap text-body text-neutral-900">
        {result.answer}
      </p>

      {result.citations.length > 0 && (
        <div className="mt-3 space-y-2">
          <div className="text-caption font-medium uppercase tracking-wider text-neutral-500">
            {sourcesLabel}
          </div>
          <ul className="space-y-2">
            {result.citations.map((citation, ci) => (
              <li
                key={ci}
                className="border-l-2 border-primary-200 pl-3 text-small"
              >
                <p className="italic text-neutral-700">„{citation.quote}"</p>
                <Link
                  href={`/dashboard/research-plans/${encodeURIComponent(
                    citation.studyId,
                  )}/synthesis`}
                  title={openStudyHint}
                  className="mt-1 inline-flex items-center gap-1 text-caption font-medium text-primary-700 transition-colors hover:text-primary-800 hover:underline"
                >
                  {titleFor(citation.studyId)}
                  <span aria-hidden="true">→</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/** The INTERPRETATION channel (Bau 2) — a soft, NON-evidenced cross-study
 *  observation. Deliberately styled UNLIKE the grounded answer: a dashed,
 *  warning-tinted block with its own "nicht direkt belegt" label, so the user
 *  never mistakes speculation for a cited finding. This visual contrast IS the
 *  point — it makes the guardrail visible. */
function InterpretationBlock({ text, label }: { text: string; label: string }) {
  return (
    <div className="mt-3 rounded-md border border-dashed border-warning-500/40 bg-warning-50 p-3">
      <div className="mb-1 flex items-center gap-1.5 text-caption font-medium uppercase tracking-wider text-warning-700">
        <svg
          className="h-3.5 w-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v5" strokeLinecap="round" />
          <path d="M12 16h.01" strokeLinecap="round" />
        </svg>
        {label}
      </div>
      <p className="whitespace-pre-wrap text-small italic text-neutral-600">
        {text}
      </p>
    </div>
  );
}

/** The honest refusal — answered=false. Calm neutral card, never error-red. */
function RefusalBlock({
  answer,
  refusalLabel,
}: {
  answer: string;
  refusalLabel: string;
}) {
  return (
    <div className="rounded-md border border-neutral-200 bg-card p-3">
      <div className="mb-1 text-caption font-medium uppercase tracking-wider text-neutral-500">
        {refusalLabel}
      </div>
      <p className="whitespace-pre-wrap text-body italic text-neutral-600">
        {answer}
      </p>
    </div>
  );
}
