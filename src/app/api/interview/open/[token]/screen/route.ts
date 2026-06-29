import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { DEFAULT_LOCALE } from "@/i18n/locale";
import {
  findOpenLinkByAccessToken,
  countOpenLinkSessions,
  isOpenLinkAtCapacity,
  findOpenLinkSessionByParticipant,
} from "@/lib/research/open-links";
import { isOpenLinkExpired } from "@/lib/research/open-link-expiry";
import { getResearchPlan } from "@/lib/research/plans-service";
import { createResearchInterview } from "@/lib/research/research-orchestration";
import { recordScreeningResponse } from "@/lib/research/screening-responses";
import { coercePanelInbound, type PanelContext } from "@/lib/research/panel";
import { evaluateScreening } from "@/lib/screening/evaluate";
import { ScreeningAnswersSchema } from "@/lib/schemas/screening";
import {
  consentTextVersion,
  markSessionConsentByToken,
} from "@/lib/voice-agent/session-service";
import type { Json } from "@/types/database";

/**
 * POST /api/interview/open/[token]/screen — the OPEN-LINK screening gate +
 * session hand-off (Phase 4, Baustein 2 — Etappe 4).
 *
 * The walk-in analog of POST /api/interview/[token]/screen, kept PHYSICALLY
 * SEPARATE: it resolves the token ONLY through findOpenLinkByAccessToken — the
 * invite resolver (findInviteByAccessToken) and the load-bearing !invite.org_id
 * guard are NEVER touched here, so there is no shared branch that could fall
 * back to the sealed null-org path.
 *
 * ── DREI KRITISCHE INVARIANTEN (Plan §5.1 / §8) ──────────────────────────────
 *  1. The shared OPEN-LINK TOKEN must NEVER become a session token. On qualify
 *     we ALWAYS mint a FRESH session token (createResearchInterview →
 *     createInterviewSession.generateToken, because inviteId is null) and return
 *     it so the client redirects to /interview/[freshSessionToken]. If the open
 *     token became the session token, all walk-ins would collide on one session
 *     (cross-participant data exposure within the org).
 *  2. MANDANTENTRENNUNG: org_id + plan_id come EXCLUSIVELY from the open-link row
 *     (server-bound), NEVER from the request body. The body carries ONLY the
 *     screening answers (ScreeningAnswersSchema — no org/plan/link field; Zod
 *     strips any extra keys). getResearchPlan(link.org_id, link.plan_id) is the
 *     second structural barrier: a plan of another org → null → no session.
 *  3. The null-org invite guard + the per-invite path stay byte-identical.
 *
 * Flow:
 *   token → exactly one ACTIVE open-link row (fail-closed null → 404).
 *   valid_until expired → entry denied, NO session (enforced, not just shown).
 *   HARD SCREENING REQUIREMENT: open links presuppose screening (the E2
 *     guardrail, enforced here). A plan WITHOUT screening_questions → entry
 *     denied, NO session. A no-screening open link can never mint a session.
 *   evaluateScreening (deterministic, KI-frei, identity-free):
 *     QUALIFIED → ANTI-ABUSE CAP (E5) first: if the link has a max_sessions cap
 *       and the COUNT of sessions already attributed to it (open_link_id, org-
 *       scoped) is at/over the cap → "study is full", NO session, NO Opus turn,
 *       NO qualified quote. The COUNT sits BEFORE createResearchInterview (the
 *       Opus turn), so a full link costs zero AI spend. Only created sessions
 *       carry open_link_id → rejections never consume the cap. Under cap →
 *       createResearchInterview({ orgId, planId, inviteId: null,
 *       openLinkId: link.id, screeningAnswers }) — fires the opening Opus turn,
 *       inserts ONE interview_sessions row (org_id = link.org_id NOT NULL,
 *       invite_id NULL, open_link_id = link.id, FRESH access_token) — PLUS ONE
 *       anonymous research_screening_responses row (verdict='qualified'). Returns
 *       the fresh sessionToken → client redirects to /interview/[sessionToken].
 *     REJECTED → NO session, NO Opus turn, NO answers; ONE anonymous row
 *       (verdict='rejected', no profile). Client shows the rejection screen.
 *
 * Idempotency / re-try: the open-link token is a SHARED credential, so every
 * qualified submit deliberately creates a NEW session with its own fresh token
 * (N walk-ins ⇒ N distinct sessions). The qualified quote is written ONLY when
 * status === 'created'. Re-try after rejection is allowed (anonymous, counted).
 * A refresh on the resulting SESSION token resolves via loadByToken on the
 * separate /interview/[sessionToken] path and creates nothing new.
 */

