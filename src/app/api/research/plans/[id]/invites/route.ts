import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireOrgIdOrError } from "@/lib/auth/org";
import { getResearchPlan } from "@/lib/research/plans-service";
import { createResearchInvite } from "@/lib/research/research-orchestration";

/**
 * POST /api/research/plans/[id]/invites — add a participant to a plan.
 *
 * Etappe B Teil 1: invite-Anlage OHNE Mail und OHNE Termin. createResearch-
 * Invite generiert den access_token sofort (Token-Hand-off-Contract — siehe
 * src/lib/research/research-orchestration.ts), aber sendResearch­Invite +
 * scheduleAndSendInvite werden hier nicht aufgerufen — Termin + Mail
 * landen in Teil 2.
 *
 * Auth: requireOrgIdOrError. Plan-Ownership: getResearchPlan(orgId, planId)
 * → 404 wenn der Plan dem User nicht gehört. Das schließt eine cross-org
 * Invite-Anlage aus, obwohl createResearchInvite intern nur den orgId-Wert
 * weiterleitet, den wir ihm übergeben.
 */

const CreateInviteBodySchema = z.object({
  contactLabel: z.string().trim().min(1).max(200),
  contactEmail: z
    .string()
    .trim()
    .email()
    .max(320)
    .nullable()
    .optional()
    .transform((v) => (v === "" ? null : v)),
  modePreference: z.enum(["text", "voice", "video"]).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;
  const { orgId } = orgOrError;

  const { id: planId } = await params;

  // Ownership check — keep the org boundary explicit here, not just inside
  // createResearchInvite. Returns 404 (not 403) so a probing client can't
  // distinguish "wrong org" from "no such plan".
  const plan = await getResearchPlan(orgId, planId);
  if (!plan) {
    return NextResponse.json(
      { error: "Research plan not found" },
      { status: 404 },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = CreateInviteBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const result = await createResearchInvite({
    orgId,
    planId,
    contactLabel: parsed.data.contactLabel,
    contactEmail: parsed.data.contactEmail ?? null,
    modePreference: parsed.data.modePreference ?? "text",
  });

  switch (result.status) {
    case "created":
      return NextResponse.json({
        success: true,
        inviteId: result.inviteId,
        // accessToken is also returned — Teil 2's "Schedule + send" will
        // need it; today's UI doesn't expose it directly but the API is
        // honest about what it persisted.
        accessToken: result.accessToken,
      });
    case "plan_not_found":
      // Shouldn't happen — we just checked existence above — but the
      // service has its own check, so map it through cleanly if it does.
      return NextResponse.json(
        { error: "Research plan not found" },
        { status: 404 },
      );
    default:
      return NextResponse.json(
        { error: result.message ?? "Could not create the invite." },
        { status: 500 },
      );
  }
}
