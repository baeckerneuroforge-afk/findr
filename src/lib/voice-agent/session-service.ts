import "server-only";

import { randomBytes } from "node:crypto";

import type { Json } from "@/types/database";
import { analyzeAccountTranscript } from "@/lib/accounts/health-service";
import {
  createResearchSupabase,
  type DatabaseWithResearch,
} from "@/lib/research/db";
import { findInviteByAccessToken } from "@/lib/research/scheduling";
import { persistResearchTranscriptAndDiscovery } from "@/lib/research/transcript-service";
import {
  DEFAULT_INTERVIEW_LANGUAGE,
  DEFAULT_VOICE_MODEL,
  extractLossReasonFromInterview,
  nextCheckinMessage,
  nextInterviewMessage,
  nextResearchMessage,
  type CheckinInput,
  type InterviewInput,
  type InterviewLanguage,
  type InterviewResult,
  type InterviewTurn,
  type ResearchInput,
} from "./interviewer";

/**
 * Persistence + orchestration for async post-loss interviews.
 *
 * SECURITY MODEL (token-based public access): RLS on interview_sessions stays
 * strict (org_isolation). The public chat page never uses the anon key — every
 * read/write goes through this service with the SERVICE-ROLE client (which
 * bypasses RLS) and is always scoped to the single row matching the caller's
 * access_token. The token is a 256-bit random string (capability URL). We never
 * list/enumerate sessions for the public path and never trust org_id from the
 * request, so possessing the unguessable token grants access to exactly one
 * session and nothing else.
 */

type Row = DatabaseWithResearch["public"]["Tables"]["interview_sessions"]["Row"];

const MAX_AGENT_TURNS = 6; // safety cap on conversation length / cost per session
const MAX_CHECKIN_AGENT_TURNS = 4; // check-ins are short (2-3 questions)

// Research interviews: total entries in conversation[] (User-Turns +
// Agent-Turns zusammen). 16 ≙ ~8 Frage-Antwort-Runden.
//
// Warum TOTAL statt nur Agent-Turns? Die agentTurnCount-Variante zählt nur
// rows mit role==='agent'. Bei alternierendem Verlauf bedeutet ein Cap von
// N effektiv ~2N jsonb-Einträge — was die DB-Beobachtung mit jsonb_array_
// length irreführend macht („14 turns" liest wie 14, ist aber 28). Ein
// TOTAL-Cap deckt sich 1:1 mit jsonb_array_length(conversation), also
// sind „16" im Code = „16" in der DB. Eindeutiger.
//
// Das ist die HARTE Obergrenze + das Sicherheitsnetz. Das Normalende
// soll der Agent selbst per done=true setzen — der Prompt enforced die
// Sättigungs-Regeln. Sollte der Agent driften (Topics außerhalb des Plans
// erfinden, beide-zufrieden-Signale ignorieren), greift der Cap als
// Stopper UND erzeugt ein generisches Closing statt einer ins Leere
// laufenden Frage (siehe advanceInterview research-Branch).
const MAX_RESEARCH_TOTAL_TURNS = 16;

/** Generic warm closing used when the TOTAL-cap forces a stop while the
 *  agent's own done flag is still false. The participant should never be
 *  left with an unanswered question on the screen. */
const RESEARCH_CAP_CLOSING_MESSAGE =
  "Vielen Dank für Ihre Zeit und Ihre offenen Antworten — das war sehr hilfreich.";

/**
 * dealContext is the per-session input bucket consumed by the agent prompt.
 * Which shape lives inside depends on `kind`:
 *   post_loss → InterviewInput  (deal + risk prediction)
 *   checkin   → CheckinInput    (account + recent signals)
 *   research  → ResearchInput   (plan + brand)
 * The column is JSONB; we narrow at the branch points.
 */
export type InterviewSessionContext =
  | InterviewInput
  | CheckinInput
  | ResearchInput;

