import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";

import { requireOrgIdOrError } from "@/lib/auth/org";
import {
  KonsoulAgentUnavailableError,
  runKonsoulAgent,
} from "@/lib/konsoul/agent/engine";
import { KonsoulAgentRequestSchema } from "@/lib/schemas/konsoul-agent";

/**
 * POST /api/konsoul-agent — Konsoul P2 ("Ein Gehirn, mehrere Türen").
 *
 * The read-only ORCHESTRATOR sibling of /api/cross-study-agent. This route is a
 * faithful clone of the cross-study route — same auth, same caps, same fail-closed
 * surface — but it points at the Konsoul orchestrator engine, which ROUTES a single
 * question to one of three doors and returns a UNIFIED, kind-tagged envelope:
 *
 *   - Theme/frequency questions are DELEGATED VERBATIM to the unchanged Cross-Study
 *     agent (Opus, anchor-filtered citations). The engine only MAPS the delegated
 *     result onto kind ∈ {grounded, interpretation, refusal} — it never touches the
 *     cross-study logic, so an identical theme question yields the same answer as
 *     today (zero regression).
 *   - Broad portfolio/status questions are answered from DETERMINISTIC read-only
 *     tools — numbers travel in a structured `data` block, never invented by the
 *     model (honesty contract §3.4).
 *   - Help / how-to questions are answered from a curated server-side corpus →
 *     kind:'guidance' (neutral, never the green "belegt" face, never citations).
 *
 * Auth is STRICT and ORG-SCOPED. The orgId comes from requireOrgIdOrError() — the
 * authenticated session — and is NEVER read from the request body. It is bound into
 * the engine's read-tools by closure (makeKonsoulReadTools(orgId)) so cross-org
 * access is structurally impossible and the model can never pass an org argument.
 * We re-use the canonical request schema with `orgId` omitted, so the body is
 * validated against the exact same question/history field defs (history capped at
 * 20 turns) while orgId stays server-authoritative — identical to the cross-study
 * and mission-control routes. The request shape (question + history) is kept
 * compatible so the existing panel only needs to swap the fetch URL.
 *
 * Surface:
 *   400  — invalid body shape / non-JSON body
 *   401  — no auth
 *   403  — auth ok but no org context
 *   500  — engine threw (model unavailable, schema validation lost twice, budget
 *          exhausted) → fail-closed, NEVER ungrounded content
 *   200  — { success: true, result: KonsoulResult }   // discriminated by `kind`
 *
 * An answered=false / kind:'refusal' result (the honest "weiß ich nicht" / no
 * grounded evidence) is a NORMAL 200 — NOT an error. The client renders it as a
 * visible, calm turn keyed on `kind`.
 */

// Body = the canonical request WITHOUT orgId (which is server-authoritative).
const BodySchema = KonsoulAgentRequestSchema.omit({ orgId: true });

export async function POST(request: NextRequest): Promise<NextResponse> {
  const t = await getTranslations("errors");
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;
  const { orgId } = orgOrError;

  // We trust nothing the client sent — the question + history are read straight
  // into the LLM prompt, so the schema's caps keep a hostile client from burning
  // model tokens (and the orchestrator's multi-call loop makes that cost real).
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
    // runKonsoulAgent binds the read-only tools to THIS org via closure and routes
    // the question. Theme questions are delegated to runCrossStudyAgent WITHOUT a
    // model override (Opus default preserved); broad/help paths use the
    // deterministic tools + curated corpus. The returned KonsoulResult is the
    // kind-tagged unified envelope — schema-validated inside the engine, so a
    // schema break throws (→ 500 below) and never leaks ungrounded content.
    const result = await runKonsoulAgent({
      orgId,
      question: parsed.data.question,
      history: parsed.data.history,
    });
    return NextResponse.json({ success: true, result });
  } catch (err) {
    // KonsoulAgentUnavailableError (model down, schema lost twice, budget
    // exhausted without a valid answer, or no service-role key) → 500. The honest
    // "no grounded answer" refusal is NOT an error; it is a normal 200 above.
    console.error(
      "[POST /api/konsoul-agent] engine failed:",
      err instanceof Error ? err.message : err,
    );
    const tAgent = await getTranslations("crossStudyAgent");
    return NextResponse.json(
      {
        error: tAgent("errEngine"),
        code:
          err instanceof KonsoulAgentUnavailableError ? "engine" : "unknown",
      },
      { status: 500 },
    );
  }
}
