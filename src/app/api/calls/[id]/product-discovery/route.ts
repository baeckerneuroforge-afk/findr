import { NextResponse, type NextRequest } from "next/server";

import { requireOrgIdOrError } from "@/lib/auth/org";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { analyzeCallForProductDiscovery } from "@/lib/product-discovery/service";

/**
 * POST /api/calls/[id]/product-discovery — extract feature requests, pain
 * points, and themes from one call's transcript. Persists the result to
 * product_discovery_insights via the service layer.
 *
 * The org-membership check happens HERE, before the service call, by design:
 * `analyzeCallForProductDiscovery` takes only a callId and derives org_id
 * from the call row itself (cf. its docstring). Without this gate, a known
 * call-id from a different org would still be analysed and persisted under
 * that org — Opus cycles spent, row written cross-org. Mirror of the
 * pattern used by the Risk and Health analyze handlers (which let their
 * service do the check internally via getDealById / getAccount; ours can't
 * since the service doesn't take orgId).
 */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;
  const { orgId } = orgOrError;

  const { id: callId } = await params;

  const supabase = createAdminSupabaseClient();
  const { data: call, error: lookupError } = await supabase
    .from("calls")
    .select("id")
    .eq("org_id", orgId)
    .eq("id", callId)
    .maybeSingle();

  if (lookupError) {
    return NextResponse.json(
      { error: "Failed to look up call", detail: lookupError.message },
      { status: 500 },
    );
  }
  if (!call) {
    return NextResponse.json({ error: "Call not found" }, { status: 404 });
  }

  try {
    const insight = await analyzeCallForProductDiscovery(callId);
    if (!insight) {
      // Org-membership already verified, so null here means the call has no
      // transcript (loadCall in the service returns null in that case).
      // Nothing for the classifier to chew on.
      return NextResponse.json(
        { error: "Call has no transcript to analyze" },
        { status: 422 },
      );
    }
    return NextResponse.json({ success: true, insight });
  } catch (err) {
    return NextResponse.json(
      {
        error: "Product discovery analysis failed",
        detail: err instanceof Error ? err.message : "unknown",
      },
      { status: 500 },
    );
  }
}
