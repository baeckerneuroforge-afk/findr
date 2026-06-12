import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { requireOrgIdOrError } from "@/lib/auth/org";
import {
  getResearchPlan,
  updateResearchPlan,
  type ResearchPlanRecord,
} from "@/lib/research/plans-service";
import {
  analyzeStimulusImage,
  analyzeStimulusVideo,
  type StimulusImageMediaType,
  type StimulusVideoFrameInput,
} from "@/lib/research/stimulus-analysis";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
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

// Bild- und Video-Zweig warten synchron auf die einmalige Vision-Analyse
// (Opus, bis ~100s Timeout) — Draft-Phase, der Forscher sieht den vorhandenen
// stimulusBusy-Spinner. Konvention wie /speak bzw. die Plan-Engine-Routen.
export const maxDuration = 120;

// Eingabe-Konstanten/-Schemas/-Prüfer leben seit Multi-Stimulus E2 im
// geteilten Modul stimulus-input.ts (Werte byte-identisch) — die Set-Route
// (…/stimuli) konsumiert exakt dieselben.
const VideoBodySchema = z
  .object({
    storagePath: z.string().trim().min(1).max(512),
    frames: z.array(VideoFrameSchema).min(1).max(MAX_VIDEO_FRAMES),
    stimulusDescription: z
      .string()
      .trim()
      .max(3000)
      .nullable()
      .optional()
      .transform((value) => (value === "" ? null : value)),
  })
  .superRefine((value, ctx) => refineFramesTotalCap(value.frames, ctx));

const LinkBodySchema = z.object({
  url: z.string().trim().min(1).max(2048),
  stimulusDescription: z
    .string()
    .trim()
    .max(3000)
    .nullable()
    .optional()
    .transform((value) => (value === "" ? null : value)),
});

type StimulusInput =
  | {
      mode: "image";
      file: Blob;
      description?: string | null;
    }
  | {
      mode: "link";
      url: string;
      description?: string | null;
    }
  | {
      mode: "video";
      storagePath: string;
      frames: StimulusVideoFrameInput[];
      description?: string | null;
    };

type ParseResult =
  | { success: true; input: StimulusInput }
  | { success: false; code: string };

function parseDescription(
  value: FormDataEntryValue | null,
  isPresent: boolean,
): { success: true; value?: string | null } | { success: false } {
  if (!isPresent) return { success: true };
  if (typeof value !== "string") return { success: false };

  const description = value.trim();
  if (description.length > 3000) return { success: false };
  return { success: true, value: description || null };
}

async function parseStimulusInput(req: NextRequest): Promise<ParseResult> {
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

    const description = parseDescription(
      form.get("stimulusDescription"),
      form.has("stimulusDescription"),
    );
    if (!description.success) {
      return { success: false, code: "invalid_stimulus_description" };
    }

    if (hasFile) {
      return {
        success: true,
        input: {
          mode: "image",
          file: fileEntry,
          ...("value" in description
            ? { description: description.value }
            : {}),
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
        ...("value" in description ? { description: description.value } : {}),
      },
    };
  }

  if (contentType.includes("application/json")) {
    const body = await req.json().catch(() => null);

    // Video-Zweig: am storagePath-Key unterschieden (das Video liegt nach dem
    // Signed-Upload bereits im Bucket; der Body trägt nur Pfad + Frames).
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
          ...(parsedVideo.data.stimulusDescription !== undefined
            ? { description: parsedVideo.data.stimulusDescription }
            : {}),
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
        ...(parsed.data.stimulusDescription !== undefined
          ? { description: parsed.data.stimulusDescription }
          : {}),
      },
    };
  }

  return { success: false, code: "unsupported_content_type" };
}

function invalidResponse(error: string, code: string) {
  return NextResponse.json({ error, code }, { status: 400 });
}

