import "server-only";

import type { CallRow } from "@/lib/calls/service";
import type { Deal } from "@/lib/deals/types";
import type { CallForPrompt } from "@/lib/risk/prompts";
import type { RiskAnalysisResult } from "@/lib/schemas/risk";
import {
  buildDetectorInput,
  promptCallsToDetectorCalls,
  riskAnalysisToLegacyResult,
} from "./adapters";
import { analyzeRisk } from "./orchestrator";

function isCallRowArray(calls: CallRow[] | CallForPrompt[]): calls is CallRow[] {
  return calls.length === 0 || "transcript_segments" in calls[0];
}

/**
 * Compatibility adapter for existing callers (cron, alerts, API persistence).
 * The legacy Claude classifier is archived in src/lib/risk/legacy/classifier.ts.
 */
export async function analyzeDealRisk(
  deal: Deal,
  calls: CallRow[] | CallForPrompt[] = [],
  orgId = "unknown",
): Promise<RiskAnalysisResult> {
  const detectorInput =
    isCallRowArray(calls)
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
