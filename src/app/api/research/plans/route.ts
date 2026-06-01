import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { requireOrgIdOrError } from "@/lib/auth/org";
import { createResearchPlan } from "@/lib/research/plans-service";

/**
 * POST /api/research/plans — create a new research plan.
 *
 * Auth via requireOrgIdOrError; body validated with Zod. Topics use a
 * deliberately lenient max so a user can sketch a long plan; the agent
 * caps its own per-turn behavior independently. Status is set to 'draft'
 * by the DB column default — not accepted in the create payload (creation
 * always starts on the floor of the lifecycle).
 */

const TopicSchema = z.object({
  topic: z.string().trim().min(3).max(80),
  intent: z.string().trim().min(3).max(300),
  hypotheses: z
    .array(z.string().trim().min(1).max(200))
    .max(5)
    .optional(),
});

const CreatePlanBodySchema = z.object({
  title: z.string().trim().min(3).max(200),
  objective: z.string().trim().min(3).max(3000),
  topics: z.array(TopicSchema).max(15).default([]),
  persona: z
    .string()
    .trim()
    .max(1000)
    .nullable()
    .optional()
    .transform((v) => (v === "" ? null : v)),
  sampleTarget: z.number().int().min(1).max(1000).nullable().optional(),
  // M3 — Studientyp-Diskriminator. Optional; fehlt er (Product-Discovery-
  // Create, byte-identisch zu pre-M3), defaultet er auf 'product_discovery' und
  // createResearchPlan lässt die Spalte weg → DB-DEFAULT. Nur der Market-
  // Research-Bereich sendet 'market_research'. Setzt das Anlegen, sonst nichts.
  studyType: z
    .enum(["product_discovery", "market_research"])
    .optional()
    .default("product_discovery"),
});

export async function POST(req: NextRequest) {
  const t = await getTranslations("errors");
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;
  const { orgId } = orgOrError;

  const body = await req.json().catch(() => null);
  const parsed = CreatePlanBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: t("invalidRequestBody"), details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const plan = await createResearchPlan(orgId, {
      title: parsed.data.title,
      objective: parsed.data.objective,
      topics: parsed.data.topics,
      persona: parsed.data.persona ?? null,
      sampleTarget: parsed.data.sampleTarget ?? null,
      studyType: parsed.data.studyType,
    });
    return NextResponse.json({ success: true, planId: plan.id, plan });
  } catch (err) {
    console.error(
      "[POST /api/research/plans] insert failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { error: t("research.couldNotCreatePlan") },
      { status: 500 },
    );
  }
}
