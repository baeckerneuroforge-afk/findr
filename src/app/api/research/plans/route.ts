import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { requireOrgIdOrError } from "@/lib/auth/org";
import { createResearchPlan } from "@/lib/research/plans-service";
import { TaskDefinitionSchema } from "@/lib/research/task";

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

const UseCaseSchema = z.enum([
  "general_survey",
  "brand_research",
  "creative_test",
  "concept_test",
  "usability_test",
]);

const AudienceSchema = z.enum(["b2b", "b2c"]);

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
  visualCaptureEnabled: z.boolean().optional().default(false),
  eventTrackingEnabled: z.boolean().optional().default(false),
  voiceEnabled: z.boolean().optional().default(false),
  ttsEnabled: z.boolean().optional().default(false),
  signalsEnabled: z.boolean().optional().default(false),
  useCase: UseCaseSchema.nullable().optional(),
  // Usability-Aufgabe (Phase 1) — nur der Usability-Studientyp sendet sie; sonst
  // weggelassen → createResearchPlan lässt die Spalte aus → NULL (byte-identisch).
  taskDefinition: TaskDefinitionSchema.nullable().optional(),
  // B2C/B2B audience. Only the Market-Research form sends it; omitted on the
  // Discovery path → createResearchPlan leaves the column out → DB DEFAULT
  // 'b2b' (byte-identical Discovery create).
  audienceType: AudienceSchema.optional(),
  stimulusUrl: z
    .string()
    .trim()
    .max(2048)
    .nullable()
    .optional()
    .transform((v) => (v === "" ? null : v)),
  stimulusType: z
    .string()
    .trim()
    .max(100)
    .nullable()
    .optional()
    .transform((v) => (v === "" ? null : v)),
  stimulusDescription: z
    .string()
    .trim()
    .max(3000)
    .nullable()
    .optional()
    .transform((v) => (v === "" ? null : v)),
  // M3 — Studientyp-Diskriminator. Optional; fehlt er (Product-Discovery-
  // Create, byte-identisch zu pre-M3), defaultet er auf 'product_discovery' und
  // createResearchPlan lässt die Spalte weg → DB-DEFAULT. Nur der Market-
  // Research-Bereich sendet 'market_research'. Setzt das Anlegen, sonst nichts.
  studyType: z
    .enum(["product_discovery", "market_research"])
    .optional()
    .default("product_discovery"),
  // F2 — interview language for the whole study; inherited by its invites,
  // open-links and sessions. Defaults to 'de' (existing behavior).
  language: z.enum(["de", "en"]).optional().default("de"),
  // Per-study interview length — agent-question UPPER BOUND. Optional; omitted
  // → DB stays NULL → system default (6). Bound mirrors the migration CHECK.
  maxRounds: z.number().int().min(2).max(15).nullable().optional(),
  // Per-study time limit in seconds (3..60 min). Optional; omitted → NULL → no
  // limit. Bound mirrors the migration CHECK.
  maxDurationSeconds: z.number().int().min(180).max(3600).nullable().optional(),
  // Per-study interview DEPTH (laddering layers per topic). Optional; omitted →
  // DB stays NULL → legacy default. New studies send 'mittel'. Mirrors the
  // migration CHECK enum.
  interviewDepth: z.enum(["flach", "mittel", "tief"]).nullable().optional(),
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
      visualCaptureEnabled: parsed.data.visualCaptureEnabled,
      eventTrackingEnabled: parsed.data.eventTrackingEnabled,
      voiceEnabled: parsed.data.voiceEnabled,
      ttsEnabled: parsed.data.ttsEnabled,
      signalsEnabled: parsed.data.signalsEnabled,
      useCase: parsed.data.useCase ?? null,
      audienceType: parsed.data.audienceType,
      stimulusUrl: parsed.data.stimulusUrl ?? null,
      stimulusType: parsed.data.stimulusType ?? null,
      stimulusDescription: parsed.data.stimulusDescription ?? null,
      studyType: parsed.data.studyType,
      language: parsed.data.language,
      maxRounds: parsed.data.maxRounds ?? null,
      maxDurationSeconds: parsed.data.maxDurationSeconds ?? null,
      interviewDepth: parsed.data.interviewDepth ?? null,
      taskDefinition: parsed.data.taskDefinition ?? null,
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
