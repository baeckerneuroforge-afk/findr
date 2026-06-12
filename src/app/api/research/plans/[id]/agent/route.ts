import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { requireOrgIdOrError } from "@/lib/auth/org";
import { getResearchPlan } from "@/lib/research/plans-service";
import {
  runResearchAgent,
  ResearchAgentUnavailableError,
} from "@/lib/research-agent/engine";
import { ResearchAgentHistoryTurnSchema } from "@/lib/schemas/research-agent";

/**
 * POST /api/research/plans/[id]/agent — Research-Agent (Etappe 2).
 *
 * The researcher fires a free-text instruction ("fasse die Hauptbefunde als 5
 * Bullet-Points", "mach das kürzer", "jetzt nach Segment aufschlüsseln") and
 * the engine builds a STRUCTURED deliverable grounded STRICTLY in the finished
 * study synthesis (never raw transcripts — DSGVO + token cost). Multi-turn: the
 * client sends the prior conversation as `history`; the engine threads it as
 * context, but the anti-hallucination anchor haystack is rebuilt from the fresh
 * synthesis on EVERY turn (a follow-up cannot smuggle in an un-grounded
 * finding). Same auth + plan-ownership posture as POST .../chat and
 * .../synthesis.
 *
 * Body shape (Zod-validated):
 *   { instruction: string (1-2000 chars), history?: [{role, content}] (≤20 turns) }
 *
 * Surface:
 *   400  — invalid body shape
 *   401  — no auth
 *   403  — auth ok but no org context
 *   404  — plan not found in this org OR engine couldn't load the study
 *   500  — engine threw (model unavailable, schema validation lost twice)
 *   200  — { success: true, result: { fulfilled, deliverableType, title,
 *           items: [{ heading, text, themeRefs, quotes }], note } }
 *
 * A fulfilled=false result (the honest "steht nicht in den Daten" refusal, and
 * the all-items-dropped downgrade) is a NORMAL 200 — NOT an error. The client
 * renders it as a visible, distinctly-styled turn.
 */

// Multi-turn agent deliverable = one long Opus call per request — explicit
// ceiling like the other LLM routes (voice: 300).
export const maxDuration = 300;

const BodySchema = z.object({
  instruction: z.string().min(1).max(2000),
  history: z.array(ResearchAgentHistoryTurnSchema).max(20).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const t = await getTranslations("errors");
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;
  const { orgId } = orgOrError;

  const { id: planId } = await params;

  // Plan-ownership gate. Filters by org_id; null = not present OR not in this
  // org. Either way → 404, no cross-org existence leak.
  const plan = await getResearchPlan(orgId, planId);
  if (!plan) {
    return NextResponse.json(
      { error: t("notFound.researchPlan") },
      { status: 404 },
    );
  }

  // Body validation. We trust nothing the client sent — the engine reads the
  // instruction + history straight into the LLM prompt, so a 2 KB cap on the
  // instruction, a 4 KB cap per history turn, and a 20-turn cap keep a hostile
  // client from burning model tokens.
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

  try {
    const result = await runResearchAgent({
      orgId,
      planId,
      instruction: parsed.data.instruction,
      history: parsed.data.history,
    });
    return NextResponse.json({ success: true, result });
  } catch (err) {
    // runResearchAgent throws ResearchAgentUnavailableError when the plan
    // vanished between the ownership check and the engine load (rare race; map
    // to 404). Everything else is treated as engine failure.
    if (
      err instanceof ResearchAgentUnavailableError &&
      err.message.includes("not found")
    ) {
      return NextResponse.json(
        { error: t("notFound.researchPlan") },
        { status: 404 },
      );
    }
    console.error(
      `[POST /api/research/plans/${planId}/agent] engine failed:`,
      err instanceof Error ? err.message : err,
    );
    const tAgent = await getTranslations("researchAgent");
    return NextResponse.json(
      {
        error: tAgent("errEngine"),
      },
      { status: 500 },
    );
  }
}
