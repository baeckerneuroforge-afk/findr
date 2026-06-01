import "server-only";

import {
  DEFAULT_VOICE_MODEL,
  nextResearchMessage,
  type InterviewLanguage,
  type InterviewTurn,
  type ResearchInput,
} from "@/lib/voice-agent/interviewer";
import {
  nextPersonaMessage,
  type PersonaInput,
} from "./persona";

/**
 * The synthetic interview loop — Stufe 1 of the dry-run.
 *
 * One side is the REAL, UNCHANGED interview agent (nextResearchMessage); the
 * other is a synthetic persona (nextPersonaMessage). They talk to each other
 * here in memory until the interview ends — a complete synthetic interview with
 * NO human and NO external provider.
 *
 * END CONDITION — mirrors advanceInterview's research branch in
 * voice-agent/session-service.ts EXACTLY, so the synthetic run reaches the same
 * stopping point a real interview would:
 *   - the agent self-closes (done === true), OR
 *   - the TOTAL-turn safety cap fires (conversation length hits
 *     MAX_RESEARCH_TOTAL_TURNS); when it does AND the agent isn't self-closing,
 *     the trailing agent question is swapped for the generic warm closing — same
 *     forceCapClose logic as the real flow, so a synthetic transcript never ends
 *     on a dangling question either.
 *
 * The two constants below are DELIBERATELY redefined here (not imported) because
 * they are module-private in session-service.ts and the real interview flow must
 * stay byte-identical. They are kept in lockstep with that file by comment.
 *
 * STRICT SEPARATION: this is a pure in-memory orchestration of pure LLM calls.
 * It NEVER calls createInterviewSession / advanceInterview /
 * persistResearchTranscriptAndDiscovery, and never writes interview_sessions,
 * calls, product_discovery_insights or study_synthesis. The caller (the service
 * layer) persists the returned conversation ONLY into the synthetic_test_* tables.
 */

// Mirrors MAX_RESEARCH_TOTAL_TURNS in voice-agent/session-service.ts (total
// entries in conversation[]; 16 ≙ ~8 Frage-Antwort-Runden). Keep in sync.
const MAX_RESEARCH_TOTAL_TURNS = 16;

// Mirrors RESEARCH_CAP_CLOSING_MESSAGE in voice-agent/session-service.ts — the
// generic warm closing used when the cap forces a stop while the agent's own
// done flag is still false. Keep in sync.
const RESEARCH_CAP_CLOSING_MESSAGE =
  "Vielen Dank für Ihre Zeit und Ihre offenen Antworten — das war sehr hilfreich.";

/** Absolute backstop: even though the forceCapClose math guarantees termination
 *  at ≤ MAX_RESEARCH_TOTAL_TURNS + 1 entries, guard against any future prompt
 *  drift so the loop can never spin unbounded (and burn tokens) server-side. */
const HARD_TURN_CEILING = MAX_RESEARCH_TOTAL_TURNS + 4;

/** Flatten a synthetic conversation into the SAME transcript shape the real
 *  research flow feeds to the Product-Discovery classifier (agent → "Assistant",
 *  persona → "Customer"). Mirrors conversationToTranscript in session-service.ts
 *  so the classifier sees an identically-shaped input. */
export function syntheticConversationToTranscript(
  conversation: InterviewTurn[],
): string {
  return conversation
    .map((t) => `${t.role === "agent" ? "Assistant" : "Customer"}: ${t.text}`)
    .join("\n");
}

export interface SyntheticInterviewResult {
  conversation: InterviewTurn[];
  transcript: string;
  /** Diagnostic: did the agent close itself, or did the safety cap fire? A
   *  "cap" ending in a dry-run is a useful signal that the guide ran long. */
  endedBy: "agent" | "cap";
}

/**
 * Run ONE full synthetic interview: the agent opens, the persona answers, and
 * they alternate until the end condition. Sequential by nature (each turn needs
 * the previous one). Fail-closed: any LLM failure propagates (the caller maps it
 * to a failed synthetic session).
 *
 * @param agentInput  the EXACT ResearchInput a real interview for this plan would
 *                    use (plan context + brand) — built by the service layer via
 *                    planToAgentContext, so the agent behaves identically.
 * @param personaInput the persona character sheet + light study grounding.
 */
export async function runSyntheticInterview(params: {
  agentInput: ResearchInput;
  personaInput: PersonaInput;
  language: InterviewLanguage;
  /** Defaults to the REAL agent model (VOICE_MODEL ?? Opus) so the dry-run
   *  tests the guide under the same model production uses. */
  agentModel?: string;
  /** Defaults to Sonnet (set inside nextPersonaMessage). */
  personaModel?: string;
}): Promise<SyntheticInterviewResult> {
  const { agentInput, personaInput, language } = params;
  const agentModel =
    params.agentModel ?? process.env.VOICE_MODEL ?? DEFAULT_VOICE_MODEL;
  const personaModel = params.personaModel;

  const conversation: InterviewTurn[] = [];

  // Opening agent message (empty history → first message), exactly like
  // createInterviewSession fires for a real research session.
  const opening = await nextResearchMessage(
    agentInput,
    [],
    language,
    agentModel,
  );
  conversation.push({ role: "agent", text: opening.message });

  let endedBy: "agent" | "cap" = "agent";
  let finished = opening.done;

  while (!finished && conversation.length < HARD_TURN_CEILING) {
    // Persona answers the agent's latest turn.
    const personaReply = await nextPersonaMessage(
      personaInput,
      conversation,
      language,
      personaModel,
    );
    conversation.push({ role: "customer", text: personaReply });

    // Agent's next turn — forceCapClose logic identical to advanceInterview.
    const history = conversation; // already includes the persona turn
    const { done, message } = await nextResearchMessage(
      agentInput,
      history,
      language,
      agentModel,
    );
    const wouldHitCap = history.length + 1 >= MAX_RESEARCH_TOTAL_TURNS;
    const forceCapClose = wouldHitCap && !done;
    const finalText = forceCapClose ? RESEARCH_CAP_CLOSING_MESSAGE : message;
    conversation.push({ role: "agent", text: finalText });

    if (done || forceCapClose) {
      endedBy = forceCapClose ? "cap" : "agent";
      finished = true;
    }
  }

  return {
    conversation,
    transcript: syntheticConversationToTranscript(conversation),
    endedBy,
  };
}