export interface InterviewSession {
  id: string;
  orgId: string;
  dealId: string | null;
  accountId: string | null;
  kind: "post_loss" | "checkin" | "research";
  /** expand-contract Phase 1: flow mirrors kind once Phase 2 lands; today
   *  kind is still authoritative. Null on legacy rows. */
  flow: "post_loss" | "checkin" | "research" | null;
  mode: "text" | "voice" | "video";
  planId: string | null;
  inviteId: string | null;
  recordingUrl: string | null;
  transcriptSource: string | null;
  accessToken: string;
  status: "open" | "completed" | "abandoned";
  language: InterviewLanguage;
  conversation: InterviewTurn[];
  dealContext: InterviewSessionContext | null;
  result: InterviewResult | null;
  model: string | null;
  createdAt: string;
  completedAt: string | null;
}

/** Minimal, safe-to-expose view for the public chat page. */
export interface PublicInterviewView {
  status: "open" | "completed" | "abandoned";
  conversation: InterviewTurn[];
  /** A friendly company name for the greeting, if available. */
  company: string | null;
  /** Flow kind — exposed so the public page can switch on it (e.g. drop the
   *  Findr branding for `research`, since the participant is the customer
   *  of a Findr customer and has no relationship with Findr). post_loss
   *  and checkin keep the existing Findr-branded chrome. */
  kind: "post_loss" | "checkin" | "research";
  /** For `research` only: the research-plan title, used by the page as the
   *  visible h1 + metadata title. Null for post_loss / checkin and when
   *  the dealContext doesn't carry a plan title. */
  planTitle: string | null;
}

function generateToken(): string {
  // 256-bit, URL-safe, unguessable — the capability credential for the link.
  return randomBytes(32).toString("base64url");
}

function toSession(row: Row): InterviewSession {
  return {
    id: row.id,
    orgId: row.org_id,
    dealId: row.deal_id,
    accountId: row.account_id,
    kind: row.kind,
    flow: row.flow,
    mode: row.mode,
    planId: row.plan_id,
    inviteId: row.invite_id,
    recordingUrl: row.recording_url,
    transcriptSource: row.transcript_source,
    accessToken: row.access_token,
    status: row.status,
    language: row.language,
    conversation: (row.conversation as unknown as InterviewTurn[]) ?? [],
    dealContext:
      (row.deal_context as unknown as InterviewSessionContext | null) ?? null,
    result: (row.result as unknown as InterviewResult | null) ?? null,
    model: row.model,
    createdAt: row.created_at,
    completedAt: row.completed_at,
  };
}

function toPublicView(session: InterviewSession): PublicInterviewView {
  // `company` is the friendly label shown in the chat header. We keep the
  // field name for backwards-compat with the existing public API; the value
  // semantics depend on the flow:
  //   post_loss → buyer's company (header reads "… about Acme")
  //   checkin   → customer's company (account)
  //   research  → NULL by design. The plan title would feel awkward as a
  //                "company" label, and the agent's transparent opening
  //                message already states what the research is about. The
  //                header then degrades cleanly to "A short conversation".
  let company: string | null = null;
  if (session.kind === "research") {
    company = null;
  } else if (session.kind === "checkin") {
    company =
      (session.dealContext as CheckinInput | null)?.account.companyName ?? null;
  } else {
    company = (session.dealContext as InterviewInput | null)?.deal.company ?? null;
  }

  // planTitle is only populated for research, derived defensively from the
  // dealContext shape so a schema change doesn't break the page (falls back
  // to null → page renders the generic "Research interview" heading).
  let planTitle: string | null = null;
  if (session.kind === "research") {
    const ctx = session.dealContext as
      | { plan?: { title?: string | null } | null }
      | null;
    planTitle = ctx?.plan?.title?.trim() || null;
  }

  return {
    status: session.status,
    conversation: session.conversation,
    company,
    kind: session.kind,
    planTitle,
  };
}

