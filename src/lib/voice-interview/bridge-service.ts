import "server-only";

import type { Json } from "@/types/database";
import { createResearchSupabase } from "@/lib/research/db";
import {
  conversationToTranscript,
  persistResearchTranscriptAndDiscovery,
} from "@/lib/research/transcript-service";
import type {
  InterviewLanguage,
  InterviewTurn,
} from "@/lib/voice-agent/interviewer";

/**
 * Voice-Interview Phase 1 — Persistenz-Seite der LiveKit-Agent-Bridge.
 *
 * Der externe Voice-Agent (Python/LiveKit-Worker) führt das Gespräch im Raum
 * `voice-<sessionId>` und liefert finalisierte Turns + das Abschluss-Signal
 * über die /api/voice/*-Routes zurück. Dieses Modul schreibt beides in EXAKT
 * dasselbe Datenmodell wie Text-Interviews:
 *
 *   - Turns landen als `{ role, text }` in interview_sessions.conversation
 *     (gleiche Form wie advanceInterview in
 *     src/lib/voice-agent/session-service.ts — kein zusätzlicher Key, keine
 *     eigene Tabelle), Modalität wird über die BESTEHENDEN Spalten
 *     mode='voice' + transcript_source='stt' markiert (20260612000000).
 *   - Der Abschluss läuft über persistResearchTranscriptAndDiscovery —
 *     denselben Trigger, den der Text-Pfad im research-Finish von
 *     advanceInterview aufruft. Extraktion (use_case-bewusst) und Synthese
 *     greifen dadurch ohne jede Änderung.
 *
 * Bewusst ein EIGENES Modul statt Erweiterung von session-service.ts: alle
 * bestehenden Text-Flows bleiben byte-identisch; der Narrow-Select-Stil
 * (Zeile statt toSession-Mapping) spiegelt
 * applyVisualCaptureToCompletedResearchTranscript in transcript-service.ts.
 *
 * NEBENLÄUFIGKEIT: conversation wird — wie im Text-Pfad — per
 * Read-Modify-Write als ganzes Array geschrieben. Der Agent MUSS seine
 * Transcript-Batches sequenziell senden (höchstens ein in-flight Request pro
 * Session). Wiederholungen (Retry nach Timeout) sind durch den Turn-Index
 * idempotent: bereits gespeicherte Indizes werden übersprungen, der erste
 * Schreiber pro Index gewinnt.
 */

type Kind = "post_loss" | "checkin" | "research";
type Status = "open" | "completed" | "abandoned";

export interface VoiceBridgeSession {
  id: string;
  orgId: string;
  kind: Kind;
  status: Status;
  language: InterviewLanguage;
  planId: string | null;
  inviteId: string | null;
  conversation: InterviewTurn[];
  /** Roh belassen (InterviewSessionContext-Union als Json); der Caller
   *  narrowt erst NACH dem kind==='research'-Guard zu ResearchInput —
   *  exakt wie advanceInterview es tut. */
  dealContext: Json | null;
  visualCapture: Json | null;
}

const SESSION_COLUMNS =
  "id, org_id, kind, status, language, plan_id, invite_id, conversation, deal_context, visual_capture";

/**
 * Eine Session per UUID laden (Agent-seitig; der Agent kennt die sessionId
 * aus /api/voice/session-context bzw. die UUID aus dem Raum-Namen).
 *
 * Rückgabe-Semantik fürs Backend-zu-Backend-API: `null` = Session existiert
 * definitiv nicht (Route → 404, Agent bricht ab); DB-/Netzfehler werfen
 * (Route → 500, Agent darf retryen) — anders als loadByToken, das transiente
 * Fehler zu null/404 glättet, weil dort ein Mensch neu lädt.
 */
