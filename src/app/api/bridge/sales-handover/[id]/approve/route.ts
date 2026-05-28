import { NextResponse, type NextRequest } from "next/server";

import { requireOrgIdOrError } from "@/lib/auth/org";
import { approveSalesHandoverSuggestion } from "@/lib/bridge/sales-to-cs";

/**
 * POST /api/bridge/sales-handover/[id]/approve
 *
 * Approves a pending sales_handover suggestion. The handler writes an
 * account_health_scores row with analysis_method='heuristic' +
 * source_call_id=null + the derived starter signals; then marks the
 * suggestion approved.
 *
 * Surface:
 *   401/403  — auth fail
 *   404      — suggestion not found / not pending / wrong kind
 *   500      — DB write failed (health-score insert or suggestion update)
 *   200      — { success: true, healthScoreId, healthScore, healthLevel,
 *                accountId }
 *
 * Separate from /api/bridge/suggestions/[id]/approve (Brücke #1) by design
 * — that route's body shape and side effects (research_plan + Opus
 * generateInterviewGuide) don't fit this kind. Keeping them split means
 * each brücke owns its lifecycle without runtime dispatch ambiguity.
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;
  const { orgId } = orgOrError;

  const { id } = await params;

  try {
    const result = await approveSalesHandoverSuggestion(orgId, id);
    if (!result) {
      return NextResponse.json(
        { error: "Suggestion not found, not pending, or wrong kind" },
        { status: 404 },
      );
    }
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error(
      `[POST /api/bridge/sales-handover/${id}/approve] failed:`,
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      {
        error: "Could not approve sales-handover suggestion",
        detail: err instanceof Error ? err.message : "unknown",
      },
      { status: 500 },
    );
  }
}
