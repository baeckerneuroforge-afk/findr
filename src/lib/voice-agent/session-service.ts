import "server-only";

import { randomBytes } from "node:crypto";
import { after } from "next/server";

import type { Json } from "@/types/database";
import type { ScreeningQuestion } from "@/lib/schemas/screening";
import { analyzeAccountTranscript } from "@/lib/accounts/health-service";
import {
  createResearchSupabase,
  type DatabaseWithResearch,
} from "@/lib/research/db";
import {
  buildPanelRedirectUrl,
  coercePanelContext,
  type PanelContext,
} from "@/lib/research/panel";
import { findInviteByAccessToken } from "@/lib/research/scheduling";
import { persistResearchTranscriptAndDiscovery } from "@/lib/research/transcript-service";
import { runTurnSignalsSidecar } from "@/lib/research/turn-signals";
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
  type TurnDelta,
  stripTurnInternals,
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
  captureSource: string | null;
  visualCapture: Json | null;
  accessToken: string;
  status: "open" | "completed" | "abandoned";
  language: InterviewLanguage;
  conversation: InterviewTurn[];
  dealContext: InterviewSessionContext | null;
  result: InterviewResult | null;
  model: string | null;
  createdAt: string;
  completedAt: string | null;
  /** Phase 4 Baustein 3 (Panel-Anbieter) — Inbound-Attribution der externen
   *  Teilnehmer-ID + Snapshot der Complete-Return-URL. Null für JEDE
   *  Nicht-Panel-Session (defensiv genarrowed via coercePanelContext). */
  panelContext: PanelContext | null;
  /** E0 Recht & Offenlegung — Zeitpunkt der Teilnehmer-Einwilligung (Consent-
   *  Gate), server-gestempelt. Null = Bestands-Session vor Einführung des
   *  Gates ODER Einwilligung (noch) nicht erteilt. */
  consentAcceptedAt: string | null;
}

/** Minimal, safe-to-expose view for the public chat page. */
/** E5 Multi-Stimulus — teilnehmer-sichere Sicht auf EIN Set-Element aus dem
 *  deal_context-Snapshot. BEWUSST ohne description/analysis: die Forscher-
 *  Beschreibung erzeugt Demand-Effekte (gleiche Disziplin wie das nie
 *  durchgereichte stimulus_description der Legacy-Split-View) und die
 *  Analyse ist Modell-Material. label ist Anzeige-Text („Variante A"). */
export interface PublicStimulusItem {
  position: number;
  type: string;
  url: string;
  label: string | null;
}

export interface PublicInterviewView {
  status: "open" | "completed" | "abandoned";
  conversation: InterviewTurn[];
  /** Internal org UUID that owns this session. Used server-side ONLY (in the
   *  page server component) to resolve white-label branding for the research
   *  participant surface — never rendered, never sent to the client. */
  orgId: string;
  /** For `research`: the plan UUID. Server-side ONLY (page server component)
   *  to load the plan's screening questions for the render path — never
   *  rendered, never sent to the client. Null for post_loss / checkin and
   *  legacy rows. */
  planId: string | null;
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
  /** Buyer-facing language for this session. The public chat subtree uses it
   *  as its NextIntlClientProvider locale, so the chrome matches the language
   *  the agent + emails speak (closes the EN-chrome / DE-interview mismatch). */
  language: InterviewLanguage;
  /** Panel-Anbieter E2 — die FERTIG aufgebaute Complete-Return-URL (Template aus
   *  panel_context.complete_url + substituierte Teilnehmer-ID, validiert), an die
   *  CompletedPanel den Browser zurück zum Anbieter leitet, sobald das Interview
   *  abgeschlossen ist. NULL für JEDE Nicht-Panel-Session (kein Redirect →
   *  byte-identischer Dank-Screen wie heute). Enthält NUR die eigene pseudonyme
   *  ID des Teilnehmers, KEINE org/internal-Daten. */
  panelCompleteRedirect: string | null;
  /** E0 Recht & Offenlegung — Einwilligungs-Zeitstempel der Session (oder null).
   *  Die Token-Page nutzt ihn SERVER-seitig, um das Consent-Gate nur Sessions
   *  zu zeigen, die noch nicht eingewilligt haben und noch nicht begonnen
   *  wurden. Ein ISO-Zeitstempel ohne Personenbezug — unkritisch im View. */
  consentAcceptedAt: string | null;
  /** E5 Multi-Stimulus — das Stimulus-Set der Studie (Snapshot, Positions-
   *  Reihenfolge, teilnehmer-sichere Felder). Leer ([]) für jede Session ohne
   *  Set — die Teilnehmer-UI rendert dann exakt den Legacy-Pfad. */
  stimuli: PublicStimulusItem[];
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
    captureSource: row.capture_source ?? null,
    visualCapture: row.visual_capture ?? null,
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
    // Defensive narrow; undefined pre-migration (select("*") omits the column) →
    // null, so every existing read stays byte-identical.
    panelContext: coercePanelContext(
      (row as { panel_context?: unknown }).panel_context,
    ),
    // E0: same defensive pattern — pre-migration select("*") omits the column.
    consentAcceptedAt:
      (row as { consent_accepted_at?: string | null }).consent_accepted_at ??
      null,
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

