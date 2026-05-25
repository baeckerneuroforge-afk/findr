import "server-only";

import { z } from "zod";

import { getAnthropicClient } from "@/lib/anthropic/client";
import { RISK_SIGNAL_TYPES, type RiskSignal } from "@/lib/schemas/risk";
import { DEFAULT_SOLUTION_MODEL } from "@/lib/solution/extractor";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/types/database";
import { getAccount } from "./service";
import {
  getAccountTranscriptCount,
  getLatestHealthScore,
} from "./health-service";
import type { HealthLevel } from "./types";

/**
 * Save-Play Layer — customer-retention recommendation generator.
 * --------------------------------------------------------------
 * The health-side mirror of src/lib/solution/extractor.ts. Where the risk side
 * does score → signals → solution (rescue a deal), this does health score →
 * churn signals → save-play (retain a customer). It consumes the latest health
 * analysis (signals + verbatim quotes + score), the account context (sponsor,
 * renewal, MRR), and the post-sale transcripts, and produces concrete, GROUNDED
 * save actions — one per churn signal, each tied to real evidence from THIS
 * account.
 *
 * Conventions mirror the solution layer exactly: structured JSON output, Zod
 * validation, one retry on schema failure, then a typed error, no heuristic
 * fallback. Opus by default, reusing the SAME SOLUTION_MODEL override knob.
 */

type SavePlayRow = Database["public"]["Tables"]["account_save_plays"]["Row"];

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

export interface SavePlayReport {
  id: string;
  org_id: string;
  account_id: string;
  status: "completed" | "failed";
  salvageable: "yes" | "no" | "maybe" | null;
  recommendations: SavePlayResult["recommendations"];
  overall: SavePlayResult["overall"];
  source_health_score_id: string | null;
  model: string;
  created_at: string;
}

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

class SavePlaySchemaError extends Error {
  constructor(
    message: string,
    public rawResponse: string,
  ) {
    super(message);
    this.name = "SavePlaySchemaError";
  }
}

export class SavePlayUnavailableError extends Error {
  constructor(
    message: string,
    public cause?: unknown,
  ) {
    super(message);
    this.name = "SavePlayUnavailableError";
  }
}

async function callClaude(
  userPrompt: string,
  attempt: number,
  model: string,
): Promise<SavePlayResult> {
  const client = getAnthropicClient();

  const system =
    attempt > 0
      ? SAVE_PLAY_SYSTEM_PROMPT +
        "\n\nIMPORTANT: Your last response did not match the required JSON schema. Return ONLY a valid JSON object with the exact structure specified. No markdown, no preamble, no explanation."
      : SAVE_PLAY_SYSTEM_PROMPT;

  const response = await client.messages.create(
    {
      model,
      max_tokens: 2048,
      // Opus 4.7 rejects the temperature parameter (400 error); rely on the
      // structured prompt + schema validation instead.
      system,
      messages: [{ role: "user", content: userPrompt }],
    },
    {
      // Opus save-play generation (several grounded actions from full
      // transcripts) routinely runs past the shared client's 30s default, so
      // give THIS call 120s and a single retry — same as the solution layer.
      timeout: 120_000,
      maxRetries: 1,
    },
  );

  const textBlock = response.content.find((block) => block.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new SavePlaySchemaError(
      "No text response from Claude",
      JSON.stringify(response.content),
    );
  }

  const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new SavePlaySchemaError("No JSON found in response", textBlock.text);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch (err) {
    throw new SavePlaySchemaError(
      `JSON parse failed: ${err instanceof Error ? err.message : "unknown"}`,
      jsonMatch[0],
    );
  }

  const result = SavePlayResultSchema.safeParse(parsed);
  if (!result.success) {
    throw new SavePlaySchemaError(
      `Schema validation failed: ${JSON.stringify(result.error.flatten())}`,
      JSON.stringify(parsed),
    );
  }

  return result.data;
}

/**
 * Generate save-play recommendations from a health analysis + account context.
 * Opus by default; reuses the SOLUTION_MODEL override knob.
 */
