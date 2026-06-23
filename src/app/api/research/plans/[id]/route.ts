import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { requireOrgIdOrError } from "@/lib/auth/org";
import {
  parseHttpUrl,
  RESEARCH_STIMULI_BUCKET,
} from "@/lib/research/stimulus-input";
import {
  countSessionsForPlan,
  deleteResearchPlan,
  getResearchPlan,
  updateResearchPlan,
} from "@/lib/research/plans-service";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

/**
 * PATCH /api/research/plans/[id] — partial update on a plan.
 *
 * Accepts any subset of (title, objective, topics, persona, sampleTarget,
 * status, visualCaptureEnabled, voiceEnabled, ttsEnabled). The route does NOT
 * enforce lifecycle transitions in v1 — the
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

const UseCaseSchema = z.enum([
  "general_survey",
  "brand_research",
  "creative_test",
  "concept_test",
]);

const AudienceSchema = z.enum(["b2b", "b2c"]);

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
    eventTrackingEnabled: z.boolean().optional(),
    voiceEnabled: z.boolean().optional(),
    ttsEnabled: z.boolean().optional(),
    signalsEnabled: z.boolean().optional(),
    useCase: UseCaseSchema.nullable().optional(),
    audienceType: AudienceSchema.optional(),
    // stimulusUrl/stimulusType render on the public participant page
    // (StimulusPanel <a href>/<img>). The dedicated stimulus routes already
    // enforce http(s) + a fixed type set — this generic PATCH must be exactly
    // as strict, otherwise a `javascript:` URL becomes a clickable link for
    // participants (stored XSS).
    stimulusUrl: z
      .string()
      .trim()
      .max(2048)
      .nullable()
      .optional()
      .transform((v) => (v === "" ? null : v))
      .refine((v) => v === null || v === undefined || parseHttpUrl(v) !== null, {
        message: "stimulusUrl must be a valid http(s) URL.",
      }),
    stimulusType: z
      .union([z.enum(["image", "link", "video"]), z.literal("")])
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
    language: z.enum(["de", "en"]).optional(),
    // Per-study interview length. `null` clears it back to the system default,
    // a number sets the ceiling. Bound mirrors the migration CHECK.
    maxRounds: z.number().int().min(2).max(15).nullable().optional(),
    // Per-study time limit in seconds (3..60 min). `null` clears it (no limit).
    maxDurationSeconds: z.number().int().min(180).max(3600).nullable().optional(),
    // Per-study interview DEPTH. `null` clears it (legacy default); a member
    // sets it. Mirrors the migration CHECK enum.
    interviewDepth: z.enum(["flach", "mittel", "tief"]).nullable().optional(),
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
      data.eventTrackingEnabled !== undefined ||
      data.voiceEnabled !== undefined ||
      data.ttsEnabled !== undefined ||
      data.signalsEnabled !== undefined ||
      data.useCase !== undefined ||
      data.audienceType !== undefined ||
      data.stimulusUrl !== undefined ||
      data.stimulusType !== undefined ||
      data.stimulusDescription !== undefined ||
      data.language !== undefined ||
      data.maxRounds !== undefined ||
      data.maxDurationSeconds !== undefined ||
      data.interviewDepth !== undefined,
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

  // Mid-Study-Flip-Warnung: ändert der Forscher den Interaktionsmodus, obwohl
  // bereits Sessions existieren, ist das KEIN Fehler (legitimer Use-Case:
  // LiveKit-Ausfall → auf Text umstellen) — aber meldenswert: bestehende
  // Sessions behalten ihren gestempelten mode (Pricing zählt per Session,
  // nicht per Plan-Flag). Warn-only, non-breaking Zusatzfeld im 200-Response;
  // fail-open (Zähl-Fehler → keine Warnung statt falscher Warnung).
  let warning: string | undefined;
  if (
    parsed.data.voiceEnabled !== undefined &&
    parsed.data.voiceEnabled !== existing.voiceEnabled
  ) {
    const sessionCount = await countSessionsForPlan(orgId, planId);
    if (sessionCount !== null && sessionCount > 0) {
      warning = "voice_mode_changed_mid_study";
      console.warn(
        `[PATCH /api/research/plans/${planId}] voiceEnabled flipped to ${parsed.data.voiceEnabled} with ${sessionCount} existing session(s) — existing sessions keep their recorded mode.`,
      );
    }
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
      eventTrackingEnabled: parsed.data.eventTrackingEnabled,
      voiceEnabled: parsed.data.voiceEnabled,
      ttsEnabled: parsed.data.ttsEnabled,
      signalsEnabled: parsed.data.signalsEnabled,
      useCase: parsed.data.useCase,
      audienceType: parsed.data.audienceType,
      language: parsed.data.language,
      stimulusUrl: parsed.data.stimulusUrl,
      stimulusType: parsed.data.stimulusType,
      stimulusDescription: parsed.data.stimulusDescription,
      maxRounds: parsed.data.maxRounds,
      maxDurationSeconds: parsed.data.maxDurationSeconds,
      interviewDepth: parsed.data.interviewDepth,
    });
    if (!plan) {
      // Defensive: the existence check above passed, so this only fires on
      // a true update failure (constraint, transport, etc.).
      return NextResponse.json(
        { error: t("research.couldNotUpdatePlan") },
        { status: 500 },
      );
    }
    return NextResponse.json(
      warning ? { success: true, plan, warning } : { success: true, plan },
    );
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

/**
 * DELETE /api/research/plans/[id] — permanently remove a study and everything
 * the DB cascades (invites, pool-invites, quotas, screening, open links,
 * stimulus rows, synthesis + shares, panel + synthetic-test data; personas live
 * on the row), plus its interview sessions (wiped in deleteResearchPlan).
 * Stimulus bucket objects are purged best-effort afterwards.
 *
 * Policy gate (two-step, by André's design — a study is deletable at any time,
 * but never by accident):
 *   • no interview sessions yet → delete immediately (clean, no PII to lose);
 *   • already has sessions → only after the study is CLOSED first, i.e.
 *     archived (deactivated via PlanStatusControl). Deleting it then also wipes
 *     all interviews + transcripts. A study with sessions that is NOT archived
 *     is blocked (409) with "close it first".
 * The session count is read fail-CLOSED: an unknown count blocks the
 * irreversible delete (retryable 500) rather than guessing.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const t = await getTranslations("errors");
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;
  const { orgId } = orgOrError;

  const { id: planId } = await params;

  const existing = await getResearchPlan(orgId, planId);
  if (!existing) {
    return NextResponse.json(
      { error: t("notFound.researchPlan") },
      { status: 404 },
    );
  }

  // Gate: no sessions → delete now; has sessions → only once archived (closed).
  const sessionCount = await countSessionsForPlan(orgId, planId);
  if (sessionCount === null) {
    // fail-closed: never run an irreversible delete with an unknown session
    // state — better a retryable 500 than a stranded transcript.
    return NextResponse.json(
      { error: t("research.couldNotDeletePlan") },
      { status: 500 },
    );
  }
  if (sessionCount > 0 && existing.status !== "archived") {
    // Has interviews but not closed yet — require the deliberate "close it
    // first" step (archive/deactivate) before the irreversible delete.
    return NextResponse.json(
      { error: t("research.planHasInterviews") },
      { status: 409 },
    );
  }

  try {
    const { deleted, storagePaths } = await deleteResearchPlan(orgId, planId);
    if (!deleted) {
      // Existence check passed above, so this is a true delete failure.
      return NextResponse.json(
        { error: t("research.couldNotDeletePlan") },
        { status: 500 },
      );
    }

    // Best-effort bucket cleanup AFTER the DB delete: an orphaned bucket object
    // is harmless (public, unlinked), but a live row pointing at a removed file
    // would not be — order mirrors the per-stimulus DELETE route.
    if (storagePaths.length > 0) {
      try {
        const supabase = createAdminSupabaseClient();
        await supabase.storage
          .from(RESEARCH_STIMULI_BUCKET)
          .remove(storagePaths);
      } catch {
        // Storage hiccup / missing bucket — the study data is already gone.
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(
      `[DELETE /api/research/plans/${planId}] delete failed:`,
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { error: t("research.couldNotDeletePlan") },
      { status: 500 },
    );
  }
}
