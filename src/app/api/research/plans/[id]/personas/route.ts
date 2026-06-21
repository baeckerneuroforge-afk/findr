import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";

import { requireOrgIdOrError } from "@/lib/auth/org";
import { getResearchPlan } from "@/lib/research/plans-service";
import { generatePersonas } from "@/lib/synthesis/audience-personas";

/**
 * POST /api/research/plans/[id]/personas — create / re-run the Persona stage
 * (Spec docs/klymeo-personas-feature-spec-2026-06-21.md). Mirrors the synthesis
 * route: mandatory auth + plan-ownership gate before the engine call.
 *
 * generatePersonas returns a DOMAIN envelope (status). Only plan-not-found is a
 * 404; a thrown engine error is a 500. The other domain states
 * (generated / no_insights / insufficient_data / wrong_study_type) come back as
 * 200 with the envelope so the client localizes the message itself — the
 * min-interview gate and the study-type guard are not HTTP errors, they are
 * expected outcomes the UI renders.
 *
 * Surface:
 *   401/403   — auth fail (via requireOrgIdOrError)
 *   404       — plan not found in this org
 *   500       — engine threw (Opus unavailable / DB write fail)
 *   200       — { success: true, result: GeneratePersonasResult }
 */

// One long Opus call over the whole study — same ceiling as synthesis / voice.
export const maxDuration = 300;

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const t = await getTranslations("errors");
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;
  const { orgId } = orgOrError;

  const { id: planId } = await params;

  // Plan-ownership check (same as the synthesis route): null = not present or
  // not in this org — either way a 404, we don't leak cross-org existence.
  const plan = await getResearchPlan(orgId, planId);
  if (!plan) {
    return NextResponse.json(
      { error: t("notFound.researchPlan") },
      { status: 404 },
    );
  }

  try {
    const result = await generatePersonas(orgId, planId);
    return NextResponse.json({ success: true, result });
  } catch (err) {
    console.error(
      "[research/personas] failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { error: t("research.personasFailed") },
      { status: 500 },
    );
  }
}
