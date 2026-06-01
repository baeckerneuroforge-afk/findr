import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";

import { requireOrgIdOrError } from "@/lib/auth/org";
import { getResearchPlan } from "@/lib/research/plans-service";
import {
  startSyntheticTestRun,
  SyntheticRunRequestSchema,
} from "@/lib/synthetic/service";

/**
 * POST /api/market-research/[planId]/synthetic-test — start a synthetic dry-run.
 *
 * Org from Clerk (requireOrgIdOrError — owns 401/403), planId from the URL, both
 * verified together via getResearchPlan. The plan must be a market_research plan
 * (a non-market / unknown plan → 404, no cross-org existence leak). orgId/planId
 * NEVER travel through the body. The body only carries the run knobs (personas +
 * language), validated by SyntheticRunRequestSchema.
 *
 * STRICT SEPARATION: startSyntheticTestRun writes ONLY synthetic_test_* tables.
 *
 * 200 { success, run } · 400 bad body · 401/403 auth · 404 plan not in org · 500.
 */

// A run only inserts rows here (no LLM), but the step route does the heavy work;
// keep the generous serverless budget consistent across the pair.
export const maxDuration = 300;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ planId: string }> },
): Promise<NextResponse> {
  const t = await getTranslations("errors");
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;
  const { orgId } = orgOrError;

  const { planId } = await params;
  const plan = await getResearchPlan(orgId, planId);
  if (!plan || plan.studyType !== "market_research") {
    return NextResponse.json(
      { error: t("notFound.researchPlan") },
      { status: 404 },
    );
  }

  const body = await request.json().catch(() => null);
  if (body === null || typeof body !== "object") {
    return NextResponse.json(
      { error: t("invalidRequestBody") },
      { status: 400 },
    );
  }
  const parsed = SyntheticRunRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: t("invalidRequestBody"), details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const run = await startSyntheticTestRun({
      orgId,
      planId,
      request: parsed.data,
    });
    return NextResponse.json({ success: true, run });
  } catch (err) {
    console.error(
      `[POST /api/market-research/${planId}/synthetic-test] start failed:`,
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
