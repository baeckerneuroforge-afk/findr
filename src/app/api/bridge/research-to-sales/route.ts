import { NextResponse, type NextRequest } from "next/server";

import { requireOrgIdOrError } from "@/lib/auth/org";
import { listResearchRiskSuggestions } from "@/lib/bridge/research-to-sales";

/**
 * GET /api/bridge/research-to-sales
 *
 * Lists pending + approved suggestions for the current org. The panel
 * renders both — pending need a decision; approved are the watch-list.
 * Dismissed rows are excluded.
 *
 * No POST here — the scan endpoint lives at
 * /api/bridge/research-to-sales/scan (separate path for symmetry with the
 * other bridges and so the route is greppable by name).
 */
export async function GET(_request: NextRequest): Promise<NextResponse> {
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;
  const { orgId } = orgOrError;

  try {
    const suggestions = await listResearchRiskSuggestions(orgId);
    return NextResponse.json({ suggestions });
  } catch (err) {
    console.error(
      "[GET /api/bridge/research-to-sales] failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      {
        error: "Could not list research-to-risk suggestions",
        detail: err instanceof Error ? err.message : "unknown",
      },
      { status: 500 },
    );
  }
}
