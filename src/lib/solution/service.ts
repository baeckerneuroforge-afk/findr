import "server-only";

import { getCallsByDealId, type CallRow } from "@/lib/calls/service";
import { getDealById } from "@/lib/deals/service";
import { getLatestRiskScore } from "@/lib/risk/service";
import type { RiskAnalysisResult } from "@/lib/schemas/risk";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import type { Database, Json } from "@/types/database";
import {
  DEFAULT_SOLUTION_MODEL,
  generateSolution,
  type SolutionDealContext,
  type SolutionResult,
} from "./extractor";

type SolutionReportRow = Database["public"]["Tables"]["solution_reports"]["Row"];

export interface SolutionReport {
  id: string;
  org_id: string;
  deal_id: string;
  status: "completed" | "failed";
  salvageable: "yes" | "no" | "maybe" | null;
  recommendations: SolutionResult["recommendations"];
  overall: SolutionResult["overall"];
  model: string;
  created_at: string;
}

function toReport(row: SolutionReportRow): SolutionReport {
  return {
    id: row.id,
    org_id: row.org_id,
    deal_id: row.deal_id,
    status: row.status,
    salvageable: row.salvageable,
    recommendations:
      (row.recommendations as unknown as SolutionResult["recommendations"]) ?? [],
    overall:
      (row.overall as unknown as SolutionResult["overall"]) ?? {
        salvageable: "maybe",
        reasoning: "",
      },
    model: row.model,
    created_at: row.created_at,
  };
}

/** Join the deal's call transcripts into one text block for the prompt. */
function buildTranscript(calls: CallRow[]): string {
  return calls
    .map((call) => {
      if (call.transcript && call.transcript.trim()) {
        return call.transcript.trim();
      }
      if (call.transcript_segments?.length) {
        return call.transcript_segments
          .map((seg) => seg.text)
          .filter((text) => text && text.trim().length > 0)
          .join("\n");
      }
      return "";
    })
    .filter((text) => text.length > 0)
    .join("\n\n---\n\n");
}

/**
 * Generate deal-rescue recommendations for a deal and persist them to
 * solution_reports.
 *
 * ON-DEMAND ONLY. Nothing calls this automatically — not the risk analysis, not
 * a cron, not the persistence path. It runs solely when explicitly invoked
 * (currently: POST /api/solution/generate).
 *
 * The stored risk analysis is the required INPUT: this loads the latest
 * risk_scores row for the deal, the deal context, and the transcript, then calls
 * generateSolution (Opus by default; SOLUTION_MODEL overrides).
 *
 * Returns null when the deal is missing or has no risk analysis yet. Propagates
 * SolutionUnavailableError when the model call ultimately fails (no row written).
 */
export async function generateAndPersistSolution(
  orgId: string,
  dealId: string,
): Promise<SolutionReport | null> {
  const deal = await getDealById(orgId, dealId);
  if (!deal) return null;

  // The solution layer acts on an existing risk analysis — no risk, no solution.
  const risk = await getLatestRiskScore(orgId, dealId);
  if (!risk) return null;

  const riskAnalysis: RiskAnalysisResult = {
    riskScore: risk.risk_score,
    riskLevel: risk.risk_level,
    signals: risk.signals,
    overallReasoning: risk.overall_reasoning,
    recommendations: risk.recommendations,
  };

  const calls = await getCallsByDealId(orgId, dealId);
  const transcript = buildTranscript(calls);

  const dealContext: SolutionDealContext = {
    stage: deal.stage,
    amount: deal.amount,
    currency: deal.currency,
    callsCount: deal.callsCompleted,
  };

  const model = process.env.SOLUTION_MODEL ?? DEFAULT_SOLUTION_MODEL;
  const result = await generateSolution(
    { riskAnalysis, deal: dealContext, transcript },
    model,
  );

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("solution_reports")
    .insert({
      org_id: orgId,
      deal_id: dealId,
      status: "completed",
      salvageable: result.overall.salvageable,
      recommendations: result.recommendations as unknown as Json,
      overall: result.overall as unknown as Json,
      model,
    })
    .select()
    .single();

  if (error || !data) {
    throw new Error(
      `Failed to persist solution_report: ${error?.message ?? "no row returned"}`,
    );
  }

  return toReport(data);
}

/** Load stored solution reports for a deal, newest first. */
export async function getSolutionReports(
  orgId: string,
  dealId: string,
  limit = 20,
): Promise<SolutionReport[]> {
  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("solution_reports")
    .select("*")
    .eq("org_id", orgId)
    .eq("deal_id", dealId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data.map(toReport);
}
