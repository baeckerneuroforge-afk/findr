import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { requireVoiceAgentAuth } from "@/lib/voice-interview/agent-auth";
import {
  appendVoiceTurns,
  type VoiceTurnInput,
} from "@/lib/voice-interview/bridge-service";

/**
 * POST /api/voice/transcript — Voice-Interview Phase 1 (AGENT-seitig).
 *
 * Der externe LiveKit-Voice-Agent liefert finalisierte Gesprächs-Turns ab.
 * Sie landen in DERSELBEN conversation[]-Struktur wie Text-Interviews
 * ({ role, text }, siehe bridge-service.ts); `ts` wird angenommen und
 * validiert, aber NICHT persistiert — die gespeicherte Turn-Form bleibt
 * byte-gleich zur Text-Form, Zeitinformation lebt in den Agent-Logs.
 *
 * Auth: Authorization: Bearer <VOICE_AGENT_SHARED_SECRET> (timing-sicher,
 * src/lib/voice-interview/agent-auth.ts). KEIN Teilnehmer-Zugriff.
 *
 * Idempotenz: absoluter `index` je Turn (Position in conversation[]).
 * Bereits gespeicherte Indizes werden übersprungen (skipped), Lücken werden
 * mit 409 + expectedIndex abgewiesen, damit der Agent nachsendet. Der Agent
 * sendet Batches SEQUENZIELL (höchstens ein in-flight Request pro Session).
 *
 * Surface:
 *   503 — Bridge nicht konfiguriert (Secret fehlt)
 *   401 — fehlendes/falsches Secret
 *   400 — non-JSON / ungültiger Body
 *   404 — sessionId unbekannt
 *   403 — Session ist kein research-Interview
 *   409 — Session nicht mehr offen ODER Index-Lücke (code: not_open | gap)
 *   500 — DB warf
 *   200 — { ok: true, appended, skipped, turnCount }
 */

const TurnSchema = z.object({
  index: z.number().int().min(0).max(9999),
  // Großzügig beim Rollen-Vokabular (LiveKit/OpenAI-Konventionen), streng
  // normalisiert aufs Konversationsmodell: agent|customer.
  role: z.enum(["agent", "assistant", "customer", "user", "participant"]),
  content: z.string().trim().min(1).max(8000),
  ts: z.string().trim().max(64).nullable().optional(),
});

const TranscriptBodySchema = z.object({
  sessionId: z.string().uuid(),
  turns: z.array(TurnSchema).min(1).max(200),
});

function toConversationRole(
  role: z.infer<typeof TurnSchema>["role"],
): VoiceTurnInput["role"] {
  return role === "agent" || role === "assistant" ? "agent" : "customer";
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = requireVoiceAgentAuth(request);
  if ("error" in auth) return auth.error;

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = TranscriptBodySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body.", detail: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const turns: VoiceTurnInput[] = parsed.data.turns.map((turn) => ({
    index: turn.index,
    role: toConversationRole(turn.role),
    text: turn.content,
  }));

  try {
    const result = await appendVoiceTurns(parsed.data.sessionId, turns);

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
        case "not_open":
          return NextResponse.json(
            {
              error: "Interview session is no longer open.",
              code: "not_open",
              status: result.status,
            },
            { status: 409 },
          );
        case "gap":
          return NextResponse.json(
            {
              error: "Turn index gap — resend from expectedIndex.",
              code: "gap",
              expectedIndex: result.expectedIndex,
              turnCount: result.turnCount,
            },
            { status: 409 },
          );
      }
    }

    return NextResponse.json({
      ok: true,
      appended: result.appended,
      skipped: result.skipped,
      turnCount: result.turnCount,
    });
  } catch (err) {
    console.error(
      "[POST /api/voice/transcript] failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}
