import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { requireOrgIdOrError } from "@/lib/auth/org";
import {
  getResearchPlan,
  updateResearchPlan,
} from "@/lib/research/plans-service";
import { ScreeningQuestionsSchema } from "@/lib/schemas/screening";

/**
 * POST /api/research/plans/[id]/screening-questions — die Screening-Fragen
 * einer Studie als Ganzes setzen (REPLACE, nicht Patch). Der Editor postet die
 * komplette Frage-Liste; sie wird Zod-validiert und in
 * research_plans.screening_questions geschrieben. Reine deterministische
 * Config, KEINE KI. Reads laufen über die Server-Component (getResearchPlan).
 *
 * Auth + Plan-Ownership exakt wie POST /quotas: requireOrgIdOrError +
 * getResearchPlan (orgId ist die Trust-Boundary).
 */

const BodySchema = z.object({
  questions: ScreeningQuestionsSchema,
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const t = await getTranslations("errors");
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;
  const { orgId } = orgOrError;

  const { id: planId } = await params;

  const plan = await getResearchPlan(orgId, planId);
  if (!plan) {
    return NextResponse.json(
      { error: t("notFound.researchPlan") },
      { status: 404 },
    );
  }

  const body = await req.json().catch(() => null);
  if (body === null || typeof body !== "object") {
    return NextResponse.json({ error: t("invalidRequestBody") }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: t("invalidRequestBody"), details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const updated = await updateResearchPlan(orgId, planId, {
    screeningQuestions: parsed.data.questions,
  });
  if (!updated) {
    return NextResponse.json(
      { error: t("research.screeningSaveFailed") },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    screeningQuestions: updated.screeningQuestions,
  });
}
