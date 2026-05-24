import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireOrgIdOrError } from "@/lib/auth/org";
import { getDealById } from "@/lib/deals/service";
import {
  getDealInterview,
  markInterviewInvited,
} from "@/lib/voice-agent/session-service";
import { sendEmail, EmailError } from "@/lib/email/resend";
import {
  buildInterviewInvite,
  interviewUrl,
} from "@/lib/email/interview-invite";

/**
 * Send the post-loss interview invitation email for a deal's open interview.
 * Org-internal (logged-in). The recipient address comes from the deal's stored
 * contact email — NEVER from the request body — and everything is org-scoped.
 */

const DealIdSchema = z.string().uuid();

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;
  const orgId = orgOrError.orgId;

  const { id } = await params;
  const parsed = DealIdSchema.safeParse(id);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid dealId" }, { status: 400 });
  }
  const dealId = parsed.data;

  const deal = await getDealById(orgId, dealId);
  if (!deal) {
    return NextResponse.json({ error: "Deal not found" }, { status: 404 });
  }

  const email = deal.contactEmail?.trim();
  if (!email) {
    return NextResponse.json(
      { error: "Add a contact email to send the invitation." },
      { status: 400 },
    );
  }

  const interview = await getDealInterview(orgId, dealId);
  if (!interview) {
    return NextResponse.json(
      { error: "Start the interview before sending an invitation." },
      { status: 400 },
    );
  }
  if (interview.status !== "open") {
    return NextResponse.json(
      { error: "This interview is no longer open." },
      { status: 400 },
    );
  }

  const { subject, html, text } = buildInterviewInvite({
    contactName: deal.contactName,
    company: deal.companyName,
    url: interviewUrl(interview.accessToken),
  });

  try {
    await sendEmail({ to: email, subject, html, text });
  } catch (err) {
    console.error(
      `[deals/${dealId}/interview/invite] send failed:`,
      err instanceof Error ? err.message : err,
    );
    if (err instanceof EmailError) {
      return NextResponse.json(
        { error: "Could not send the invitation email. Please try again." },
        { status: 502 },
      );
    }
    return NextResponse.json(
      { error: "Could not send the invitation. Please try again." },
      { status: 500 },
    );
  }

  // Record the send so the deal page can show "invited" instead of re-offering.
  const invitedAt = await markInterviewInvited(orgId, interview.accessToken);

  return NextResponse.json({ success: true, sentTo: email, invitedAt });
}