function agentTurnCount(conversation: InterviewTurn[]): number {
  return conversation.filter((t) => t.role === "agent").length;
}

/** Flatten a conversation into a plain transcript for the health engine. */
function conversationToTranscript(conversation: InterviewTurn[]): string {
  return conversation
    .map((t) => `${t.role === "agent" ? "Assistant" : "Customer"}: ${t.text}`)
    .join("\n");
}

async function loadByToken(token: string): Promise<InterviewSession | null> {
  const supabase = createResearchSupabase();
  const { data, error } = await supabase
    .from("interview_sessions")
    .select("*")
    .eq("access_token", token)
    .maybeSingle();
  // Surface transient PostgREST / network failures in the Vercel log
  // instead of swallowing them as "no such session". Before this log,
  // a 5xx or aborted fetch would render as a 404 on the public page
  // with no breadcrumbs — exactly the silent failure mode that masked
  // the read-after-write 404 we just fixed structurally. Token itself
  // stays out of the log (it's a capability credential) — only the
  // error message is emitted.
  if (error) {
    console.error("[loadByToken] supabase read failed:", error.message);
  }
  if (error || !data) return null;
  return toSession(data);
}

/**
 * Create a session and generate the agent's opening question (empty history ->
 * first message). Returns the row including the access token. deal_id may be null
 * in this sprint (test sessions without a real deal).
 */
