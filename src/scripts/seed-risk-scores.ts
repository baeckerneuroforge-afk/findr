/**
 * Seed-Script: generates Claude-based risk analyses for every Deal in MOCK_DEALS
 * and writes them to the `risk_scores` table.
 *
 * Uses inline supabase queries + a direct Anthropic call instead of importing
 * @/lib/calls/service or @/lib/risk/classifier — both carry "server-only" which
 * throws when imported outside the Next.js server runtime (i.e. under tsx).
 *
 * Prerequisites:
 *   1. Run supabase/migrations/20260520000000_risk_drilldown.sql
 *   2. Have rows in `calls` (from seed-calls.ts) so the classifier sees transcripts
 *   3. .env.local with NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 *      and ANTHROPIC_API_KEY
 *
 * Run with: pnpm tsx src/scripts/seed-risk-scores.ts
 */

import { createClient } from "@supabase/supabase-js";
import { config as loadEnv } from "dotenv";
import Anthropic from "@anthropic-ai/sdk";
import { MOCK_DEALS } from "@/lib/deals/mock-data";
import {
  RISK_CLASSIFIER_SYSTEM_PROMPT,
  buildRiskClassifierPrompt,
  type CallForPrompt,
} from "@/lib/risk/prompts";
import type { RiskAnalysisResult } from "@/lib/deals/types";
import { DEV_ORG_ID } from "@/lib/auth/dev-org";

loadEnv({ path: ".env.local" });
loadEnv();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anthropicKey = process.env.ANTHROPIC_API_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Set them in .env.local.",
  );
  process.exit(1);
}
if (!anthropicKey) {
  console.error("Missing ANTHROPIC_API_KEY. Set it in .env.local.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const anthropic = new Anthropic({ apiKey: anthropicKey });

async function analyzeDeal(
  deal: (typeof MOCK_DEALS)[number],
  calls: CallForPrompt[],
): Promise<RiskAnalysisResult> {
  const userPrompt = buildRiskClassifierPrompt(deal, calls);

  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 2048,
    system: RISK_CLASSIFIER_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Anthropic returned no text response");
  }

  const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`No JSON found in response: ${textBlock.text}`);
  }

  return JSON.parse(jsonMatch[0]) as RiskAnalysisResult;
}

async function seedRiskScores() {
  console.log(`Generating risk scores for ${MOCK_DEALS.length} deals...`);

  for (const deal of MOCK_DEALS) {
    try {
      const { data: calls } = await supabase
        .from("calls")
        .select("*, call_speakers(*), transcript_segments(*)")
        .eq("org_id", DEV_ORG_ID)
        .eq("deal_id", deal.id)
        .order("recorded_at", { ascending: false });

      const result = await analyzeDeal(deal, (calls ?? []) as CallForPrompt[]);

      const { error } = await supabase
        .from("risk_scores")
        .insert({
          org_id: DEV_ORG_ID,
          deal_id: deal.id,
          risk_score: result.riskScore,
          risk_level: result.riskLevel,
          overall_reasoning: result.overallReasoning,
          recommendations: result.recommendations ?? [],
          signals: result.signals,
        } as never);

      if (error) {
        console.error(`✗ ${deal.name}: ${error.message}`);
      } else {
        console.log(
          `✓ ${deal.name} → ${result.riskScore}/100 (${result.riskLevel}, ${result.signals.length} signals)`,
        );
      }
    } catch (err) {
      console.error(
        `✗ ${deal.name}:`,
        err instanceof Error ? err.message : err,
      );
    }
  }

  console.log("Done.");
}

seedRiskScores().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
