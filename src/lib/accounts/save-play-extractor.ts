import "server-only";

import { z } from "zod";

import {
  callClaudeStructured,
  StructuredOutputError,
} from "@/lib/anthropic/structured";
import { RISK_SIGNAL_TYPES, type RiskSignal } from "@/lib/schemas/risk";
import { DEFAULT_SOLUTION_MODEL } from "@/lib/solution/extractor";
import type { HealthLevel } from "./types";

/**
 * Save-Play Extractor — pure LLM portion of the save-play layer.
 * ---------------------------------------------------------------
 * Health-side mirror of src/lib/solution/extractor.ts. Where the risk side does
 * score → signals → solution (rescue a deal), this does health score → churn
 * signals → save-play (retain a customer). It consumes a health analysis
 * (signals + verbatim quotes + score), the account context, and the post-sale
 * transcripts, and produces concrete, GROUNDED save actions — one per churn
 * signal, each tied to real evidence from THIS account.
 *
 * This module is intentionally Next/Supabase/Clerk-FREE — its only imports are
 * zod, the Anthropic client, the risk-signal vocabulary, and the shared
 * SOLUTION_MODEL constant. That isolation matters: the eval runner
 * (evals-save-play/run.ts) loads this file under plain tsx, which can NOT
 * evaluate Clerk's server SDK or next/headers (no React runtime → the
 * createContext crash). The DB-bound wrapper that persists results into
 * account_save_plays lives in `./save-play-service`, which imports from here.
 *
 * Mirrors the solution extractor's conventions: structured JSON output, Zod
 * validation, one retry on schema failure, then a typed error. NO heuristic
 * fallback — a save-play is only worth surfacing when the model produced a
 * valid grounded one. Opus by default, reusing the SAME SOLUTION_MODEL knob.
 */

// ----------------------------------------------------------------------------
// Output schema (identical shape to the solution layer)
// ----------------------------------------------------------------------------

const SavePlayRecommendationSchema = z.object({
  /** The churn signal type this action addresses (echoes an input signal). */
  signal: z.string().min(1),
  /** The specific save action to address the signal for THIS customer. */
  recommendation: z.string().min(1),
  /** One concrete, actionable next step (who/what/when). */
  nextStep: z.string().min(1),
  /** The verbatim quote from this account the action rests on. */
  evidence: z.string().default(""),
});

const SavePlayResultSchema = z.object({
  recommendations: z.array(SavePlayRecommendationSchema).default([]),
  overall: z.object({
    /** Can the customer still be retained? */
    salvageable: z.enum(["yes", "no", "maybe"]),
    /** One sentence, grounded in this account. */
    reasoning: z.string().min(1),
  }),
});

export type SavePlayRecommendation = z.infer<typeof SavePlayRecommendationSchema>;
export type SavePlayResult = z.infer<typeof SavePlayResultSchema>;

// ----------------------------------------------------------------------------
// Input
// ----------------------------------------------------------------------------

interface SavePlayAccountContext {
  companyName: string;
  sponsorName: string | null;
  sponsorEmail: string | null;
  renewalDate: string | null;
  mrr: number | null;
  currency: string;
  transcriptsCount: number;
}

interface SavePlayHealthContext {
  healthScore: number;
  healthLevel: HealthLevel;
  signals: RiskSignal[];
  overallReasoning: string;
}

export interface SavePlayInput {
  health: SavePlayHealthContext;
  account: SavePlayAccountContext;
  /** Full transcript text the recommendations must stay grounded in. */
  transcript: string;
  /** OPTIONAL profile of the selling company (sharpens competitor/feature plays). */
  companyProfile?: string;
}

// ----------------------------------------------------------------------------
// Prompt
// ----------------------------------------------------------------------------

