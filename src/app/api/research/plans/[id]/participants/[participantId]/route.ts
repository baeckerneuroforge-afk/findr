import { NextResponse, type NextRequest } from "next/server";

import { requireOrgIdOrError } from "@/lib/auth/org";
import { createResearchSupabase } from "@/lib/research/db";
import { getResearchPlan } from "@/lib/research/plans-service";

/**
 * DELETE /api/research/plans/[id]/participants/[participantId]
 *
 * Hard-deletes a research_invites row. "Participant" is the UI-side
 * terminology; in the DB the row lives in `research_invites` (1 invite =
 * 1 participant on a plan). The single-line nominal-ID-aware path is
 * intentional — by carrying both planId and participantId in the URL we
 * get an extra ownership check (the invite must belong to *that* plan in
 * *that* org), which is one more guardrail than the existing
 * /api/research/invites/[id]/* routes that scope only by orgId+inviteId.
 *
 * FK behavior on cascade: interview_sessions.research_invite_id has
 * ON DELETE SET NULL (migration 20260612), so deleting an invite that
 * already kicked off (or even completed) a session does NOT delete the
 * session — the session row stays and its research_invite_id becomes
 * null. That's the intended semantics: the conversation/analysis data is
 * preserved as a research artifact even if the inviter "removed the
 * participant" from the plan list. If a user actually wanted to wipe the
 * data too, they'd need to delete the session as well — out of scope for
 * this v1 endpoint.
 *
 * Auth: requireOrgIdOrError + plan-ownership (mirrors POST /invites).
 * Returns 404 (not 403) for cross-org probes so the response doesn't
 * leak existence.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; participantId: string }> },
) {
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;
  const { orgId } = orgOrError;

  const { id: planId, participantId } = await params;

  // Step 1: confirm the plan belongs to this org. Returns 404 for
  // cross-org probes (consistent with POST /invites).
  const plan = await getResearchPlan(orgId, planId);
  if (!plan) {
    return NextResponse.json(
      { error: "Research plan not found" },
      { status: 404 },
    );
  }

  // Step 2: scoped DELETE. The triple filter (id + plan_id + org_id) is
  // belt-and-braces — RLS plus the explicit org_id eq plus the
  // plan_id eq plus the id eq means we cannot accidentally hit another
  // org's invite if some part of the chain is misconfigured. Returns
  // 404 if no row matched (wrong plan, wrong org, or already deleted).
  const supabase = createResearchSupabase();
  const { data, error } = await supabase
    .from("research_invites")
    .delete()
    .eq("id", participantId)
    .eq("plan_id", planId)
    .eq("org_id", orgId)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error(
      `[DELETE participant] supabase error for invite ${participantId} on plan ${planId}:`,
      error.message,
    );
    return NextResponse.json(
      { error: "Could not delete the participant." },
      { status: 500 },
    );
  }
  if (!data) {
    return NextResponse.json(
      { error: "Participant not found" },
      { status: 404 },
    );
  }

  // 200 with a small confirmation body (not 204) so the client can JSON-
  // parse uniformly and surface a single message on the toast/inline UI
  // without branching on status code.
  return NextResponse.json({ success: true, participantId: data.id });
}
