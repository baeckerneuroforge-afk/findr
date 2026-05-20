import { NextResponse } from "next/server";
import { maybeTriggerAlert, getPreviousScore } from "@/lib/alerts/trigger";
import { getCallsByDealId } from "@/lib/calls/service";
import { getDealsByOrg } from "@/lib/deals/service";
import { analyzeDealRisk } from "@/lib/risk/classifier";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

function isAuthorizedCron(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;

  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${cronSecret}`;
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

  const results = {
    total_orgs: orgs.length,
    total_deals: 0,
    successful: 0,
    failed: 0,
    skipped: 0,
    alerts_triggered: 0,
    errors: [] as string[],
  };

  for (const org of orgs) {
    try {
      const deals = await getDealsByOrg(org.id);
      const activeDeals = deals.filter(
        (deal) => !["closed_won", "closed_lost"].includes(deal.stage),
      );

      results.total_deals += activeDeals.length;

      for (const deal of activeDeals) {
        try {
          if (deal.dataSource === "mock") {
            results.skipped++;
            continue;
          }

          const calls = await getCallsByDealId(org.id, deal.id);

          if (calls.length === 0) {
            results.skipped++;
            continue;
          }

          const previousScore = await getPreviousScore(org.id, deal.id);
          const result = await analyzeDealRisk(deal, calls);

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
