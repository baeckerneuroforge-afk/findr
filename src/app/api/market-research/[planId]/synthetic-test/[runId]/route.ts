import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";

import { requireOrgIdOrError } from "@/lib/auth/org";
import { getResearchPlan } from "@/lib/research/plans-service";
import { deleteSyntheticTestRun } from "@/lib/synthetic/service";

/**
 * DELETE /api/market-research/[planId]/synthetic-test/[runId] — delete a dry-run
 * (its synthetic sessions cascade). Test-data hygiene: a dry-run is throwaway,
 * so the user can clear it. Org+plan scoped; runId re-bound server-side.
 *
 * 200 { success, deleted } · 401/403 auth · 404 plan not in org · 500.
 */

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ planId: string; runId: string }> },
): Promise<NextResponse> {
  const t = await getTranslations("errors");
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;
  const { orgId } = orgOrError;

  const { planId, runId } = await params;
  const plan = await getResearchPlan(orgId, planId);
  if (!plan || plan.studyType !== "market_research") {
    return NextResponse.json(
      { error: t("notFound.researchPlan") },
      { status: 404 },
    );
  }

  try {
    const deleted = await deleteSyntheticTestRun({ orgId, planId, runId });
    return NextResponse.json({ success: true, deleted });
  } catch (err) {
    console.error(
      `[DELETE /api/market-research/${planId}/synthetic-test/${runId}] failed:`,
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      {
        error: t("unexpected"),
        detail: err instanceof Error ? err.message : "unknown",
      },
      { status: 500 },
    );
  }
}
