import "server-only";

import type { CallRow } from "@/lib/calls/service";
import type { Deal } from "@/lib/deals/types";
import type { CallForPrompt } from "@/lib/risk/prompts";
import type { RiskAnalysisResult } from "@/lib/schemas/risk";
import { analyzeDealRiskLLM } from "./llm-classifier";
import {
  buildDetectorInput,
  promptCallsToDetectorCalls,
  riskAnalysisToLegacyResult,
} from "./adapters";
import { analyzeRisk } from "./orchestrator";

export type RiskAnalysisSource = "llm" | "heuristic";

function isCallRowArray(calls: CallRow[] | CallForPrompt[]): calls is CallRow[] {
  return calls.length === 0 || "transcript_segments" in calls[0];
}

function callRowsToPromptCalls(calls: CallRow[]): CallForPrompt[] {
  return calls.map((call) => ({
    call_type: call.call_type,
    duration_seconds: call.duration_seconds,
    recorded_at: call.recorded_at,
    transcript_summary: call.transcript_summary,
    transcript: call.transcript,
  }));
}

async function runHeuristicFallback(
  deal: Deal,
  calls: CallRow[] | CallForPrompt[],
  orgId: string,
): Promise<RiskAnalysisResult> {
  const detectorInput = isCallRowArray(calls)
    ? buildDetectorInput({
        orgId,
        deal,
        calls,
      })
    : {
        ...buildDetectorInput({
          orgId,
          deal,
          calls: [],
        }),
        calls: promptCallsToDetectorCalls(calls as CallForPrompt[]),
      };

  const analysis = await analyzeRisk(detectorInput);
  return riskAnalysisToLegacyResult(analysis);
}

/**
 * Runs the real Claude classifier first, then falls back to deterministic
 * heuristic detectors when the LLM is unavailable or returns unusable output.
 */
export async function analyzeDealRiskWithFallback(
  deal: Deal,
  calls: CallRow[] | CallForPrompt[] = [],
  orgId = "unknown",
): Promise<{ result: RiskAnalysisResult; source: RiskAnalysisSource }> {
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const promptCalls = isCallRowArray(calls)
        ? callRowsToPromptCalls(calls)
        : calls;
      const result = await analyzeDealRiskLLM(deal, promptCalls);
      return { result, source: "llm" };
    } catch (err) {
      console.warn(
        "LLM analysis failed, falling back to heuristic detectors:",
        err,
      );
    }
  }

  const result = await runHeuristicFallback(deal, calls, orgId);
  return { result, source: "heuristic" };
}

/**
 * Compatibility adapter for existing callers (cron, alerts, API persistence).
 */
export async function analyzeDealRisk(
  deal: Deal,
  calls: CallRow[] | CallForPrompt[] = [],
  orgId = "unknown",
): Promise<RiskAnalysisResult> {
  const { result } = await analyzeDealRiskWithFallback(deal, calls, orgId);
  return result;
}
