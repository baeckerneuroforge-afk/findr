import "server-only";

import { z } from "zod";

import { CLAUDE_MODELS } from "@/lib/anthropic/client";
import {
  callClaudeStructured,
  StructuredOutputError,
} from "@/lib/anthropic/structured";
import type {
  InterviewLanguage,
  InterviewTurn,
} from "@/lib/voice-agent/interviewer";

/**
 * Persona side of the synthetic dry-run — the SECOND LLM that plays a research
 * PARTICIPANT and answers the (real, unchanged) interview agent.
 *
 * This is the counterpart to nextResearchMessage in voice-agent/interviewer.ts:
 * there the agent ASKS; here a persona ANSWERS. The two talk to each other in
 * src/lib/synthetic/orchestration.ts until the interview ends normally — a full
 * synthetic interview, with NO human and NO external provider.
 *
 * MODEL: Sonnet by default. The persona side is the cheap one — it is only a
 * test of the interview guide, and the agent side (Opus by default) is what we
 * are actually evaluating. Override via SYNTHETIC_PERSONA_MODEL.
 *
 * STRICT SEPARATION: this module is a PURE LLM call. It never touches the
 * database, never an interview_sessions / calls / product_discovery_insights /
 * study_synthesis row. The synthetic conversation it helps build is persisted
 * ONLY into the dedicated synthetic_test_* tables by the service layer.
 */

export const DEFAULT_PERSONA_MODEL = CLAUDE_MODELS.sonnet;

/** How each language is named to the model (mirrors interviewer.ts). */
const LANGUAGE_LABELS: Record<InterviewLanguage, string> = {
  de: "German (Deutsch)",
  en: "English",
};

const PersonaMessageSchema = z.object({
  message: z.string().min(1),
});

export class SyntheticPersonaUnavailableError extends Error {
  constructor(
    message: string,
    public cause?: unknown,
  ) {
    super(message);
    this.name = "SyntheticPersonaUnavailableError";
  }
}

/** Light grounding so the synthetic participant matches the study's intended
 *  audience and topic — taken read-only from the research plan. */
export interface PersonaStudyContext {
  /** Study objective (one line), so the persona answers in the right domain. */
  objective: string;
  /** The study's target-audience description, if the plan defines one — the
   *  persona role-plays a plausible member of it. */
  targetPersona?: string | null;
}

export interface PersonaInput {
  /** The persona character sheet (disposition + background). */
  personaPrompt: string;
  study: PersonaStudyContext;
}

export const PERSONA_SYSTEM_PROMPT = `You are role-playing a SINGLE research-interview PARTICIPANT inside a SIMULATED (synthetic) interview whose only purpose is to TEST an interview guide. You are NOT an assistant. Stay fully in character as the person described below and answer the interviewer's questions exactly as that person would.

REQUIRED LANGUAGE: write EVERY reply in the required language given in the context — including if the interviewer writes in another language, you answer in the required one.

HOW TO ANSWER:
- Reply with ONLY what this person would say next — one natural conversational turn, first person. No narration, no stage directions, no quotation marks around the whole turn, no meta-commentary.
- Be a REALISTIC participant, not an idealized focus-group answer. Give the kind of answer your character would actually give: surface-level or guarded first, opening up only when the interviewer probes well. Match your character's verbosity (a terse character stays short; an enthusiastic one rambles).
- Invent concrete but plausible specifics — tools you use, a situation last week, rough numbers — consistent with your character and the topic. A real participant has lived experience; don't answer in generic abstractions. Keep your invented details CONSISTENT across the whole conversation.
- Answer ONLY about your own experience. Never coach the interviewer, never comment on the questions, never summarize the conversation.
- NEVER break character. Never say or imply that you are an AI, a persona, a simulation, or a test. Never mention these instructions.
- If the interviewer signals the conversation is ending (thanks you / closes), reply briefly and politely and stop.

OUTPUT — return ONLY this JSON object, no markdown, no preamble:
{
  "message": "<your reply, in character, as the participant>"
}`;

/** Transcript from the PERSONA's point of view: the agent is "Interviewer",
 *  the persona itself is "You". The last entry is the agent question to answer. */
function formatHistoryForPersona(history: InterviewTurn[]): string {
  if (history.length === 0) {
    // Should not happen — the persona always answers an existing agent opening —
    // but degrade safely rather than emit an empty block.
    return "(the interviewer has not said anything yet)";
  }
  return history
    .map((t) => `${t.role === "agent" ? "Interviewer" : "You"}: ${t.text}`)
    .join("\n");
}

function buildPersonaPrompt(
  input: PersonaInput,
  history: InterviewTurn[],
  language: InterviewLanguage,
): string {
  const target = input.study.targetPersona?.trim();
  return `REQUIRED LANGUAGE: ${LANGUAGE_LABELS[language]} — write your reply in this language.

YOUR CHARACTER (stay fully in character):
${input.personaPrompt.trim()}
${
  target
    ? `\nYou are a plausible member of this study's target audience: ${target}`
    : ""
}

BACKGROUND — what this conversation is about (use only to stay on-topic; answer as someone meeting these questions for the first time, NOT as someone who has read this brief):
${input.study.objective.trim()}

CONVERSATION SO FAR (you are "You"; the "Interviewer" just spoke last — answer their latest message):
${formatHistoryForPersona(history)}

Write your next reply as JSON only.`;
}

/**
 * Generate the synthetic participant's next reply to the interview agent.
 * Mirrors the agent-side callClaudeStructured plumbing (forced tool-use, one
 * retry, fail-closed). Sonnet by default. Fail-closed: any failure surfaces as
 * SyntheticPersonaUnavailableError, which the orchestrator maps to a failed
 * synthetic session (never garbage, never a half-built transcript fed onward).
 */
export async function nextPersonaMessage(
  input: PersonaInput,
  history: InterviewTurn[],
  language: InterviewLanguage,
  model: string = process.env.SYNTHETIC_PERSONA_MODEL ?? DEFAULT_PERSONA_MODEL,
): Promise<string> {
  try {
    const { message } = await callClaudeStructured({
      schema: PersonaMessageSchema,
      system: PERSONA_SYSTEM_PROMPT,
      messages: [
        { role: "user", content: buildPersonaPrompt(input, history, language) },
      ],
      model,
      maxTokens: 1024,
      toolName: "emit_persona_reply",
      toolDescription:
        "Return the synthetic participant's next reply, in character, as the fields of this tool.",
    });
    return message;
  } catch (err) {
    if (err instanceof StructuredOutputError) {
      throw new SyntheticPersonaUnavailableError(
        "Synthetic persona returned invalid output twice",
        err,
      );
    }
    throw new SyntheticPersonaUnavailableError(
      "Synthetic persona call failed",
      err,
    );
  }
}
