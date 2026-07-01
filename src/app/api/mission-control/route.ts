import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";

import { requireOrgIdOrError } from "@/lib/auth/org";
import {
  missionControlChat,
  MissionControlUnavailableError,
} from "@/lib/mission-control/engine";
import { MissionControlRequestSchema } from "@/lib/schemas/mission-control";

/**
 * POST /api/mission-control — Mission-Control / Cross-Study-Chat (Etappe 2).
 *
 * The researcher asks a question ACROSS ALL studies of their org ("welche Themen
 * tauchen studienübergreifend auf?", "vergleiche die Befunde aus Studie A und B")
 * and the engine answers grounded STRICTLY in the org's study syntheses, with
 * per-study verbatim citations. Multi-turn: the client sends the prior
 * conversation as `history`; the engine threads it as context but rebuilds the
 * per-study anchor haystack from the FRESH syntheses on EVERY turn — a follow-up
 * can never smuggle in an un-grounded cross-study claim.
 *
 * Auth is STRICT and ORG-SCOPED (this is NOT a public route, unlike the synthesis
 * share links): the orgId comes from requireOrgIdOrError() — the authenticated
 * session — and is NEVER taken from the request body. We re-use the canonical
 * request schema with `orgId` omitted, so the body is validated against the exact
 * same question/history field defs while orgId stays server-authoritative.
 *
 * Surface:
 *   400  — invalid body shape / non-JSON body
 *   401  — no auth
 *   403  — auth ok but no org context
 *   500  — engine threw (model unavailable, schema validation lost twice)
 *   200  — { success: true, result: { answered, answer,
 *            citations: [{ studyId, quote }] } }
 *
 * An answered=false result (the honest "keine Evidenz in den Studien" refusal,
 * and the all-citations-dropped downgrade) is a NORMAL 200 — NOT an error. The
 * client renders it as a visible, calm turn.
 */

// Body = the canonical request WITHOUT orgId (which is server-authoritative).
// Reusing the schema keeps question/history validation identical to the
// engine/eval contract (≤2000-char question, ≤20 history turns of ≤4000 chars).
const BodySchema = MissionControlRequestSchema.omit({ orgId: true });

// Vercel-Funktionslimit anheben: die inneren LLM-Budgets (Opus-Chat-Turn mit großer Datensektion)
// übersteigen sonst das Routen-Limit — die Funktion würde mitten im
// bezahlten Call/Loop gekillt (verworfene Antwort, "unexpected error").
// Gleiches Muster wie synthesis/agent/chat-Routen.
export const maxDuration = 300;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const t = await getTranslations("errors");
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;
  const { orgId } = orgOrError;

  // We trust nothing the client sent — the question + history are read straight
  // into the LLM prompt, so the schema's caps keep a hostile client from burning
  // model tokens.
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
    // The engine returns a MissionControlResult that already conforms to
    // MissionControlResultSchema — it was forced-tool-validated on the way in and
    // re-shaped by the per-study anchor filter on the way out.
    const result = await missionControlChat(
      orgId,
      parsed.data.question,
      parsed.data.history,
    );
    return NextResponse.json({ success: true, result });
  } catch (err) {
    // MissionControlUnavailableError (model down, schema lost twice, or no
    // service-role key) → 500. The honest "no evidence" refusal is NOT an error;
    // it comes back as a normal answered=false 200 above.
    console.error(
      "[POST /api/mission-control] engine failed:",
      err instanceof Error ? err.message : err,
    );
    const tMc = await getTranslations("missionControl");
    return NextResponse.json(
      {
        error: tMc("errEngine"),
        code: err instanceof MissionControlUnavailableError ? "engine" : "unknown",
      },
      { status: 500 },
    );
  }
}
