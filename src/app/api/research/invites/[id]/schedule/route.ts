import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireOrgIdOrError } from "@/lib/auth/org";
import { getResearchPlan } from "@/lib/research/plans-service";
import {
  getResearchInvite,
  scheduleInvite,
} from "@/lib/research/scheduling";

/**
 * POST /api/research/invites/[id]/schedule — set scheduled_at + status='scheduled'.
 *
 * Etappe B Teil 2a: NUR Termin festlegen, KEIN Mailversand. sendResearch-
 * Invite + ICS-Attachment landen in Teil 2b, sobald RESEND_API_KEY in Prod
 * gesetzt ist. Bis dahin ist diese Route die einzige UI-Mutation auf der
 * scheduled_at-Spalte.
 *
 * Ownership-Check (Defense in depth):
 *   1. getResearchInvite filtert per org_id — wenn null, ist die Invite
 *      entweder nicht da oder nicht in unserer Org → 404.
 *   2. getResearchPlan auf invite.plan_id mit demselben orgId — fängt den
 *      theoretischen Fall ab, dass ein Invite zwar in unserer Org sitzt,
 *      aber auf einen Plan einer anderen Org zeigt (sollte nicht
 *      vorkommen, weil createResearchInvite den orgId-Match enforced, aber
 *      die Doppel-Verifikation kostet nichts).
 *   3. scheduleInvite hat zusätzlich seine eigene Checks (in_past,
 *      missing_org).
 */

const ScheduleBodySchema = z.object({
  // ISO-8601 mit Zeitzone — datetime-local-Inputs liefern „YYYY-MM-DDTHH:mm"
  // ohne TZ. Wir akzeptieren beides und lassen den Date-Konstruktor
  // browser-lokal interpretieren; Konvertierung in UTC passiert in der
  // Service-Funktion (scheduledAt.toISOString()).
  scheduledAt: z.string().min(1).max(40),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;
  const { orgId } = orgOrError;

  const { id: inviteId } = await params;

  const body = await req.json().catch(() => null);
  const parsed = ScheduleBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Parse the datetime client-side string. Date() accepts ISO with or without
  // TZ; if the parse fails getTime() is NaN and scheduleInvite's in_past
  // check still rejects (NaN <= Date.now() is false; but the toISOString in
  // the update would then throw). Catch the explicit NaN case here so we
  // can return 400 with a precise message.
  const scheduledAt = new Date(parsed.data.scheduledAt);
  if (Number.isNaN(scheduledAt.getTime())) {
    return NextResponse.json(
      { error: "scheduledAt is not a valid date." },
      { status: 400 },
    );
  }

  // Ownership-Step 1: invite exists in this org?
  const invite = await getResearchInvite(orgId, inviteId);
  if (!invite) {
    return NextResponse.json(
      { error: "Research invite not found" },
      { status: 404 },
    );
  }

  // Ownership-Step 2: plan-org match (defense in depth — see header).
  const plan = await getResearchPlan(orgId, invite.plan_id);
  if (!plan) {
    return NextResponse.json(
      { error: "Research invite not found" },
      { status: 404 },
    );
  }

  const result = await scheduleInvite(orgId, inviteId, scheduledAt);
  switch (result.status) {
    case "scheduled":
      return NextResponse.json({
        success: true,
        scheduledAt: result.invite?.scheduled_at ?? null,
        invite: result.invite,
      });
    case "in_past":
      return NextResponse.json(
        { error: result.message ?? "scheduled_at must be in the future." },
        { status: 422 },
      );
    case "not_found":
      // Reachable in a race: the invite vanished between our pre-check and
      // the UPDATE. Treat the same as the up-front 404.
      return NextResponse.json(
        { error: "Research invite not found" },
        { status: 404 },
      );
    case "missing_org":
      return NextResponse.json(
        { error: result.message ?? "Invite is missing an org." },
        { status: 409 },
      );
    default:
      return NextResponse.json(
        { error: "Could not schedule the invite." },
        { status: 500 },
      );
  }
}
