"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";

import { Card, CardBody, CardHeader } from "@/components/ui/Card";

/**
 * Mission-Control — Cross-Study-Chat-Panel (Etappe 2).
 *
 * Posts to /api/mission-control. The researcher asks a question ACROSS ALL
 * studies of the org and the engine answers grounded STRICTLY in the org's study
 * syntheses, with per-study verbatim citations. Multi-turn: each turn carries the
 * full conversation as `history` so a follow-up has continuity. Local state only
 * — the thread is NOT persisted (navigation away clears it; persistence is a
 * later Etappe — same posture as ResearchAgentPanel / ChatWithDataPanel).
 *
 * Anti-hallucination is enforced SERVER-SIDE and on EVERY turn: the engine
 * re-checks each citation's quote against the FRESH per-study synthesis (never
 * the conversation history) and drops unanchored / wrong-study citations; an
 * answered=true whose citations all drop is downgraded to answered=false. This
 * panel renders that honest refusal as a VISIBLE, calm turn — never swallowed,
 * never shown as an error (the danger-700 footer is reserved for HTTP/network
 * failures). Each surviving citation links back to its SOURCE study's synthesis,
 * so the researcher can open the evidence. KI-Inhalte/Zitate bleiben Quellsprache.
 *
 * Stil mirrors ResearchAgentPanel — same neutral border, primary CTA,
 * danger-700 for errors. i18n: deutsch (du-Form) via the missionControl catalog.
 */

interface MissionControlCitation {
  /** plan_id of the source study — resolved to a title + synthesis link below. */
  studyId: string;
  /** Verbatim source-language quote, validated against the cited study only. */
  quote: string;
}

interface MissionControlResult {
  answered: boolean;
  /** The German answer (answered=true) OR the honest refusal (answered=false). */
  answer: string;
  citations: MissionControlCitation[];
}

interface ChatTurn {
  /** Stable order in the message list — never reset within a session. */
  id: number;
  role: "user" | "assistant";
  /** User turns: the question. Assistant turns: the answer text, sent verbatim
   *  as the `content` of this turn in the history payload (continuity). */
  content: string;
  /** Assistant only — the structured result to render. */
  result?: MissionControlResult;
}

/** {studyId → title} for citation→study link labels. Loaded server-side from the
 *  canonical loadOrgSyntheses() and passed down by the page. */
interface StudyRef {
  studyId: string;
  studyTitle: string;
}

interface MissionControlPanelProps {
  /** All of the org's studies that have a synthesis (the citation universe). When
   *  empty the panel shows the not-ready state — there is nothing to ground on. */
  studies: StudyRef[];
}

/** Keep each history turn under the route's 4000-char cap. Answers are capped at
 *  2500 and questions at 2000 by validation, so this only ever bites a pathological
 *  case — the authoritative evidence is always the fresh synthesis in `system`. */
const HISTORY_CONTENT_CAP = 3900;

export function MissionControlPanel({ studies }: MissionControlPanelProps) {
  const t = useTranslations("missionControl");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const turnIdRef = useRef(0);

  const ready = studies.length > 0;
  const titleByStudy = new Map(studies.map((s) => [s.studyId, s.studyTitle]));

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

    // The API treats `question` as the current turn and `history` as everything
    // before it. We send the prior turns (their `content` strings) as history.
    const historyPayload = turns.map((turn) => ({
      role: turn.role,
      content: turn.content.slice(0, HISTORY_CONTENT_CAP),
    }));

    try {
      const res = await fetch("/api/mission-control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: trimmed, history: historyPayload }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        result?: MissionControlResult;
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
          "mission-control failed:",
          data.detail ?? data.error ?? res.status,
        );
        return;
      }
      const result = data.result;
      const assistantTurn: ChatTurn = {
        id: nextTurnId(),
        role: "assistant",
        // Continuity content = the answer text (refusal text when answered=false).
        content: (result.answer.trim() === "" ? "—" : result.answer.trim()).slice(
          0,
          HISTORY_CONTENT_CAP,
        ),
        result,
      };
      setTurns((prev) => [...prev, assistantTurn]);
    } catch (err) {
      setError(t("errNetwork"));
      console.error("mission-control failed:", err);
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
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-h3 text-neutral-900">{t("title")}</h2>
            <p className="mt-1 text-small text-neutral-500">{t("subtitle")}</p>
          </div>
          {turns.length > 0 && (
            <button
              type="button"
              onClick={handleReset}
              disabled={loading}
              className="shrink-0 rounded-md border border-neutral-200 bg-white px-3 py-1.5 text-caption font-medium text-neutral-700 transition-colors hover:border-neutral-300 hover:bg-neutral-50 disabled:opacity-50"
            >
              {t("clear")}
            </button>
          )}
        </div>
      </CardHeader>

      <CardBody>
        {!ready ? (
          <p className="py-4 text-center text-body text-neutral-500">
            {t("notReady")}
          </p>
        ) : (
          <div className="space-y-4">
            {/* Conversation */}
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
                        <AnswerBlock
                          result={turn.result}
                          answerLabel={t("answerLabel")}
                          sourcesLabel={t("sourcesLabel")}
                          openStudyHint={t("openStudyHint")}
                          titleFor={titleFor}
                        />
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

            {/* Question input */}
            <form onSubmit={handleSubmit} className="space-y-2">
              <textarea
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder={t("placeholder")}
                rows={3}
                disabled={loading}
                className="block w-full resize-y rounded-md border border-neutral-200 bg-white px-3 py-2 text-body text-neutral-900 placeholder:text-neutral-400 focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500 disabled:opacity-50"
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
                  className="shrink-0 rounded-md border border-primary-600 bg-primary-600 px-4 py-2 text-small font-medium text-white transition-colors hover:border-primary-700 hover:bg-primary-700 disabled:cursor-not-allowed disabled:opacity-50"
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

/** An answered turn — the German answer + the per-study citations. Each citation
 *  shows its verbatim quote and a LINK to the source study's synthesis, so the
 *  researcher can open the evidence the cross-study claim rests on. */
function AnswerBlock({
  result,
  answerLabel,
  sourcesLabel,
  openStudyHint,
  titleFor,
}: {
  result: MissionControlResult;
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

/** The honest refusal — answered=false. Rendered as a visible, neutral/muted turn
 *  (NOT an error), so the researcher SEES when the engine deliberately declines
 *  because no study synthesis supports the question. */
function RefusalBlock({
  answer,
  refusalLabel,
}: {
  answer: string;
  refusalLabel: string;
}) {
  return (
    <div className="rounded-md border border-neutral-200 bg-white p-3">
      <div className="mb-1 text-caption font-medium uppercase tracking-wider text-neutral-500">
        {refusalLabel}
      </div>
      <p className="whitespace-pre-wrap text-body italic text-neutral-600">
        {answer}
      </p>
    </div>
  );
}
