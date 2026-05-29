import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";

import { requireOrgIdOrError } from "@/lib/auth/org";
import { dismissBridgeSuggestion } from "@/lib/bridge/cs-to-research";

/**
 * POST /api/bridge/suggestions/[id]/dismiss
 *
 * Marks a pending bridge suggestion as 'dismissed' — the user rejected
 * the proposal. The cluster's signalType is NOT permanently blacklisted;
 * a future detector scan can re-surface the same signal if a new cohort
 * of churned accounts appears (the de-dup in detectAndPersistChurnSuggestions
 * only checks pending+approved, not dismissed).
 *
 * Surface:
 *   401/403  — auth fail
 *   404      — suggestion not found
 *   500      — DB update failed
 *   200      — { success: true, suggestion: BridgeSuggestion }
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
    const suggestion = await dismissBridgeSuggestion(orgId, id);
    if (!suggestion) {
      return NextResponse.json(
        { error: t("notFound.suggestion") },
        { status: 404 },
      );
    }
    return NextResponse.json({ success: true, suggestion });
  } catch (err) {
    console.error(
      `[POST /api/bridge/suggestions/${id}/dismiss] failed:`,
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      {
        error: t("bridge.couldNotDismiss"),
        detail: err instanceof Error ? err.message : "unknown",
      },
      { status: 500 },
    );
  }
}
