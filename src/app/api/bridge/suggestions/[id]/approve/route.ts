import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";

import { requireOrgIdOrError } from "@/lib/auth/org";
import { approveBridgeSuggestion } from "@/lib/bridge/cs-to-research";

/**
 * POST /api/bridge/suggestions/[id]/approve
 *
 * Approves a pending bridge suggestion: creates a research_plan draft from
 * the suggestion's derived_goal AND calls generateInterviewGuide to fill
 * topics. Both calls are tied together; if the guide-gen step fails the
 * plan is still created (and the suggestion marked approved) — the user
 * can regenerate topics from the plan-edit screen.
 *
 * Idempotency: a second approve on the same suggestion returns 404 because
 * approveBridgeSuggestion only acts on status='pending' rows. The first
 * approve's outcome stands.
 *
 * Surface:
 *   401/403  — auth fail
 *   404      — suggestion not found OR not in 'pending' state
 *   500      — engine threw (DB write fail on the suggestion row)
 *   200      — { success: true, planId, guideGenerated, guideError }
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
    const result = await approveBridgeSuggestion(orgId, id);
    if (!result) {
      // 404 covers both "doesn't exist" and "already non-pending" — a
      // probe can't distinguish them.
      return NextResponse.json(
        { error: t("bridge.suggestionAlreadyDecided") },
        { status: 404 },
      );
    }
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    console.error(
      `[POST /api/bridge/suggestions/${id}/approve] failed:`,
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      {
        error: t("bridge.couldNotApprove"),
      },
      { status: 500 },
    );
  }
}
