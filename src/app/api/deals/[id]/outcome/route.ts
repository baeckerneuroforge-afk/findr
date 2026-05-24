import { NextResponse, type NextRequest } from "next/server";
import { requireOrgIdOrError } from "@/lib/auth/org";
import { DealOutcomeSchema, updateDealOutcome } from "@/lib/deals/service";

/**
 * Set a deal's close outcome (open / won / lost). Marking won/lost also stamps
 * closed_at; reopening clears it. Org-scoped via the logged-in session.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;

  const { id } = await params;
  const rawBody = await request.json().catch(() => null);
  const parsed = DealOutcomeSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const deal = await updateDealOutcome(
    orgOrError.orgId,
    id,
    parsed.data.outcome,
  );
  if (!deal) {
    return NextResponse.json({ error: "Deal not found" }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    outcome: deal.outcome ?? "open",
    closedAt: deal.closedAt ?? null,
  });
}