  // Panel-Anbieter E2: die Complete-Return-URL einmal hier server-seitig bauen
  // (Template-Snapshot + validierte ID-Substitution) und als fertigen String
  // exponieren. Null für jede Nicht-Panel-Session ODER wenn keine complete_url
  // gesnapshottet wurde (Attribution-only) ODER wenn das Template keine sichere
  // http(s)-URL ist (buildPanelRedirectUrl → null). Der Client navigiert nur,
  // wenn dieser Wert gesetzt ist → kein Redirect, byte-identisch, sonst.
  const panelCompleteRedirect = session.panelContext?.complete_url
    ? buildPanelRedirectUrl(
        session.panelContext.complete_url,
        session.panelContext.participant_id,
      )
    : null;

  // E5 Multi-Stimulus — das Set aus dem SNAPSHOT (nie live vom Plan, R2):
  // Teilnehmer-UI braucht Position/Typ/URL/Label für Reveal + Thumbnails.
  // Leer für jede Nicht-Research-Session und jede Session ohne Set.
  const stimuli: PublicStimulusItem[] =
    session.kind === "research"
      ? ((session.dealContext as unknown as ResearchInput | null)?.plan
          ?.stimuli ?? [])
          .map((item) => ({
            position: item.position,
            type: item.type,
            url: item.url,
            label: item.label ?? null,
          }))
          .sort((a, b) => a.position - b.position)
      : [];

  return {
    status: session.status,
    // E3 — Teilnehmer-Payloads tragen NIE interne Turn-Felder (why): wer
    // liest, warum gefragt wird, antwortet verzerrt (Demand-Effekte, O1).
    conversation: stripTurnInternals(session.conversation),
    stimuli,
    orgId: session.orgId,
    planId: session.planId,
    company,
    kind: session.kind,
    planTitle,
    language: session.language,
    panelCompleteRedirect,
    consentAcceptedAt: session.consentAcceptedAt,
  };
}

/** E3/E4 — Agent-Turn additiv bauen: why (Forscher-Rationale) und
 *  shownStimulusPosition (Multi-Stimulus-Reveal) erscheinen NUR, wenn der
 *  Pfad sie liefert; post_loss/checkin und Set-lose Research-Sessions
 *  schreiben exakt die alte {role, text}-Form. */
