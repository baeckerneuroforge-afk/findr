"use client";

import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";

import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Konsoul, type KonsoulState } from "@/components/dashboard/Konsoul";
import type {
  KonsoulResult,
  PortfolioFacts,
  PortfolioStudyFact,
} from "@/lib/schemas/konsoul-agent";

/**
 * Konsoul-Agent — Panel (P2: „ein Gehirn, mehrere Türen"). The AGENTIC sibling of
 * MissionControlPanel: posts to /api/konsoul-agent, where the read-only
 * orchestrator ROUTES the question — it delegates THEME questions verbatim to the
 * unchanged Cross-Study-Agent (no regression), answers BROAD portfolio/status and
 * HELP/how-to from deterministic read-tools + a curated corpus, and refuses
 * honestly otherwise. Multi-turn, session-local (NOT persisted — navigation away
 * clears it; same posture as MissionControlPanel / ResearchAgentPanel).
 *
 * Renders by the unified `kind` discriminator (read FIRST, before any
 * answered-branch — order is load-bearing, see §1 of the contract). Four kinds:
 *  - GROUNDED (kind:'grounded') — answer + per-study citations linking to each
 *    source synthesis. Solid primary border. The ONLY green („belegt") path —
 *    only the delegated Cross-Study (Opus, anchor-filtered) can produce it;
 *  - INTERPRETATION (kind:'interpretation') — a soft cross-study observation the
 *    agent could NOT back with an exact count. A visually DISTINCT, dashed
 *    warning-tinted block. Telling grounded fact from speculation IS the point;
 *  - GUIDANCE (kind:'guidance') — NEW. Help/how-to OR portfolio/status. A CALM,
 *    NEUTRAL card: „beantwortet, nicht belegt". Deliberately un-green — no
 *    success pip, no study-citation look. Optional `data` (PortfolioFacts) is
 *    rendered as a localized fact list NEXT TO the prose (numbers come from the
 *    tool, never the model — the honesty moat); optional `sources` are
 *    corpus-key provenance, never studyIds;
 *  - REFUSAL (kind:'refusal') — answered=false. A calm neutral card, never
 *    error-red (the danger-700 footer is reserved for HTTP/network failures).
 *
 * Mirrors MissionControlPanel's structure + auth/multi-turn/citation-link pattern;
 * the delegated Cross-Study agent itself is unchanged. i18n: crossStudyAgent
 * catalog (du-Form) — the panel hangs on exactly this namespace (`konsoulHi` etc).
 */

/** The unified result envelope (real type from the engine schema on disk). The
 *  panel renders STRICTLY by `result.kind`. */
type AgentResult = KonsoulResult;

interface ChatTurn {
  id: number;
  role: "user" | "assistant";
  /** User turns: the question. Assistant turns: the answer text (sent as history
   *  content for continuity — interpretation/data/sources are display-only). */
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
  /** Prefill seed from the global "Frag Konsoul" lane (Cmd+K → ?q=…). Read-only:
   *  it ONLY seeds the textarea's initial value so the question is ready to send
   *  and Konsoul reacts (listen/greet). It NEVER auto-submits — the user still
   *  presses send. Absent → the panel behaves exactly as before (empty field). */
  initialQuestion?: string;
}

/** Keep each history turn under the route's 4000-char cap. */
const HISTORY_CONTENT_CAP = 3900;