export async function loadVoiceBridgeSession(
  sessionId: string,
): Promise<VoiceBridgeSession | null> {
  const supabase = createResearchSupabase();
  const { data, error } = await supabase
    .from("interview_sessions")
    .select(SESSION_COLUMNS)
    .eq("id", sessionId)
    .maybeSingle();
  if (error) {
    throw new Error(`Failed to read interview session: ${error.message}`);
  }
  if (!data) return null;
  return {
    id: data.id,
    orgId: data.org_id,
    kind: data.kind,
    status: data.status,
    language: data.language,
    planId: data.plan_id,
    inviteId: data.invite_id,
    conversation: (data.conversation as unknown as InterviewTurn[] | null) ?? [],
    dealContext: data.deal_context ?? null,
    visualCapture: data.visual_capture ?? null,
  };
}

/** Ein finalisierter Voice-Turn, bereits auf das Konversations-Rollenmodell
 *  normalisiert (Route-Layer mappt assistant→agent, user/participant→customer).
 *  `index` ist die ABSOLUTE Position im conversation[]-Array — Index 0 ist die
 *  beim Session-Create generierte Opening-Message; der Agent beginnt also bei
 *  `nextTurnIndex` aus /api/voice/session-context. */
export interface VoiceTurnInput {
  index: number;
  role: "agent" | "customer";
  text: string;
}

export type AppendVoiceTurnsResult =
  | { ok: true; appended: number; skipped: number; turnCount: number }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "not_research" }
  | { ok: false; reason: "not_open"; status: Status }
  | { ok: false; reason: "gap"; expectedIndex: number; turnCount: number };

/**
 * Finalisierte Voice-Turns idempotent in conversation[] mergen.
 *
 * Merge-Regel je Turn (Batch wird nach index aufsteigend verarbeitet):
 *   index <  länge  → bereits gespeichert → SKIP (Idempotenz bei Re-Delivery;
 *                     der erste Schreiber pro Index gewinnt, Inhalt wird nicht
 *                     überschrieben)
 *   index == länge  → APPEND als { role, text } (exakt die Text-Interview-Form)
 *   index >  länge  → Lücke → Fehler mit expectedIndex, damit der Agent die
 *                     fehlenden Turns nachsendet (kein Lücken-Auffüllen)
 *
 * Beim ersten erfolgreichen Append werden mode='voice' +
 * transcript_source='stt' gestempelt (idempotent, jede weitere Schreibung
 * setzt dieselben Werte). Eine Session, für die nie Turns ankommen, bleibt
 * unverändert text/typed.
 */
export async function appendVoiceTurns(
  sessionId: string,
  turns: VoiceTurnInput[],
): Promise<AppendVoiceTurnsResult> {
  const session = await loadVoiceBridgeSession(sessionId);
  if (!session) return { ok: false, reason: "not_found" };
  if (session.kind !== "research") return { ok: false, reason: "not_research" };
  if (session.status !== "open") {
    return { ok: false, reason: "not_open", status: session.status };
  }

  const conversation: InterviewTurn[] = [...session.conversation];
  const sorted = [...turns].sort((a, b) => a.index - b.index);
  let appended = 0;
  let skipped = 0;

  for (const turn of sorted) {
    if (turn.index < conversation.length) {
      skipped += 1;
      continue;
    }
    if (turn.index > conversation.length) {
      return {
        ok: false,
        reason: "gap",
        expectedIndex: conversation.length,
        turnCount: conversation.length,
      };
    }
    conversation.push({ role: turn.role, text: turn.text });
    appended += 1;
  }

  if (appended === 0) {
    // Reine Re-Delivery — nichts zu schreiben, Zustand unverändert.
    return { ok: true, appended: 0, skipped, turnCount: conversation.length };
  }

  const supabase = createResearchSupabase();
  const { error } = await supabase
    .from("interview_sessions")
    .update({
      conversation: conversation as unknown as Json,
      mode: "voice",
      transcript_source: "stt",
    })
    .eq("id", session.id);
  if (error) {
    throw new Error(`Failed to persist voice turns: ${error.message}`);
  }

  return { ok: true, appended, skipped, turnCount: conversation.length };
}

