import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";

import { requireOrgIdOrError } from "@/lib/auth/org";
import { approveResearchRiskSuggestion } from "@/lib/bridge/research-to-sales";

/**
 * POST /api/bridge/research-to-sales/[id]/approve
 *
 * Approves a pending research_to_risk suggestion. Pure state transition
 * — no side effects (no plan creation, no health-score write). The
 * approved row IS the artifact: it appears in the Watch-Liste on the
 * Sales-surface panel.
 *
 * Separate from /api/bridge/suggestions/[id]/approve (Brücke #1, which
 * triggers Opus for guide generation) and from /api/bridge/sales-handover/
 * [id]/approve (Brücke #2, which writes account_health_scores). Each
 * brücke owns its lifecycle without runtime dispatch ambiguity.
 *
 * Surface:
 *   401/403  — auth fail
 *   404      — suggestion not found / not pending / wrong kind
 *   500      — DB update failed
 *   200      — { success: true, suggestion: ResearchRiskSuggestion }
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const t = await getTranslations("errors");
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;
  const { orgId } = orgOrError;

  const { id } = await params;

  try {
    const suggestion = await approveResearchRiskSuggestion(orgId, id);
    if (!suggestion) {
      return NextResponse.json(
        { error: t("bridge.suggestionWrongState") },
        { status: 404 },
      );
    }
    return NextResponse.json({ success: true, suggestion });
  } catch (err) {
    console.error(
      `[POST /api/bridge/research-to-sales/${id}/approve] failed:`,
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      {
        error: t("bridge.couldNotApproveResearchToRisk"),
      },
      { status: 500 },
    );
  }
}