export async function generateSavePlayLLM(
  input: SavePlayInput,
  model: string = process.env.SOLUTION_MODEL ?? DEFAULT_SOLUTION_MODEL,
): Promise<SavePlayResult> {
  const userPrompt = buildSavePlayPrompt(input);

  try {
    return await callClaude(userPrompt, 0, model);
  } catch (err) {
    if (!(err instanceof SavePlaySchemaError)) {
      throw new SavePlayUnavailableError("Claude save-play generation failed", err);
    }
    console.warn(
      "Save-play schema validation failed on first attempt, retrying:",
      err.message,
    );
  }

  try {
    return await callClaude(userPrompt, 1, model);
  } catch (err) {
    if (err instanceof SavePlaySchemaError) {
      console.error(
        "Save-play schema validation failed twice:",
        err.message,
        "Raw:",
        err.rawResponse.slice(0, 500),
      );
      throw new SavePlayUnavailableError(
        "Claude save-play generation returned invalid JSON twice",
        err,
      );
    }
    throw new SavePlayUnavailableError("Claude save-play generation failed", err);
  }
}

// ----------------------------------------------------------------------------
// Service: load context, generate, persist (mirrors solution/service.ts)
// ----------------------------------------------------------------------------

function toReport(row: SavePlayRow): SavePlayReport {
  return {
    id: row.id,
    org_id: row.org_id,
    account_id: row.account_id,
    status: row.status,
    salvageable: row.salvageable,
    recommendations:
      (row.recommendations as unknown as SavePlayResult["recommendations"]) ?? [],
    overall:
      (row.overall as unknown as SavePlayResult["overall"]) ?? {
        salvageable: "maybe",
        reasoning: "",
      },
    source_health_score_id: row.source_health_score_id,
    model: row.model,
    created_at: row.created_at,
  };
}

/** Join the account's transcripts into one text block for the prompt. */
async function buildAccountTranscript(
  orgId: string,
  accountId: string,
): Promise<string> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("calls")
    .select("transcript")
    .eq("org_id", orgId)
    .eq("account_id", accountId)
    .order("recorded_at", { ascending: false });

  if (error || !data) return "";
  return data
    .map((c) => c.transcript?.trim() ?? "")
    .filter((text) => text.length > 0)
    .join("\n\n---\n\n");
}

/**
 * Generate customer save-play recommendations for an account and persist them to
 * account_save_plays.
 *
 * ON-DEMAND ONLY — runs solely when explicitly invoked (POST
 * /api/accounts/[id]/save-play). The latest health analysis is the required
 * INPUT: no health score, no save-play.
 *
 * Returns null when the account is missing or has no health analysis yet.
 * Propagates SavePlayUnavailableError when the model call ultimately fails (no
 * row written).
 */
export async function generateSavePlay(
  orgId: string,
  accountId: string,
): Promise<SavePlayReport | null> {
  const account = await getAccount(orgId, accountId);
  if (!account) return null;

  // The save-play acts on an existing health analysis — no health, no play.
  const health = await getLatestHealthScore(orgId, accountId);
  if (!health) return null;

  const [transcript, transcriptsCount] = await Promise.all([
    buildAccountTranscript(orgId, accountId),
    getAccountTranscriptCount(orgId, accountId),
  ]);

  const input: SavePlayInput = {
    health: {
      healthScore: health.health_score,
      healthLevel: health.health_level,
      signals: health.signals,
      overallReasoning: health.overall_reasoning,
    },
    account: {
      companyName: account.companyName,
      sponsorName: account.sponsorName,
      sponsorEmail: account.sponsorEmail,
      renewalDate: account.renewalDate,
      mrr: account.mrr,
      currency: account.currency,
      transcriptsCount,
    },
    transcript,
  };

  const model = process.env.SOLUTION_MODEL ?? DEFAULT_SOLUTION_MODEL;
  const result = await generateSavePlayLLM(input, model);

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("account_save_plays")
    .insert({
      org_id: orgId,
      account_id: accountId,
      status: "completed",
      salvageable: result.overall.salvageable,
      recommendations: result.recommendations as unknown as Json,
      overall: result.overall as unknown as Json,
      source_health_score_id: health.id,
      model,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to persist account_save_play: ${error?.message ?? "no row returned"}`,
    );
  }

  return toReport(data);
}

/** Load stored save-plays for an account, newest first. */
export async function getSavePlays(
  orgId: string,
  accountId: string,
  limit = 20,
): Promise<SavePlayReport[]> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("account_save_plays")
    .select("*")
    .eq("org_id", orgId)
    .eq("account_id", accountId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data.map(toReport);
}