export type CompleteVoiceSessionResult =
  | { ok: true; alreadyCompleted: boolean; discoveryRan: boolean }
  | { ok: false; reason: "not_found" }
  | { ok: false; reason: "not_research" };

/**
 * Session abschließen + nachgelagerte Extraktion anstoßen — DERSELBE Pfad
 * wie das research-Finish im Text-Interview (advanceInterview):
 * persistResearchTranscriptAndDiscovery legt die calls-Zeile an und ruft
 * analyzeCallForProductDiscovery (use_case-/study_type-bewusst) auf.
 *
 * Zwei BEWUSSTE Abweichungen vom Text-Pfad, beide für Agent-Retries:
 *
 *   1. Reihenfolge: Erst der ATOMARE Statusübergang open→completed
 *      (UPDATE … WHERE status='open'; nur der Gewinner läuft weiter), DANN
 *      die Extraktion. Der Text-Pfad extrahiert vor dem Status-Update — dort
 *      gibt es aber keinen konkurrierenden Caller. Agent-seitig verhindert
 *      die Transition-zuerst-Ordnung eine Doppel-Extraktion bei
 *      parallelem/wiederholtem complete (Insights würden sonst doppelt in
 *      product_discovery_insights landen und die Synthese verzerren).
 *      Rest-Risiko: Stirbt der Prozess ZWISCHEN Transition und Extraktion,
 *      fehlt die Extraktion — derselbe Recovery-Weg wie beim Text-Pfad
 *      (calls-Reanalyse) bzw. manuelles Nachstoßen.
 *
 *   2. Leere Interviews: Hat die Konversation KEINEN customer-Turn (der
 *      Teilnehmer hat nie gesprochen), wird abgeschlossen, aber NICHT
 *      extrahiert — der Text-Pfad erreicht sein Finish strukturell nie ohne
 *      Teilnehmer-Turn, dieselbe Invariante wird hier explizit gehalten.
 *
 * Extraktion ist best-effort (geloggt, nie geworfen) — identisch zum
 * try/catch im research-Branch von advanceInterview.
 */
export async function completeVoiceResearchSession(
  sessionId: string,
): Promise<CompleteVoiceSessionResult> {
  const session = await loadVoiceBridgeSession(sessionId);
  if (!session) return { ok: false, reason: "not_found" };
  if (session.kind !== "research") return { ok: false, reason: "not_research" };
  if (session.status !== "open") {
    return { ok: true, alreadyCompleted: true, discoveryRan: false };
  }

  // Atomarer Übergang — gewinnt genau ein Caller; jeder weitere sieht no-row
  // und meldet alreadyCompleted (idempotent, at-most-once-Extraktion).
  const supabase = createResearchSupabase();
  const { data: transitioned, error: updateError } = await supabase
    .from("interview_sessions")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
    })
    .eq("id", session.id)
    .eq("status", "open")
    .select("id")
    .maybeSingle();
  if (updateError) {
    throw new Error(
      `Failed to complete interview session: ${updateError.message}`,
    );
  }
  if (!transitioned) {
    return { ok: true, alreadyCompleted: true, discoveryRan: false };
  }

  const hasParticipantTurn = session.conversation.some(
    (t) => t.role === "customer",
  );
  if (!hasParticipantTurn) {
    return { ok: true, alreadyCompleted: false, discoveryRan: false };
  }

  let discoveryRan = false;
  try {
    await persistResearchTranscriptAndDiscovery({
      orgId: session.orgId,
      sessionId: session.id,
      planId: session.planId,
      inviteId: session.inviteId,
      transcript: conversationToTranscript(session.conversation),
      visualCapture: session.visualCapture,
    });
    discoveryRan = true;
  } catch (err) {
    console.error(
      "[voice complete] discovery analysis failed (session already completed):",
      err instanceof Error ? err.message : err,
    );
  }

  return { ok: true, alreadyCompleted: false, discoveryRan };
}