export const SAVE_PLAY_SYSTEM_PROMPT = `You are a senior B2B SaaS Customer Success strategist advising an experienced CSM / account manager on how to SAVE one specific at-risk CUSTOMER — i.e. prevent churn and protect the renewal. You work with DACH (Germany / Austria / Switzerland) accounts, in German and English.

You receive: a health analysis of ONE customer account (detected churn signals, each with verbatim quotes from post-sale conversations), the account context (sponsor, renewal date, MRR), the transcript(s), and OPTIONALLY a profile of the selling company.

Your job: for EACH detected churn signal, produce ONE concrete, grounded save action to address it, plus the single most useful next step. Then give a one-line overall verdict on whether the customer is retainable.

Valid signal types: ${RISK_SIGNAL_TYPES.join(", ")}.

NON-NEGOTIABLE RULES:

1. GROUND EVERY ACTION IN THIS ACCOUNT. Each one must reference the specific churn signal and the REAL evidence — a concrete quote, name, number, date, or objection that actually appears in this account's transcripts or health analysis. Put that exact quote in the "evidence" field.

2. NO GENERIC CS PLATITUDES. Banned: "build a relationship", "communicate value", "build trust", "add value", "stay in touch", "be proactive", "schedule a check-in" with no specifics — and any filler that could apply to any account. If a sentence would be true for every customer, it is wrong here. Speak to THIS sponsor's words.

3. EVERY ACTION NEEDS A CONCRETE NEXT STEP. "nextStep" must be an actionable move: who does what, with what artifact, by when. Good shapes: a concrete email draft to the named sponsor addressing their quoted concern; a specific escalation ("loop in <role> because <quoted reason> before the <named> renewal"); a tailored success-plan item. Not "follow up", not "reach out".

4. NEVER INVENT FACTS. Use only what is in the transcripts, health analysis, account context, or company profile. If an action needs information you don't have (a price, a feature, a date), say what is missing instead of inventing it (e.g. "Confirm the renewal date — not stated.").

5. COMPANY PROFILE. If a profile is provided, use it for COMPETITOR_PRESSURE and feature/gap signals to steer toward concrete differentiators. If NO profile is provided, do not speculate about differentiators you cannot defend — stay with what the transcripts support.

6. HEALTHY CUSTOMERS. If there are no churn signals, return an empty "recommendations" array and an overall verdict of "yes" with a one-line reason. Do NOT manufacture problems or invent save actions for a healthy account.

TONE: terse, direct, peer-to-peer with an experienced CS leader. No coaching clichés, no preamble, no restating the obvious.

OUTPUT — return ONLY this JSON object, no markdown, no code fences, no preamble:

{
  "recommendations": [
    {
      "signal": "<exact signal type from the input, e.g. CHAMPION_DISENGAGEMENT>",
      "recommendation": "<the specific save action to address this signal for THIS customer>",
      "nextStep": "<one concrete, actionable next step: who / what / when (e.g. an email draft to the sponsor, an escalation)>",
      "evidence": "<verbatim quote from this account the action rests on>"
    }
  ],
  "overall": {
    "salvageable": "yes" | "no" | "maybe",
    "reasoning": "<one sentence, grounded in this account>"
  }
}`;

function buildSavePlayPrompt(input: SavePlayInput): string {
  const { health, account, transcript, companyProfile } = input;

  const signalsBlock =
    health.signals.length > 0
      ? health.signals
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
      : "  (none — no churn signals detected)";

  const mrrStr =
    account.mrr != null
      ? `${account.currency} ${account.mrr.toLocaleString()}`
      : "unknown";

  const profileBlock = companyProfile?.trim()
    ? `\n\nSELLING COMPANY PROFILE:\n${companyProfile.trim()}`
    : "\n\nSELLING COMPANY PROFILE: (none provided — stay grounded in the transcript; do not speculate about differentiators)";

  return `Generate customer save-play recommendations for this at-risk B2B SaaS customer.

ACCOUNT CONTEXT:
Company: ${account.companyName}
Sponsor: ${account.sponsorName ?? "unknown"}${
    account.sponsorEmail ? ` <${account.sponsorEmail}>` : ""
  }
Renewal date: ${account.renewalDate ?? "not set"}
MRR: ${mrrStr}
Transcripts on file: ${account.transcriptsCount}

HEALTH ANALYSIS:
Health score: ${health.healthScore}/100 (${health.healthLevel})  [higher = healthier]
Overall: ${health.overallReasoning}
Detected churn signals:
${signalsBlock}${profileBlock}

TRANSCRIPT(S):
${transcript || "(no transcript available)"}

Produce one save action per detected churn signal, grounded in the quotes above and the transcript(s). Return JSON only.`;
}

// ----------------------------------------------------------------------------
// LLM call + error handling (mirrors src/lib/solution/extractor.ts)
// ----------------------------------------------------------------------------

export class SavePlayUnavailableError extends Error {
  constructor(
    message: string,
    public cause?: unknown,
  ) {
    super(message);
    this.name = "SavePlayUnavailableError";
  }
}

/**
 * Generate save-play recommendations from a health analysis + account context.
 * Opus by default; reuses the SOLUTION_MODEL override knob.
 *
 * Robust transport: forced tool-use via callClaudeStructured — the model
 * returns the deliverable as a parsed tool input (no text-JSON regex/parse, so
 * the "invalid JSON twice" crash class is gone). Same prompt, same
 * SavePlayResultSchema, same Opus default. Fail-closed preserved: a structurally
 * invalid result throws SavePlayUnavailableError (NO heuristic fallback — a
 * save-play is only surfaced when the model produced a valid grounded one).
 */
export async function generateSavePlayLLM(
  input: SavePlayInput,
  model: string = process.env.SOLUTION_MODEL ?? DEFAULT_SOLUTION_MODEL,
): Promise<SavePlayResult> {
  const userPrompt = buildSavePlayPrompt(input);

  try {
    return await callClaudeStructured({
      schema: SavePlayResultSchema,
      system: SAVE_PLAY_SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
      model,
      maxTokens: 2048,
      // Opus save-play generation (several grounded actions from full
      // transcripts) routinely runs past the shared client's 30s default.
      timeoutMs: 120_000,
      toolName: "emit_save_play",
      toolDescription:
        "Return the customer save-play recommendations (one per detected churn signal) plus the overall retainability verdict, grounded strictly in this account's evidence.",
    });
  } catch (err) {
    if (err instanceof StructuredOutputError) {
      console.error(
        "Save-play structured output failed twice:",
        err.message,
        "Raw:",
        err.rawResponse.slice(0, 500),
      );
      throw new SavePlayUnavailableError(
        "Claude save-play generation returned invalid output twice",
        err,
      );
    }
    throw new SavePlayUnavailableError(
      "Claude save-play generation failed",
      err,
    );
  }
}
