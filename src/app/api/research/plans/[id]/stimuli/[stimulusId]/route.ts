import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { requireOrgIdOrError } from "@/lib/auth/org";
import {
  getResearchPlan,
  listPlanStimuli,
  removePlanStimulus,
  updatePlanStimulus,
  type ResearchPlanStimulusRecord,
} from "@/lib/research/plans-service";
import { RESEARCH_STIMULI_BUCKET as BUCKET } from "@/lib/research/stimulus-input";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

/**
 * Multi-Stimulus E2 — Element-Route des Stimulus-Sets:
 *   PATCH  → Label/Beschreibung eines Assets (sparse; die Analyse-Felder
 *            schreibt NUR die Collection-Route beim Add).
 *   DELETE → Asset entfernen (Service schließt die Positions-Lücke) +
 *            Bucket-Objekt best-effort aufräumen.
 *
 * Synthetische legacy:<planId>-Elemente (Dual-Read der Collection-GET) landen
 * hier nie — sie haben keine Tabellen-Zeile und werden weiterhin über die
 * Legacy-Route /stimulus verwaltet; ein Treffer-Versuch läuft sauber in 404.
 */

const PatchBodySchema = z
  .object({
    label: z
      .string()
      .trim()
      .max(80)
      .nullable()
      .optional()
      .transform((value) => (value === "" ? null : value)),
    description: z
      .string()
      .trim()
      .max(3000)
      .nullable()
      .optional()
      .transform((value) => (value === "" ? null : value)),
  })
  .refine(
    (value) => value.label !== undefined || value.description !== undefined,
    { message: "At least one field is required." },
  );

async function findStimulus(
  orgId: string,
  planId: string,
  stimulusId: string,
): Promise<ResearchPlanStimulusRecord | null> {
  const rows = await listPlanStimuli(orgId, planId);
  return rows.find((row) => row.id === stimulusId) ?? null;
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; stimulusId: string }> },
) {
  const t = await getTranslations("errors");
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;
  const { orgId } = orgOrError;

  const { id: planId, stimulusId } = await params;
  const plan = await getResearchPlan(orgId, planId);
  if (!plan) {
    return NextResponse.json(
      { error: t("notFound.researchPlan") },
      { status: 404 },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = PatchBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: t("invalidRequestBody"), code: "invalid_stimulus_patch" },
      { status: 400 },
    );
  }

  try {
    const updated = await updatePlanStimulus(orgId, planId, stimulusId, {
      ...(parsed.data.label !== undefined ? { label: parsed.data.label } : {}),
      ...(parsed.data.description !== undefined
        ? { description: parsed.data.description }
        : {}),
    });
    if (!updated) {
      return NextResponse.json(
        { error: t("invalidRequestBody"), code: "stimulus_not_found" },
        { status: 404 },
      );
    }
    return NextResponse.json({
      stimulus: {
        id: updated.id,
        position: updated.position,
        stimulus_type: updated.stimulusType,
        url: updated.url,
        label: updated.label,
        description: updated.description,
        analysis_status: updated.analysisStatus,
        legacy: false,
      },
    });
  } catch (err) {
    console.error(
      `[PATCH /api/research/plans/${planId}/stimuli/${stimulusId}] failed:`,
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { error: t("research.couldNotUpdatePlan") },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; stimulusId: string }> },
) {
  const t = await getTranslations("errors");
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;
  const { orgId } = orgOrError;

  const { id: planId, stimulusId } = await params;
  const plan = await getResearchPlan(orgId, planId);
  if (!plan) {
    return NextResponse.json(
      { error: t("notFound.researchPlan") },
      { status: 404 },
    );
  }

  try {
    // Den storage_path VOR dem Löschen sichern — danach ist die Zeile weg.
    const record = await findStimulus(orgId, planId, stimulusId);
    if (!record) {
      return NextResponse.json(
        { error: t("invalidRequestBody"), code: "stimulus_not_found" },
        { status: 404 },
      );
    }

    const removed = await removePlanStimulus(orgId, planId, stimulusId);
    if (!removed) {
      return NextResponse.json(
        { error: t("research.couldNotUpdatePlan") },
        { status: 500 },
      );
    }

    // Bucket-Aufräumen best-effort NACH dem DB-Delete: ein verwaistes
    // Bucket-Objekt ist harmlos (public, unverlinkt), eine DB-Zeile auf ein
    // gelöschtes Objekt wäre es nicht — Reihenfolge daher bewusst so.
    if (record.storagePath) {
      const supabase = createAdminSupabaseClient();
      await supabase.storage
        .from(BUCKET)
        .remove([record.storagePath])
        .catch(() => null);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(
      `[DELETE /api/research/plans/${planId}/stimuli/${stimulusId}] failed:`,
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { error: t("research.couldNotUpdatePlan") },
      { status: 500 },
    );
  }
}
