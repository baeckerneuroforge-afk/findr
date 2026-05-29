import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";

import { requireOrgIdOrError } from "@/lib/auth/org";
import { getResearchPlan } from "@/lib/research/plans-service";
import { getResearchInvite } from "@/lib/research/scheduling";
import { sendResearchInvite } from "@/lib/research/invite-orchestration";

/**
 * POST /api/research/invites/[id]/send — send the scheduling invitation
 * mail for a research invite (Etappe B Teil 2b).
 *
 * Flow:
 *   1. requireOrgIdOrError → orgId
 *   2. Load invite (org-scoped) + plan (org-scoped). Both required so that
 *      a hand-crafted invite_id from another org can never trigger a send.
 *   3. PRE-CHECKS (in this order, mapping to the most precise HTTP code):
 *       a) scheduled_at must be set        → 422 "schedule first"
 *       b) contact_email must be set       → 422 "missing contact email"
 *       c) invited_at must NOT yet be set  → 409 "already sent"   (idempotency)
 *   4. Call sendResearchInvite. Map result.status to HTTP:
 *        sent             → 200
 *        not_found        → 404  (raced with a delete)
 *        missing_org      → 409  (org_id null — shouldn't reach here)
 *        missing_token    → 500  (createResearchInvite should have set it)
 *        missing_schedule → 422  (pre-check should have caught this)
 *        missing_contact  → 422  (pre-check should have caught this)
 *        error            → 502
 *
 * IDEMPOTENCY (409 on already-sent) is enforced HERE, not in the service.
 * sendResearchInvite is deliberately re-runnable for a future "resend after
 * delivery failure" workflow; the route gates it for the typical UI button
 * so a double-click can't trigger two mails. A future ?force=true (or
 * separate /resend route) would bypass this check.
 */

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const t = await getTranslations("errors");
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;
  const { orgId } = orgOrError;

  const { id: inviteId } = await params;

  // Ownership-Step 1: invite in this org?
  const invite = await getResearchInvite(orgId, inviteId);
  if (!invite) {
    return NextResponse.json(
      { error: t("notFound.researchInvite") },
      { status: 404 },
    );
  }

  // Ownership-Step 2: plan-org match (defense in depth — same pattern as the
  // schedule route).
  const plan = await getResearchPlan(orgId, invite.plan_id);
  if (!plan) {
    return NextResponse.json(
      { error: t("notFound.researchInvite") },
      { status: 404 },
    );
  }

  // ── Pre-checks (order matters: most precise message wins) ────────────────

  // (a) Must be scheduled first — explicit two-step UX policy: terminieren,
  // dann senden. sendResearchInvite would also catch this (missing_schedule)
  // but checking up-front gives a clearer error in logs + responses.
  if (!invite.scheduled_at) {
    return NextResponse.json(
      {
        error:
          t("research.scheduleBeforeSend"),
      },
      { status: 422 },
    );
  }

  // (b) Must have a contact email (else there's nothing for Resend to send to).
  // ResearchInviteRecord.contact_email is "" when the DB stored null; treat
  // empty-string as "missing" to match the service's validateForSend.
  const email = invite.contact_email.trim();
  if (email === "") {
    return NextResponse.json(
      {
        error:
          t("research.addEmailBeforeSend"),
      },
      { status: 422 },
    );
  }

  // (c) Idempotency — invited_at means a mail already went out. Block the
  // typical double-click + button-spam case at 409. A real "resend after
  // delivery failure" path is not built yet; today this is one-shot.
  if (invite.invited_at) {
    return NextResponse.json(
      {
        error:
          t("research.inviteAlreadySent"),
        invitedAt: invite.invited_at,
      },
      { status: 409 },
    );
  }

  // ── Send ────────────────────────────────────────────────────────────────
  const result = await sendResearchInvite(orgId, inviteId);

  switch (result.status) {
    case "sent":
      return NextResponse.json({
        success: true,
        sentTo: result.sentTo,
        invitedAt: result.invitedAt,
      });
    case "not_found":
      // Raced with a deletion between the pre-check and the send.
      return NextResponse.json(
        { error: t("notFound.researchInvite") },
        { status: 404 },
      );
    case "missing_org":
      return NextResponse.json(
        { error: result.message ?? t("research.inviteMissingOrg") },
        { status: 409 },
      );
    case "missing_schedule":
    case "missing_contact":
      // Defense-in-depth — the up-front checks should have caught these.
      // If we still see them, surface them as 422 with the service's
      // own message.
      return NextResponse.json(
        { error: result.message ?? t("research.inviteNotReady") },
        { status: 422 },
      );
    case "missing_token":
      // createResearchInvite generates the token at invite-create time, so
      // a NULL token here is a real bug — log it and return 500.
      console.error(
        `[POST /api/research/invites/${inviteId}/send] missing access_token — createResearchInvite invariant broken`,
      );
      return NextResponse.json(
        {
          error:
            t("research.inviteMissingToken"),
        },
        { status: 500 },
      );
    case "error":
    default:
      return NextResponse.json(
        { error: result.message ?? t("research.couldNotSendInvite") },
        { status: 502 },
      );
  }
}
