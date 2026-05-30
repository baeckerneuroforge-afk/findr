"use client";

import { useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";

import { Card, CardBody, CardHeader } from "@/components/ui/Card";

/**
 * Research-Agent — Deliverable-Panel auf der Synthese-Seite (Etappe 2).
 *
 * Posts to /api/research/plans/[id]/agent. The researcher gives a free-text
 * instruction and the agent builds a STRUCTURED deliverable (summary /
 * breakdown / theme-ranking / custom) grounded STRICTLY in the study synthesis.
 * Multi-turn: each turn carries the full conversation as `history` so a
 * follow-up ("mach das kürzer", "jetzt nach Segment") has continuity. Local
 * state only — the thread is NOT persisted (navigation away clears it;
 * persistence is a later Etappe).
 *
 * Anti-hallucination is enforced SERVER-SIDE and on EVERY turn: the engine
 * re-checks each deliverable item against the FRESH synthesis (never the
 * conversation history) and drops unanchored items; a deliverable whose items
 * are all dropped is downgraded to fulfilled=false. This panel renders that
 * honest refusal as a VISIBLE, distinctly-styled turn — never swallowed, never
 * shown as an error (the red error footer is reserved for HTTP/network
 * failures). KI-Inhalte/Zitate bleiben Quellsprache.
 *
 * Stil mirrors ChatWithDataPanel — same neutral border, primary CTA,
 * danger-700 for errors. i18n: deutsch (du-Form).
 */

interface DeliverableItem {
  heading: string;
  text: string;
  /** Verbatim theme titles / tension descriptions this item is grounded in. */
  themeRefs: string[];
  /** Verbatim source-language quotes. */
  quotes: string[];
}

interface AgentResult {
  fulfilled: boolean;
  deliverableType: "summary" | "breakdown" | "theme_ranking" | "custom";
  title: string;
  items: DeliverableItem[];
  /** Honest 1-sentence note — meaningful when fulfilled=false. */
  note: string;
}

interface AgentTurn {
  /** Stable order in the message list — never reset within a session. */
  id: number;
  role: "user" | "assistant";
  /** User turns: the instruction. Assistant turns: a text rendering of the
   *  deliverable, sent verbatim as the `content` of this turn in the history
   *  payload (so the model has continuity). */
  content: string;
  /** Assistant only — the structured deliverable to render. */
  result?: AgentResult;
}

interface ResearchAgentPanelProps {
  planId: string;
  /** When false, the panel is disabled — the page passes "synthesis row exists
   *  with synthesized_at set" (same gate as the export / chat / share
   *  surfaces). The engine short-circuits an empty synthesis server-side, but
   *  gating client-side saves a round trip + makes the empty state visible. */
  ready: boolean;
}

/** Keep each history turn under the route's 4000-char cap. A long deliverable
 *  rendered to text could exceed it; we truncate the CONTEXT copy (the model
 *  only needs the gist of the prior turn for continuity — the authoritative
 *  evidence is always the synthesis in `system`). */
const HISTORY_CONTENT_CAP = 3900;

function deliverableToHistoryContent(result: AgentResult): string {
  if (!result.fulfilled) {
    const note = result.note.trim();
    return (note === "" ? "—" : note).slice(0, HISTORY_CONTENT_CAP);
  }
  const lines: string[] = [];
  if (result.title.trim() !== "") lines.push(result.title.trim());
  for (const item of result.items) {
    const head = item.heading.trim() !== "" ? `${item.heading.trim()}: ` : "";
    lines.push(`- ${head}${item.text.trim()}`);
  }
  const joined = lines.join("\n").trim();
  return (joined === "" ? "—" : joined).slice(0, HISTORY_CONTENT_CAP);
}

export function ResearchAgentPanel({ planId, ready }: ResearchAgentPanelProps) {
  const t = useTranslations("researchAgent");
  const [turns, setTurns] = useState<AgentTurn[]>([]);
  const [instruction, setInstruction] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const turnIdRef = useRef(0);

  function nextTurnId(): number {
    turnIdRef.current += 1;
    return turnIdRef.current;
  }

  function typeLabel(type: AgentResult["deliverableType"]): string {
    switch (type) {
      case "summary":
        return t("types.summary");
      case "breakdown":
        return t("types.breakdown");
      case "theme_ranking":
        return t("types.theme_ranking");
      default:
        return t("types.custom");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = instruction.trim();
    if (!trimmed || loading) return;

    setError(null);
    const userTurn: AgentTurn = {
      id: nextTurnId(),
      role: "user",
      content: trimmed,
    };
    setTurns((prev) => [...prev, userTurn]);
    setInstruction("");
    setLoading(true);

    // The API treats `instruction` as the current turn and `history` as
    // everything before it. We send the prior turns (their `content` strings)
    // as history and `trimmed` as the instruction.
    const historyPayload = turns.map((turn) => ({
      role: turn.role,
      content: turn.content,
    }));

    try {
      const res = await fetch(
        `/api/research/plans/${encodeURIComponent(planId)}/agent`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            instruction: trimmed,
            history: historyPayload,
          }),
        },
      );
      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        result?: AgentResult;
        error?: string;
        detail?: string;
      };
      if (!res.ok || !data.success || !data.result) {
        const message =
          res.status === 404
            ? t("errPlanNotFound")
            : res.status === 401 || res.status === 403
              ? t("errNoAccess")
              : res.status === 400
                ? (data.error ?? t("errInvalidRequest"))
                : (data.error ?? t("errEngine"));
        setError(message);
        console.error(
          `research-agent failed for plan ${planId}:`,
          data.detail ?? data.error ?? res.status,
        );
        return;
      }
      const result = data.result;
      const assistantTurn: AgentTurn = {
        id: nextTurnId(),
        role: "assistant",
        content: deliverableToHistoryContent(result),
        result,
      };
      setTurns((prev) => [...prev, assistantTurn]);
    } catch (err) {
      setError(t("errNetwork"));
      console.error(`research-agent failed for plan ${planId}:`, err);
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
                          {t("instructionLabel")}
                        </div>
                        <p className="whitespace-pre-wrap text-body text-neutral-900">
                          {turn.content}
                        </p>
                      </div>
                    </li>
                  ) : (
                    <li key={turn.id}>
                      {turn.result && turn.result.fulfilled ? (
                        <DeliverableBlock
                          result={turn.result}
                          deliverableLabel={t("deliverableLabel")}
                          evidenceLabel={t("evidenceLabel")}
                          groundingLabel={t("groundingLabel")}
                          typeLabel={typeLabel(turn.result.deliverableType)}
                        />
                      ) : (
                        <RefusalBlock
                          note={turn.result?.note ?? ""}
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
                        {t("deliverableLabel")}
                      </div>
                      <p className="text-body italic text-neutral-500">
                        {t("thinking")}
                      </p>
                    </div>
                  </li>
                )}
              </ul>
            )}

            {/* Instruction input */}
            <form onSubmit={handleSubmit} className="space-y-2">
              <textarea
                value={instruction}
                onChange={(e) => setInstruction(e.target.value)}
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
                  disabled={loading || instruction.trim() === ""}
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

