"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { useTranslations, useLocale } from "next-intl";

import { formatActivationDateTime } from "@/lib/scheduler/datetime";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Konsoul, type KonsoulState } from "@/components/dashboard/Konsoul";
import { KONSOUL_ACTIONS_ENABLED } from "@/lib/konsoul/actions-flag";
import { isKonsoulP5Enabled } from "@/lib/konsoul/p5-flag";
import { hydrateThreadTurns } from "@/lib/konsoul/render-helpers";
import type {
  KonsoulResult,
  KonsoulProposalResult,
  KonsoulProposalActionType,
  KonsoulFacts,
  CalendarStudyFact,
  PortfolioStudyFact,
} from "@/lib/schemas/konsoul-agent";

/**
 * P3.1 — der `kind:'proposal'`-Envelope (Design-Doc §4). Konsoul SCHLÄGT VOR — der
 * Mensch entscheidet per Klick. Das Modell liefert nur Argumente; die ENGINE baut
 * diesen Block deterministisch (terminal, keine Ausführung). Die Ausführung lebt
 * AUSSCHLIESSLICH im Confirm-Klick unten, der eine BESTEHENDE org-scoped Route ruft
 * — NIE /api/konsoul-agent.
 *
 * SEAM (erledigt): Der Schema-Owner (`src/lib/schemas/konsoul-agent.ts`) hat den
 * `kind:'proposal'`-Zweig in die `KonsoulResult`-discriminatedUnion aufgenommen.
 * Der frühere frontend-lokale Spiegel ist daher durch den Import aus dem Schema
 * ersetzt (verbindlicher Vertrag): Die Modell-Prosa fürs UI heißt `rationale`
 * (NIE persistiert — das Audit trägt kein Freitext-Feld); `precondition` trägt
 * tool-deterministische Zahlen/Flags aus `acc.data` (completedSessions,
 * hasSynthesis, hasPersonas, basedOnCount), nie modell-erfunden.
 */

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
 *  panel renders STRICTLY by `result.kind`. KonsoulResult ALREADY carries the
 *  additive P3.1 `kind:'proposal'` branch (the schema-owner folded it into the
 *  discriminatedUnion); the four P2 kinds stay byte-identical. */
type AgentResult = KonsoulResult;

// ── P3.1 Aktions-Allowlist (Whitelist statt Blacklist, fail-closed) ──────────
//
// Die GENAU VIER erlaubten Aktionen → ihr BESTEHENDER org-scoped Ziel-Endpunkt.
// Der Confirm-Klick ruft AUSSCHLIESSLICH eine dieser Routen — NIE /api/konsoul-
// agent, NIE das Modell. Jede Route zieht orgId selbst via requireOrgIdOrError()
// aus der Session; der Body trägt NIE orgId/status. Ein actionType außerhalb
// dieser Map (halluziniert) findet keinen Endpunkt → kein Request, kein Confirm.
//
// VERBOTEN und bewusst NICHT in der Map (existieren als Tool nicht): publish/
// Prolific, invites, invite-from-pool, open-link, panel/*, screening-questions,
// quotas, participants, stimuli, share, chat.
const ACTION_ENDPOINT: Record<
  KonsoulProposalActionType,
  (planId?: string) => string | null
> = {
  // Reiner INSERT, Status=draft per DB-Default. Kein planId.
  create_study_draft: () => "/api/research/plans",
  // upsert onConflict org_id,plan_id → Re-Run ersetzt die Synthese (destructive).
  run_synthesis: (planId) =>
    planId ? `/api/research/plans/${encodeURIComponent(planId)}/synthesis` : null,
  // upsert onConflict → Re-Run ersetzt die Personas (destructive).
  run_personas: (planId) =>
    planId ? `/api/research/plans/${encodeURIComponent(planId)}/personas` : null,
  // Überschreibt topic_script wholesale (destructive wenn befüllt).
  run_guide: (planId) =>
    planId ? `/api/research/plans/${encodeURIComponent(planId)}/guide` : null,
  // Kalender-Terminierung: KEIN direkter POST. Der Confirm NAVIGIERT zum Kalender-
  // Picker (Deep-Link ?schedule=<id>), wo der Mensch die Zeit wählt und die
  // bestehende /schedule-Route läuft. Endpoint=null → execute() nimmt den
  // Navigations-Pfad (siehe ProposalBlock), nie diesen Map-Eintrag.
  schedule_activation: () => null,
};

