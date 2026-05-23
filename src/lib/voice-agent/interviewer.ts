import "server-only";

import { z } from "zod";

import { CLAUDE_MODELS, getAnthropicClient } from "@/lib/anthropic/client";
import type { LossReasonType } from "@/lib/loss/extractor";
import type { RiskAnalysisResult } from "@/lib/schemas/risk";

/**
 * Voice Agent core — the post-loss interview (TEXT version).
 * ---------------------------------------------------------
 * The fourth AI building block: after a deal is lost, this agent runs a short,
 * empathetic interview to surface the REAL reason — past the polite surface
 * answer ("too expensive", "bad timing") — and then maps it to a loss category
 * and checks it against what the risk analysis had predicted.
 *
 * NOT WIRED INTO PRODUCTION. No telephony, no voice, no UI — just the
 * conversation core + extraction, built next to the product for eval (like the
 * loss + solution layers were). Mirrors src/lib/solution/extractor.ts
 * conventions: structured JSON output, Zod validation, one retry, typed errors.
 *
 * Model: Opus by default (claude-opus-4-7). Override via VOICE_MODEL.
 */

export const DEFAULT_VOICE_MODEL = CLAUDE_MODELS.opus;

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface VoiceDealContext {
  dealName: string;
  company: string;
  contactName: string;
  amount: number;
  currency: string;
}

export interface InterviewInput {
  deal: VoiceDealContext;
  /** What the risk analysis predicted — used only as a private hypothesis. */
  riskAnalysis: RiskAnalysisResult;
}

export type InterviewRole = "agent" | "customer";

export interface InterviewTurn {
  role: InterviewRole;
  text: string;
}

/** The 10 valid loss-reason categories (kept in lockstep with LossReasonType). */
const LOSS_CATEGORIES = [
  "pricing",
  "compliance",
  "competitor",
  "timing",
  "budget",
  "champion_lost",
  "feature_gap",
  "no_decision",
  "internal_priority",
  "other",
] as const satisfies readonly LossReasonType[];

const NextMessageSchema = z.object({
  /** false while still asking; true when wrapping up (message = closing). */
  done: z.boolean(),
  message: z.string().min(1),
});
export type NextMessage = z.infer<typeof NextMessageSchema>;

const InterviewResultSchema = z.object({
  extractedReason: z.enum(LOSS_CATEGORIES),
  evidence: z.string().default(""),
  matchedRiskPrediction: z.enum(["yes", "no", "partial"]),
  reasoning: z.string().min(1),
});
export type InterviewResult = z.infer<typeof InterviewResultSchema>;

// ----------------------------------------------------------------------------
// Errors (mirror solution/extractor.ts)
// ----------------------------------------------------------------------------

class VoiceSchemaError extends Error {
  constructor(
    message: string,
    public rawResponse: string,
  ) {
    super(message);
    this.name = "VoiceSchemaError";
  }
}

export class VoiceUnavailableError extends Error {
  constructor(
    message: string,
    public cause?: unknown,
  ) {
    super(message);
    this.name = "VoiceUnavailableError";
  }
}

// ----------------------------------------------------------------------------
// Prompts
// ----------------------------------------------------------------------------

