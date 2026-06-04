import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { requireOrgIdOrError } from "@/lib/auth/org";
import {
  getResearchPlan,
  updateResearchPlan,
} from "@/lib/research/plans-service";

/**
 * PATCH /api/research/plans/[id] — partial update on a plan.
 *
 * Accepts any subset of (title, objective, topics, persona, sampleTarget,
 * status, visualCaptureEnabled, voiceEnabled). The route does NOT enforce lifecycle
 * transitions in v1 — the
 * UI only offers the valid Next steps (draft→active, active→completed,
 * any→archived). The DB column CHECK is the backstop that catches an
 * out-of-set value.
 *
 * Returns 404 if the plan doesn't exist or belongs to another org. The
 * service uses an org_id-scoped UPDATE, so the only way to get null is
 * "no row matched" — that maps cleanly to 404 for the caller.
 */

const TopicSchema = z.object({
  topic: z.string().trim().min(3).max(80),
  intent: z.string().trim().min(3).max(300),
  hypotheses: z
    .array(z.string().trim().min(1).max(200))
    .max(5)
    .optional(),
});

const UpdatePlanBodySchema = z
  .object({
    title: z.string().trim().min(3).max(200).optional(),
    objective: z.string().trim().min(3).max(3000).optional(),
    topics: z.array(TopicSchema).max(15).optional(),
    persona: z
      .string()
      .trim()
      .max(1000)
      .nullable()
      .optional()
      .transform((v) => (v === "" ? null : v)),
    sampleTarget: z.number().int().min(1).max(1000).nullable().optional(),
    status: z
      .enum(["draft", "active", "completed", "archived"])
      .optional(),
    visualCaptureEnabled: z.boolean().optional(),
    voiceEnabled: z.boolean().optional(),
  })
  .refine(
    (data) =>
      data.title !== undefined ||
      data.objective !== undefined ||
      data.topics !== undefined ||
      data.persona !== undefined ||
      data.sampleTarget !== undefined ||
      data.status !== undefined ||
      data.visualCaptureEnabled !== undefined ||
      data.voiceEnabled !== undefined,
    { message: "At least one field must be present in the update body." },
  );

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const t = await getTranslations("errors");
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;
  const { orgId } = orgOrError;

  const { id: planId } = await params;

  const body = await req.json().catch(() => null);
  const parsed = UpdatePlanBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: t("invalidRequestBody"), details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Pre-check existence so we can return 404 distinctly from a real DB
  // failure. updateResearchPlan also returns null on "not found", but
  // checking up-front gives the caller a precise reason.
  const existing = await getResearchPlan(orgId, planId);
  if (!existing) {
    return NextResponse.json(
      { error: t("notFound.researchPlan") },
      { status: 404 },
    );
  }

  try {
    const plan = await updateResearchPlan(orgId, planId, {
      title: parsed.data.title,
      objective: parsed.data.objective,
      topics: parsed.data.topics,
      persona: parsed.data.persona,
      sampleTarget: parsed.data.sampleTarget,
      status: parsed.data.status,
      visualCaptureEnabled: parsed.data.visualCaptureEnabled,
      voiceEnabled: parsed.data.voiceEnabled,
    });
    if (!plan) {
      // Defensive: the existence check above passed, so this only fires on
      // a true update failure (constraint, transport, etc.).
      return NextResponse.json(
        { error: t("research.couldNotUpdatePlan") },
        { status: 500 },
      );
    }
    return NextResponse.json({ success: true, plan });
  } catch (err) {
    console.error(
      `[PATCH /api/research/plans/${planId}] update failed:`,
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { error: t("research.couldNotUpdatePlan") },
      { status: 500 },
    );
  }
}