/**
 * Einmalige Vision-Analyse des frisch hochgeladenen Bild-Stimulus — FAIL-OPEN:
 * jeder Fehler (Transport, Schema nach Retry, Persistenz) lässt den Upload
 * trotzdem gelingen und mappt nur auf Status 'failed'. Das Interview braucht
 * die Analyse nie — ohne sie rendert der Prompt exakt wie heute (nur die
 * Forscher-Beschreibung). Interview-Pfade triggern NIE eine Analyse.
 *
 * `plan` ist die bereits aktualisierte Zeile (trägt eine im selben Request
 * mitgeschickte Beschreibung), damit die Frageansätze den frischesten
 * Studien-Kontext sehen.
 */
async function runStimulusAnalysis(
  orgId: string,
  planId: string,
  file: Blob,
  plan: ResearchPlanRecord,
): Promise<"done" | "failed"> {
  try {
    const imageBase64 = Buffer.from(await file.arrayBuffer()).toString(
      "base64",
    );
    const payload = await analyzeStimulusImage({
      imageBase64,
      // file.type ist oben bereits gegen EXT_BY_TYPE (png/jpeg/webp) validiert.
      mediaType: file.type as StimulusImageMediaType,
      study: {
        title: plan.title,
        objective: plan.objective,
        topics: plan.topics,
        useCase: plan.useCase,
        stimulusDescription: plan.stimulusDescription,
      },
    });
    const written = await updateResearchPlan(orgId, planId, {
      stimulusAnalysis: payload,
      stimulusAnalysisStatus: "done",
    });
    if (!written) {
      throw new Error("could not persist the stimulus analysis");
    }
    return "done";
  } catch (err) {
    console.error(
      `[POST /api/research/plans/${planId}/stimulus] analysis failed (fail-open):`,
      err instanceof Error ? err.message : err,
    );
    // Best-effort Status-Schreiben — schlägt auch das fehl, bleibt 'pending'
    // stehen; der Upload selbst ist davon unberührt.
    await updateResearchPlan(orgId, planId, {
      stimulusAnalysisStatus: "failed",
    }).catch(() => null);
    return "failed";
  }
}

/** Video-Gegenstück zu runStimulusAnalysis — identische FAIL-OPEN-Semantik:
 *  jeder Fehler lässt den Upload gelingen und mappt nur auf Status 'failed'.
 *  Die Frames stammen aus dem validierten Request-Body und werden nach diesem
 *  Aufruf verworfen — sie werden nirgends persistiert. */
