import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { requireOrgIdOrError } from "@/lib/auth/org";
import {
  addPlanStimulus,
  getResearchPlan,
  listPlanStimuli,
  MAX_PLAN_STIMULI,
  reorderPlanStimuli,
  resolveStimulusSet,
  updatePlanStimulus,
  type ResearchPlanRecord,
  type ResearchPlanStimulusRecord,
} from "@/lib/research/plans-service";
import {
  analyzeStimulusImage,
  analyzeStimulusVideo,
  type StimulusImageMediaType,
  type StimulusVideoFrameInput,
} from "@/lib/research/stimulus-analysis";
import {
  EXT_BY_TYPE,
  hasValidImageSignature,
  MAX_IMAGE_BYTES,
  MAX_VIDEO_BYTES,
  MAX_VIDEO_FRAMES,
  parseHttpUrl,
  refineFramesTotalCap,
  RESEARCH_STIMULI_BUCKET as BUCKET,
  VIDEO_CONTENT_TYPE,
  VideoFrameSchema,
} from "@/lib/research/stimulus-input";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

/**
 * Multi-Stimulus E2 (docs/findr-multi-stimulus-plan.md) — die SET-Route:
 * bis zu MAX_PLAN_STIMULI Assets pro Studie (research_plan_stimuli).
 *
 *   GET    → aufgelöstes Set (Dual-Read D1: Tabellen-Zeilen gewinnen, sonst
 *            Legacy-Single-Asset als 1-Element-Set mit legacy:true — solche
 *            Elemente verwaltet weiterhin die Legacy-Route /stimulus).
 *   POST   → Asset anhängen (Bild multipart / Video storagePath+Frames /
 *            Link) + per-Asset Vision-Analyse (FAIL-OPEN wie die Legacy-
 *            Route). Erster Add migriert einen vorhandenen Legacy-Slot lazy
 *            in eine Tabellen-Zeile (einzige Schreib-Brücke Legacy→Set).
 *   PATCH  → Reorder ({ orderedIds }) — exakte Permutation des Sets (O5:
 *            v1 = feste Forscher-Reihenfolge).
 *
 * Auth-Modell identisch zur Legacy-Route: Clerk-Org via requireOrgIdOrError
 * + Plan-Ownership via getResearchPlan. Eingabe-Validierung (Caps, MIME,
 * Magic Bytes, Pfad-Namespace) kommt aus dem geteilten stimulus-input.ts und
 * ist byte-identisch zur Legacy-Route.
 */

// Bild- und Video-Zweig warten synchron auf die einmalige Vision-Analyse
// (Opus, bis ~100s Timeout) — Draft-Phase, gleiche Konvention wie die
// Legacy-Stimulus-Route.
export const maxDuration = 120;

const LabelSchema = z
  .string()
  .trim()
  .max(80)
  .nullable()
  .optional()
  .transform((value) => (value === "" ? null : (value ?? null)));

const DescriptionSchema = z
  .string()
  .trim()
  .max(3000)
  .nullable()
  .optional()
  .transform((value) => (value === "" ? null : (value ?? null)));

const VideoBodySchema = z
  .object({
    storagePath: z.string().trim().min(1).max(512),
    frames: z.array(VideoFrameSchema).min(1).max(MAX_VIDEO_FRAMES),
    label: LabelSchema,
    description: DescriptionSchema,
  })
  .superRefine((value, ctx) => refineFramesTotalCap(value.frames, ctx));

const LinkBodySchema = z.object({
  url: z.string().trim().min(1).max(2048),
  label: LabelSchema,
  description: DescriptionSchema,
});

const ReorderBodySchema = z.object({
  orderedIds: z
    .array(z.string().trim().min(1).max(64))
    .min(1)
    .max(MAX_PLAN_STIMULI),
});

type StimulusInput =
  | { mode: "image"; file: Blob; label: string | null; description: string | null }
  | { mode: "link"; url: string; label: string | null; description: string | null }
  | {
      mode: "video";
      storagePath: string;
      frames: StimulusVideoFrameInput[];
      label: string | null;
      description: string | null;
    };

type ParseResult =
  | { success: true; input: StimulusInput }
  | { success: false; code: string };

function parseOptionalText(
  value: FormDataEntryValue | null,
  maxLength: number,
): { success: true; value: string | null } | { success: false } {
  if (value === null) return { success: true, value: null };
  if (typeof value !== "string") return { success: false };
  const text = value.trim();
  if (text.length > maxLength) return { success: false };
  return { success: true, value: text || null };
}

