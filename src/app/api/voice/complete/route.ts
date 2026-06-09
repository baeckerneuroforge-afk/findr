import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireVoiceAgentAuth } from "@/lib/voice-interview/agent-auth";
import { completeVoiceResearchSession } from "@/lib/voice-interview/bridge-service";

/**
 * POST /api/voice/complete — Voice-Interview Phase 1 (AGENT-seitig).
 *
 * Markiert die Session als abgeschlossen über DENSELBEN Pfad wie das
 * research-Finish im Text-Interview: completeVoiceResearchSession führt den
 * atomaren open→completed-Übergang aus und ruft danach
 * persistResearchTranscriptAndDiscovery (calls-Zeile + use_case-bewusste
 * Product-Discovery-/Market-Research-Extraktion) — Details + bewusste
 * Abweichungen (Transition-zuerst für at-most-once-Extraktion) in
 * src/lib/voice-interview/bridge-service.ts.
 *
 * REIHENFOLGE-KONTRAKT: Der Agent ruft complete erst NACH dem letzten
 * erfolgreichen /api/voice/transcript-Batch — nach dem Abschluss werden
 * Transcript-Schreibungen mit 409 abgewiesen.
 *
 * Auth: Authorization: Bearer <VOICE_AGENT_SHARED_SECRET>.
 *
 * Surface:
 *   503 — Bridge nicht konfiguriert (Secret fehlt)
 *   401 — fehlendes/falsches Secret
 *   400 — non-JSON / ungültiger Body
 *   404 — sessionId unbekannt
 *   403 — Session ist kein research-Interview
 *   500 — DB warf
 *   200 — { completed: true, alreadyCompleted, discoveryRan } (idempotent:
 *         ein wiederholter Aufruf liefert alreadyCompleted: true und stößt
 *         KEINE zweite Extraktion an)
 */

const CompleteBodySchema = z.object({
  sessionId: z.string().uuid(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = requireVoiceAgentAuth(request);
  if ("error" in auth) return auth.error;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = CompleteBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body.", detail: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const result = await completeVoiceResearchSession(parsed.data.sessionId);

    if (!result.ok) {
      switch (result.reason) {
        case "not_found":
          return NextResponse.json(
            { error: "Interview session not found." },
            { status: 404 },
          );
        case "not_research":
          return NextResponse.json(
            { error: "Voice is only available for research interviews." },
            { status: 403 },
          );
      }
    }

    return NextResponse.json({
      completed: true,
      alreadyCompleted: result.alreadyCompleted,
      discoveryRan: result.discoveryRan,
    });
  } catch (err) {
    console.error(
      "[POST /api/voice/complete] failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}