export function CrossStudyAgentPanel({
  studies,
  initialQuestion,
}: CrossStudyAgentPanelProps) {
  const t = useTranslations("crossStudyAgent");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  // Seed once from the prefill at mount. The value flows ONLY into the controlled
  // <textarea value={question}> below — never into dangerouslySetInnerHTML — so
  // there is no injection surface. No fetch is triggered on mount; the user sends.
  const [question, setQuestion] = useState(initialQuestion ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const turnIdRef = useRef(0);
  const questionRef = useRef<HTMLTextAreaElement>(null);

  const ready = studies.length > 0;
  const titleByStudy = new Map(studies.map((s) => [s.studyId, s.studyTitle]));

  // Konsoul-Zustand — 1:1 aus dem Panel-State, kein neuer Datenpfad: loading →
  // recherchiert; sein Name im Feld → winkt (greet); beim Tippen → hört zu;
  // sonst spiegelt die letzte Antwort (belegt / Interpretation / Hilfe /
  // Ablehnung); sonst Ruhe. Der Zustand wird AUSSCHLIESSLICH aus `result.kind`
  // abgeleitet — der `guidance`-Zweig steht VOR allem anderen, damit eine Hilfe-
  // Antwort nie als belegt (grün) oder Ablehnung gerendert wird.
  const lastResult = [...turns]
    .reverse()
    .find((turn) => turn.role === "assistant")?.result;
  const mentionsName = /\bkonsoul\b/i.test(question);
  const konsoulState: KonsoulState = loading
    ? "research"
    : mentionsName
      ? "greet"
      : question.trim() !== ""
        ? "listen"
        : lastResult
          ? lastResult.kind === "guidance"
            ? "guidance"
            : lastResult.kind === "refusal"
              ? "refuse"
              : lastResult.kind === "interpretation"
                ? "hedge"
                : "answer"
          : "idle";

  // Klickbare Einstiegs-Vorschläge (nur im leeren Verlauf). Bei ≥2 Studien wird
  // der erste Vorschlag dynamisch aus echten Studientiteln gebaut.
  const suggestions =
    studies.length >= 2
      ? [
          t("sugCompare", {
            a: titleFor(studies[0].studyId),
            b: titleFor(studies[1].studyId),
          }),
          t("sug1"),
          t("sug3"),
        ]
      : [t("sug1"), t("sug2"), t("sug3")];

  function applySuggestion(text: string) {
    if (loading) return;
    setQuestion(text);
    questionRef.current?.focus();
  }

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
      // P2 — Umhängen auf den Konsoul-Orchestrator. Body/Header/history-Cap/
      // Envelope ({success,result,error,detail}) sind identisch zum Cross-Study,
      // damit Theme-Fragen (delegiert) byte-gleich bleiben. Kein Streaming.
      const res = await fetch("/api/konsoul-agent", {
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
          "konsoul-agent failed:",
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
      console.error("konsoul-agent failed:", err);
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
            <Konsoul
              state={konsoulState}
              greeting={t("konsoulHi")}
              className="hidden sm:block"
            />
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
        {/* P2 §4.3 — kein hartes notReady-Gate mehr: Help/Portfolio brauchen keine
            Synthese, also bleibt das Eingabefeld IMMER aktiv. Ohne Synthese fehlt
            nur das Zitat-Universe (`studies`), darum statt Theme-Vorschlägen ein
            freundlicher „frag mich nach Hilfe/Status"-Hinweis. */}
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
                    {turn.result?.kind === "guidance" ? (
                      <GuidanceBlock
                        result={turn.result}
                        guidanceLabel={t("guidanceLabel")}
                        portfolioLabel={t("portfolioLabel")}
                        studyStatusLabel={t("studyStatusLabel")}
                        sourcesLabel={t("guidanceSourcesLabel")}
                        t={t}
                      />
                    ) : turn.result && turn.result.answered ? (
                      <>
                        <AnswerBlock
                          result={turn.result}
                          answerLabel={t("answerLabel")}
                          sourcesLabel={t("sourcesLabel")}
                          openStudyHint={t("openStudyHint")}
                          titleFor={titleFor}
                        />
                        {turn.result.kind === "interpretation" &&
                          turn.result.interpretation.trim() !== "" && (
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

          {turns.length === 0 &&
            (ready ? (
              <div className="space-y-2">
                <div className="text-caption font-medium uppercase tracking-wider text-neutral-500">
                  {t("suggestTitle")}
                </div>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => applySuggestion(s)}
                      disabled={loading}
                      className="rounded-full border border-neutral-200 bg-card px-3 py-1.5 text-left text-small text-neutral-700 transition-colors hover:border-neutral-300 hover:bg-neutral-50 disabled:opacity-50"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-body text-neutral-500">{t("notReady")}</p>
            ))}

          <form onSubmit={handleSubmit} className="space-y-2">
              <textarea
                ref={questionRef}
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
  /** Grounded OR interpretation — both carry `answer` + per-study `citations`.
   *  Structural type so guidance (no citations) can never be passed here. */
  result: { answer: string; citations: { studyId: string; quote: string }[] };
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
                <p className="italic text-neutral-700">„{citation.quote}&ldquo;</p>
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

/** Translator for the crossStudyAgent catalog — the namespace the panel hangs on. */
type TFn = ReturnType<typeof useTranslations<"crossStudyAgent">>;

/**
 * The GUIDANCE channel (P2) — help/how-to OR portfolio/status. Deliberately the
 * CALM, NEUTRAL twin of AnswerBlock: a plain neutral border, NO green/success,
 * NO dashed-warning, NO studyId-citation optic. „beantwortet, nicht belegt".
 *
 * The honesty moat lives here: any hard number renders from `result.data`
 * (PortfolioFacts) — deterministic tool output — formatted via ICU NEXT TO the
 * prose, so the model can neither invent nor rewrite it. `completedSessions:null`
 * renders „—", never 0, never guessed. `sources` are corpus-key provenance, never
 * studyIds, never clickable.
 */
function GuidanceBlock({
  result,
  guidanceLabel,
  portfolioLabel,
  studyStatusLabel,
  sourcesLabel,
  t,
}: {
  result: { answer: string; sources?: string[]; data?: PortfolioFacts };
  guidanceLabel: string;
  portfolioLabel: string;
  studyStatusLabel: string;
  sourcesLabel: string;
  t: TFn;
}) {
  const data = result.data;
  const factsLabel =
    data?.scope === "study" ? studyStatusLabel : portfolioLabel;

  return (
    <div className="rounded-md border border-neutral-200 bg-neutral-50 p-3">
      <div className="mb-1 flex items-center gap-1.5 text-caption font-medium uppercase tracking-wider text-neutral-500">
        {/* schlichtes „Hinweis"-Glyph, monochrom — kein grüner Haken */}
        <svg
          className="h-3.5 w-3.5 text-neutral-400"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 11v5" strokeLinecap="round" />
          <path d="M12 8h.01" strokeLinecap="round" />
        </svg>
        {guidanceLabel}
      </div>

      <p className="whitespace-pre-wrap text-body text-neutral-900">
        {result.answer}
      </p>

      {/* Deterministischer Fakten-Block NEBEN der Prosa — Zahlen aus dem Tool,
          nie aus dem Modell. */}
      {data && data.studies.length > 0 && (
        <div className="mt-3 space-y-2">
          <div className="text-caption font-medium uppercase tracking-wider text-neutral-500">
            {factsLabel}
          </div>
          <ul className="space-y-2">
            {data.studies.map((study) => (
              <li
                key={study.studyId}
                className="border-l-2 border-neutral-200 pl-3 text-small"
              >
                <p className="font-medium text-neutral-800">{study.title}</p>
                <p className="text-caption text-neutral-500">
                  {formatStudyFacts(study, t)}
                </p>
              </li>
            ))}
          </ul>
          {typeof data.poolSize === "number" && (
            <p className="text-caption text-neutral-500">
              {t("factPoolSize", { count: data.poolSize })}
            </p>
          )}
        </div>
      )}

      {/* Korpus-Herkunft — kleine, nicht-klickbare Quelle (KEINE studyIds). */}
      {result.sources && result.sources.length > 0 && (
        <p className="mt-3 text-caption text-neutral-400">
          {sourcesLabel}: {result.sources.join(", ")}
        </p>
      )}
    </div>
  );
}

/** Localized, comma-joined fact line for one study row. Each number is verbatim
 *  from the tool-computed PortfolioStudyFact — null completedSessions → „—". */
function formatStudyFacts(study: PortfolioStudyFact, t: TFn): string {
  const parts: string[] = [];

  parts.push(
    study.completedSessions === null
      ? t("factCompletedUnknown")
      : t("factCompleted", { count: study.completedSessions }),
  );

  parts.push(study.hasSynthesis ? t("factSynthesis") : t("factNoSynthesis"));

  if (
    typeof study.newInterviewsSince === "number" &&
    study.newInterviewsSince > 0
  ) {
    parts.push(t("factNewSince", { count: study.newInterviewsSince }));
  }

  return parts.join(" · ");
}
