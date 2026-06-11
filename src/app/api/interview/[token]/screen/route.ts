import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { DEFAULT_LOCALE } from "@/i18n/locale";
import { findInviteByAccessToken } from "@/lib/research/scheduling";
import { getResearchPlan } from "@/lib/research/plans-service";
import { createResearchInterview } from "@/lib/research/research-orchestration";
import { recordScreeningResponse } from "@/lib/research/screening-responses";
import { evaluateScreening } from "@/lib/screening/evaluate";
import { ScreeningAnswersSchema } from "@/lib/schemas/screening";
import {
  CONSENT_TEXT_VERSION,
  loadByToken,
  markSessionConsentByToken,
} from "@/lib/voice-agent/session-service";
import type { Json } from "@/types/database";

/**
 * POST /api/interview/[token]/screen — the REAL screening gate (Etappe 4).
 *
 * Public, login-free; the capability is the unguessable invite access_token in
 * the URL. Runs the DETERMINISTIC evaluateScreening (NO AI) over the plan's
 * configured questions:
 *
 *   QUALIFIED → create the interview session via the SAME createResearchInterview
 *     path the no-screening flow uses (inserts the interview_sessions row;
 *     since Perf-B2 WITHOUT the opening turn — that streams in on the
 *     interview page), persists the answers onto that session, and
 *     appends ONE anonymous research_screening_responses row (verdict='qualified').
 *     The client then reloads → the page resolves to the session → interview.
 *
 *   REJECTED → NO session, NO interview_sessions row, NO Opus turn; appends ONE
 *     anonymous row (verdict='rejected', no profile, no answers). The client
 *     shows the rejection screen.
 *
 * Idempotency / re-try: the qualified row is written ONLY when WE create the
 * session (status='created'); the session's UNIQUE access_token means that
 * happens at most once per invite, so a refresh or double-submit finds the
 * existing session (loadByToken) and writes no extra row. Re-try after a
 * rejection is allowed — a fresh submit is a fresh attempt (counted, anonymous).
 */

const TokenSchema = z.string().min(20).max(200);
// E0: consentAccepted ist das ADDITIVE, OPTIONALE Gate-Signal des
// InviteConsentGate (Page rendert es VOR dem ScreeningGate). Es bestätigt nur,
// dass das UI-Gate passiert wurde — der Zeitstempel entsteht server-seitig
// (markSessionConsentByToken). Ohne Flag bleibt der Pfad byte-identisch.
const BodySchema = z.object({
  answers: ScreeningAnswersSchema,
  consentAccepted: z.boolean().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const tokenParsed = TokenSchema.safeParse(token);
  if (!tokenParsed.success) {
    const t = await getTranslations("errors");
    return NextResponse.json(
      { error: t("interview.invalidLink") },
      { status: 400 },
    );
  }

  const invite = await findInviteByAccessToken(tokenParsed.data);
  const t = await getTranslations({
    locale: invite?.language ?? DEFAULT_LOCALE,
    namespace: "errors",
  });
  if (!invite || !invite.org_id) {
    return NextResponse.json(
      { error: t("notFound.interview") },
      { status: 404 },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: t("invalidRequestBody"), details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Deterministic, KI-frei. Empty config → qualified (No-op) by construction.
  const plan = await getResearchPlan(invite.org_id, invite.plan_id);
  const questions = plan?.screeningQuestions ?? [];
  const { qualified } = evaluateScreening(questions, parsed.data.answers);

  if (!qualified) {
    // Rejected: no session, no Opus turn — only the anonymous quote row.
    await recordScreeningResponse(invite.org_id, invite.plan_id, "rejected");
    return NextResponse.json({ qualified: false });
  }

  // Qualified: create the session via the canonical path, carrying the answers.
  const result = await createResearchInterview({
    orgId: invite.org_id,
    planId: invite.plan_id,
    inviteId: invite.id,
    language: invite.language,
    screeningAnswers: parsed.data.answers as unknown as Json,
  });

  if (result.status === "created") {
    // E0: die Session trägt bei Invites denselben access_token wie der Invite —
    // der Consent-Stempel läuft daher über den Request-Token. Best-effort +
    // idempotent (nur erster Accept schreibt); niemals pfad-blockierend.
    if (parsed.data.consentAccepted === true) {
      await markSessionConsentByToken(tokenParsed.data, CONSENT_TEXT_VERSION);
    }
    // Exactly one qualified row — written only when WE created the session.
    await recordScreeningResponse(invite.org_id, invite.plan_id, "qualified");
    return NextResponse.json({ qualified: true });
  }

  // Not 'created': a cross-request racer / re-submit (session already exists →
  // idempotent success, NO extra row) or a genuine failure.
  const existing = await loadByToken(tokenParsed.data);
  if (existing) {
    // E0: auch der Race-/Re-Submit-Gewinner kam durchs Consent-Gate — stempeln,
    // falls noch nicht geschehen (idempotent, best-effort).
    if (parsed.data.consentAccepted === true) {
      await markSessionConsentByToken(tokenParsed.data, CONSENT_TEXT_VERSION);
    }
    return NextResponse.json({ qualified: true });
  }

  console.error(
    `[screen] createResearchInterview failed: status=${result.status} ${result.message ?? ""}`,
  );
  return NextResponse.json({ error: t("unexpected") }, { status: 500 });
}