/** Lokaler Confirm-Status einer einzelnen Proposal-Karte. */
type ProposalPhase =
  | "idle" // zeigt Bestätigen/Verwerfen
  | "arming" // destructive: nach 1. Klick, wartet auf bewusste 2. Bestätigung
  | "running" // Ziel-Endpunkt läuft
  | "done" // erfolgreich ausgeführt
  | "dismissed" // verworfen (logDecision 'ignored')
  | "error"; // Ziel-Endpunkt schlug fehl

/**
 * P3.1 — logDecision: schreibt den Vorschlags-AUSGANG (accepted/ignored) ins
 * org-scoped Audit (`konsoul_action_log`, Design-Doc §3). FAIL-OPEN gegen den
 * Hauptpfad: ein fehlendes/fehlerndes Decision-Audit darf einen erfolgreichen
 * Confirm NIE kippen und keinen Dismiss blockieren — exakt die Posture des
 * server-seitigen Audit-Writers (action-audit.ts). Der Body trägt NIE orgId
 * (die Decision-Route zieht sie server-seitig); nur den Aktionstyp + planId als
 * Metadaten, plus den Status. Schlägt der Beacon fehl, wird still geloggt.
 *
 * Die Decision-Route (POST /api/konsoul-agent/decision) zieht orgId server-seitig
 * (requireOrgIdOrError) und setzt GENAU die proposed-Zeile mit `auditId` auf
 * accepted/ignored. Der Body trägt NIE orgId — nur die auditId (aus dem Proposal-
 * Envelope) + den Status. Fehlt die auditId (proposed-Schreibung schlug fail-open
 * fehl), gibt es nichts zu setzen → No-op. `keepalive`, damit ein Dismiss kurz vor
 * Navigation noch durchgeht.
 */
function logDecision(
  status: "accepted" | "ignored",
  auditId: string | null,
): void {
  if (!auditId) return; // kein proposed-Datensatz → nichts zu aktualisieren (fail-open).
  try {
    void fetch("/api/konsoul-agent/decision", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, auditId }),
      keepalive: true,
    }).catch((err) => {
      console.error("[konsoul] logDecision beacon failed:", err);
    });
  } catch (err) {
    console.error("[konsoul] logDecision threw:", err);
  }
}

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
  /** P5 (flag-gated): the id of a restored persisted thread, so new turns UPDATE
   *  it instead of creating a duplicate. Undefined → a fresh thread is created on
   *  the first persisted turn. */
  initialThreadId?: string;
  /** P5 (flag-gated): a restored conversation's {role, content} turns. Hydrated
   *  into the view; assistant turns render NEUTRALLY (a replayed answer is never
   *  re-grounded — no green pip, no stale citations — the honesty contract). */
  initialTurns?: { role: "user" | "assistant"; content: string }[];
  /** Kalender-Drawer: wird VOR dem schedule_activation-Confirm-Navigieren
   *  (router.push zum Picker) gerufen, damit der Drawer sich schließt und der
   *  Picker nicht hinter zwei Scrims auftaucht. Andere Türen (⌘K/insights) lassen
   *  es weg. */
  onScheduleNavigate?: () => void;
}

/** Keep each history turn under the route's 4000-char cap. */
const HISTORY_CONTENT_CAP = 3900;

