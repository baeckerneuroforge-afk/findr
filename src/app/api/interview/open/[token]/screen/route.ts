import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { DEFAULT_LOCALE } from "@/i18n/locale";
import { findOpenLinkByAccessToken } from "@/lib/research/open-links";
import { isOpenLinkExpired } from "@/lib/research/open-link-expiry";
import { getResearchPlan } from "@/lib/research/plans-service";
import { createResearchInterview } from "@/lib/research/research-orchestration";
import { recordScreeningResponse } from "@/lib/research/screening-responses";
import { evaluateScreening } from "@/lib/screening/evaluate";
import { ScreeningAnswersSchema } from "@/lib/schemas/screening";
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
 *     QUALIFIED → createResearchInterview({ orgId, planId, inviteId: null,
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
const BodySchema = z.object({ answers: ScreeningAnswersSchema });

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

  // ⑤ Deterministic, KI-frei, identity-free.
  const { qualified } = evaluateScreening(questions, parsed.data.answers);

  if (!qualified) {
    // Rejected: no session, no Opus turn — only the anonymous quote row.
    await recordScreeningResponse(link.org_id, link.plan_id, "rejected");
    return NextResponse.json({ qualified: false });
  }

  // ⑥ Qualified: mint a FRESH session via the canonical path. inviteId: null →
  //    createInterviewSession generates a brand-new access_token (the open-link
  //    token is NEVER reused). open_link_id = link.id stamps the attribution.
  const result = await createResearchInterview({
    orgId: link.org_id,
    planId: link.plan_id,
    inviteId: null,
    openLinkId: link.id,
    screeningAnswers: parsed.data.answers as unknown as Json,
  });

  if (result.status === "created" && result.accessToken) {
    // Exactly one qualified row — written only when WE created the session.
    await recordScreeningResponse(link.org_id, link.plan_id, "qualified");
    // Hand back the FRESH session token; the client redirects to
    // /interview/[sessionToken] (NEVER the open-link token).
    return NextResponse.json({
      qualified: true,
      sessionToken: result.accessToken,
    });
  }

  // No fallback loadByToken here: the open-link token is NOT a session token, so
  // it must never be matched against interview_sessions. A non-'created' status
  // is a genuine failure (random fresh tokens make a unique-collision race
  // impossible — every qualified walk-in gets its own session).
  console.error(
    `[open-screen] createResearchInterview failed: status=${result.status} ${result.message ?? ""}`,
  );
  return NextResponse.json({ error: t("unexpected") }, { status: 500 });
}