async function parseAddInput(req: NextRequest): Promise<ParseResult> {
  const contentType = req.headers.get("content-type")?.toLowerCase() ?? "";

  if (contentType.startsWith("multipart/form-data")) {
    const form = await req.formData().catch(() => null);
    if (!form) return { success: false, code: "invalid_form_data" };

    const fileEntry = form.get("file");
    const urlEntry = form.get("url");
    const rawUrl = typeof urlEntry === "string" ? urlEntry.trim() : "";
    const hasFile = fileEntry instanceof Blob;
    const hasUrl = rawUrl.length > 0;

    if (hasFile && hasUrl) {
      return { success: false, code: "ambiguous_stimulus_input" };
    }

    const label = parseOptionalText(form.get("label"), 80);
    if (!label.success) return { success: false, code: "invalid_stimulus_label" };
    const description = parseOptionalText(form.get("description"), 3000);
    if (!description.success) {
      return { success: false, code: "invalid_stimulus_description" };
    }

    if (hasFile) {
      return {
        success: true,
        input: {
          mode: "image",
          file: fileEntry,
          label: label.value,
          description: description.value,
        },
      };
    }

    if (fileEntry !== null || !hasUrl) {
      return { success: false, code: "missing_stimulus" };
    }

    const url = parseHttpUrl(rawUrl);
    if (!url) return { success: false, code: "invalid_stimulus_url" };
    return {
      success: true,
      input: {
        mode: "link",
        url,
        label: label.value,
        description: description.value,
      },
    };
  }

  if (contentType.includes("application/json")) {
    const body = await req.json().catch(() => null);

    // Video-Zweig: am storagePath-Key unterschieden (das Video liegt nach dem
    // Signed-Upload der bestehenden upload-url-Route bereits im Bucket).
    if (body && typeof body === "object" && "storagePath" in body) {
      const parsedVideo = VideoBodySchema.safeParse(body);
      if (!parsedVideo.success) {
        return { success: false, code: "invalid_stimulus_video_payload" };
      }
      return {
        success: true,
        input: {
          mode: "video",
          storagePath: parsedVideo.data.storagePath,
          frames: parsedVideo.data.frames,
          label: parsedVideo.data.label,
          description: parsedVideo.data.description,
        },
      };
    }

    const parsed = LinkBodySchema.safeParse(body);
    if (!parsed.success) {
      return { success: false, code: "invalid_link_payload" };
    }
    const url = parseHttpUrl(parsed.data.url);
    if (!url) return { success: false, code: "invalid_stimulus_url" };
    return {
      success: true,
      input: {
        mode: "link",
        url,
        label: parsed.data.label,
        description: parsed.data.description,
      },
    };
  }

  return { success: false, code: "unsupported_content_type" };
}

function invalidResponse(error: string, code: string) {
  return NextResponse.json({ error, code }, { status: 400 });
}

/** Client-Form eines Set-Elements. storage_path bleibt bewusst draußen
 *  (Server-Implementierungsdetail); `legacy` markiert das synthetische
 *  1-Element-Set aus den Plan-Spalten (Dual-Read), das die Legacy-Route
 *  verwaltet. */
function serializeStimulus(record: ResearchPlanStimulusRecord) {
  return {
    id: record.id,
    position: record.position,
    stimulus_type: record.stimulusType,
    url: record.url,
    label: record.label,
    description: record.description,
    analysis_status: record.analysisStatus,
    legacy: record.id.startsWith("legacy:"),
  };
}

/**
 * Per-Asset-Gegenstück zu runStimulusAnalysis der Legacy-Route — identische
 * FAIL-OPEN-Semantik: jeder Fehler lässt den Add gelingen und mappt nur auf
 * Status 'failed'. Persistiert in der Set-Zeile, nie in den Plan-Spalten.
 */
