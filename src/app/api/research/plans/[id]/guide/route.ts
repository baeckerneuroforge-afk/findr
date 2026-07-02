import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { requireOrgIdOrError } from "@/lib/auth/org";
import {
  getResearchPlan,
  listPlanStimuli,
} from "@/lib/research/plans-service";
import {
  buildStimulusContext,
  generateInterviewGuide,
  GuideGeneratorUnavailableError,
} from "@/lib/research/guide-generator";
import { BUSINESS_CONTEXT_MAX_CHARS } from "@/lib/settings/org-settings-shared";

/**
 * POST /api/research/plans/[id]/guide — "Leitfaden mit KI generieren".
 *
 * Generates a structured Interview-Guide from the supplied Research-Ziel,
 * writes the mapped topics onto the existing research_plan, and returns
 * the full guide for the UI to render (so the researcher can review +
 * edit before the final save).
 *
 * Auth + plan-ownership posture exactly mirrors /synthesis and /chat:
 * requireOrgIdOrError → getResearchPlan(orgId, planId). 404 covers both
 * "plan doesn't exist" and "plan in another org" — no cross-org leak.
 *
 * Body shape (Zod-validated):
 *   { goal: string (3-2000 chars, mandatory),
 *     audienceType?: "b2b" | "b2c", who?: string (≤1000),
 *     businessContext?: string (≤2000 — E1 Unternehmens-/Produkt-Kontext),
 *     language?: string (≤16), topicCount?: int (3-10),
 *     useCase?: 5-Enum (Art der Studie → Themen-Fokus),
 *     interviewDepth?: "flach" | "mittel" | "tief" (→ Probe-Anzahl/Thema) }
 *
 * Surface:
 *   400  — invalid body shape
 *   401  — no auth
 *   403  — auth ok but no org context
 *   404  — plan not found in this org
 *   500  — engine threw (Opus unavailable, schema-validation lost twice, DB write)
 *   200  — { success: true, guide: InterviewGuide }
 */

const BodySchema = z.object({
  // 2 KB cap per the brief; min 3 to allow short-but-meaningful goals.
  goal: z.string().min(3).max(2000),
  audienceType: z.enum(["b2b", "b2c"]).optional(),
  // who-Cap = 1000, konsistent mit dem persona-Cap der Plan-Route
  // (src/app/api/research/plans/route.ts). War 200 → eine in der DB gültige
  // (bis 1000) bzw. von Konsoul vorgeschlagene (bis 240) Persona legte den
  // Entwurf an, kippte aber HIER die Generierung mit 400. Jetzt eine Zahl
  // end-to-end → keine lange Persona bricht den Leitfaden mehr.
  who: z.string().max(1000).optional(),
  // E1 — Unternehmens-/Produkt-Kontext. Trim + DIE Cap-Konstante (dieselbe wie
  // Plan-Routen, UI-maxLength und Org-Settings — ein logisches Feld = eine
  // Zahl, Lehre aus dem persona-Cap-Bug). Semantik: undefined = Feld nicht
  // gesendet → Fallback auf den persistierten plan.business_context; "" =
  // explizit geleert → KEIN Kontext (kein Fallback).
  businessContext: z.string().trim().max(BUSINESS_CONTEXT_MAX_CHARS).optional(),
  language: z.string().max(16).optional(),
  topicCount: z.number().int().min(3).max(10).optional(),
  // Art der Studie + Tiefe steuern den Themen-Fokus bzw. die Probe-Anzahl des
  // generierten Leitfadens. Werte spiegeln das Plan-Schema (use_case ohne
  // DB-CHECK, hier zod-validiert; interview_depth = flach|mittel|tief).
  useCase: z
    .enum([
      "general_survey",
      "brand_research",
      "creative_test",
      "concept_test",
      "usability_test",
    ])
    .optional(),
  interviewDepth: z.enum(["flach", "mittel", "tief"]).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const t = await getTranslations("errors");
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;
  const { orgId } = orgOrError;

  const { id: planId } = await params;

  // Plan-ownership gate. Same pattern as /chat and /synthesis. 404 on both
  // miss + cross-org so a probe can't distinguish.
  const plan = await getResearchPlan(orgId, planId);
  if (!plan) {
    return NextResponse.json(
      { error: t("notFound.researchPlan") },
      { status: 404 },
    );
  }

  // Body validation. The generator runs an Anthropic call per request, so
  // a hostile client without these caps could burn tokens — 2 KB on goal +
  // 1 KB on segment/role is plenty for a real research brief.
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      { error: t("invalidJsonBody") },
      { status: 400 },
    );
  }
  const parsed = BodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: t("invalidRequestBody"),
        detail: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  // E1 — Kontext-Auflösung: der Body gewinnt (Wizard sendet den Live-Stand,
  // auch "" für "explizit geleert"); ist das Feld gar nicht gesendet (klassische
  // Form, Bridge, ältere Clients), fällt die Route auf den am Plan
  // persistierten Kontext zurück — sonst würde eine Regenerierung über einen
  // kontext-losen Pfad den Leitfaden still generischer machen.
  const businessContext =
    parsed.data.businessContext !== undefined
      ? parsed.data.businessContext === ""
        ? undefined
        : parsed.data.businessContext
      : (plan.businessContext ?? undefined);

  // E2 — Stimulus-Analysen des Plans in die Generierung einspeisen — NUR für
  // Studienarten, in denen Teilnehmende Material bewerten (Konzept-/Creative-
  // Test; Body gewinnt, sonst Plan). Das Gating verhindert (a) einen
  // nutzlosen DB-Read für die Mehrheit der Studien und (b) dass Alt-Assets
  // nach einem Use-Case-Wechsel den Leitfaden einer Nicht-Material-Studie
  // kapern. Die Analyse ist beim Upload bereits gelaufen und persistiert
  // (research_plan_stimuli.analysis) — hier NUR lesen, kein Vision-Call.
  // Fail-open: keine analysierten Assets ⇒ kein MATERIAL-Block ⇒ User-Prompt
  // unverändert zum Vor-Verhalten.
  const effectiveUseCase = parsed.data.useCase ?? plan.useCase;
  const wantsStimuli =
    effectiveUseCase === "concept_test" || effectiveUseCase === "creative_test";
  const stimulusContext = wantsStimuli
    ? buildStimulusContext(await listPlanStimuli(orgId, planId))
    : undefined;

  try {
    const guide = await generateInterviewGuide({
      orgId,
      planId,
      goal: parsed.data.goal,
      audienceType: parsed.data.audienceType,
      who: parsed.data.who,
      businessContext,
      stimulusContext,
      language: parsed.data.language,
      topicCount: parsed.data.topicCount,
      useCase: parsed.data.useCase,
      interviewDepth: parsed.data.interviewDepth,
    });
    return NextResponse.json({ success: true, guide });
  } catch (err) {
    // Engine signals plan-disappeared-between-check-and-load as Unavailable
    // with "not found" in the message — map back to 404. All other engine
    // failures stay 500 (Opus unavailable, schema lost twice, DB write).
    if (
      err instanceof GuideGeneratorUnavailableError &&
      err.message.includes("not found")
    ) {
      return NextResponse.json(
        { error: t("notFound.researchPlan") },
        { status: 404 },
      );
    }
    console.error(
      `[POST /api/research/plans/${planId}/guide] engine failed:`,
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      {
        error: t("research.guideFailed"),
      },
      { status: 500 },
    );
  }
}
