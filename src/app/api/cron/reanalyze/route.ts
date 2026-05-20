import { NextResponse } from "next/server";
import { maybeTriggerAlert, getPreviousScore } from "@/lib/alerts/trigger";
import { getSlackAlertPreferences } from "@/lib/alerts/service";
import { maybeTriggerForecastChange } from "@/lib/alerts/triggers";
import { getCallsByDealId } from "@/lib/calls/service";
import { getDealsByOrg } from "@/lib/deals/service";
import type { Deal } from "@/lib/deals/types";
import {
  buildDetectorInput,
  riskAnalysisToLegacyResult,
} from "@/lib/risk/adapters";
import { analyzeRisk } from "@/lib/risk/orchestrator";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

function isAuthorizedCron(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${cronSecret}`;
}

async function getRiskAdjustedPipelineValue(
  orgId: string,
  deals: Deal[],
): Promise<number> {
  if (deals.length === 0) return 0;

  const supabase = createAdminSupabaseClient();
  const dealIds = deals.map((deal) => deal.id);
  const { data } = await supabase
    .from("risk_scores")
    .select("deal_id, risk_score, analyzed_at")
    .eq("org_id", orgId)
    .in("deal_id", dealIds)
    .order("analyzed_at", { ascending: false });

  const latestScoreByDeal = new Map<string, number>();
  for (const row of data ?? []) {
    if (!latestScoreByDeal.has(row.deal_id)) {
      latestScoreByDeal.set(row.deal_id, row.risk_score);
    }
  }

  return deals.reduce((sum, deal) => {
    const riskScore = latestScoreByDeal.get(deal.id) ?? deal.riskScore ?? 0;
    const riskMultiplier = Math.max(0, 1 - riskScore / 100);
    return sum + deal.amount * riskMultiplier;
  }, 0);
}

interface OrgDeals {
  org: { id: string; name: string | null };
  activeDeals: Deal[];
}

export function isRealActiveDeal(
  deal: Pick<Deal, "stage" | "dataSource">,
): boolean {
  return (
    !["closed_won", "closed_lost"].includes(deal.stage) &&
    deal.dataSource !== "mock"
  );
}

export function getCronAnalysisMode(
  env: { ANTHROPIC_API_KEY?: string } = {
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  },
): "heuristic_only" | "heuristic_with_ai_available" {
  return env.ANTHROPIC_API_KEY
    ? "heuristic_with_ai_available"
    : "heuristic_only";
}

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminSupabaseClient();

  const { data: orgs, error: orgsError } = await supabase
    .from("organizations")
    .select("id, name");

  if (orgsError || !orgs) {
    return NextResponse.json({ error: "Failed to fetch orgs" }, { status: 500 });
  }

  if (getCronAnalysisMode() === "heuristic_only") {
    console.log("Cron running in heuristic-only mode");
  }

  const orgDealGroups: OrgDeals[] = [];
  let skippedNonRealDeals = 0;

  for (const org of orgs) {
    try {
      const deals = await getDealsByOrg(org.id);
      const realDeals = deals.filter(isRealActiveDeal);
      const skippedDeals = deals.length - realDeals.length;
      skippedNonRealDeals += skippedDeals;
      orgDealGroups.push({
        org,
        activeDeals: realDeals,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown";
      orgDealGroups.push({
        org,
        activeDeals: [],
      });
      console.error(`Failed to fetch deals for org ${org.id}: ${msg}`);
    }
  }

  const totalRealDeals = orgDealGroups.reduce(
    (sum, group) => sum + group.activeDeals.length,
    0,
  );

  if (totalRealDeals === 0) {
    return NextResponse.json({
      success: true,
      processed: 0,
      skipped: true,
      reason: "no_real_deals",
      total_orgs: orgs.length,
      skipped_deals: skippedNonRealDeals,
      timestamp: new Date().toISOString(),
    });
  }

  const results = {
    total_orgs: orgs.length,
    total_deals: 0,
    successful: 0,
    failed: 0,
    skipped: 0,
    alerts_triggered: 0,
    errors: [] as string[],
  };

  results.skipped += skippedNonRealDeals;

  for (const { org, activeDeals } of orgDealGroups) {
    try {
      const oldPipelineValue = await getRiskAdjustedPipelineValue(
        org.id,
        activeDeals,
      );

      results.total_deals += activeDeals.length;

      for (const deal of activeDeals) {
        try {
          const calls = await getCallsByDealId(org.id, deal.id);

          if (calls.length === 0) {
            results.skipped++;
            continue;
          }

          const previousScore = await getPreviousScore(org.id, deal.id);
          const analysis = await analyzeRisk(
            buildDetectorInput({
              orgId: org.id,
              deal,
              calls,
            }),
          );
          const result = riskAnalysisToLegacyResult(analysis);

          const { data: inserted, error: insertError } = await supabase
            .from("risk_scores")
            .insert({
              org_id: org.id,
              deal_id: deal.id,
              risk_score: result.riskScore,
              risk_level: result.riskLevel,
              overall_reasoning: result.overallReasoning,
              recommendations: result.recommendations ?? [],
              signals: result.signals as unknown as Json,
            })
            .select()
            .single();

          if (insertError || !inserted) {
            results.failed++;
            results.errors.push(
              `${org.id}/${deal.id}: ${insertError?.message ?? "insert failed"}`,
            );
            continue;
          }

          const alertResult = await maybeTriggerAlert(
            org.id,
            deal.id,
            deal.name,
            inserted.id,
            result,
            previousScore,
            {
              deal_amount: deal.amount,
              deal_owner: deal.ownerName,
              metadata: {
                champion_name: deal.championName,
              },
            },
          );

          if (alertResult.triggered) {
            results.alerts_triggered++;
          }

          results.successful++;
        } catch (err) {
          results.failed++;
          const msg = err instanceof Error ? err.message : "unknown";
          results.errors.push(`${org.id}/${deal.id}: ${msg}`);
        }
      }

      const newPipelineValue = await getRiskAdjustedPipelineValue(
        org.id,
        activeDeals,
      );
      const preferences = await getSlackAlertPreferences(org.id);
      const forecastAlertResult = await maybeTriggerForecastChange({
        orgId: org.id,
        oldPipelineValue,
        newPipelineValue,
        threshold: preferences.forecast_change_threshold,
      });
      if (forecastAlertResult.triggered) {
        results.alerts_triggered++;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "unknown";
      results.errors.push(`org ${org.id}: ${msg}`);
    }
  }

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    ...results,
  });
}
