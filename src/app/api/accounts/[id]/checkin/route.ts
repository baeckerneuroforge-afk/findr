import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";
import { requireOrgIdOrError } from "@/lib/auth/org";
import { createAndInviteCheckin } from "@/lib/voice-agent/checkin-orchestration";

/**
 * Send a customer check-in for an account: creates the check-in session (if
 * needed) and emails the sponsor a one-time link. The recipient comes from the
 * account's stored sponsor_email — NEVER from the request body. Mirrors the deal
 * post-loss invite route.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const t = await getTranslations("errors");
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;

  const { id } = await params;
  const result = await createAndInviteCheckin(orgOrError.orgId, id);

  switch (result.status) {
    case "sent":
      return NextResponse.json({
        success: true,
        sentTo: result.sentTo,
        invitedAt: result.invitedAt,
        accessToken: result.accessToken,
      });
    case "missing_contact":
      return NextResponse.json(
        { error: t("accounts.addSponsorEmail") },
        { status: 400 },
      );
    case "not_found":
      return NextResponse.json({ error: t("notFound.account") }, { status: 404 });
    default:
      return NextResponse.json(
        { error: t("accounts.couldNotSendCheckin") },
        { status: 502 },
      );
  }
}