export const INTERVIEWER_SYSTEM_PROMPT = `You are findr.'s post-loss interview agent. A B2B SaaS deal was just lost, and you are reaching out to the buyer (over text/chat) to learn the REAL reason it didn't go forward. This is research — you are NOT trying to win the deal back or sell anything.

You work in DACH (Germany / Austria / Switzerland). Mirror the buyer's language: reply in German if they write German, English if they write English; otherwise use the language of the deal context.

YOUR STYLE:
- Warm, brief, professional. ONE short message at a time — a single question, never a wall of text.
- Genuinely curious, never defensive, never pushy. Thank them for their time.

YOUR JOB:
- Open with ONE open question about why the deal didn't move forward.
- Buyers usually give a polite, surface-level reason first ("too expensive", "bad timing", "we went another direction"). That is rarely the whole truth. When an answer is vague or a polite deflection, acknowledge it, then ask ONE specific, low-pressure follow-up that invites the real story. One thoughtful follow-up per turn — do not interrogate.
- Ask at most 4–5 questions in total. As soon as you have a clear, specific reason (or the buyer plainly won't say more), STOP and close warmly with a short thank-you.

PRIVATE CONTEXT (never reveal):
- You are told what findr.'s risk analysis SUSPECTED the reason was. Use it ONLY as a private hypothesis to steer your follow-ups. Never state it, never lead the buyer toward it, never say "we think you left because…". Let the buyer tell the truth in their own words.

OUTPUT — return ONLY this JSON object, no markdown, no preamble:
{
  "done": true | false,
  "message": "<your next message to the buyer, or a short warm closing if done>"
}
Set "done": false while you still want to ask another question; set "done": true when wrapping up.`;

export const EXTRACTION_SYSTEM_PROMPT = `You analyze a COMPLETED post-loss interview between findr.'s agent and a B2B buyer whose deal was lost. Determine the REAL primary reason the deal was lost, in the buyer's own words — read past polite surface answers and weight what the buyer revealed when gently pressed.

Classify into EXACTLY ONE category:
- pricing — the price/cost itself was the blocker.
- budget — availability of funds (no/frozen/late budget, finance declined).
- competitor — a competing vendor was chosen instead.
- feature_gap — a missing capability, feature, or integration.
- compliance — legal / security / data-protection blockers (GDPR/DSGVO, SOC 2, Betriebsrat, …).
- timing — wrong time, independent of money.
- champion_lost — the internal advocate left or changed role.
- no_decision — never actually decided; it stalled or fizzled.
- internal_priority — deprioritized for other internal initiatives / reorg.
- other — none genuinely fit.

You are also given what findr.'s risk analysis PREDICTED (its signals + reasoning). Judge whether the real reason matches:
- "yes" — the real reason matches the predicted risk.
- "partial" — the prediction caught part of it but mis-prioritized or only partly overlaps.
- "no" — the real reason differs from what was predicted.

OUTPUT — return ONLY this JSON object, no markdown, no preamble:
{
  "extractedReason": "<one of the categories>",
  "evidence": "<a short verbatim quote from the BUYER in the transcript>",
  "matchedRiskPrediction": "yes" | "no" | "partial",
  "reasoning": "<one or two sentences: the real reason and how it relates to the prediction>"
}`;

function formatRiskPrediction(risk: RiskAnalysisResult): string {
  const signals =
    risk.signals.length > 0
      ? risk.signals.map((s) => s.type).join(", ")
      : "none";
  return `Risk score ${risk.riskScore}/100 (${risk.riskLevel}). Predicted signals: ${signals}. Reasoning: ${risk.overallReasoning}`;
}

function formatDeal(deal: VoiceDealContext): string {
  return [
    `Deal: ${deal.dealName} · ${deal.company}`,
    `Buyer contact: ${deal.contactName}`,
    `Amount: ${deal.currency} ${deal.amount.toLocaleString()}`,
    `Status: closed lost`,
  ].join("\n");
}

function formatHistory(history: InterviewTurn[]): string {
  if (history.length === 0) {
    return "(no messages yet — this is your first message to the buyer)";
  }
  return history
    .map((t) => `${t.role === "agent" ? "Agent" : "Buyer"}: ${t.text}`)
    .join("\n");
}

function buildInterviewerPrompt(
  input: InterviewInput,
  history: InterviewTurn[],
): string {
  return `LOST DEAL CONTEXT:
${formatDeal(input.deal)}

PRIVATE — what findr.'s risk analysis suspected (do NOT reveal to the buyer):
${formatRiskPrediction(input.riskAnalysis)}

CONVERSATION SO FAR:
${formatHistory(history)}

Write your next message as JSON only.`;
}

