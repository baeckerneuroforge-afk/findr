import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";

import { requireOrgIdOrError } from "@/lib/auth/org";
import { getResearchPlan } from "@/lib/research/plans-service";
import { expandSynthesisNarrative } from "@/lib/synthesis/narrative";

/**
 * POST /api/research/plans/[id]/synthesis/expand — the post-hoc "Ausführlicher
 * machen" trigger. Runs ONLY the additive executive-narrative stage over the
 * EXISTING synthesis (no full re-synthesis), so the core synthesis is untouched.
 *
 * Same auth + ownership gate as the synthesis POST. Surface:
 *   401/403 — auth fail
 *   404     — plan not found in this org
 *   409     — no (finished) synthesis to expand
 *   500     — narrative stage threw
 *   200     — { success: true, executiveNarrative }
 */

// One Opus call — give it the same generous ceiling as the other LLM surfaces.
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

  const plan = await getResearchPlan(orgId, planId);
  if (!plan) {
    return NextResponse.json(
      { error: t("notFound.researchPlan") },
      { status: 404 },
    );
  }

  try {
    const expanded = await expandSynthesisNarrative(orgId, planId);
    if (expanded.status === "no_synthesis") {
      return NextResponse.json(
        { error: t("research.noSynthesisYet") },
        { status: 409 },
      );
    }
    return NextResponse.json({
      success: true,
      executiveNarrative: expanded.executiveNarrative,
    });
  } catch (err) {
    console.error(
      `[research/synthesis/expand] failed:`,
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { error: t("research.synthesisFailed") },
      { status: 500 },
    );
  }
}
