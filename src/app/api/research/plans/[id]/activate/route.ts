import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";

import type { Json } from "@/types/database";
import { auth } from "@/auth";
import { requireOrgIdOrError } from "@/lib/auth/org";
import { getResearchPlan } from "@/lib/research/plans-service";
import { activatePlanNow, recordSchedulerEvent } from "@/lib/research/scheduler";

/**
 * POST /api/research/plans/[id]/activate — release a prepared study NOW
 * (Deferred Activation, Phase 1, manual). No body.
 *
 * Flips status draft→active via a compare-and-set (at-most-once, even under a
 * concurrent click) and then sends the prepared pool invites best-effort. The
 * response carries an invite-release summary so the UI can report exactly what
 * happened ("23 versendet, 2 brauchen noch einen Termin"). Returns 409 when the
 * study is not a draft (already live / completed / archived, or a concurrent
 * caller won the race). Prolific publishing is deliberately NOT touched here —
 * it stays a separate, explicit money action.
 */

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const t = await getTranslations("errors");

  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;
  const { orgId } = orgOrError;

  const session = await auth();
  const userId = session?.user?.id ?? null;
  const email = session?.user?.email ?? null;

  const { id: planId } = await params;

  const existing = await getResearchPlan(orgId, planId);
  if (!existing) {
    return NextResponse.json(
      { error: t("notFound.researchPlan") },
      { status: 404 },
    );
  }
  if (existing.status !== "draft") {
    return NextResponse.json(
      { error: t("scheduler.notDraft"), code: "not_draft" },
      { status: 409 },
    );
  }

  try {
    const result = await activatePlanNow(orgId, planId);
    if (!result.ok) {
      // CAS returned 0 rows — the plan stopped being a draft between the check
      // above and the update (concurrent click / cron). Safe no-op → 409.
      return NextResponse.json(
        { error: t("scheduler.notDraft"), code: "not_draft" },
        { status: 409 },
      );
    }
    await recordSchedulerEvent(orgId, planId, "manual_activated", {
      userId,
      email,
      detail: result.invites
        ? (result.invites as unknown as Json)
        : null,
    });
    return NextResponse.json({
      success: true,
      plan: result.plan,
      invites: result.invites,
    });
  } catch (err) {
    console.error(
      `[POST /api/research/plans/${planId}/activate] failed:`,
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { error: t("scheduler.couldNotActivate") },
      { status: 500 },
    );
  }
}