export function CrossStudyAgentPanel({
  studies,
  initialQuestion,
  initialThreadId,
  initialTurns,
  onScheduleNavigate,
}: CrossStudyAgentPanelProps) {
  const t = useTranslations("crossStudyAgent");
  const p5 = isKonsoulP5Enabled();
  const [turns, setTurns] = useState<ChatTurn[]>(() =>
    hydrateThreadTurns(initialTurns),
  );
  const threadIdRef = useRef<string | null>(initialThreadId ?? null);
  // Seed once from the prefill at mount. The value flows ONLY into the controlled
  // <textarea value={question}> below — never into dangerouslySetInnerHTML — so
  // there is no injection surface. No fetch is triggered on mount; the user sends.
  const [question, setQuestion] = useState(initialQuestion ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Start after the hydrated turns so new ids never collide with restored keys.
  const turnIdRef = useRef(initialTurns?.length ?? 0);
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
          ? lastResult.kind === "proposal"
            ? "propose"
            : lastResult.kind === "guidance"
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

  // P5 (flag-gated): persist the conversation org-side so it survives a reload.
  // Sends ONLY {role, content} text (no citations/result — re-grounded fresh on
  // continue). Best-effort + fire-and-forget: a failed save never affects the
  // answer; orgId is server-authoritative on the route. Captures the returned
  // threadId so subsequent turns UPDATE the same thread.
  function persistThread(allTurns: ChatTurn[]): void {
    if (!p5) return;
    const payload = allTurns.map((tn) => ({
      role: tn.role,
      content: tn.content,
    }));
    // NO keepalive: this runs right after the answer renders while the page is
    // fully alive, so keepalive buys nothing — and its 64 KiB body cap would
    // SILENTLY drop the save for long (most valuable) conversations.
    void fetch("/api/konsoul-agent/threads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        threadId: threadIdRef.current ?? undefined,
        turns: payload,
      }),
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { threadId?: string | null } | null) => {
        if (d && typeof d.threadId === "string") threadIdRef.current = d.threadId;
      })
      .catch((err) => {
        console.error("[konsoul] persistThread failed:", err);
      });
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
      // Continuity content = the grounded answer text (refusal text when
      // answered=false). A proposal carries `rationale` (UI prose) instead of
      // `answer` — thread that so the multi-turn history stays coherent. The
      // interpretation is NOT threaded — it is soft.
      const continuity =
        result.kind === "proposal" ? result.rationale : result.answer;
      const assistantTurn: ChatTurn = {
        id: nextTurnId(),
        role: "assistant",
        content: (continuity.trim() === "" ? "—" : continuity.trim()).slice(
          0,
          HISTORY_CONTENT_CAP,
        ),
        result,
      };
      setTurns((prev) => [...prev, assistantTurn]);
      // P5 (flag-gated): persist the full conversation (prior turns + this
      // exchange). `turns` here is the pre-submit closure, so the complete set is
      // [...turns, userTurn, assistantTurn].
      persistThread([...turns, userTurn, assistantTurn]);
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
    // P5: a fresh conversation = a fresh thread; the next persisted turn creates
    // a new row instead of overwriting the prior thread.
    threadIdRef.current = null;
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
                    {turn.result?.kind === "proposal" ? (
                      // P3.1 — die fünfte Tür. Steht VOR guidance/answered (Order
                      // load-bearing), damit ein Vorschlag nie als belegt/Hilfe
                      // gerendert wird. Nur sichtbar, wenn das Flag scharf ist;
                      // andernfalls liefert die Engine diesen kind nie.
                      KONSOUL_ACTIONS_ENABLED ? (
                        <ProposalBlock
                          result={turn.result}
                          titleFor={titleFor}
                          t={t}
                          onScheduleNavigate={onScheduleNavigate}
                        />
                      ) : (
                        // Flag AUS, aber ein proposal kam (sollte nie passieren):
                        // ehrlich-ruhig wie eine Refusal rendern, NIE ausführbar.
                        // Ein proposal trägt `rationale` (UI-Prosa), kein `answer`.
                        <RefusalBlock
                          answer={turn.result.rationale}
                          refusalLabel={t("refusalLabel")}
                        />
                      )
                    ) : turn.result?.kind === "guidance" ? (
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
 * P3.1 — der ProposalBlock (Design-Doc §2 / §4, fünfte Tür). Konsoul SCHLÄGT VOR,
 * der Mensch ENTSCHEIDET per Klick. Dieser Block ist die EINZIGE Stelle, die eine
 * echte Aktion auslöst — und nur durch einen bewussten Klick (KEIN Auto-Submit).
 *
 * Sicherheits-Eigenschaften (alle im Klick-Handler durchgesetzt):
 *  - Der Klick ruft AUSSCHLIESSLICH den bestehenden org-scoped Ziel-Endpunkt aus
 *    ACTION_ENDPOINT (Allowlist, fail-closed) — NIE /api/konsoul-agent, nie das
 *    Modell. Ein actionType ohne Endpunkt → kein Request.
 *  - Der Body trägt NIE orgId/status — die Ziel-Route zieht orgId server-seitig
 *    via requireOrgIdOrError() und prüft Plan-Eigentum (getResearchPlan).
 *  - destructive (Re-Run Synthese/Personas, oder Guide auf befülltem topic_script)
 *    bekommt das STARKE, 2-stufige „überschreibt"-Gate (Vorbild deleteResearchPlan):
 *    erst „arming", dann ein bewusster zweiter Klick.
 *  - costsModel (Opus-Aktionen guide/synthesis/personas) zeigt einen Kosten-Hinweis.
 *  - Nach Erfolg: logDecision('accepted'); beim Verwerfen: logDecision('ignored')
 *    (fail-open Audit-Beacon, kippt den Hauptpfad nie).
 *
 * Visuell eigenständig wie Guidance/Interpretation je ein eigenes Gewand: ein
 * ruhiger, primär gerahmter Vorschlag — NICHT das grüne „belegt"-Gewand (ein
 * Vorschlag ist nicht belegt, sondern eine Handlungs-Einladung). Erst der
 * destructive-Pfad färbt warnend (danger), analog zum Lösch-Gate.
 */
function ProposalBlock({
  result,
  titleFor,
  t,
  onScheduleNavigate,
}: {
  result: KonsoulProposalResult;
  titleFor: (studyId: string) => string;
  t: TFn;
  onScheduleNavigate?: () => void;
}) {
  const { proposal } = result;
  const router = useRouter();
  const [phase, setPhase] = useState<ProposalPhase>("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const planId = proposal.targetStudyId ?? null;
  const isSchedule = proposal.actionType === "schedule_activation";
  const destructive = proposal.destructive === true;
  const costsModel = proposal.costsModel === true;

  // Erledigt-Ziel: bei Terminierung der Kalender (Picker), sonst die Synthese-
  // Route, auf die auch die Zitate zeigen.
  const doneHref = isSchedule
    ? planId
      ? `/dashboard/kalender?schedule=${encodeURIComponent(planId)}`
      : "/dashboard/kalender"
    : planId
      ? `/dashboard/research-plans/${encodeURIComponent(planId)}/synthesis`
      : "/dashboard/market-research";

  /** Baut den minimalen, orgId-freien Body für die jeweilige Ziel-Route. */
  function bodyFor(): Record<string, unknown> {
    switch (proposal.actionType) {
      case "create_study_draft": {
        // POST /api/research/plans erwartet title + objective (Pflichtfelder, je
        // server-re-validiert min 3). objective = die rationale-Prosa (Engine
        // garantiert sie nicht-leer). Status=draft setzt der DB-Default.
        // studyType MUSS 'market_research' sein, damit Konsouls Entwurf in seinem
        // eigenen Scope (Market-Research-Übersicht) landet — ohne das Feld greift
        // im Schema der Default 'product_discovery' und der Entwurf taucht im
        // MR-Bereich nicht auf. createResearchPlan stempelt dann study_type
        // (sonst bleibt der Insert-Key weg → DB-DEFAULT). Keine weiteren Pflichtfelder.
        //
        // Titel-Fallback: studyTitle ist im Tool OPTIONAL → das Modell kann einen
        // titellosen Vorschlag bauen. Ein leerer/zu kurzer Titel (<3) würde die
        // title-Validierung 400en. Darum ein sicherer, lokalisierter Ersatztitel,
        // damit der bestätigte Entwurf nie daran scheitert (umbenennbar).
        const draftTitle = (proposal.targetTitle ?? "").trim();
        return {
          title: draftTitle.length >= 3 ? draftTitle : t("untitledStudy"),
          objective: result.rationale,
          studyType: "market_research" as const,
        };
      }
      case "run_guide":
        // POST /…/guide erwartet { goal } (min 3). studyId steckt im Pfad, nie
        // im Body. Der Vorschlag trägt kein separates Ziel-Feld → die rationale-
        // Prosa dient als Forschungsziel (server-re-validiert).
        return { goal: result.rationale };
      case "run_synthesis":
      case "run_personas":
        // Leerer Body — die Route arbeitet rein aus (orgId, planId-im-Pfad).
        return {};
      case "schedule_activation":
        // Unerreichbar: schedule_activation postet nicht, es navigiert zum Picker
        // (execute() short-circuited davor). Nur für die switch-Vollständigkeit.
        return {};
    }
  }

  /** Der eine echte Auslöser. Ruft NUR den Allowlist-Endpunkt, loggt den Ausgang. */
  async function execute() {
    // Kalender-Terminierung: KEIN POST. Wir öffnen den BESTEHENDEN Termin-Picker
    // (Deep-Link), der Mensch wählt die Zeit, die bestehende /schedule-Route läuft.
    // Der Confirm-Klick ist die „Annahme" des Vorschlags → Audit 'accepted'. Das
    // tatsächliche Schreiben passiert im Picker, nie hier (kein Versand, kein
    // /activate). Ohne planId (sollte nie) fail-closed.
    if (isSchedule) {
      if (!planId) {
        setErrorMsg(t("proposalErrInvalid"));
        setPhase("error");
        return;
      }
      logDecision("accepted", result.auditId ?? null);
      setPhase("done");
      // Drawer schließen (falls aus dem Kalender-Drawer), BEVOR wir zum Picker
      // navigieren — sonst öffnet der Picker hinter dem noch offenen Drawer.
      onScheduleNavigate?.();
      router.push(
        `/dashboard/kalender?schedule=${encodeURIComponent(planId)}`,
      );
      return;
    }
    const endpoint = ACTION_ENDPOINT[proposal.actionType](planId ?? undefined);
    if (!endpoint) {
      // Halluzinierter/fehlender Pfad (z. B. Re-Run ohne planId) → fail-closed,
      // kein Request. Sollte nie eintreten (Engine validiert), aber hart gegated.
      setErrorMsg(t("proposalErrInvalid"));
      setPhase("error");
      return;
    }
    setErrorMsg(null);
    setPhase("running");
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyFor()),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setErrorMsg(
          res.status === 401 || res.status === 403
            ? t("errNoAccess")
            : (data.error ?? t("proposalErrRun")),
        );
        setPhase("error");
        console.error("[konsoul] proposal execute failed:", res.status);
        return;
      }
      // Erfolg → Audit 'accepted' (fail-open) und ruhiger Erledigt-Zustand.
      logDecision("accepted", result.auditId ?? null);
      setPhase("done");
    } catch (err) {
      setErrorMsg(t("errNetwork"));
      setPhase("error");
      console.error("[konsoul] proposal execute threw:", err);
    }
  }

  /** Bestätigen-Klick. Bei destructive: erst „arming" (2-stufiges Gate), dann run. */
  function onConfirm() {
    if (destructive && phase === "idle") {
      setPhase("arming");
      return;
    }
    void execute();
  }

  /** Verwerfen → Audit 'ignored' (fail-open), Karte ruht. Kein Endpunkt-Call. */
  function onDismiss() {
    logDecision("ignored", result.auditId ?? null);
    setPhase("dismissed");
  }

  const actionLabel = t(`proposalAction.${proposal.actionType}`);
  // Terminierung/Entwurf tragen den Titel im Proposal (ein Entwurf steht evtl.
  // nicht im Synthese-Universe von titleFor) — den bevorzugen; run_* nutzen
  // titleFor(planId) wie bisher (sie setzen kein targetTitle).
  const targetName =
    proposal.targetTitle ??
    (planId ? titleFor(planId) : t("untitledStudy"));

  // ── Terminale Zustände ─────────────────────────────────────────────────────
  if (phase === "done") {
    return (
      <div className="rounded-md border border-success-500/40 bg-success-50/50 p-3">
        <div className="mb-1 text-caption font-medium uppercase tracking-wider text-success-700">
          {t("proposalDoneLabel")}
        </div>
        <p className="text-body text-neutral-900">
          {t("proposalDone", { action: actionLabel })}
        </p>
        <Link
          href={doneHref}
          className="mt-2 inline-flex items-center gap-1 text-caption font-medium text-primary-700 transition-colors hover:text-primary-800 hover:underline"
        >
          {t("proposalDoneLink")}
          <span aria-hidden="true">→</span>
        </Link>
      </div>
    );
  }

  if (phase === "dismissed") {
    return (
      <div className="rounded-md border border-neutral-200 bg-card p-3">
        <p className="text-small italic text-neutral-500">
          {t("proposalDismissed")}
        </p>
      </div>
    );
  }

  // ── Aktive Karte (idle / arming / running / error) ──────────────────────────
  const armed = phase === "arming";
  const running = phase === "running";

  return (
    <div
      className={`rounded-md border p-3 ${
        destructive
          ? "border-danger-500/40 bg-danger-50/40"
          : "border-primary-100 bg-primary-50/40"
      }`}
    >
      <div
        className={`mb-1 flex items-center gap-1.5 text-caption font-medium uppercase tracking-wider ${
          destructive ? "text-danger-700" : "text-primary-700"
        }`}
      >
        {/* schlichtes Handlungs-Glyph (Pfeil-in-Kreis), monochrom je nach Ton */}
        <svg
          className="h-3.5 w-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M9 12h6M13 9l3 3-3 3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {t("proposalLabel")}
      </div>

      {/* Modell-Prosa (rationale): warum diese Aktion jetzt sinnvoll ist. */}
      <p className="whitespace-pre-wrap text-body text-neutral-900">
        {result.rationale}
      </p>

      {/* Was genau passiert — Aktion + Zielstudie, deterministisch. */}
      <p className="mt-2 text-small text-neutral-700">
        {t("proposalSummary", { action: actionLabel, study: targetName })}
      </p>

      {/* Kosten-Hinweis für Opus-Aktionen (verhindert versehentliche teure Re-Runs). */}
      {costsModel && (
        <p className="mt-2 flex items-start gap-1.5 text-caption text-neutral-500">
          <span aria-hidden="true">≈</span>
          {t("proposalCostHint")}
        </p>
      )}

      {/* STARKE Überschreib-Warnung (destructive) — Vorbild 2-stufiges Lösch-Gate.
          Ehrliche Metadaten (Datum/based_on_count) aus precondition, nie Prosa. */}
      {destructive && (
        <div className="mt-2 rounded-md border border-danger-500/40 bg-danger-50 p-2.5">
          <p className="text-small font-medium text-danger-700">
            {proposal.actionType === "run_guide"
              ? t("proposalOverwriteGuide")
              : proposal.actionType === "run_personas"
                ? t("proposalOverwritePersonas", {
                    count: proposal.precondition?.basedOnCount ?? 0,
                  })
                : t("proposalOverwriteSynthesis", {
                    count: proposal.precondition?.basedOnCount ?? 0,
                  })}
          </p>
        </div>
      )}

      {/* Fehler — derselbe danger-700-Kanal wie der Panel-Footer. */}
      {phase === "error" && errorMsg && (
        <p className="mt-2 text-caption text-danger-700">{errorMsg}</p>
      )}

      {/* Aktionen. „Bestätigen" ist der EINZIGE Auslöser; „Verwerfen" unauffällig.
          Bei destructive verlangt der 1. Klick eine bewusste 2. Bestätigung. */}
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={onConfirm}
          disabled={running}
          className={`shrink-0 rounded-md px-4 py-2 text-small font-medium text-white transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
            destructive
              ? "border border-danger-700 bg-danger-700 hover:opacity-90"
              : "border border-primary-600 bg-primary-600 hover:border-primary-hover hover:bg-primary-hover"
          }`}
        >
          {running
            ? t("proposalRunning")
            : armed
              ? t("proposalConfirmFinal")
              : destructive
                ? t("proposalConfirmDestructive")
                : t("proposalConfirm")}
        </button>
        <button
          type="button"
          onClick={onDismiss}
          disabled={running}
          className="rounded-md border border-neutral-200 bg-card px-3 py-2 text-small font-medium text-neutral-600 transition-colors hover:border-neutral-300 hover:bg-neutral-50 disabled:opacity-50"
        >
          {armed ? t("proposalCancelArm") : t("proposalDismiss")}
        </button>
      </div>
    </div>
  );
}

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
  result: { answer: string; sources?: string[]; data?: KonsoulFacts };
  guidanceLabel: string;
  portfolioLabel: string;
  studyStatusLabel: string;
  sourcesLabel: string;
  t: TFn;
}) {
  const locale = useLocale();
  const data = result.data;
  const isCalendar = data?.scope === "calendar";
  const factsLabel = isCalendar
    ? t("calendarLabel")
    : data?.scope === "study"
      ? studyStatusLabel
      : portfolioLabel;

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
            {data.scope === "calendar"
              ? data.studies.map((study) => (
                  <li
                    key={study.studyId}
                    className="border-l-2 border-neutral-200 pl-3 text-small"
                  >
                    <p className="font-medium text-neutral-800">
                      {study.title}
                    </p>
                    <p className="text-caption text-neutral-500">
                      {formatCalendarStudyFacts(study, t, locale)}
                    </p>
                  </li>
                ))
              : data.studies.map((study) => (
                  <li
                    key={study.studyId}
                    className="border-l-2 border-neutral-200 pl-3 text-small"
                  >
                    <p className="font-medium text-neutral-800">
                      {study.title}
                    </p>
                    <p className="text-caption text-neutral-500">
                      {formatStudyFacts(study, t)}
                    </p>
                  </li>
                ))}
          </ul>
          {data.scope === "calendar" ? (
            <p className="text-caption text-neutral-500">
              {t("factCalCounts", {
                unscheduled: data.unscheduledDrafts,
                scheduled: data.scheduledCount,
                overdue: data.overdueCount,
              })}
            </p>
          ) : (
            typeof data.poolSize === "number" && (
              <p className="text-caption text-neutral-500">
                {t("factPoolSize", { count: data.poolSize })}
              </p>
            )
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

/** Localized fact line for one CALENDAR study row: activation state (+ scheduled
 *  date if any). Each value is verbatim from the tool — never model-invented. The
 *  date uses the SAME Europe/Berlin display zone (formatActivationDateTime) as the
 *  calendar grid, the „Demnächst"-Liste and the activation email — so Konsoul never
 *  shows a different wall-clock time than the product it summarizes. */
function formatCalendarStudyFacts(
  study: CalendarStudyFact,
  t: TFn,
  locale: string,
): string {
  const parts: string[] = [t("factCalState", { state: study.activationState })];
  if (study.scheduledActivationAt) {
    parts.push(
      t("factCalScheduledAt", {
        date: formatActivationDateTime(study.scheduledActivationAt, locale),
      }),
    );
  }
  return parts.join(" · ");
}
