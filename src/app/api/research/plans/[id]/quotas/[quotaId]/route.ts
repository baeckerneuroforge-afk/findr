import { NextResponse, type NextRequest } from "next/server";

import { requireOrgIdOrError } from "@/lib/auth/org";
import { getResearchPlan } from "@/lib/research/plans-service";
import { deleteQuota } from "@/lib/research/participant-pool";

/**
 * DELETE /api/research/plans/[id]/quotas/[quotaId] — eine Screening-Quote
 * entfernen. Auth + Plan-Ownership wie die übrigen Plan-Routes; deleteQuota
 * filtert zusätzlich org+plan+id (belt-and-braces). 404, wenn nichts traf.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; quotaId: string }> },
) {
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;
  const { orgId } = orgOrError;

  const { id: planId, quotaId } = await params;

  const plan = await getResearchPlan(orgId, planId);
  if (!plan) {
    return NextResponse.json({ error: "Research plan not found" }, { status: 404 });
  }

  const deleted = await deleteQuota(orgId, planId, quotaId);
  if (!deleted) {
    return NextResponse.json({ error: "Quote nicht gefunden" }, { status: 404 });
  }
  return NextResponse.json({ success: true, quotaId });
}
