import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { requireOrgIdOrError } from "@/lib/auth/org";
import { getResearchPlan } from "@/lib/research/plans-service";
import {
  chatWithData,
  ChatWithDataUnavailableError,
} from "@/lib/research/chat-with-data";

/**
 * POST /api/research/plans/[id]/chat — "Frag deine Daten".
 *
 * Researcher poses a natural-language question about a single study; the
 * engine answers STRICTLY from the verdichtungen + Stage-2 synthesis of
 * that plan, with verbatim citations. Same auth + plan-ownership posture
 * as POST /api/research/plans/[id]/synthesis.
 *
 * Body shape (Zod-validated):
 *   { question: string (1-2000 chars), history?: [{role, content}] (≤20 turns) }
 *
 * Surface:
 *   400  — invalid body shape
 *   401  — no auth
 *   403  — auth ok but no org context
 *   404  — plan not found in this org OR engine couldn't load the study
 *   500  — engine threw (Opus unavailable, schema validation lost twice)
 *   200  — { success: true, result: { answer, citations, answered } }
 */

// One Opus turn over the full study corpus per request — explicit ceiling
// like the other LLM routes (voice: 300).
export const maxDuration = 300;

const HistoryTurnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});

const BodySchema = z.object({
  question: z.string().min(1).max(2000),
  history: z.array(HistoryTurnSchema).max(20).optional(),
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

  // Plan-ownership gate. Filters by org_id; null = not present OR not in
  // this org. Either way → 404, no cross-org existence leak.
  const plan = await getResearchPlan(orgId, planId);
  if (!plan) {
    return NextResponse.json(
      { error: t("notFound.researchPlan") },
      { status: 404 },
    );
  }

  // Body validation. We trust nothing the client sent — the engine reads
  // the question + history straight into the LLM prompt, so a 4 KB cap
  // per message + 20-turn cap on history keeps a hostile client from
  // burning Opus tokens.
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      { error: t("invalidJsonBody") },
      { status: 400 },
    );
  }
  const parsed = BodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: t("invalidRequestBody"),
        detail: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  try {
    const result = await chatWithData({
      orgId,
      planId,
      question: parsed.data.question,
      history: parsed.data.history,
    });
    return NextResponse.json({ success: true, result });
  } catch (err) {
    // chatWithData throws ChatWithDataUnavailableError when the plan vanished
    // between the ownership check and the engine load (rare race; map to
    // 404). Everything else is treated as engine failure.
    if (
      err instanceof ChatWithDataUnavailableError &&
      err.message.includes("not found")
    ) {
      return NextResponse.json(
        { error: t("notFound.researchPlan") },
        { status: 404 },
      );
    }
    console.error(
      `[POST /api/research/plans/${planId}/chat] engine failed:`,
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      {
        error: t("research.chatFailed"),
        detail: err instanceof Error ? err.message : "unknown",
      },
      { status: 500 },
    );
  }
}
