import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";

import { requireOrgIdOrError } from "@/lib/auth/org";
import { getResearchPlan } from "@/lib/research/plans-service";
// TODO: wird beim Merge mit engine-Branch verbunden — die Stub-Variante in
// src/lib/synthesis/engine.ts wirft "not implemented", Terminal 1 baut den
// echten Body mit derselben Signatur. Die TYPES aus dem Modul (insbesondere
// StudySynthesisRecord) bleiben über den Merge stabil — wenn nicht, fällt
// es hier am Type-Check sofort auf.
import { synthesizeStudy } from "@/lib/synthesis/engine";
import { expandSynthesisNarrative } from "@/lib/synthesis/narrative";

/**
 * POST /api/research/plans/[id]/synthesis — re-run / create Stage-2 synthesis.
 *
 * Mandatory auth + plan-ownership gate before the engine call: synthesizeStudy
 * doesn't take orgId for "trust me" — the route verifies the plan belongs to
 * the caller's org and only THEN hands the (orgId, planId) pair down. Mirrors
 * the pattern used by the research-invite / send-invite routes.
 *
 * Surface:
 *   401/403   — auth fail (via requireOrgIdOrError)
 *   404       — plan not found in this org
 *   500       — engine threw (currently expected because the stub always
 *               throws; under Terminal 1's real engine this becomes "Opus
 *               unavailable" / DB write fail / etc.)
 *   200       — { success: true, synthesis: StudySynthesisRecord }
 */

// Stage-2 synthesis is one long Opus call over the whole study — give the
// route the same explicit ceiling as the other LLM surfaces (voice: 300).
export const maxDuration = 300;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const t = await getTranslations("errors");
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;
  const { orgId } = orgOrError;

  const { id: planId } = await params;

  // Optional body: { detailLevel: "standard" | "ausführlich" }. Absent/non-JSON
  // → "standard" = the unchanged behaviour (the plain re-run button sends no
  // body). Only an explicit "ausführlich" triggers the additive narrative stage.
  let detailLevel: "standard" | "ausführlich" = "standard";
  try {
    const body = (await request.json()) as { detailLevel?: unknown };
    if (body?.detailLevel === "ausführlich") detailLevel = "ausführlich";
  } catch {
    // no/invalid body → standard
  }

  // Plan-ownership check. getResearchPlan filters by org_id; null = either
  // not present or not in this org. Either way it's a 404 to the caller —
  // we don't leak existence cross-org.
  const plan = await getResearchPlan(orgId, planId);
  if (!plan) {
    return NextResponse.json(
      { error: t("notFound.researchPlan") },
      { status: 404 },
    );
  }

  try {
    const synthesis = await synthesizeStudy(orgId, planId);
    // Ausführlich = additive, BEST-EFFORT second stage. The core synthesis above
    // is the hard path; if the narrative stage fails, the base synthesis still
    // stands and we just return without it (mirrors the E4 extras posture).
    let executiveNarrative: string | null = null;
    if (detailLevel === "ausführlich" && synthesis.status === "synthesized") {
      try {
        const expanded = await expandSynthesisNarrative(orgId, planId);
        executiveNarrative = expanded.executiveNarrative;
      } catch (narrErr) {
        console.warn(
          `[research/synthesis] narrative stage failed (base synthesis kept): ${
            narrErr instanceof Error ? narrErr.message : narrErr
          }`,
        );
      }
    }
    return NextResponse.json({ success: true, synthesis, executiveNarrative });
  } catch (err) {
    console.error("[research/synthesis] failed:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      {
        error: t("research.synthesisFailed"),
      },
      { status: 500 },
    );
  }
}
