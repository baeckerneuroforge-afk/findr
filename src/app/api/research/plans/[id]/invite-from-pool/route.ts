import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { requireOrgIdOrError } from "@/lib/auth/org";
import { getResearchPlan } from "@/lib/research/plans-service";
import { inviteFromPool } from "@/lib/research/participant-pool";

/**
 * POST /api/research/plans/[id]/invite-from-pool — ausgewählte Pool-Personen
 * in diese Studie einladen.
 *
 * Body: { poolMemberIds: string[] }. inviteFromPool erzeugt jede Einladung
 * über den bestehenden createResearchInvite-Pfad (KEIN paralleler Invite-
 * Schreibweg) und verknüpft sie via participant_pool_invites. Die Response
 * spiegelt die Form der Bulk-Invite-Route (results + summary), damit das UI
 * dieselbe Ergebnis-Darstellung nutzen kann.
 *
 * Auth + Plan-Ownership identisch zur POST /invites-Route: requireOrgIdOrError
 * → getResearchPlan (404 für fremde/abwesende Pläne, leakt keine Existenz).
 */

const BodySchema = z.object({
  poolMemberIds: z.array(z.string().uuid()).min(1).max(200),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const t = await getTranslations("errors");
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;
  const { orgId } = orgOrError;

  const { id: planId } = await params;

  const plan = await getResearchPlan(orgId, planId);
  if (!plan) {
    return NextResponse.json({ error: t("notFound.researchPlan") }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  if (body === null || typeof body !== "object") {
    return NextResponse.json({ error: t("invalidRequestBody") }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: t("invalidRequestBody"), details: parsed.error.flatten() },
      { status: parsed.error.issues.some((i) => i.code === "too_big") ? 413 : 400 },
    );
  }

  const result = await inviteFromPool(orgId, planId, parsed.data.poolMemberIds);

  // Localize the per-item service messages at the request boundary — mirrors
  // the status→t() mapping the sibling invite routes do. inviteFromPool authors
  // stable status discriminants; the German fallback text it carries stays
  // internal and is replaced here by the locale-correct string. (No AI /
  // verbatim content is involved — these are system messages.)
  const results = result.results.map((r) => {
    switch (r.status) {
      case "already_invited":
        return { ...r, message: t("pool.alreadyInvitedFromPool") };
      case "skipped_duplicate":
        return { ...r, message: t("pool.duplicateInStudy") };
      case "error":
        return { ...r, message: t("pool.couldNotCreate") };
      default:
        return r;
    }
  });

  return NextResponse.json({ success: true, results, summary: result.summary });
}