/** A fulfilled deliverable — title + a type badge + the anchored items. Each
 *  item shows its prose and, when present, its verbatim quotes (evidence) and
 *  the findings it is grounded in (theme/tension refs). */
function DeliverableBlock({
  result,
  deliverableLabel,
  evidenceLabel,
  groundingLabel,
  typeLabel,
}: {
  result: AgentResult;
  deliverableLabel: string;
  evidenceLabel: string;
  groundingLabel: string;
  typeLabel: string;
}) {
  return (
    <div className="rounded-md border border-primary-100 bg-primary-50/40 p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="text-caption font-medium uppercase tracking-wider text-neutral-500">
          {deliverableLabel}
        </div>
        <span className="shrink-0 rounded-full border border-primary-200 bg-white px-2 py-0.5 text-caption font-medium text-primary-700">
          {typeLabel}
        </span>
      </div>
      {result.title.trim() !== "" && (
        <p className="mb-3 text-body-strong text-neutral-900">{result.title}</p>
      )}
      <ul className="space-y-3">
        {result.items.map((item, i) => (
          <li
            key={i}
            className="rounded-md border border-neutral-200 bg-white p-3"
          >
            {item.heading.trim() !== "" && (
              <p className="text-body-strong text-neutral-900">
                {item.heading}
              </p>
            )}
            <p className="whitespace-pre-wrap text-body text-neutral-700">
              {item.text}
            </p>
            {item.quotes.length > 0 && (
              <div className="mt-3 space-y-2">
                <div className="text-caption font-medium uppercase tracking-wider text-neutral-500">
                  {evidenceLabel}
                </div>
                <ul className="space-y-2">
                  {item.quotes.map((quote, qi) => (
                    <li
                      key={qi}
                      className="border-l-2 border-primary-200 pl-3 text-small italic text-neutral-700"
                    >
                      „{quote}"
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {item.themeRefs.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                <span className="text-caption font-medium uppercase tracking-wider text-neutral-400">
                  {groundingLabel}
                </span>
                {item.themeRefs.map((ref, ri) => (
                  <span
                    key={ri}
                    className="rounded-md bg-neutral-100 px-2 py-0.5 text-caption text-neutral-600"
                  >
                    {ref}
                  </span>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The honest refusal — fulfilled=false. Rendered as a visible, neutral/muted
 *  turn (NOT an error), so the researcher SEES when the agent deliberately
 *  declines because the synthesis can't support the instruction. */
function RefusalBlock({
  note,
  refusalLabel,
}: {
  note: string;
  refusalLabel: string;
}) {
  return (
    <div className="rounded-md border border-neutral-200 bg-white p-3">
      <div className="mb-1 text-caption font-medium uppercase tracking-wider text-neutral-500">
        {refusalLabel}
      </div>
      <p className="whitespace-pre-wrap text-body italic text-neutral-600">
        {note}
      </p>
    </div>
  );
}