function buildAgentTurn(
  text: string,
  why: string | null,
  shownStimulusPosition: number | null,
): InterviewTurn {
  return {
    role: "agent",
    text,
    ...(why !== null ? { why } : {}),
    ...(shownStimulusPosition !== null ? { shownStimulusPosition } : {}),
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

export async function loadByToken(
  token: string,
): Promise<InterviewSession | null> {
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
 * Create a session and — unless skipOpening is set (B2) — generate the
 * agent's opening question (empty history -> first message). Returns the row
 * including the access token. deal_id may be null in this sprint (test
 * sessions without a real deal).
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
  /** Phase 4: screening answers of the QUALIFIED participant, written to the
   *  session row at creation. Null/omitted for non-screened sessions (the
   *  post_loss / checkin / no-screening-research lazy path), so behavior there
   *  is byte-identical to before. */
  screeningAnswers?: Json | null;
  /** Phase 4 Baustein 2 (offener Studien-Link): the open-link row this walk-in
   *  session belongs to. Additive, nullable attribution (mirrors invite_id,
   *  20260629000000) — set ONLY on the open-link path; null/omitted for every
   *  per-invite / post_loss / checkin session, so behavior there is byte-
   *  identical. Mutually exclusive with inviteId by construction (the open route
   *  passes inviteId: null + openLinkId, the invite route the inverse). */
  openLinkId?: string | null;
  /** Phase 4 Baustein 3 (Panel-Anbieter) E1: Inbound-Attribution-Bucket (provider
   *  + opake Teilnehmer-ID + Complete-URL-Snapshot, PanelContext-Form als Json).
   *  Gesetzt NUR auf dem Panel-Pfad (Open-Link mit ?PROLIFIC_PID=); null/omitted
   *  auf JEDEM anderen Pfad. NULL-SICHER + BYTE-IDENTISCH: der panel_context-Key
   *  wird NUR dann überhaupt in den INSERT aufgenommen, wenn er gesetzt ist —
   *  jeder Nicht-Panel-INSERT referenziert die Spalte gar nicht (funktioniert
   *  also auch, falls die Migration 20260702000000 noch nicht angewandt ist). */
  panelContext?: Json | null;
  /** Perf-Etappe B2: create the session WITHOUT generating the opening
   *  message (conversation starts empty). The participant-facing research
   *  paths set this so the page can paint immediately; the opening is then
   *  generated as the first STREAMED turn via ensureOpeningTurn. Omitted →
   *  the original blocking-opening behavior (post_loss / checkin, whose
   *  sessions are created on operator actions, not on the participant's
   *  request path). */
  skipOpening?: boolean;
}): Promise<InterviewSession> {
  const kind = params.kind ?? "post_loss";
  const mode = params.mode ?? "text";
  const model = params.model ?? process.env.VOICE_MODEL ?? DEFAULT_VOICE_MODEL;
  const language = params.language ?? DEFAULT_INTERVIEW_LANGUAGE;

  // Opening message routing — same plain-turn plumbing, different prompt +
  // input shape per flow. Skipped entirely under B2 (see skipOpening above).
  const opening = params.skipOpening
    ? null
    : kind === "research"
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
  // E3/E4 — Opening-Begründung + Reveal-Marker (nur Research liefert sie)
  // reisen additiv mit; post_loss/checkin geben null → Form unverändert.
  const conversation: InterviewTurn[] = opening
    ? [buildAgentTurn(opening.message, opening.why, opening.showStimulusPosition)]
    : [];

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
      // Additive walk-in attribution; null for every existing INSERT (no-op).
      open_link_id: params.openLinkId ?? null,
      transcript_source: mode === "text" ? "typed" : null,
      access_token: params.accessToken ?? generateToken(),
      status: "open",
      language,
      conversation: conversation as unknown as Json,
      deal_context: params.dealContext as unknown as Json,
      model,
      screening_answers: params.screeningAnswers ?? null,
      // Panel-Anbieter E1: den panel_context-Key NUR aufnehmen, wenn gesetzt.
      // So ist jeder Nicht-Panel-INSERT byte-identisch (referenziert die Spalte
      // nie) — auch vor angewandter Migration. Panel-INSERTs treten erst auf,
      // nachdem die Migration angewandt + Panel konfiguriert ist.
      ...(params.panelContext != null
        ? { panel_context: params.panelContext }
        : {}),
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
 *           inserts an interview_sessions row with the SAME access_token
 *           (so the invite's URL stays stable through the mail it was
 *           embedded in). Since Perf-Etappe B2 the row is created WITHOUT
 *           the opening message (conversation = []) — the opening arrives
 *           as the first streamed turn via ensureOpeningTurn, so this
 *           lazy-create is cheap and the page paints immediately.
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
 * Korrektheits-Race auf Datenebene. (Der frühere Opus-Edge-Case —
 * beide Racer generieren VOR dem INSERT eine Opening-Message — ist
 * mit B2 strukturell weg: die Erstellung macht keinen LLM-Call mehr;
 * Opening-Races behandelt ensureOpeningTurn mit eigenem Guard.)
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

  // E4 SCREENING GATE — if the invite's plan has screening questions and no
  // session exists yet, DEFER: do NOT lazy-create (no Opus opening turn, no
  // interview_sessions row). Return null so this back-compat accessor — and the
  // GET/POST routes that use it — 404: there is nothing to advance until the
  // participant qualifies. The participant page uses resolvePublicEntry, which
  // surfaces the needs_screening render path; the session is created by POST
  // /api/interview/[token]/screen on a QUALIFIED verdict. FAIL-SAFE: no
  // questions configured (or plan missing) → fall through to the unchanged
  // lazy-create path below. getResearchPlan is dynamically imported for the
  // same cycle-avoidance reason as createResearchInterview.
  {
    const { getResearchPlan } = await import("@/lib/research/plans-service");
    const plan = await getResearchPlan(invite.org_id, invite.plan_id);
    if ((plan?.screeningQuestions ?? []).length > 0) {
      return null;
    }
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
    // Single source of truth for the participant-facing language: the invite
    // carries it, the lazily-created session inherits it, the chrome follows.
    language: invite.language,
  });
  if (result.status === "created" && result.session) {
    return toPublicView(result.session);
  }

  const created = await loadByToken(token);
  return created ? toPublicView(created) : null;
}