async function runStimulusVideoAnalysis(
  orgId: string,
  planId: string,
  frames: StimulusVideoFrameInput[],
  plan: ResearchPlanRecord,
): Promise<"done" | "failed"> {
  try {
    const payload = await analyzeStimulusVideo({
      frames,
      study: {
        title: plan.title,
        objective: plan.objective,
        topics: plan.topics,
        useCase: plan.useCase,
        stimulusDescription: plan.stimulusDescription,
      },
    });
    const written = await updateResearchPlan(orgId, planId, {
      stimulusAnalysis: payload,
      stimulusAnalysisStatus: "done",
    });
    if (!written) {
      throw new Error("could not persist the stimulus analysis");
    }
    return "done";
  } catch (err) {
    console.error(
      `[POST /api/research/plans/${planId}/stimulus] video analysis failed (fail-open):`,
      err instanceof Error ? err.message : err,
    );
    await updateResearchPlan(orgId, planId, {
      stimulusAnalysisStatus: "failed",
    }).catch(() => null);
    return "failed";
  }
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

  const parsed = await parseStimulusInput(req);
  if (!parsed.success) {
    return invalidResponse(t("invalidRequestBody"), parsed.code);
  }

  try {
    let stimulusUrl: string;
    let stimulusType: "image" | "link" | "video";

    if (parsed.input.mode === "image") {
      const { file } = parsed.input;
      if (file.size === 0) {
        return invalidResponse(t("invalidRequestBody"), "empty_stimulus_file");
      }
      if (file.size > MAX_IMAGE_BYTES) {
        return invalidResponse(t("invalidRequestBody"), "stimulus_file_too_large");
      }

      const ext = EXT_BY_TYPE[file.type];
      if (!ext) {
        return invalidResponse(t("invalidRequestBody"), "invalid_stimulus_mime");
      }
      if (!(await hasValidImageSignature(file))) {
        return invalidResponse(
          t("invalidRequestBody"),
          "invalid_stimulus_file",
        );
      }

      const supabase = createAdminSupabaseClient();
      const path = `${orgId}/${planId}/${Date.now()}-stimulus.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { contentType: file.type, upsert: true });
      if (uploadError) throw uploadError;

      stimulusUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data
        .publicUrl;
      stimulusType = "image";
    } else if (parsed.input.mode === "video") {
      const { storagePath } = parsed.input;
      // SICHERHEIT: der Pfad muss im org/plan-Namespace DIESES Requests
      // liegen — sonst könnte ein Forscher ein fremdes Bucket-Objekt als
      // eigenen Stimulus referenzieren. Die upload-url-Route mintet Pfade
      // exakt in diesem Format.
      if (
        !storagePath.startsWith(`${orgId}/${planId}/`) ||
        !storagePath.endsWith(".mp4")
      ) {
        return invalidResponse(
          t("invalidRequestBody"),
          "invalid_stimulus_storage_path",
        );
      }

      // Das Objekt muss real existieren (der Signed-Upload ist abgeschlossen,
      // bevor der Client diese Route ruft). MIME + Größe erzwingt primär der
      // Bucket (Migration 20260703000008); die Metadaten-Prüfung hier ist
      // Defense-in-depth, fail-open bei fehlenden Feldern.
      const supabase = createAdminSupabaseClient();
      const { data: objectInfo, error: infoError } = await supabase.storage
        .from(BUCKET)
        .info(storagePath);
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

      stimulusUrl = supabase.storage.from(BUCKET).getPublicUrl(storagePath)
        .data.publicUrl;
      stimulusType = "video";
    } else {
      stimulusUrl = parsed.input.url;
      stimulusType = "link";
    }

    const updated = await updateResearchPlan(orgId, planId, {
      stimulusUrl,
      stimulusType,
      ...("description" in parsed.input
        ? { stimulusDescription: parsed.input.description }
        : {}),
      // INVALIDIERUNG: jeder neue Stimulus (Bild, Video ODER Link) macht eine
      // alte Analyse ungültig — es gibt keinen Zustand, in dem eine Analyse zu
      // einem anderen Asset gehört. Bild/Video → 'pending' (Analyse folgt
      // unten), Link → null (nichts zu analysieren).
      stimulusAnalysis: null,
      stimulusAnalysisStatus:
        parsed.input.mode === "link" ? null : "pending",
    });
    if (!updated) {
      return NextResponse.json(
        { error: t("research.couldNotUpdatePlan") },
        { status: 500 },
      );
    }

    const analysisStatus =
      parsed.input.mode === "image"
        ? await runStimulusAnalysis(orgId, planId, parsed.input.file, updated)
        : parsed.input.mode === "video"
          ? await runStimulusVideoAnalysis(
              orgId,
              planId,
              parsed.input.frames,
              updated,
            )
          : null;

    return NextResponse.json({
      stimulus_url: updated.stimulusUrl,
      stimulus_type: updated.stimulusType,
      stimulus_analysis_status: analysisStatus,
    });
  } catch (err) {
    console.error(
      `[POST /api/research/plans/${planId}/stimulus] failed:`,
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

  try {
    const updated = await updateResearchPlan(orgId, planId, {
      stimulusUrl: null,
      stimulusType: null,
      stimulusDescription: null,
      stimulusAnalysis: null,
      stimulusAnalysisStatus: null,
    });
    if (!updated) {
      return NextResponse.json(
        { error: t("research.couldNotUpdatePlan") },
        { status: 500 },
      );
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(
      `[DELETE /api/research/plans/${planId}/stimulus] failed:`,
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { error: t("research.couldNotUpdatePlan") },
      { status: 500 },
    );
  }
}