const TokenSchema = z.string().min(20).max(200);
// `panel` is the ADDITIVE, OPTIONAL panel-attribution bucket forwarded by the
// open-link entry component when a Prolific PID rode in on the entry URL. Typed
// as unknown here on purpose — the REAL validation (PID charset/length, no
// injection) happens server-side via coercePanelInbound below, the persistence
// trust boundary. Non-panel submits omit it entirely → byte-identical to today.
const BodySchema = z.object({
  answers: ScreeningAnswersSchema,
  panel: z.unknown().optional(),
  // E0: Gate-Signal des mandatory ConsentStep (OpenLinkEntry sendet immer true —
  // der Step liegt strukturell vor dem Submit). Bestätigt nur die UI-Handlung;
  // der Zeitstempel entsteht server-seitig. Optional, damit ältere gecachte
  // Clients während eines Rollouts nicht auf 400 laufen (dann bleibt der
  // Stempel schlicht leer — ehrlich statt erfunden).
  consentAccepted: z.boolean().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const t = await getTranslations({
    locale: DEFAULT_LOCALE,
    namespace: "errors",
  });

  const tokenParsed = TokenSchema.safeParse(token);
  if (!tokenParsed.success) {
    return NextResponse.json(
      { error: t("interview.invalidLink") },
      { status: 400 },
    );
  }

  // ① Token → exactly one ACTIVE open-link row. Disabled / unknown → null → 404.
  //    org_id + plan_id are read from THIS row only; no client-supplied org/plan
  //    anywhere on this path. The invite resolver is never called.
  const link = await findOpenLinkByAccessToken(tokenParsed.data);
  if (!link) {
    return NextResponse.json({ error: t("notFound.interview") }, { status: 404 });
  }

  // ② Expiry ENFORCED at session-create time (not just rendered): an expired
  //    link yields NO session and NO quote.
  if (isOpenLinkExpired(link.valid_until)) {
    return NextResponse.json({ available: false }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: t("invalidRequestBody"), details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Panel-Anbieter E1 — die externe Teilnehmer-ID aus dem (client-gelieferten)
  // Body server-seitig RE-VALIDIEREN (charset/Länge, kein Injection); null, wenn
  // kein/ungültiger PID → der ganze Pfad bleibt byte-identisch zum Nicht-Panel-
  // Walk-in (panel_context wird nie gesetzt, kein Redirect). Nie blind übernehmen.
  const panelInbound = coercePanelInbound(parsed.data.panel);

  // ③ Second structural barrier (inherited unchanged): getResearchPlan enforces
  //    .eq("org_id", link.org_id).eq("id", link.plan_id). A plan of another org
  //    — or any denorm drift — resolves to null → fail-closed, no session.
  const plan = await getResearchPlan(link.org_id, link.plan_id);
  const questions = plan?.screeningQuestions ?? [];

  // ④ HARD SCREENING REQUIREMENT (E2 guardrail enforced): open links presuppose
  //    screening. No questions configured → entry denied, NO session, NO quote
  //    (this is a config denial, not a participant rejection — nothing to count).
  if (questions.length === 0) {
    return NextResponse.json({ available: false }, { status: 403 });
  }

  // ④b PANEL-DEDUP (E1) — VOR Screening + Cap + Opus-Turn. Ein Panel-Link ist ein
  //    GETEILTES Credential; ein Teilnehmer kann ihn neu laden oder erneut
  //    eintreten. Hat dieselbe PID an DIESEM Link bereits eine Session, schließen
  //    wir kurz und geben den BESTEHENDEN frischen Session-Token zurück — KEINE
  //    neue Session, KEIN zweiter Opus-Turn, KEINE doppelte Cap-Belastung, KEINE
  //    doppelte Screening-Quote (die wurde beim ersten Mal geschrieben). Der
  //    Client redirectet auf /interview/[sessionToken] und der Teilnehmer setzt
  //    sein Gespräch fort (oder sieht — falls abgeschlossen — den Completion-
  //    Redirect). Nur auf dem Panel-Pfad; Nicht-Panel-Submits überspringen das.
  if (panelInbound) {
    const existing = await findOpenLinkSessionByParticipant(
      link.org_id,
      link.id,
      panelInbound.participantId,
    );
    if (existing) {
      // E0: der Wiederkehrer hat soeben (erneut) den ConsentStep bestätigt —
      // stempeln, falls die Session noch keinen Stempel trägt (idempotent:
      // ein vorhandener ERST-Stempel wird nie überschrieben). Best-effort.
      if (parsed.data.consentAccepted === true) {
        await markSessionConsentByToken(
          existing.accessToken,
          consentTextVersion(),
        );
      }
      return NextResponse.json({
        qualified: true,
        sessionToken: existing.accessToken,
        resumed: true,
      });
    }
  }

  // ⑤ Deterministic, KI-frei, identity-free.
  const { qualified } = evaluateScreening(questions, parsed.data.answers);

  if (!qualified) {
    // Rejected: no session, no Opus turn — only the anonymous quote row.
    await recordScreeningResponse(link.org_id, link.plan_id, "rejected");
    return NextResponse.json({ qualified: false });
  }

  // ⑥ ANTI-ABUSE CAP (E5) — the structural cost brake, placed BEFORE session
  //    creation. Qualified means the next step (createResearchInterview) mints
  //    a session token, and every Opus turn (the opening included, since
  //    Perf-B2 streamed lazily) hangs off that token — no session, no spend. So
  //    we COUNT first: sessions already attributed to THIS link, org-scoped.
  //    Only created/qualified sessions carry open_link_id, so REJECTIONS never
  //    consume the cap. At/over the cap → NO session, NO Opus turn, NO qualified
  //    quote — the friendly "study is full" denial. A transient count error fails
  //    CLOSED (isOpenLinkAtCapacity treats used=null as full), protecting spend.
  //    There is NO unlimited mode: an unset cap (null) is clamped to the hard
  //    safety ceiling OPEN_LINK_HARD_CAP, so a leaked/shared link can NEVER mint
  //    unbounded sessions — the cap is therefore ALWAYS enforced (the only guard
  //    against an open link becoming an unbounded spend tor).
  const used = await countOpenLinkSessions(link.org_id, link.id);
  if (isOpenLinkAtCapacity(link.max_sessions, used)) {
    // 403 {full:true} is produced ONLY here — textually before
    // createResearchInterview — so this response shape itself proves no Opus
    // turn fired (the COUNT is the only DB read on this branch).
    return NextResponse.json({ available: false, full: true }, { status: 403 });
  }

  // ⑦ Qualified + under cap: mint a FRESH session via the canonical path.
  //    inviteId: null → createInterviewSession generates a brand-new access_token
  //    (the open-link token is NEVER reused). open_link_id = link.id stamps the
  //    attribution (and is what the cap COUNT above measures).
  //
  //    Panel-Anbieter E1/E2: ist es ein Panel-Eintritt, bauen wir hier den
  //    panel_context-Snapshot — die validierten Inbound-Felder PLUS die
  //    Complete-Return-URL aus der Link-Completion-Konfig (E2). Der Snapshot macht
  //    die Session selbst-enthalten: der Completion-Redirect (CompletedPanel)
  //    braucht später keinen zweiten Read des offenen Links. complete_url ist
  //    null, wenn (noch) keine E2-Konfig hinterlegt ist → reine Attribution.
  //    Nicht-Panel: panelContext bleibt null → der INSERT referenziert die Spalte
  //    nie (byte-identisch).
  const panelContext: PanelContext | null = panelInbound
    ? {
        provider: panelInbound.provider,
        participant_id: panelInbound.participantId,
        study_id: panelInbound.studyId,
        session_id: panelInbound.sessionId,
        complete_url: link.panel_completion?.complete_url ?? null,
      }
    : null;

  const result = await createResearchInterview({
    orgId: link.org_id,
    planId: link.plan_id,
    inviteId: null,
    openLinkId: link.id,
    screeningAnswers: parsed.data.answers as unknown as Json,
    panelContext: panelContext as unknown as Json | null,
  });

  if (result.status === "created" && result.accessToken) {
    // E0: Consent-Stempel auf die FRISCHE Session (server-seitiger Zeitstempel,
    // best-effort, niemals pfad-blockierend). Der mandatory ConsentStep lag
    // strukturell vor diesem Submit.
    if (parsed.data.consentAccepted === true) {
      await markSessionConsentByToken(result.accessToken, consentTextVersion());
    }
    // Exactly one qualified row — written only when WE created the session.
    await recordScreeningResponse(link.org_id, link.plan_id, "qualified");
    // Hand back the FRESH session token; the client redirects to
    // /interview/[sessionToken] (NEVER the open-link token).
    return NextResponse.json({
      qualified: true,
      sessionToken: result.accessToken,
    });
  }

  // PANEL DEDUP RACE BACKSTOP (E1): the sequential dedup at ④b covers the common
  // re-entry case, but a CONCURRENT first-entry of the same NEW PID (double-click
  // / parallel retry) can pass ④b twice and both reach the INSERT. The fresh
  // session tokens differ, so the access_token UNIQUE does NOT collide — instead
  // the partial-unique index interview_sessions_open_link_panel_pid_idx
  // (open_link_id, panel_context->>'participant_id') makes the LOSER's INSERT fail
  // → createResearchInterview maps it to a non-'created' status here. The WINNER's
  // row now exists, so we re-read it (org+link+PID scoped) and hand back ITS token:
  // ONE session, ONE cap slot, NO duplicate qualified quote (the winner already
  // wrote it). This mirrors getPublicSession's loadByToken backstop after a raced
  // invite insert. Only the rare wasted opening Opus turn remains — the same,
  // explicitly-accepted edge the invite lazy-create + walk-in paths already carry.
  if (panelInbound) {
    const raced = await findOpenLinkSessionByParticipant(
      link.org_id,
      link.id,
      panelInbound.participantId,
    );
    if (raced) {
      // E0: gleiche Stempel-Logik wie am ④b-Dedup — der Verlierer des
      // Insert-Race kam ebenfalls durchs Consent-Gate (idempotent, best-effort).
      if (parsed.data.consentAccepted === true) {
        await markSessionConsentByToken(
          raced.accessToken,
          consentTextVersion(),
        );
      }
      return NextResponse.json({
        qualified: true,
        sessionToken: raced.accessToken,
        resumed: true,
      });
    }
  }

  // Non-panel: no fallback loadByToken — the open-link token is NOT a session
  // token, so it must never be matched against interview_sessions. With distinct
  // fresh tokens and no participant-id index on this path, a non-'created' status
  // is a genuine failure.
  console.error(
    `[open-screen] createResearchInterview failed: status=${result.status} ${result.message ?? ""}`,
  );
  return NextResponse.json({ error: t("unexpected") }, { status: 500 });
}
