import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";

import { requireOrgIdOrError } from "@/lib/auth/org";
import {
  DEFAULT_META_SYNTHESIS_MODEL,
  MetaSynthesisInputError,
  runMetaSynthesis,
} from "@/lib/meta-synthesis/engine";
import {
  saveMetaSynthesis,
  type MetaSynthesisStudyRef,
} from "@/lib/meta-synthesis/service";
import type { MissionControlSynthesisInput } from "@/lib/mission-control/prompts";
import { MetaSynthesisRequestSchema } from "@/lib/schemas/meta-synthesis";

/**
 * POST /api/meta-synthesis — generate + persist a cross-study meta-synthesis.
 *
 * The deep, exportable sibling of the Cross-Study-Agent CHAT: given ≥2 studies
 * (selected in the picker, or seeded from a chat answer's cited studies), the
 * engine runs ONE Opus call over their finished syntheses and returns a
 * structured, anchor-filtered artifact — then we persist it (E2) so it can be
 * re-opened, re-exported (E4) and later shared (E5).
 *
 * Auth is STRICT + ORG-SCOPED (like /api/cross-study-agent, NOT a public route):
 * orgId comes from requireOrgIdOrError(), NEVER the body. The body reuses the
 * canonical request schema with orgId omitted.
 *
 * Surface:
 *   400  — invalid body shape / non-JSON body
 *   401/403 — no auth / no org
 *   422  — fewer than 2 of the selected studies have a synthesis (code
 *           "not_enough_studies") — a caller-fixable precondition, not a crash
 *   500  — engine threw (model unavailable, schema lost twice) or persist failed
 *   200  — { success: true, record: MetaSynthesisRecord }
 */

// One long Opus call over several syntheses — same ceiling as the other LLM
// surfaces (study synthesis / voice: 300).
export const maxDuration = 300;

// Body = the canonical request WITHOUT orgId (which is server-authoritative).
const BodySchema = MetaSynthesisRequestSchema.omit({ orgId: true });

/** Auto-title from the used studies when the user didn't name the artifact. */
function defaultTitle(studies: MissionControlSynthesisInput[]): string {
  const joined = studies
    .map((s) => s.studyTitle)
    .filter((t) => t && t.trim() !== "")
    .join(" · ");
  const base = joined ? `Meta-Synthese: ${joined}` : "Meta-Synthese";
  return base.length > 200 ? `${base.slice(0, 199)}…` : base;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const t = await getTranslations("errors");
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;
  const { orgId } = orgOrError;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: t("invalidJsonBody") }, { status: 400 });
  }
  const parsed = BodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: t("invalidRequestBody"), detail: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Resolve the model explicitly (so we persist EXACTLY what generated the row).
  const model = process.env.META_SYNTHESIS_MODEL ?? DEFAULT_META_SYNTHESIS_MODEL;

  try {
    const { result, usedStudies } = await runMetaSynthesis(
      orgId,
      parsed.data.studyIds,
      parsed.data.focus,
      model,
    );

    // Persist the anchor-filtered artifact + a point-in-time study snapshot so
    // the view/export can label cited studyIds even after a rename/delete.
    const basedOn: MetaSynthesisStudyRef[] = usedStudies.map((s) => ({
      studyId: s.studyId,
      studyTitle: s.studyTitle,
      basedOnCount: s.basedOnCount,
      studyType: s.studyType,
    }));
    const record = await saveMetaSynthesis({
      orgId,
      title: parsed.data.title?.trim() || defaultTitle(usedStudies),
      sourceStudyIds: usedStudies.map((s) => s.studyId),
      focus: parsed.data.focus ?? null,
      result,
      basedOn,
      model,
    });

    return NextResponse.json({ success: true, record });
  } catch (err) {
    // Caller-fixable precondition → 422 with a stable code the UI localizes.
    if (err instanceof MetaSynthesisInputError) {
      return NextResponse.json(
        { error: t("unexpected"), code: "not_enough_studies" },
        { status: 422 },
      );
    }
    console.error(
      "[POST /api/meta-synthesis] failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      { error: t("unexpected"), code: "engine" },
      { status: 500 },
    );
  }
}
