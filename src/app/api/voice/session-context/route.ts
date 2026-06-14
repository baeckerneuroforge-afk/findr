import { NextResponse, type NextRequest } from "next/server";

import {
  buildResearchSystemPrompt,
  type ResearchInput,
} from "@/lib/voice-agent/interviewer";
import { ensureOpeningTurnBySessionId } from "@/lib/voice-agent/session-service";
import { requireVoiceAgentAuth } from "@/lib/voice-interview/agent-auth";
import { loadVoiceBridgeSession } from "@/lib/voice-interview/bridge-service";
import { sessionIdFromRoomName } from "@/lib/voice-interview/room";

/**
 * GET /api/voice/session-context?room=voice-<sessionId> — Phase 1 (AGENT-seitig).
 *
 * Der LiveKit-Voice-Agent wird per Agent-Dispatch in den Raum geholt und kennt
 * zunächst NUR den Raum-Namen. Diese Route löst ihn zur Session auf und liefert
 * den vollständigen Interview-Kontext:
 *
 *   - systemPrompt über die BESTEHENDE buildResearchSystemPrompt-Logik
 *     (inkl. use_case- bzw. Stimulus-Fokusblock) — gefüttert aus dem
 *     deal_context-Snapshot der Session (ResearchInput = { plan, brand }),
 *     also EXAKT derselben Quelle, die der Text-Interviewer in
 *     advanceInterview auf jedem Turn nutzt. Plan-Edits nach Session-Start
 *     wirken sich damit in beiden Modalitäten gleich (nicht) aus.
 *   - Studien-Titel, Objective, Persona, Sprache, Leitfaden (topics inkl.
 *     intent + private hypotheses), Stimulus-Metadaten, Brand-Grounding.
 *   - conversation + nextTurnIndex: conversation[0] ist die Opening-Message
 *     (seit Perf-B2 nicht mehr beim Session-Create erzeugt, sondern hier
 *     lazily via ensureOpeningTurnBySessionId sichergestellt, bevor der
 *     Kontext rausgeht) — der Agent SPRICHT diese als Begrüßung und
 *     indiziert seine eigenen Turns ab nextTurnIndex (Kontrakt von
 *     /api/voice/transcript). Bei Reconnect enthält conversation bereits
 *     gelieferte Voice-Turns → nahtloses Fortsetzen.
 *
 * Auth: Authorization: Bearer <VOICE_AGENT_SHARED_SECRET>. Der Secret-Inhaber
 * ist vertrauenswürdige Infrastruktur (Threat-Model in agent-auth.ts); eine
 * voice_enabled-Re-Prüfung passiert hier bewusst NICHT — das Gating sitzt an
 * der Teilnehmer-Token-Ausgabe (/api/voice/token), und ein mid-Interview
 * umgelegter Plan-Schalter darf ein laufendes Gespräch nicht abreißen.
 *
 * Surface:
 *   503 — Bridge nicht konfiguriert (Secret fehlt)
 *   401 — fehlendes/falsches Secret
 *   400 — room-Parameter fehlt / kein voice-<uuid>-Format
 *   404 — Raum gehört zu keiner Session
 *   403 — Session ist kein research-Interview
 *   409 — Session nicht mehr offen ODER ohne research-Kontext
 *   500 — DB warf
 *   200 — Kontext-Payload (siehe unten)
 */

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = requireVoiceAgentAuth(request);
  if ("error" in auth) return auth.error;

  const room = request.nextUrl.searchParams.get("room") ?? "";
  const sessionId = sessionIdFromRoomName(room);
  if (!sessionId) {
    return NextResponse.json(
      { error: "Invalid room parameter — expected voice-<sessionId>." },
      { status: 400 },
    );
  }

  try {
    const session = await loadVoiceBridgeSession(sessionId);
    if (!session) {
      return NextResponse.json(
        { error: "Interview session not found." },
        { status: 404 },
      );
    }
    if (session.kind !== "research") {
      return NextResponse.json(
        { error: "Voice is only available for research interviews." },
        { status: 403 },
      );
    }
    if (session.status !== "open") {
      return NextResponse.json(
        {
          error: "Interview session is no longer open.",
          code: "not_open",
          status: session.status,
        },
        { status: 409 },
      );
    }

    // Narrow NACH dem kind-Guard — exakt wie advanceInterview
    // (session.dealContext as unknown as ResearchInput).
    const input = session.dealContext as unknown as ResearchInput | null;
    if (!input?.plan) {
      return NextResponse.json(
        { error: "Session has no research context.", code: "no_context" },
        { status: 409 },
      );
    }

    // Spiegel der modul-privaten hasResearchStimulus-Logik in interviewer.ts:
    // der Stimulus-Fokusblock greift bei nicht-leerer Beschreibung ODER
    // Vision-Analyse (textBlock — Bestands-Snapshots tragen das Feld nicht →
    // undefined → Verhalten unverändert). E6: ein Multi-Stimulus-SET zählt
    // ebenfalls als Präsenz (Parität zu hasResearchStimulus seit E4).
    const stimulusSet = Array.isArray(input.plan.stimuli)
      ? [...input.plan.stimuli].sort((a, b) => a.position - b.position)
      : [];
    const hasStimulus = Boolean(
      input.plan.stimulusDescription?.trim() ||
        input.plan.stimulusAnalysis?.trim() ||
        stimulusSet.length > 0,
    );
    const systemPrompt = buildResearchSystemPrompt(
      input.plan.useCase,
      hasStimulus,
    );

    const stimulus =
      input.plan.stimulusUrl ||
      input.plan.stimulusType ||
      input.plan.stimulusDescription ||
      input.plan.stimulusAnalysis
        ? {
            url: input.plan.stimulusUrl ?? null,
            type: input.plan.stimulusType ?? null,
            description: input.plan.stimulusDescription ?? null,
            // Additiv: der fertige Analyse-textBlock für den Voice-Agenten
            // (eigenes Repo). Ein alter Agent ignoriert das Feld — graceful.
            analysis: input.plan.stimulusAnalysis ?? null,
          }
        : null;

    // Perf-Etappe B2: research sessions are now created WITHOUT the opening
    // turn (it streams in lazily on the text surface). The voice agent's
    // contract is "speak conversation[0] as the greeting" — so an empty
    // conversation grows its opening HERE, before context is handed out.
    // Idempotent + race-guarded in ensureOpeningTurn; sessions that already
    // have turns (reconnect, pre-B2 rows) skip the LLM call entirely.
    let conversation = session.conversation;
    if (conversation.length === 0) {
      const opened = await ensureOpeningTurnBySessionId(session.id);
      conversation = opened?.conversation ?? conversation;
    }

    return NextResponse.json({
      sessionId: session.id,
      roomName: room,
      language: session.language,
      studyTitle: input.plan.title,
      objective: input.plan.objective,
      persona: input.plan.persona ?? null,
      useCase: input.plan.useCase ?? null,
      topics: input.plan.topics,
      stimulus,
      // E6 Multi-Stimulus — das Set aus dem deal_context-SNAPSHOT (dieselbe
      // Quelle wie die Text-Engine und die Teilnehmer-Page, R2/R6), in
      // Positions-Reihenfolge. BEWUSST OHNE url: der Agent braucht sie nicht
      // (das Reveal läuft über die Position; der Browser kennt die URLs aus
      // der Page) — so kann keine Signed-URL versehentlich in den LLM-Prompt
      // wandern. Leer ([]) für jede Session ohne Set; ein alter Agent
      // ignoriert das Feld — graceful wie bei `stimulus.analysis`.
      stimuli: stimulusSet.map((item) => ({
        position: item.position,
        type: item.type,
        label: item.label ?? null,
        description: item.description ?? null,
        analysis: item.analysis ?? null,
      })),
      brand: input.brand ?? null,
      systemPrompt,
      // Konfigurierte Runden-Obergrenze (Agent-Fragen) für diese Studie — der
      // Voice-Agent (eigenes Repo) schließt ab diesem Wert sanft ab. Null für
      // Default-Länge UND für JEDE Stimulus-Set-Studie (deren Snapshot maxRounds
      // bewusst auslässt → der Agent nutzt dort seine eigene stimulus_set-
      // Decke). Ein alter Agent ignoriert das Feld — graceful.
      maxRounds: input.plan.maxRounds ?? null,
      // Zeitlimit (Sekunden) für diese Studie — der Voice-Agent startet einen
      // Timer und schließt nach Ablauf hart ab (Abschluss-Satz → auflegen).
      // Null = kein Limit. Gilt für ALLE Studien (auch Stimulus-Set). Ein alter
      // Agent ignoriert das Feld — graceful.
      maxDurationSeconds: input.plan.maxDurationSeconds ?? null,
      conversation,
      nextTurnIndex: conversation.length,
    });
  } catch (err) {
    console.error(
      "[GET /api/voice/session-context] failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json({ error: "Unexpected error." }, { status: 500 });
  }
}
