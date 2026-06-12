import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";

import { requireOrgIdOrError } from "@/lib/auth/org";
import { getResearchPlan } from "@/lib/research/plans-service";
import { advanceSyntheticTestRun } from "@/lib/synthetic/service";

/**
 * POST /api/market-research/[planId]/synthetic-test/[runId]/step — advance the
 * run by ONE unit of work (run the next synthetic interview, or synthesize once
 * all are done). No body. The client loops this until status === "completed".
 *
 * Same auth + plan-ownership gate as the start route; the service additionally
 * re-binds runId to (orgId, planId) and returns null when it doesn't match →
 * 404 (never trust the URL runId alone). One step = one interview (+ classify)
 * or one synthesis — bounded well under the serverless timeout.
 *
 * 200 { success, run } · 401/403 auth · 404 plan or run not in org · 500.
 */

export const maxDuration = 300;

export async function POST(
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
    const run = await advanceSyntheticTestRun({ orgId, planId, runId });
    if (!run) {
      return NextResponse.json(
        { error: t("notFound.researchPlan") },
        { status: 404 },
      );
    }
    return NextResponse.json({ success: true, run });
  } catch (err) {
    console.error(
      `[POST /api/market-research/${planId}/synthetic-test/${runId}/step] failed:`,
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      {
        error: t("unexpected"),
      },
      { status: 500 },
    );
  }
}
