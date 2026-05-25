import { NextResponse, type NextRequest } from "next/server";
import { requireOrgIdOrError } from "@/lib/auth/org";
import { DealOutcomeSchema, updateDealOutcome } from "@/lib/deals/service";
import { getOrgSettings } from "@/lib/settings/org-settings";
import { getDealInterview } from "@/lib/voice-agent/session-service";
import { createAndInviteInterview } from "@/lib/voice-agent/interview-orchestration";

/**
 * Set a deal's close outcome (open / won / lost). Marking won/lost also stamps
 * closed_at; reopening clears it. Org-scoped via the logged-in session.
 *
 * AUTO-TRIGGER: when the org has enabled it, marking a deal 'lost' also creates
 * the post-loss interview AND sends the invitation in one go. This is best-effort
 * and is wrapped so it can NEVER make the outcome update fail — if it can't run
 * (missing contact, mail/Opus error), the outcome is still set and we report the
 * reason in the response (and logs).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;
  const orgId = orgOrError.orgId;

  const { id } = await params;
  const rawBody = await request.json().catch(() => null);
  const parsed = DealOutcomeSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const deal = await updateDealOutcome(orgId, id, parsed.data.outcome);
  if (!deal) {
    return NextResponse.json({ error: "Deal not found" }, { status: 404 });
  }

  let autoInterview: { status: string; sentTo?: string | null } | null = null;
  if (parsed.data.outcome === "lost") {
    try {
      const settings = await getOrgSettings(orgId);
      if (settings.autoStartPostLossInterview) {
        // Idempotency: only auto-fire when no interview exists for this deal yet.
        const existing = await getDealInterview(orgId, id);
        if (existing) {
          autoInterview = { status: "exists" };
        } else {
          const result = await createAndInviteInterview(orgId, id);
          autoInterview = { status: result.status, sentTo: result.sentTo };
          if (result.status !== "sent") {
            console.warn(
              `[deals/${id}/outcome] auto-interview not sent: ${result.status} — ${result.message ?? ""}`,
            );
          }
        }
      }
    } catch (err) {
      // Must never fail the outcome update.
      console.error(
        `[deals/${id}/outcome] auto-interview error:`,
        err instanceof Error ? err.message : err,
      );
      autoInterview = { status: "error" };
    }
  }

  return NextResponse.json({
    success: true,
    outcome: deal.outcome ?? "open",
    closedAt: deal.closedAt ?? null,
    autoInterview,
  });
}