function buildExtractionPrompt(
  input: InterviewInput,
  history: InterviewTurn[],
): string {
  return `LOST DEAL CONTEXT:
${formatDeal(input.deal)}

WHAT findr.'s RISK ANALYSIS PREDICTED:
${formatRiskPrediction(input.riskAnalysis)}

FULL INTERVIEW TRANSCRIPT:
${formatHistory(history)}

Return your analysis as JSON only.`;
}

// ----------------------------------------------------------------------------
// LLM call (JSON, validated, one retry — mirrors solution/extractor.ts)
// ----------------------------------------------------------------------------

async function requestJson<T>(
  system: string,
  userPrompt: string,
  model: string,
  schema: z.ZodType<T>,
  retry: boolean,
): Promise<T> {
  const client = getAnthropicClient();

  const sys = retry
    ? `${system}\n\nIMPORTANT: Your last response did not match the required JSON schema. Return ONLY a valid JSON object with the exact structure specified. No markdown, no preamble.`
    : system;

  const response = await client.messages.create(
    {
      model,
      max_tokens: 1024,
      // Opus 4.7 rejects the temperature parameter; rely on the structured
      // prompt + schema validation.
      system: sys,
      messages: [{ role: "user", content: userPrompt }],
    },
    // The interview makes several short calls; a 60s per-request budget is ample
    // and fails reasonably fast. The shared client default stays untouched.
    { timeout: 60_000, maxRetries: 2 },
  );

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new VoiceSchemaError(
      "No text response from Claude",
      JSON.stringify(response.content),
    );
  }

  const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new VoiceSchemaError("No JSON found in response", textBlock.text);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch (err) {
    throw new VoiceSchemaError(
      `JSON parse failed: ${err instanceof Error ? err.message : "unknown"}`,
      jsonMatch[0],
    );
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new VoiceSchemaError(
      `Schema validation failed: ${JSON.stringify(result.error.flatten())}`,
      JSON.stringify(parsed),
    );
  }

  return result.data;
}

async function callJson<T>(
  system: string,
  userPrompt: string,
  model: string,
  schema: z.ZodType<T>,
): Promise<T> {
  try {
    return await requestJson(system, userPrompt, model, schema, false);
  } catch (err) {
    if (!(err instanceof VoiceSchemaError)) {
      throw new VoiceUnavailableError("Claude voice call failed", err);
    }
    console.warn("[voice] schema validation failed, retrying:", err.message);
  }

  try {
    return await requestJson(system, userPrompt, model, schema, true);
  } catch (err) {
    if (err instanceof VoiceSchemaError) {
      throw new VoiceUnavailableError(
        "Claude voice call returned invalid JSON twice",
        err,
      );
    }
    throw new VoiceUnavailableError("Claude voice call failed", err);
  }
}

// ----------------------------------------------------------------------------
// Public API
// ----------------------------------------------------------------------------

/**
 * Generate the agent's next message given the conversation so far. Returns
 * `done: true` (with a closing message) when the agent decides it has enough.
 */
export async function nextInterviewMessage(
  input: InterviewInput,
  history: InterviewTurn[],
  model: string = process.env.VOICE_MODEL ?? DEFAULT_VOICE_MODEL,
): Promise<NextMessage> {
  return callJson(
    INTERVIEWER_SYSTEM_PROMPT,
    buildInterviewerPrompt(input, history),
    model,
    NextMessageSchema,
  );
}

/**
 * After the interview, extract the real loss reason (one category + a buyer
 * quote) and judge whether it matched the risk analysis's prediction.
 */
export async function extractLossReasonFromInterview(
  input: InterviewInput,
  history: InterviewTurn[],
  model: string = process.env.VOICE_MODEL ?? DEFAULT_VOICE_MODEL,
): Promise<InterviewResult> {
  return callJson(
    EXTRACTION_SYSTEM_PROMPT,
    buildExtractionPrompt(input, history),
    model,
    InterviewResultSchema,
  );
}
