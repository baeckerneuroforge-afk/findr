"use client";

import { useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";

import { Card, CardBody, CardHeader } from "@/components/ui/Card";

/**
 * "Frag deine Daten" — Chat-Panel auf der Synthese-Seite.
 *
 * Posts to /api/research/plans/[id]/chat. Each turn carries the full
 * conversation history so the engine can do multi-turn references
 * ("Und was war mit X?"). Local state only — history is NOT persisted;
 * navigation away clears the conversation, intentional simplicity for v1.
 *
 * Anti-hallucination contract is enforced server-side (the engine drops
 * paraphrased quotes / unknown ids and downgrades unsourced answers to
 * answered=false). The UI distinguishes answered=true (with citations)
 * vs answered=false (no citations, italic muted note) so the researcher
 * SEES when the data couldn't support an answer.
 *
 * Stil mirrors UpdateSynthesisButton / ExportSynthesisPdfButton — same
 * neutral border, primary CTA, danger-700 for errors. i18n: deutsch.
 */

interface ChatCitation {
  interviewId: string;
  quote: string;
}

interface ChatTurn {
  /** Stable order in the message list — never reset within a session. */
  id: number;
  role: "user" | "assistant";
  content: string;
  /** Only present on assistant turns. */
  citations?: ChatCitation[];
  /** Only present on assistant turns. False = the engine said "no
   *  evidence" — UI shows the refusal styled differently. */
  answered?: boolean;
}

interface ChatWithDataPanelProps {
  planId: string;
  /** When false, the chat is disabled — the page passes this as
   *  "synthesis row exists with synthesized_at set". A study with no
   *  insights would short-circuit server-side, but disabling client-side
   *  saves a round trip + makes the empty state visible. */
  ready: boolean;
}

export function ChatWithDataPanel({ planId, ready }: ChatWithDataPanelProps) {
  const t = useTranslations("research.synthesis");
  const tc = useTranslations("research.common");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const turnIdRef = useRef(0);

  function nextTurnId(): number {
    turnIdRef.current += 1;
    return turnIdRef.current;
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
    const nextTurns = [...turns, userTurn];
    setTurns(nextTurns);
    setQuestion("");
    setLoading(true);

    // Build the history payload the API expects. We send the conversation
    // up to and INCLUDING the just-appended user turn? No — the API treats
    // `question` as the current turn and `history` as everything before.
    // So we send the prior turns as history and `trimmed` as `question`.
    const historyPayload = turns.map((t) => ({
      role: t.role,
      content: t.content,
    }));

    try {
      const res = await fetch(
        `/api/research/plans/${encodeURIComponent(planId)}/chat`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            question: trimmed,
            history: historyPayload,
          }),
        },
      );
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        result?: {
          answered: boolean;
          answer: string;
          citations: ChatCitation[];
        };
        error?: string;
        detail?: string;
      };
      if (!res.ok || !data.success || !data.result) {
        const message =
          res.status === 404
            ? tc("errPlanNotFound")
            : res.status === 401 || res.status === 403
              ? tc("errNoAccessPlan")
              : res.status === 400
                ? (data.error ?? tc("errInvalidRequest"))
                : (data.detail ?? data.error ?? t("errChat"));
        setError(message);
        console.error(
          `chat-with-data failed for plan ${planId}:`,
          data.detail ?? data.error ?? res.status,
        );
        return;
      }
      const assistantTurn: ChatTurn = {
        id: nextTurnId(),
        role: "assistant",
        content: data.result.answer,
        citations: data.result.citations,
        answered: data.result.answered,
      };
      setTurns((prev) => [...prev, assistantTurn]);
    } catch (err) {
      setError(t("errChatNetwork"));
      console.error(`chat-with-data failed for plan ${planId}:`, err);
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
            <h2 className="text-h3 text-neutral-900">{t("chatTitle")}</h2>
            <p className="mt-1 text-small text-neutral-500">
              {t("chatSubtitle")}
            </p>
          </div>
          {turns.length > 0 && (
            <button
              type="button"
              onClick={handleReset}
              disabled={loading}
              className="shrink-0 rounded-md border border-neutral-200 bg-card px-3 py-1.5 text-caption font-medium text-neutral-700 transition-colors hover:border-neutral-300 hover:bg-neutral-50 disabled:opacity-50"
            >
              {t("chatClear")}
            </button>
          )}
        </div>
      </CardHeader>

      <CardBody>
        {!ready ? (
          <p className="py-4 text-center text-body text-neutral-500">
            {t("chatNotReady")}
          </p>
        ) : (
          <div className="space-y-4">
            {/* Conversation */}
            {turns.length > 0 && (
              <ul className="space-y-3">
                {turns.map((turn) => (
                  <li key={turn.id}>
                    {turn.role === "user" ? (
                      <div className="rounded-md bg-neutral-50 p-3">
                        <div className="mb-1 text-caption font-medium uppercase tracking-wider text-neutral-500">
                          {t("chatQuestion")}
                        </div>
                        <p className="whitespace-pre-wrap text-body text-neutral-900">
                          {turn.content}
                        </p>
                      </div>
                    ) : (
                      <div
                        className={`rounded-md border p-3 ${
                          turn.answered === false
                            ? "border-neutral-200 bg-card"
                            : "border-primary-100 bg-primary-50/40"
                        }`}
                      >
                        <div className="mb-1 text-caption font-medium uppercase tracking-wider text-neutral-500">
                          {t("chatAnswer")}
                        </div>
                        <p
                          className={`whitespace-pre-wrap text-body ${
                            turn.answered === false
                              ? "italic text-neutral-600"
                              : "text-neutral-900"
                          }`}
                        >
                          {turn.content}
                        </p>
                        {turn.citations && turn.citations.length > 0 && (
                          <div className="mt-3 space-y-2">
                            <div className="text-caption font-medium uppercase tracking-wider text-neutral-500">
                              {t("chatEvidence")}
                            </div>
                            <ul className="space-y-2">
                              {turn.citations.map((c, i) => (
                                <li
                                  key={`${turn.id}-cite-${i}`}
                                  className="border-l-2 border-primary-200 pl-3"
                                >
                                  <p className="text-small italic text-neutral-700">
                                    „{c.quote}"
                                  </p>
                                  <p className="mt-0.5 font-mono text-caption text-neutral-400">
                                    {c.interviewId}
                                  </p>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                ))}
                {loading && (
                  <li>
                    <div className="rounded-md border border-primary-100 bg-primary-50/40 p-3">
                      <div className="mb-1 text-caption font-medium uppercase tracking-wider text-neutral-500">
                        Antwort
                      </div>
                      <p className="text-body italic text-neutral-500">
                        {t("chatSearching")}
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
                placeholder={t("chatPlaceholder")}
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
                    {t("chatAnchored")}
                  </span>
                )}
                <button
                  type="submit"
                  disabled={loading || question.trim() === ""}
                  className="shrink-0 rounded-md border border-primary-600 bg-primary-600 px-4 py-2 text-small font-medium text-white transition-colors hover:border-primary-hover hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? t("chatAsking") : t("chatAsk")}
                </button>
              </div>
            </form>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
