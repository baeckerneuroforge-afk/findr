import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { auth } from "@/auth";
import { requireOrgIdOrError } from "@/lib/auth/org";
import { getResearchPlan } from "@/lib/research/plans-service";
import {
  cancelPlanActivation,
  recordSchedulerEvent,
  schedulePlanActivation,
} from "@/lib/research/scheduler";

/**
 * POST /api/research/plans/[id]/schedule — set, move, or cancel a study's
 * planned activation time (Deferred Activation, Phase 1).
 *
 * Body: { scheduledActivationAt: ISO-UTC string | null }.
 *   • a timestamp schedules/reschedules the activation (must be in the future);
 *   • null cancels the schedule, returning the study to the unscheduled state.
 *
 * Only a draft can be scheduled — a study that is already live/completed/archived
 * returns 409. activation_mode is fixed to 'manual' in Phase 1 (no cron yet); the
 * auto mode + reminders arrive with the Phase-2 cron. activation_state is NEVER
 * settable from the client — it is derived server-side by the scheduler service.
 */

const ScheduleBodySchema = z.object({
  scheduledActivationAt: z.string().datetime().nullable(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const t = await getTranslations("errors");

  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;
  const { orgId } = orgOrError;

  // userId/email come from the session directly — requireOrgIdOrError only
  // surfaces orgId. session.user.id is the Zitadel subject (src/auth.ts:105).
  const session = await auth();
  const userId = session?.user?.id ?? null;
  const email = session?.user?.email ?? null;

  const { id: planId } = await params;

  const body = await req.json().catch(() => null);
  const parsed = ScheduleBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: t("invalidRequestBody"), details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
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

    // ── cancel ──
    if (parsed.data.scheduledActivationAt === null) {
      const result = await cancelPlanActivation(orgId, planId);
      if (!result.ok) {
        // The draft check above passed, so a 0-row CAS means a concurrent
        // status change (race) — the plan is no longer a draft.
        return NextResponse.json(
          { error: t("scheduler.notDraft"), code: "not_draft" },
          { status: 409 },
        );
      }
      await recordSchedulerEvent(orgId, planId, "schedule_cancelled", {
        userId,
        email,
      });
      return NextResponse.json({ success: true, plan: result.plan });
    }

    // ── set / move ──
    const scheduledAt = new Date(parsed.data.scheduledActivationAt);
    if (scheduledAt.getTime() <= Date.now()) {
      return NextResponse.json(
        { error: t("scheduler.inPast"), code: "in_past" },
        { status: 400 },
      );
    }

    const wasScheduled = existing.activationState === "scheduled";
    const result = await schedulePlanActivation(orgId, planId, {
      scheduledAt,
      mode: "manual",
      userId,
      email,
    });
    if (!result.ok) {
      // Same race window as cancel — draft pre-check passed, CAS found 0 rows.
      return NextResponse.json(
        { error: t("scheduler.notDraft"), code: "not_draft" },
        { status: 409 },
      );
    }
    await recordSchedulerEvent(
      orgId,
      planId,
      wasScheduled ? "rescheduled" : "scheduled",
      {
        userId,
        email,
        detail: { scheduledActivationAt: scheduledAt.toISOString() },
      },
    );
    return NextResponse.json({ success: true, plan: result.plan });
  } catch (err) {
    console.error(
      `[POST /api/research/plans/${planId}/schedule] failed:`,
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { error: t("scheduler.couldNotSchedule") },
      { status: 500 },
    );
  }
}