async function runSetStimulusAnalysis(
  orgId: string,
  planId: string,
  stimulusId: string,
  plan: ResearchPlanRecord,
  source:
    | { kind: "image"; file: Blob }
    | { kind: "video"; frames: StimulusVideoFrameInput[] },
  description: string | null,
): Promise<"done" | "failed"> {
  try {
    const study = {
      title: plan.title,
      objective: plan.objective,
      topics: plan.topics,
      useCase: plan.useCase,
      // Die Analyse sieht die Beschreibung DIESES Assets, nicht die des Plans.
      stimulusDescription: description,
    };
    const payload =
      source.kind === "image"
        ? await analyzeStimulusImage({
            imageBase64: Buffer.from(
              await source.file.arrayBuffer(),
            ).toString("base64"),
            // file.type ist vom Aufrufer bereits gegen EXT_BY_TYPE validiert.
            mediaType: source.file.type as StimulusImageMediaType,
            study,
          })
        : await analyzeStimulusVideo({ frames: source.frames, study });

    const written = await updatePlanStimulus(orgId, planId, stimulusId, {
      analysis: payload,
      analysisStatus: "done",
    });
    if (!written) {
      throw new Error("could not persist the stimulus analysis");
    }
    return "done";
  } catch (err) {
    console.error(
      `[POST /api/research/plans/${planId}/stimuli] analysis failed (fail-open):`,
      err instanceof Error ? err.message : err,
    );
    await updatePlanStimulus(orgId, planId, stimulusId, {
      analysisStatus: "failed",
    }).catch(() => null);
    return "failed";
  }
}

/**
 * Lazy-Migration des Legacy-Single-Slots in eine Set-Zeile — läuft genau
 * beim ERSTEN Set-Add eines Plans mit Legacy-Asset, damit das vorhandene
 * Asset Position 1 behält. Analyse + Status werden kopiert, NIE neu
 * gerechnet. Die Legacy-Plan-Spalten bleiben unangetastet (kein destruktiver
 * Schreibzugriff; bis E4 speist sich der Interview-Prompt weiter aus ihnen —
 * bewusster Übergangszustand, dokumentiert im Plan §E2).
 * FAIL-OPEN: schlägt die Migration fehl, wird sie geloggt und der Add läuft
 * weiter — das neue Asset wird dann Position 1.
 */