export async function createInterviewSession(params: {
  orgId: string;
  dealId?: string | null;
  accountId?: string | null;
  kind?: "post_loss" | "checkin" | "research";
  dealContext: InterviewSessionContext;
  /** Conversation channel — default 'text'. Voice/Video will set this when
   *  the transport adapters land. */
  mode?: "text" | "voice" | "video";
  /** Research-only links. Ignored for post_loss / checkin sessions. */
  planId?: string | null;
  inviteId?: string | null;
  /** OPTIONAL pre-generated access token. Use this when the token was
   *  created earlier in the flow (e.g. at research-invite creation, so the
   *  scheduling mail can carry the /interview/[token] link before the
   *  session exists). If omitted, a fresh 256-bit token is generated here
   *  (the original post_loss + checkin behavior, unchanged). */
  accessToken?: string;
  language?: InterviewLanguage;
  model?: string;
}): Promise<InterviewSession> {
  const kind = params.kind ?? "post_loss";
  const mode = params.mode ?? "text";
  const model = params.model ?? process.env.VOICE_MODEL ?? DEFAULT_VOICE_MODEL;
  const language = params.language ?? DEFAULT_INTERVIEW_LANGUAGE;

  // Opening message routing — same callJson plumbing, different prompt + input
  // shape per flow.
  const opening =
    kind === "research"
      ? await nextResearchMessage(
          params.dealContext as ResearchInput,
          [],
          language,
          model,
        )
      : kind === "checkin"
        ? await nextCheckinMessage(
            params.dealContext as CheckinInput,
            [],
            language,
            model,
          )
        : await nextInterviewMessage(
            params.dealContext as InterviewInput,
            [],
            language,
            model,
          );
  const conversation: InterviewTurn[] = [
    { role: "agent", text: opening.message },
  ];

  const supabase = createResearchSupabase();
  // expand-contract Phase 1: kind stays authoritative; we ALSO write `flow`
  // with the same value so future readers can switch over without a backfill.
  // transcript_source is "typed" for text mode (default); voice/video adapters
  // will set it differently when they land.
  const { data, error } = await supabase
    .from("interview_sessions")
    .insert({
      org_id: params.orgId,
      deal_id: params.dealId ?? null,
      account_id: params.accountId ?? null,
      kind,
      flow: kind,
      mode,
      plan_id: params.planId ?? null,
      invite_id: params.inviteId ?? null,
      transcript_source: mode === "text" ? "typed" : null,
      access_token: params.accessToken ?? generateToken(),
      status: "open",
      language,
      conversation: conversation as unknown as Json,
      deal_context: params.dealContext as unknown as Json,
      model,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to create interview_session: ${error?.message ?? "no row returned"}`,
    );
  }
  return toSession(data);
}

/**
 * Public read for the chat page — minimal view, by token only.
 *
 * THREE PATHS (in this priority order):
 *
 *   (1) Existing interview_sessions row matches the token
 *         → return it (unchanged behavior — covers post_loss + checkin,
 *           and previously-created research sessions). NEVER re-creates;
 *           an existing conversation is preserved across reloads.
 *
 *   (2) No session, but a research_invites row has access_token = token
 *         → LAZY-create the session via createResearchInterview, which
 *           fires the opening message and inserts an interview_sessions
 *           row with the SAME access_token (so the invite's URL stays
 *           stable through the mail it was embedded in). The session
 *           is created only when the participant actually opens the
 *           link — saves an Opus call per invite that never gets
 *           clicked.
 *
 *   (3) Token matches neither table → null (404 from the page).
 *
 * post_loss + checkin always hit path (1): their sessions are created
 * up-front in createAndInviteInterview / createAndInviteCheckin (see
 * src/lib/voice-agent/interview-orchestration.ts +
 * src/lib/voice-agent/checkin-orchestration.ts — both call
 * createInterviewSession before returning). The lazy branch is
 * research-flow-exclusive.
 *
 * RACE-SCHUTZ — wenn der Teilnehmer den Link doppelklickt oder zwei
 * parallele requests reinkommen, kann es passieren, dass beide path
 * (2) erreichen. createResearchInterview führt intern einen INSERT
 * gegen interview_sessions aus, der durch interview_sessions.access_token
 * (text not null UNIQUE, aus 20260529000000_interview_sessions.sql)
 * geschützt ist. Der zweite INSERT wirft eine unique-violation, die
 * createResearchInterview in seinem eigenen try/catch zu
 * status='error' mappt. Wir UNTERSCHEIDEN das hier bewusst NICHT von
 * einem echten Fehler — stattdessen läuft loadByToken im Anschluss
 * IMMER. Wenn die Zeile existiert (egal wer von uns sie geschrieben
 * hat), gewinnt der erste Insert, der zweite Request liest das
 * Ergebnis und serviert dieselbe Session. Das löst den
 * Korrektheits-Race auf Datenebene; ein Opus-Edge-Case bleibt (beide
 * Requests generieren VOR dem INSERT eine Opening-Message), das ist
 * akzeptiert, weil bei einem Teilnehmer-Doppelklick selten und
 * Opening-Messages billig sind. Eine spätere Optimierung könnte ein
 * pg_advisory_lock vor dem Opus-Call setzen.
 */
export async function getPublicSession(
  token: string,
): Promise<PublicInterviewView | null> {
  // Path (1) — existing session. Covers everything post_loss + checkin
  // ever asks for, plus any previously-lazy-created research session.
  const existing = await loadByToken(token);
  if (existing) return toPublicView(existing);

  // Path (2) — no session yet. Maybe it's a research invite whose session
  // hasn't been created yet?
  const invite = await findInviteByAccessToken(token);
  if (!invite || !invite.org_id) {
    // Path (3) — neither table knows this token, OR the invite has no
    // org_id (reserved for the future external-research path that hasn't
    // been wired yet).
    return null;
  }

  // createResearchInterview is dynamically imported here to break a static
  // circular dependency: research-orchestration.ts imports
  // createInterviewSession from THIS file. Top-level static import would
  // form session-service → research-orchestration → session-service. The
  // lazy branch is a slow path anyway (Opus opening-message generation),
  // so the import-cost is negligible.
  const { createResearchInterview } = await import(
    "@/lib/research/research-orchestration"
  );

  // Returns a status-result, NEVER throws — even when the internal INSERT
  // hits a unique-violation from a concurrent racer (mapped to
  // status='error' in createResearchInterview's catch).
  //
  // HAPPY PATH — we created the row ourselves: result.session is the
  // freshly inserted InterviewSession (from createInterviewSession's
  // .insert().select().single() return). Render it directly via
  // toPublicView — NO second DB read. This closes the previous
  // first-hit-404: the re-read via loadByToken was vulnerable to
  // cold-start-latency-induced aborts after the front-loaded Opus call,
  // and would silently return null even though the row was committed.
  //
  // CROSS-REQUEST RACER PATH — status !== 'created' AND a parallel
  // request just inserted a row with our token: createInterviewSession
  // threw on the UNIQUE constraint, the catch mapped it to status='error'.
  // The winner's row IS now in the DB. Use loadByToken as a backstop to
  // pick it up. (NOT the same as the previous re-read: this branch only
  // fires when our OWN INSERT didn't succeed — meaning we never had the
  // session in memory to begin with.)
  const result = await createResearchInterview({
    orgId: invite.org_id,
    planId: invite.plan_id,
    inviteId: invite.id,
  });
  if (result.status === "created" && result.session) {
    return toPublicView(result.session);
  }

  const created = await loadByToken(token);
  return created ? toPublicView(created) : null;
}

/** Org-internal view of a deal's interview (for the dashboard deal page). */
export interface DealInterviewView {
  accessToken: string;
  status: "open" | "completed" | "abandoned";
  createdAt: string;
  completedAt: string | null;
  /** When an invitation email was last sent for this interview (null = never). */
  invitedAt: string | null;
  /** Result fields — populated once the interview is completed. */
  extractedReason: string | null;
  evidence: string | null;
  matchedRiskPrediction: "yes" | "no" | "partial" | null;
  reasoning: string | null;
  conversation: InterviewTurn[];
}

/**
 * The most recent interview session linked to a deal, scoped to the org. Used by
 * the deal page to show an existing interview (status + link) and, once
 * completed, its result (extracted reason, evidence, risk-prediction match,
 * reasoning, full conversation). Org-internal — the dashboard user owns the
 * deal, so exposing the access token + result here is fine; this is NOT the
 * public token path.
 */
export async function getDealInterview(
  orgId: string,
  dealId: string,
): Promise<DealInterviewView | null> {
  const supabase = createResearchSupabase();
  const { data, error } = await supabase
    .from("interview_sessions")
    .select(
      "access_token, status, created_at, completed_at, invited_at, extracted_reason, evidence, matched_risk_prediction, result, conversation",
    )
    .eq("org_id", orgId)
    .eq("deal_id", dealId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;

  const result = (data.result as unknown as InterviewResult | null) ?? null;
  return {
    accessToken: data.access_token,
    status: data.status,
    createdAt: data.created_at,
    completedAt: data.completed_at,
    invitedAt: data.invited_at,
    extractedReason: data.extracted_reason,
    evidence: data.evidence,
    matchedRiskPrediction:
      (data.matched_risk_prediction as "yes" | "no" | "partial" | null) ?? null,
    reasoning: result?.reasoning ?? null,
    conversation: (data.conversation as unknown as InterviewTurn[]) ?? [],
  };
}

/** Org-internal view of an account's latest check-in (for the account page). */
export interface AccountCheckinView {
  accessToken: string;
  status: "open" | "completed" | "abandoned";
  createdAt: string;
  completedAt: string | null;
  invitedAt: string | null;
}

/** The most recent check-in session for an account, scoped to the org. */
export async function getAccountCheckin(
  orgId: string,
  accountId: string,
): Promise<AccountCheckinView | null> {
  const supabase = createResearchSupabase();
  const { data, error } = await supabase
    .from("interview_sessions")
    .select("access_token, status, created_at, completed_at, invited_at")
    .eq("org_id", orgId)
    .eq("account_id", accountId)
    .eq("kind", "checkin")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return {
    accessToken: data.access_token,
    status: data.status,
    createdAt: data.created_at,
    completedAt: data.completed_at,
    invitedAt: data.invited_at,
  };
}

/**
 * Stamp invited_at = now on a session, identified by its access token within the
 * org. Returns the new timestamp, or null if no matching session. Org-scoped.
 */
export async function markInterviewInvited(
  orgId: string,
  accessToken: string,
): Promise<string | null> {
  const now = new Date().toISOString();
  const supabase = createResearchSupabase();
  const { data, error } = await supabase
    .from("interview_sessions")
    .update({ invited_at: now })
    .eq("org_id", orgId)
    .eq("access_token", accessToken)
    .select("invited_at")
    .maybeSingle();
  if (error || !data) return null;
  return data.invited_at;
}

/**
 * Append the buyer/customer message, generate the next agent message, persist,
 * and finish when the agent (or the safety cap) closes the conversation.
 *
 * Branches on session kind:
 *   post_loss → on finish, run the loss-reason extraction (unchanged).
 *   checkin   → on finish, turn the conversation into a transcript and feed it to
 *               the account health engine (one transcript → one health point).
 *   research  → on finish, persist the transcript as a calls row and run the
 *               product-discovery classifier. Both side-effects are best-effort
 *               (errors are logged, the conversation is saved regardless).
 *
 * Returns the updated public view, or null if the token doesn't match a session.
 */
export async function advanceInterview(
  token: string,
  buyerMessage: string,
): Promise<PublicInterviewView | null> {
  const session = await loadByToken(token);
  if (!session) return null;

  // Already finished, or missing the context needed to continue — no-op.
  if (session.status !== "open" || !session.dealContext) {
    return toPublicView(session);
  }

  const model = session.model ?? process.env.VOICE_MODEL ?? DEFAULT_VOICE_MODEL;
  const history: InterviewTurn[] = [
    ...session.conversation,
    { role: "customer", text: buyerMessage.trim() },
  ];
  const supabase = createResearchSupabase();

  // ── RESEARCH: plan-driven research interview → Product Discovery on finish ──
  // Branch ordered BEFORE check-in / post-loss so a session with kind="research"
  // never falls through to the older paths. The existing branches stay
  // untouched.
  if (session.kind === "research") {
    const input = session.dealContext as unknown as ResearchInput;
    const { done, message } = await nextResearchMessage(
      input,
      history,
      session.language,
      model,
    );

    // Decide BEFORE pushing the agent turn: would pushing the LLM message
    // bring conversation.length to the cap? If so AND the agent isn't
    // self-closing (done=false), the LLM just emitted "another question"
    // when the system already has to stop. Swap that question for the
    // generic warm closing so the participant doesn't end on an
    // unanswered prompt.
    //
    // The cap is measured against `history.length + 1` because the agent's
    // turn isn't appended yet — we're predicting the row we're about to
    // push.
    const wouldHitCap = history.length + 1 >= MAX_RESEARCH_TOTAL_TURNS;
    const forceCapClose = wouldHitCap && !done;
    const finalAgentText = forceCapClose
      ? RESEARCH_CAP_CLOSING_MESSAGE
      : message;
    history.push({ role: "agent", text: finalAgentText });
    const finished = done || forceCapClose;

    if (finished) {
      // Persist the completed transcript as a calls row (account_id = null,
      // deal_id = null — allowed under calls_single_parent_chk which says
      // "not both set", not "exactly one") and feed it to the Product
      // Discovery classifier. Any failure is logged but never thrown — the
      // conversation must be saved no matter what.
      try {
        await persistResearchTranscriptAndDiscovery({
          orgId: session.orgId,
          planId: session.planId,
          inviteId: session.inviteId,
          transcript: conversationToTranscript(history),
        });
      } catch (err) {
        console.error(
          "[research] discovery analysis failed (conversation still saved):",
          err instanceof Error ? err.message : err,
        );
      }

      const { data, error } = await supabase
        .from("interview_sessions")
        .update({
          conversation: history as unknown as Json,
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("access_token", token)
        .select()
        .single();
      if (error || !data) {
        throw new Error(
          `Failed to finalize research session: ${error?.message ?? "no row returned"}`,
        );
      }
      return toPublicView(toSession(data));
    }

    const { data, error } = await supabase
      .from("interview_sessions")
      .update({ conversation: history as unknown as Json })
      .eq("access_token", token)
      .select()
      .single();
    if (error || !data) {
      throw new Error(
        `Failed to update research session: ${error?.message ?? "no row returned"}`,
      );
    }
    return toPublicView(toSession(data));
  }

  // ── CHECK-IN: short satisfaction chat → account health point on finish ──────
  if (session.kind === "checkin") {
    const input = session.dealContext as unknown as CheckinInput;
    const { done, message } = await nextCheckinMessage(
      input,
      history,
      session.language,
      model,
    );
    history.push({ role: "agent", text: message });
    const finished = done || agentTurnCount(history) >= MAX_CHECKIN_AGENT_TURNS;

    if (finished) {
      // Feed the completed check-in into the account's health score. A health
      // failure must NOT break the customer's chat — the conversation is saved
      // regardless.
      if (session.accountId) {
        try {
          await analyzeAccountTranscript(
            session.orgId,
            session.accountId,
            conversationToTranscript(history),
          );
        } catch (err) {
          console.error(
            "[checkin] health analysis failed (conversation still saved):",
            err instanceof Error ? err.message : err,
          );
        }
      }
      const { data, error } = await supabase
        .from("interview_sessions")
        .update({
          conversation: history as unknown as Json,
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("access_token", token)
        .select()
        .single();
      if (error || !data) {
        throw new Error(
          `Failed to finalize check-in session: ${error?.message ?? "no row returned"}`,
        );
      }
      return toPublicView(toSession(data));
    }

    const { data, error } = await supabase
      .from("interview_sessions")
      .update({ conversation: history as unknown as Json })
      .eq("access_token", token)
      .select()
      .single();
    if (error || !data) {
      throw new Error(
        `Failed to update check-in session: ${error?.message ?? "no row returned"}`,
      );
    }
    return toPublicView(toSession(data));
  }

  // ── POST-LOSS interview (unchanged behavior) ────────────────────────────────
  // Narrow the broadened dealContext (InterviewSessionContext union) back to
  // InterviewInput — by the time we reach this branch, both research and
  // checkin have returned, so the value must be the post-loss shape.
  const input = session.dealContext as InterviewInput;
  const { done, message } = await nextInterviewMessage(
    input,
    history,
    session.language,
    model,
  );
  history.push({ role: "agent", text: message });

  const finished = done || agentTurnCount(history) >= MAX_AGENT_TURNS;

  if (finished) {
    const result = await extractLossReasonFromInterview(input, history, model);
    const { data, error } = await supabase
      .from("interview_sessions")
      .update({
        conversation: history as unknown as Json,
        status: "completed",
        extracted_reason: result.extractedReason,
        evidence: result.evidence,
        matched_risk_prediction: result.matchedRiskPrediction,
        result: result as unknown as Json,
        completed_at: new Date().toISOString(),
      })
      .eq("access_token", token)
      .select()
      .single();
    if (error || !data) {
      throw new Error(
        `Failed to finalize interview_session: ${error?.message ?? "no row returned"}`,
      );
    }
    return toPublicView(toSession(data));
  }

  const { data, error } = await supabase
    .from("interview_sessions")
    .update({ conversation: history as unknown as Json })
    .eq("access_token", token)
    .select()
    .single();
  if (error || !data) {
    throw new Error(
      `Failed to update interview_session: ${error?.message ?? "no row returned"}`,
    );
  }
  return toPublicView(toSession(data));
}
