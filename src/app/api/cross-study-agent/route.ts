import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";

import { requireOrgIdOrError } from "@/lib/auth/org";
import {
  CrossStudyAgentUnavailableError,
  runCrossStudyAgent,
} from "@/lib/cross-study-agent/engine";
import { CrossStudyAgentRequestSchema } from "@/lib/schemas/cross-study-agent";

/**
 * POST /api/cross-study-agent — Cross-Study-Agent (Bau 3).
 *
 * The AGENTIC sibling of /api/mission-control: instead of loading ALL syntheses
 * into one context, the engine RESEARCHES — it lists studies, loads the relevant
 * ones on demand, counts themes deterministically (aggregate_theme_frequency),
 * then answers with the SAME per-study citation guarantee. Multi-turn: the client
 * sends the prior conversation as `history`; the engine threads it as context but
 * rebuilds the per-study anchor haystack from the loaded studies on EVERY turn —
 * a follow-up can never smuggle in an un-grounded cross-study claim.
 *
 * Auth is STRICT and ORG-SCOPED (this is NOT a public route, unlike the synthesis
 * share links): the orgId comes from requireOrgIdOrError() — the authenticated
 * session — and is NEVER taken from the request body. We re-use the canonical
 * request schema with `orgId` omitted, so the body is validated against the exact
 * same question/history field defs while orgId stays server-authoritative. Mirror
 * of the mission-control route.
 *
 * Surface:
 *   400  — invalid body shape / non-JSON body
 *   401  — no auth
 *   403  — auth ok but no org context
 *   500  — engine threw (model unavailable, schema validation lost twice)
 *   200  — { success: true, result: { answered, answer,
 *            citations: [{ studyId, quote }], interpretation } }
 *
 * An answered=false result (the honest "keine belegbare Antwort" refusal, and the
 * all-citations-dropped downgrade) is a NORMAL 200 — NOT an error. The client
 * renders it as a visible, calm turn. The `interpretation` field is the
 * non-evidenced soft channel (Bau 2) — the client renders it distinctly.
 */

// Body = the canonical request WITHOUT orgId (which is server-authoritative).
const BodySchema = CrossStudyAgentRequestSchema.omit({ orgId: true });

export async function POST(request: NextRequest): Promise<NextResponse> {
  const t = await getTranslations("errors");
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;
  const { orgId } = orgOrError;

  // We trust nothing the client sent — the question + history are read straight
  // into the LLM prompt, so the schema's caps keep a hostile client from burning
  // model tokens (and the agent's multi-call loop makes that cost real).
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
    // runCrossStudyAgent returns the anchor-filtered CrossStudyAgentResult — the
    // research loop selected the studies, the answer rests on Mission-Control's
    // verbatim citation guarantee on that loaded subset.
    const result = await runCrossStudyAgent({
      orgId,
      question: parsed.data.question,
      history: parsed.data.history,
    });
    return NextResponse.json({ success: true, result });
  } catch (err) {
    // CrossStudyAgentUnavailableError (model down, schema lost twice, budget
    // exhausted without a valid answer, or no service-role key) → 500. The honest
    // "no grounded answer" refusal is NOT an error; it is a normal 200 above.
    console.error(
      "[POST /api/cross-study-agent] engine failed:",
      err instanceof Error ? err.message : err,
    );
    const tAgent = await getTranslations("crossStudyAgent");
    return NextResponse.json(
      {
        error: tAgent("errEngine"),
        detail: err instanceof Error ? err.message : "unknown",
        code:
          err instanceof CrossStudyAgentUnavailableError ? "engine" : "unknown",
      },
      { status: 500 },
    );
  }
}