/** Screening-aware entry resolution for the participant page +
 *  generateMetadata. Distinguishes a real session from a needs_screening
 *  signal (a research invite whose plan has screening questions and no session
 *  yet — deferred so NO session row + NO Opus turn exist before the participant
 *  qualifies). */
export interface NeedsScreeningView {
  /** server-only — white-label branding + the /screen endpoint's org scope. */
  orgId: string;
  planId: string;
  planTitle: string | null;
  language: InterviewLanguage;
  questions: ScreeningQuestion[];
}

export type PublicEntry =
  | { mode: "session"; session: PublicInterviewView }
  | { mode: "needs_screening"; screening: NeedsScreeningView };

export async function resolvePublicEntry(
  token: string,
): Promise<PublicEntry | null> {
  // Existing session → always a session (post_loss / checkin / already-created
  // research, incl. a session created after a qualified screening).
  const existing = await loadByToken(token);
  if (existing) return { mode: "session", session: toPublicView(existing) };

  // No session yet — research invite with screening configured?
  const invite = await findInviteByAccessToken(token);
  if (!invite || !invite.org_id) return null;
  const { getResearchPlan } = await import("@/lib/research/plans-service");
  const plan = await getResearchPlan(invite.org_id, invite.plan_id);
  const questions = plan?.screeningQuestions ?? [];
  if (questions.length > 0) {
    return {
      mode: "needs_screening",
      screening: {
        orgId: invite.org_id,
        planId: invite.plan_id,
        planTitle: plan?.title ?? null,
        language: invite.language,
        questions,
      },
    };
  }

  // No screening → delegate to getPublicSession for the unchanged lazy-create +
  // race backstop (kept as the single source of that logic).
  const session = await getPublicSession(token);
  return session ? { mode: "session", session } : null;
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
 * E0 Recht & Offenlegung — Version der Consent-/Offenlegungstexte. Wird beim
 * Stempeln in consent_version persistiert und referenziert den git-
 * historisierten Stand der i18n-Texte (interview.open.consent.* /
 * interview.inviteConsent.*): der DSGVO-Art.-7(1)-Nachweis, WELCHEM Text
 * zugestimmt wurde. Bei jeder inhaltlichen Änderung der Consent-Texte
 * MITZIEHEN (neues Datum).
 */
export const CONSENT_TEXT_VERSION = "2026-06-11";

/**
 * E0 — stamp the participant's consent on a session (DSGVO Art. 7(1)
 * accountability). Properties, in Reihenfolge ihrer Wichtigkeit:
 *
 *   - SERVER-side timestamp: the client only ever signals "the gate was
 *     accepted"; the time itself is never client-supplied.
 *   - Idempotent: `WHERE consent_accepted_at IS NULL` — only the FIRST accept
 *     writes; refreshes/double-clicks/re-entries never overwrite the original
 *     stamp (the original consent moment is the legally relevant one).
 *   - Best-effort & pre-migration safe: before 20260704000001 is applied the
 *     UPDATE fails on the unknown column — we LOG and swallow. The UI gate has
 *     already enforced disclosure + active confirmation; a participant is
 *     NEVER locked out of an interview because the stamp could not be written.
 *   - Token-scoped (capability auth), like every public interview operation.
 */
export async function markSessionConsentByToken(
  accessToken: string,
  consentVersion: string,
): Promise<void> {
  try {
    const supabase = createResearchSupabase();
    const { error } = await supabase
      .from("interview_sessions")
      .update({
        consent_accepted_at: new Date().toISOString(),
        consent_version: consentVersion,
      })
      .eq("access_token", accessToken)
      .is("consent_accepted_at", null);
    if (error) {
      console.warn(
        `[consent] stamp failed (migration 20260704000001 applied?): ${error.message}`,
      );
    }
  } catch (err) {
    console.warn("[consent] stamp failed:", err);
  }
}

/**
 * Voice-Pricing-Fundament — stempelt mode='voice' auf eine Session, sobald
 * der LiveKit-Token gemintet wurde (POST /api/voice/token). Das ist der
 * Moment, ab dem der Voice-Agent dispatcht wird und Voice-Kosten entstehen —
 * NICHT erst beim ersten persistierten Voice-Turn (den Spät-Stempel in
 * appendVoiceTurns gibt es weiterhin, gleiche Werte, redundanz-sicher).
 * Teilnehmer, die nur den ?mode=text-Fallback nutzen und nie einen Token
 * holen, bleiben mode='text' — sie verursachen keine Voice-Kosten.
 *
 * Eigenschaften (Spiegel von markSessionConsentByToken):
 *   - Idempotent: `WHERE mode = 'text'` — ein bereits gesetzter voice/video-
 *     Modus wird nie überschrieben.
 *   - Best-effort: Fehler werden geloggt und geschluckt — ein Teilnehmer
 *     wird NIE aus dem Interview ausgesperrt, weil der Stempel scheitert.
 *   - transcript_source bleibt unberührt — 'stt' ist erst wahr, wenn
 *     tatsächlich Turns ankommen (Job von appendVoiceTurns).
 */
export async function markSessionVoiceModeById(
  sessionId: string,
): Promise<void> {
  try {
    const supabase = createResearchSupabase();
    const { error } = await supabase
      .from("interview_sessions")
      .update({ mode: "voice" })
      .eq("id", sessionId)
      .eq("mode", "text");
    if (error) {
      console.warn(`[voice] mode stamp failed: ${error.message}`);
    }
  } catch (err) {
    console.warn("[voice] mode stamp failed:", err);
  }
}

/**
 * DSGVO-Selbstwiderruf (G6) — der Teilnehmer löscht seine EIGENE Interview-
 * Session über den unguessbaren access_token. Entfernt die Session-Row samt
 * Gesprächstranskript (conversation), Auswertung (result), Screening-Antworten,
 * Recording-/Visual-Capture-Referenzen, Consent-Stempel und Turn-Signalen.
 * Token-scoped (Capability-Auth, kein Login) wie jede öffentliche Interview-
 * Operation. Idempotent: ist keine Session (mehr) vorhanden → deleted=false.
 *
 * Scope-Grenze: dies löscht die Interview-DATEN des Teilnehmers. Die vom
 * Forscher angelegte Invite-Zeile (Label/E-Mail) bleibt unberührt und wird über
 * die org-seitige Teilnehmer-Erasure (DELETE …/participants/[id]?erase=true)
 * oder die Org-Voll-Löschung entfernt.
 */
export async function withdrawSessionByToken(
  accessToken: string,
): Promise<{ deleted: boolean }> {
  const supabase = createResearchSupabase();
  const { data, error } = await supabase
    .from("interview_sessions")
    .delete()
    .eq("access_token", accessToken)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  return { deleted: Boolean(data) };
}

/**
 * Perf-Etappe B2 — generate + persist the opening message for a session that
 * was created with skipOpening (empty conversation). Idempotent: if the
 * conversation already has content (a parallel request won, or the session
 * predates B2), it returns the current view WITHOUT an LLM call — so the
 * client may call this on every page load.
 *
 * RACE GUARD: the UPDATE is conditioned on `conversation = '[]'` (jsonb
 * equality), so a late writer can never overwrite a conversation that a
 * faster opener — or worse, an already-answering participant — has advanced.
 * Losing the race is not an error: we reload and serve the winner's row.
 */
export async function ensureOpeningTurn(
  token: string,
  onDelta?: TurnDelta,
  // E4 — frühes Reveal-Event (Multi-Stimulus); nur der Research-Pfad nutzt es.
  onShow?: (position: number) => void,
): Promise<PublicInterviewView | null> {
  const session = await loadByToken(token);
  if (!session) return null;
  if (
    session.status !== "open" ||
    session.conversation.length > 0 ||
    !session.dealContext
  ) {
    return toPublicView(session);
  }

  const model = session.model ?? process.env.VOICE_MODEL ?? DEFAULT_VOICE_MODEL;
  const opening =
    session.kind === "research"
      ? await nextResearchMessage(
          session.dealContext as unknown as ResearchInput,
          [],
          session.language,
          model,
          onDelta,
          onShow,
        )
      : session.kind === "checkin"
        ? await nextCheckinMessage(
            session.dealContext as unknown as CheckinInput,
            [],
            session.language,
            model,
            onDelta,
          )
        : await nextInterviewMessage(
            session.dealContext as InterviewInput,
            [],
            session.language,
            model,
            onDelta,
          );

  // E3/E4 — Opening-Begründung + Reveal-Marker additiv mitschreiben.
  const conversation: InterviewTurn[] = [
    buildAgentTurn(opening.message, opening.why, opening.showStimulusPosition),
  ];
  const supabase = createResearchSupabase();
  const { data, error } = await supabase
    .from("interview_sessions")
    .update({ conversation: conversation as unknown as Json })
    .eq("access_token", token)
    // jsonb equality — Postgres normalizes jsonb at parse, so '[]' matches
    // regardless of how the empty array was ever formatted on write.
    .eq("conversation", "[]")
    .eq("status", "open")
    .select()
    .maybeSingle();
  if (error) {
    throw new Error(`Failed to persist opening turn: ${error.message}`);
  }
  if (data) return toPublicView(toSession(data));

  // 0 rows matched — a parallel opener (or an answering participant) got
  // there first. Their row is authoritative; ours is discarded.
  const current = await loadByToken(token);
  return current ? toPublicView(current) : null;
}

/**
 * Id-keyed wrapper for backend-to-backend callers that know the session UUID
 * but not the capability token (the LiveKit voice bridge: its agent speaks
 * conversation[0] as the greeting, so a B2-created empty session must grow
 * its opening before the bridge hands out context). One narrow select to
 * resolve the token, then the token-keyed path with all its guarantees.
 */
export async function ensureOpeningTurnBySessionId(
  sessionId: string,
): Promise<PublicInterviewView | null> {
  const supabase = createResearchSupabase();
  const { data, error } = await supabase
    .from("interview_sessions")
    .select("access_token")
    .eq("id", sessionId)
    .maybeSingle();
  if (error) {
    throw new Error(`Failed to resolve session token: ${error.message}`);
  }
  if (!data) return null;
  return ensureOpeningTurn(data.access_token);
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
  onDelta?: TurnDelta,
  // E4 — frühes Reveal-Event (Multi-Stimulus); nur der Research-Pfad nutzt es.
  onShow?: (position: number) => void,
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

    // Decide BEFORE the LLM call: would pushing the agent message bring
    // conversation.length to the cap? If so AND the agent doesn't self-close
    // (done=false below), its message gets SWAPPED for the generic warm
    // closing — so on this one turn nothing may stream to the participant
    // (they'd watch a question appear that the swap then deletes).
    //
    // The cap is measured against `history.length + 1` because the agent's
    // turn isn't appended yet — we're predicting the row we're about to
    // push.
    const wouldHitCap = history.length + 1 >= MAX_RESEARCH_TOTAL_TURNS;

    const { done, message, why, showStimulusPosition } =
      await nextResearchMessage(
        input,
        history,
        session.language,
        model,
        wouldHitCap ? undefined : onDelta,
        // Cap-Close-Turns dürfen auch kein Reveal-Event feuern — die Message
        // wird gleich durch die generische Closing ersetzt.
        wouldHitCap ? undefined : onShow,
      );
    const forceCapClose = wouldHitCap && !done;
    const finalAgentText = forceCapClose
      ? RESEARCH_CAP_CLOSING_MESSAGE
      : message;
    // E3/E4 — Begründung + Reveal-Marker wandern additiv an den Agent-Turn.
    // NICHT beim Cap-Close: dort wurde die Modell-Nachricht durch die
    // generische Closing-Message ersetzt; Begründung wie Reveal gehörten zur
    // verworfenen Frage. Alte Reader (Voice-Agent build_history,
    // conversationToTranscript) lesen nur `text`; Teilnehmer-Payloads
    // strippen why in toPublicView (der Reveal-Marker bleibt — E5 braucht
    // ihn für Panel-Restore).
    history.push(
      forceCapClose
        ? { role: "agent", text: finalAgentText }
        : buildAgentTurn(finalAgentText, why, showStimulusPosition),
    );
    const finished = done || forceCapClose;

    if (finished) {
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

      // Persist the completed transcript as a calls row (account_id = null,
      // deal_id = null — allowed under calls_single_parent_chk which says
      // "not both set", not "exactly one") and run the Product Discovery
      // classifier (Opus, ~10–40s) OFF the participant's critical path via
      // after(): the conversation is already saved above, so the participant
      // gets their completion response immediately instead of waiting on the
      // classifier. Best-effort — any failure is logged, never thrown, and
      // never blocks the response.
      after(async () => {
        try {
          await persistResearchTranscriptAndDiscovery({
            orgId: session.orgId,
            planId: session.planId,
            inviteId: session.inviteId,
            transcript: conversationToTranscript(history),
            visualCapture: session.visualCapture,
          });
        } catch (err) {
          console.error(
            "[research] discovery analysis failed (conversation still saved):",
            err instanceof Error ? err.message : err,
          );
        }
      });

      // E1 Turn-Signale — Signal-Sidecar NACH der Teilnehmer-Response (after()
      // = waitUntil-Muster der Post-Loss-Extraktion unten): ein Haiku-Call über
      // das soeben final persistierte Transkript, gated im Sidecar selbst auf
      // plan.signals_enabled (Opt-in, default OFF) + consent_accepted_at
      // (E0-Kopplung) + turn_signals IS NULL (Idempotenz). Fehler bleiben im
      // Sidecar (geloggt, nie geworfen) — dieser Pfad ist davon unberührbar.
      after(() => runTurnSignalsSidecar(session.id));

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
      onDelta,
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
    onDelta,
  );
  history.push({ role: "agent", text: message });

  const finished = done || agentTurnCount(history) >= MAX_AGENT_TURNS;

  if (finished) {
    // Decouple the loss-reason extraction from the participant's request path.
    // The closing message (the `nextInterviewMessage` Opus call above) is what
    // the participant actually sees and MUST be in the response. The loss-reason
    // extraction is a SECOND Opus call producing purely internal analytics
    // (extracted_reason / evidence / matched_risk_prediction / result) that the
    // participant never sees — `toPublicView` exposes none of those fields. So
    // we persist the completed status + closing message NOW and return
    // immediately, instead of making the participant wait that extra Opus call
    // before they see "completed".
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
        `Failed to finalize interview_session: ${error?.message ?? "no row returned"}`,
      );
    }

    // Run the extraction AFTER the response is sent. `after` (next/server) is
    // backed by Vercel's `waitUntil`, which extends the serverless invocation's
    // lifetime until this promise settles — so, unlike a bare floating promise,
    // the extraction is NOT cut off when the response goes out, and its result
    // still lands reliably in the same row (just shortly after the participant
    // already saw completion). The extraction failing must never surface to, or
    // retroactively break, the already-sent participant response, so it is
    // caught and logged here rather than thrown.
    after(async () => {
      try {
        const result = await extractLossReasonFromInterview(
          input,
          history,
          model,
        );
        const { error: extractionError } = await supabase
          .from("interview_sessions")
          .update({
            extracted_reason: result.extractedReason,
            evidence: result.evidence,
            matched_risk_prediction: result.matchedRiskPrediction,
            result: result as unknown as Json,
          })
          .eq("access_token", token);
        if (extractionError) {
          throw new Error(extractionError.message);
        }
      } catch (err) {
        console.error(
          "[post-loss] loss-reason extraction failed (session already completed):",
          err instanceof Error ? err.message : err,
        );
      }
    });

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