async function migrateLegacySlotIfNeeded(
  orgId: string,
  planId: string,
  plan: ResearchPlanRecord,
  existing: ResearchPlanStimulusRecord[],
): Promise<ResearchPlanStimulusRecord[]> {
  if (existing.length > 0) return existing;
  if (!plan.stimulusUrl || !plan.stimulusType) return existing;

  const migrated = await addPlanStimulus(orgId, planId, {
    stimulusType: plan.stimulusType,
    url: plan.stimulusUrl,
    description: plan.stimulusDescription,
    analysis: plan.stimulusAnalysis,
    analysisStatus: plan.stimulusAnalysisStatus,
  });
  if (!migrated) {
    console.error(
      `[POST /api/research/plans/${planId}/stimuli] legacy slot migration failed (fail-open)`,
    );
    return existing;
  }
  return [migrated];
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const t = await getTranslations("errors");
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;
  const { orgId } = orgOrError;

  const { id: planId } = await params;
  const plan = await getResearchPlan(orgId, planId);
  if (!plan) {
    return NextResponse.json(
      { error: t("notFound.researchPlan") },
      { status: 404 },
    );
  }

  const rows = await listPlanStimuli(orgId, planId);
  const set = resolveStimulusSet(plan, rows);
  return NextResponse.json({
    stimuli: set.map(serializeStimulus),
    max_stimuli: MAX_PLAN_STIMULI,
  });
}

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
    return NextResponse.json(
      { error: t("notFound.researchPlan") },
      { status: 404 },
    );
  }

  const parsed = await parseAddInput(req);
  if (!parsed.success) {
    return invalidResponse(t("invalidRequestBody"), parsed.code);
  }

  try {
    // Kapazität VOR jedem Bucket-Write prüfen (kein verwaistes Objekt bei
    // vollem Set); die Lazy-Migration zählt gegen denselben Cap.
    const existing = await migrateLegacySlotIfNeeded(
      orgId,
      planId,
      plan,
      await listPlanStimuli(orgId, planId),
    );
    if (existing.length >= MAX_PLAN_STIMULI) {
      return invalidResponse(t("invalidRequestBody"), "stimulus_set_full");
    }

    let stimulusUrl: string;
    let stimulusType: "image" | "link" | "video";
    let storagePath: string | null = null;

    if (parsed.input.mode === "image") {
      const { file } = parsed.input;
      if (file.size === 0) {
        return invalidResponse(t("invalidRequestBody"), "empty_stimulus_file");
      }
      if (file.size > MAX_IMAGE_BYTES) {
        return invalidResponse(
          t("invalidRequestBody"),
          "stimulus_file_too_large",
        );
      }
      const ext = EXT_BY_TYPE[file.type];
      if (!ext) {
        return invalidResponse(t("invalidRequestBody"), "invalid_stimulus_mime");
      }
      if (!(await hasValidImageSignature(file))) {
        return invalidResponse(t("invalidRequestBody"), "invalid_stimulus_file");
      }

      const supabase = createAdminSupabaseClient();
      // Gleicher Namespace wie die Legacy-Route; der Suffix hält parallele
      // Set-Adds kollisionsfrei (upsert bleibt trotzdem an).
      const path = `${orgId}/${planId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-stimulus.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { contentType: file.type, upsert: true });
      if (uploadError) throw uploadError;

      stimulusUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data
        .publicUrl;
      stimulusType = "image";
      storagePath = path;
    } else if (parsed.input.mode === "video") {
      const path = parsed.input.storagePath;
      // SICHERHEIT: Namespace-Check wie in der Legacy-Route — die
      // upload-url-Route mintet Pfade exakt in diesem Format.
      if (!path.startsWith(`${orgId}/${planId}/`) || !path.endsWith(".mp4")) {
        return invalidResponse(
          t("invalidRequestBody"),
          "invalid_stimulus_storage_path",
        );
      }

      const supabase = createAdminSupabaseClient();
      const { data: objectInfo, error: infoError } = await supabase.storage
        .from(BUCKET)
        .info(path);
      if (infoError || !objectInfo) {
        return invalidResponse(
          t("invalidRequestBody"),
          "stimulus_video_not_found",
        );
      }
      if (
        objectInfo.contentType &&
        objectInfo.contentType !== VIDEO_CONTENT_TYPE
      ) {
        return invalidResponse(
          t("invalidRequestBody"),
          "invalid_stimulus_video_type",
        );
      }
      if (
        typeof objectInfo.size === "number" &&
        objectInfo.size > MAX_VIDEO_BYTES
      ) {
        return invalidResponse(
          t("invalidRequestBody"),
          "stimulus_video_too_large",
        );
      }

      stimulusUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data
        .publicUrl;
      stimulusType = "video";
      storagePath = path;
    } else {
      stimulusUrl = parsed.input.url;
      stimulusType = "link";
    }

    const created = await addPlanStimulus(orgId, planId, {
      stimulusType,
      url: stimulusUrl,
      storagePath,
      label: parsed.input.label,
      description: parsed.input.description,
      // Bild/Video → Analyse folgt unten; Link → nichts zu analysieren.
      analysisStatus: stimulusType === "link" ? null : "pending",
    });
    if (!created) {
      return NextResponse.json(
        { error: t("research.couldNotUpdatePlan") },
        { status: 500 },
      );
    }

    const analysisStatus =
      parsed.input.mode === "image"
        ? await runSetStimulusAnalysis(
            orgId,
            planId,
            created.id,
            plan,
            { kind: "image", file: parsed.input.file },
            parsed.input.description,
          )
        : parsed.input.mode === "video"
          ? await runSetStimulusAnalysis(
              orgId,
              planId,
              created.id,
              plan,
              { kind: "video", frames: parsed.input.frames },
              parsed.input.description,
            )
          : null;

    return NextResponse.json({
      stimulus: {
        ...serializeStimulus(created),
        analysis_status: analysisStatus,
      },
      stimuli_count: existing.length + 1,
    });
  } catch (err) {
    console.error(
      `[POST /api/research/plans/${planId}/stimuli] failed:`,
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { error: t("research.couldNotUpdatePlan") },
      { status: 500 },
    );
  }
}

export async function PATCH(
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
    return NextResponse.json(
      { error: t("notFound.researchPlan") },
      { status: 404 },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = ReorderBodySchema.safeParse(body);
  if (!parsed.success) {
    return invalidResponse(t("invalidRequestBody"), "invalid_stimulus_order");
  }

  try {
    const reordered = await reorderPlanStimuli(
      orgId,
      planId,
      parsed.data.orderedIds,
    );
    if (!reordered) {
      // Keine exakte Permutation des aktuellen Sets (Stale-UI nach
      // parallelem Add/Remove) — der Client lädt das Set neu.
      return invalidResponse(t("invalidRequestBody"), "stale_stimulus_order");
    }
    return NextResponse.json({ stimuli: reordered.map(serializeStimulus) });
  } catch (err) {
    console.error(
      `[PATCH /api/research/plans/${planId}/stimuli] failed:`,
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { error: t("research.couldNotUpdatePlan") },
      { status: 500 },
    );
  }
}
