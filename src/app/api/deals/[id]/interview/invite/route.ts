import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireOrgIdOrError } from "@/lib/auth/org";
import { createAndInviteInterview } from "@/lib/voice-agent/interview-orchestration";

/**
 * Send the post-loss interview invitation email for a deal. Org-internal
 * (logged-in). The recipient address comes from the deal's stored contact email
 * — NEVER from the request body. Delegates to the shared createAndInviteInterview
 * flow (also used by the lost-deal auto-trigger), which creates the interview if
 * one doesn't exist yet and then sends the invite.
 */

const DealIdSchema = z.string().uuid();

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;

  const { id } = await params;
  const parsed = DealIdSchema.safeParse(id);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid dealId" }, { status: 400 });
  }

  const result = await createAndInviteInterview(orgOrError.orgId, parsed.data);

  switch (result.status) {
    case "sent":
      return NextResponse.json({
        success: true,
        sentTo: result.sentTo,
        invitedAt: result.invitedAt,
      });
    case "missing_contact":
      return NextResponse.json(
        { error: "Add a contact email to send the invitation." },
        { status: 400 },
      );
    case "not_found":
      return NextResponse.json({ error: "Deal not found" }, { status: 404 });
    case "not_open":
      return NextResponse.json(
        { error: "This interview is no longer open." },
        { status: 400 },
      );
    default:
      return NextResponse.json(
        { error: "Could not send the invitation email. Please try again." },
        { status: 502 },
      );
  }
}
