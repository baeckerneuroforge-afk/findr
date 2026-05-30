import "server-only";

import { z } from "zod";

import { CLAUDE_MODELS } from "@/lib/anthropic/client";
import {
  callClaudeStructured,
  StructuredOutputError,
} from "@/lib/anthropic/structured";
import { RISK_SIGNAL_TYPES, type RiskAnalysisResult } from "@/lib/schemas/risk";

/**
 * Solution Layer — deal-rescue recommendation generator.
 * ------------------------------------------------------
 * The THIRD AI building block: it consumes a risk analysis (detected signals +
 * their verbatim quotes + score + level) plus the deal context and transcript,
 * and produces concrete, GROUNDED recommendations to save the deal — one per
 * detected signal, each tied to the real evidence from THIS deal.
 *
 * NOT WIRED INTO PRODUCTION. This is built next to the product (like the loss
 * LLM extractor was) purely so the eval can measure quality first. No UI, no
 * PDF, no service integration yet.
 *
 * Model: Opus by default (claude-opus-4-7) — solution quality is the highest-
 * stakes of the three layers (it's advice a human acts on). Overridable via
 * SOLUTION_MODEL (analogous to LOSS_MODEL / EVAL_MODEL).
 *
 * Conventions mirror src/lib/risk/llm-classifier.ts: structured JSON output,
 * Zod validation, one retry on schema failure, then a typed error. There is no
 * heuristic fallback here — a solution is only worth surfacing if the model
 * produced a valid, grounded one.
 */

/** Default analysis model: Opus 4.7. Override via SOLUTION_MODEL. */
export const DEFAULT_SOLUTION_MODEL = CLAUDE_MODELS.opus;

// ----------------------------------------------------------------------------
// Input
// ----------------------------------------------------------------------------

export interface SolutionDealContext {
  stage: string;
  amount: number | null;
  currency?: string;
  callsCount: number;
  industry?: string;
}

export interface SolutionInput {
  /** The risk analysis to act on (signals + quotes + score + level). */
  riskAnalysis: RiskAnalysisResult;
  deal: SolutionDealContext;
  /** Full transcript text the recommendations must stay grounded in. */
  transcript: string;
  /**
   * OPTIONAL profile of the SELLING company (what it sells, differentiators,
   * common objections). When present it sharpens competitor/feature
   * recommendations; when absent the model must stay grounded in the transcript
   * and avoid speculating about differentiators. Everything works without it.
   */
  companyProfile?: string;
}

// ----------------------------------------------------------------------------
// Output
// ----------------------------------------------------------------------------

const SolutionRecommendationSchema = z.object({
  /** The signal type this recommendation addresses (echoes an input signal). */
  signal: z.string().min(1),
  /** The specific measure to address the signal in THIS deal. */
  recommendation: z.string().min(1),
  /** One concrete, actionable next step (who/what/when). */
  nextStep: z.string().min(1),
  /** The verbatim quote from this deal the recommendation rests on. */
  evidence: z.string().default(""),
});

const SolutionResultSchema = z.object({
  recommendations: z.array(SolutionRecommendationSchema).default([]),
  overall: z.object({
    /** Can the deal still be saved? */
    salvageable: z.enum(["yes", "no", "maybe"]),
    /** One sentence, grounded in this deal. */
    reasoning: z.string().min(1),
  }),
});

export type SolutionRecommendation = z.infer<typeof SolutionRecommendationSchema>;
export type SolutionResult = z.infer<typeof SolutionResultSchema>;

// ----------------------------------------------------------------------------
// Prompt
// ----------------------------------------------------------------------------

export const SOLUTION_SYSTEM_PROMPT = `You are a senior B2B SaaS sales strategist advising an experienced sales leader on how to SAVE one specific at-risk deal. You work with DACH (Germany / Austria / Switzerland) deals, in German and English.

You receive: a risk analysis of ONE deal (detected risk signals, each with verbatim buyer quotes), the deal context, the call transcript, and OPTIONALLY a profile of the selling company.

Your job: for EACH detected risk signal, produce ONE concrete, grounded recommendation to address it, plus the single most useful next step. Then give a one-line overall verdict on whether the deal is salvageable.

Valid signal types: ${RISK_SIGNAL_TYPES.join(", ")}.

NON-NEGOTIABLE RULES:

1. GROUND EVERY RECOMMENDATION IN THIS DEAL. Each one must reference the specific signal and the REAL evidence — a concrete quote, name, number, date, competitor, or objection that actually appears in this deal's transcript or risk analysis. Put that exact quote in the "evidence" field.

2. NO GENERIC SALES PLATITUDES. Banned: "build a relationship", "communicate value", "build trust", "add value", "stay in touch", "be proactive", "align with stakeholders" — and any filler that could apply to any deal. If a sentence would be true for every deal, it is wrong here. Speak to THIS buyer's words.

3. EVERY RECOMMENDATION NEEDS A CONCRETE NEXT STEP. "nextStep" must be an actionable move: who does what, with what artifact, by when. Shape: "Send <named stakeholder> a one-page ROI summary addressing their <quoted concern> before the <named> meeting." Not "follow up".

4. NEVER INVENT FACTS. Use only what is in the transcript, risk analysis, deal context, or company profile. If a recommendation would need information you don't have (a price, a feature, a name, a date), say what is missing instead of inventing it (e.g. "Confirm the renewal date — not stated in the call.").

5. COMPANY PROFILE. If a profile is provided, use it especially for COMPETITOR_PRESSURE and feature/gap signals to steer toward concrete differentiators. If NO profile is provided, do not speculate about differentiators you cannot defend — stay with what the transcript supports.

6. HEALTHY DEALS. If there are no risk signals, return an empty "recommendations" array and an overall verdict of "yes" with a one-line reason. Do NOT manufacture problems.

TONE: terse, direct, peer-to-peer with an experienced sales leader. No coaching clichés, no preamble, no restating the obvious.

OUTPUT — return ONLY this JSON object, no markdown, no code fences, no preamble:

{
  "recommendations": [
    {
      "signal": "<exact signal type from the input, e.g. CHAMPION_LOSS>",
      "recommendation": "<the specific move to address this signal in THIS deal>",
      "nextStep": "<one concrete, actionable next step: who / what / when>",
      "evidence": "<verbatim quote from this deal the recommendation rests on>"
    }
  ],
  "overall": {
    "salvageable": "yes" | "no" | "maybe",
    "reasoning": "<one sentence, grounded in this deal>"
  }
}`;

