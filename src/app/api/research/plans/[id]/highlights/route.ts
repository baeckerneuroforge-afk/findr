import { NextResponse, type NextRequest } from "next/server";

import { requireOrgIdOrError } from "@/lib/auth/org";
import { getResearchPlan } from "@/lib/research/plans-service";
import {
  generateHighlightReel,
  HighlightReelUnavailableError,
} from "@/lib/research/highlight-reels";

/**
 * /api/research/plans/[id]/highlights — Highlight-Reel for ONE study.
 *
 * Compute-on-demand: the reel is derived from the verdichtungen + synthesis
 * and NOT persisted (no `highlight_reels` table). Same auth + plan-ownership
 * gate as /synthesis and /chat. The engine itself contains the zero-token
 * short-circuits — a study with no synthesis / no condensations / no
 * haystack returns an empty reel WITHOUT calling Opus.
 *
 * Both POST and GET delegate to the same engine call:
 *   - POST — the canonical UI trigger ("Reel erzeugen" button)
 *   - GET  — direct-URL / programmatic read; same body shape
 *
 * Because each call is an Opus invocation, the UI gates the request on a
 * user click and does NOT auto-fetch on mount. There's no caching layer
 * here — that's a deliberate choice to keep the surface minimal until we
 * see whether persistence is worth a migration.
 *
 * Surface:
 *   401/403  — auth fail (via requireOrgIdOrError)
 *   404      — plan not found in this org (engine also throws on a
 *              between-checks race; mapped to 404 too)
 *   500      — engine threw (Opus unavailable, schema validation lost twice,
 *              DB read failure)
 *   200      — { success: true, reel: HighlightReel }
 */

async function handleHighlights(
  planId: string,
  orgId: string,
): Promise<NextResponse> {
  // Plan-ownership gate. Filters by org_id; null = not present OR not in
  // this org. Either way → 404, no cross-org existence leak.
  const plan = await getResearchPlan(orgId, planId);
  if (!plan) {
    return NextResponse.json(
      { error: "Research plan not found" },
      { status: 404 },
    );
  }

  try {
    const reel = await generateHighlightReel({ orgId, planId });
    return NextResponse.json({ success: true, reel });
  } catch (err) {
    // generateHighlightReel throws HighlightReelUnavailableError when the
    // plan vanished between the ownership check and the engine load (rare
    // race; map to 404). Everything else is treated as engine failure.
    if (
      err instanceof HighlightReelUnavailableError &&
      err.message.includes("not found")
    ) {
      return NextResponse.json(
        { error: "Research plan not found" },
        { status: 404 },
      );
    }
    console.error(
      `[/api/research/plans/${planId}/highlights] engine failed:`,
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      {
        error: "Highlight reel failed",
        detail: err instanceof Error ? err.message : "unknown",
      },
      { status: 500 },
    );
  }
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;
  const { orgId } = orgOrError;

  const { id: planId } = await params;
  return handleHighlights(planId, orgId);
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;
  const { orgId } = orgOrError;

  const { id: planId } = await params;
  return handleHighlights(planId, orgId);
}