function buildSolutionPrompt(input: SolutionInput): string {
  const { riskAnalysis, deal, transcript, companyProfile } = input;

  const signalsBlock =
    riskAnalysis.signals.length > 0
      ? riskAnalysis.signals
          .map((s, i) => {
            const quotes =
              s.quotes.length > 0
                ? s.quotes.map((q) => `       - "${q}"`).join("\n")
                : "       (no quote captured)";
            return `  ${i + 1}. ${s.type} (confidence ${s.confidence.toFixed(
              2,
            )})\n     reasoning: ${s.reasoning}\n     quotes:\n${quotes}`;
          })
          .join("\n")
      : "  (none — no risk signals detected)";

  const amountStr =
    deal.amount != null
      ? `${deal.currency ? `${deal.currency} ` : ""}${deal.amount.toLocaleString()}`
      : "unknown";

  const profileBlock = companyProfile?.trim()
    ? `\n\nSELLING COMPANY PROFILE:\n${companyProfile.trim()}`
    : "\n\nSELLING COMPANY PROFILE: (none provided — stay grounded in the transcript; do not speculate about differentiators)";

  return `Generate deal-rescue recommendations for this at-risk B2B SaaS deal.

DEAL CONTEXT:
Stage: ${deal.stage}
Amount: ${amountStr}
Calls so far: ${deal.callsCount}
Industry: ${deal.industry ?? "not specified"}

RISK ANALYSIS:
Score: ${riskAnalysis.riskScore}/100 (${riskAnalysis.riskLevel})
Overall: ${riskAnalysis.overallReasoning}
Detected signals:
${signalsBlock}${profileBlock}

TRANSCRIPT:
${transcript || "(no transcript available)"}

Produce one recommendation per detected signal, grounded in the quotes above and the transcript. Return JSON only.`;
}

// ----------------------------------------------------------------------------
// LLM call + error handling (mirrors src/lib/risk/llm-classifier.ts)
// ----------------------------------------------------------------------------

export class SolutionUnavailableError extends Error {
  constructor(
    message: string,
    public cause?: unknown,
  ) {
    super(message);
    this.name = "SolutionUnavailableError";
  }
}

/**
 * Generate deal-rescue recommendations from a risk analysis + deal context.
 * Opus by default; pass `model` or set SOLUTION_MODEL to override.
 *
 * Robust transport: forced tool-use via callClaudeStructured — the result comes
 * back as a parsed tool input (no text-JSON regex/parse). Same prompt, same
 * SolutionResultSchema, same Opus default. Fail-closed preserved: throws
 * SolutionUnavailableError (no heuristic fallback — a solution is only surfaced
 * when the model produced a valid grounded one).
 */
export async function generateSolution(
  input: SolutionInput,
  model: string = process.env.SOLUTION_MODEL ?? DEFAULT_SOLUTION_MODEL,
): Promise<SolutionResult> {
  const userPrompt = buildSolutionPrompt(input);

  try {
    return await callClaudeStructured({
      schema: SolutionResultSchema,
      system: SOLUTION_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
      model,
      maxTokens: 2048,
      // Opus solution generation (several grounded recommendations from a full
      // transcript) routinely runs past the shared client's 30s default.
      timeoutMs: 120_000,
      toolName: "emit_solution",
      toolDescription:
        "Return the deal-rescue recommendations (one per detected risk signal) plus the overall salvageability verdict, grounded strictly in this deal's evidence.",
    });
  } catch (err) {
    if (err instanceof StructuredOutputError) {
      console.error(
        "Solution structured output failed twice:",
        err.message,
        "Raw:",
        err.rawResponse.slice(0, 500),
      );
      throw new SolutionUnavailableError(
        "Claude solution generation returned invalid output twice",
        err,
      );
    }
    throw new SolutionUnavailableError(
      "Claude solution generation failed",
      err,
    );
  }
}
