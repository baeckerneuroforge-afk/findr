import { NextResponse, type NextRequest } from "next/server";
import { requireOrgIdOrError } from "@/lib/auth/org";
import { getDealById } from "@/lib/deals/service";
import { getCallsByDealId } from "@/lib/calls/service";
import { analyzeDealRisk } from "@/lib/risk/classifier";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { maybeTriggerAlert, getPreviousScore } from "@/lib/alerts/trigger";
import { AnalyzeRiskRequestSchema } from "@/lib/schemas/risk";
import type { Json } from "@/types/database";

export async function POST(req: NextRequest) {
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;
  const orgId = orgOrError.orgId;

  const rawBody = await req.json().catch(() => null);
  const parsed = AnalyzeRiskRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { dealId } = parsed.data;

  const deal = await getDealById(orgId, dealId);
  if (!deal) {
    return NextResponse.json({ error: "deal not found" }, { status: 404 });
  }

  try {
    const calls = await getCallsByDealId(orgId, dealId);
    const previousScore = await getPreviousScore(orgId, dealId);
    const result = await analyzeDealRisk(deal, calls);

    const supabase = createAdminSupabaseClient();
    const { data: inserted, error: insertError } = await supabase
      .from("risk_scores")
      .insert({
        org_id: orgId,
        deal_id: dealId,
        risk_score: result.riskScore,
        risk_level: result.riskLevel,
        overall_reasoning: result.overallReasoning,
        recommendations: result.recommendations ?? [],
        signals: result.signals as unknown as Json,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Failed to persist risk_score:", insertError.message);
    }

    const riskScoreId = inserted?.id ?? null;

    let alert: { triggered: boolean; reason?: string } = { triggered: false };
    if (riskScoreId) {
      alert = await maybeTriggerAlert(
        orgId,
        dealId,
        deal.name,
        riskScoreId,
        result,
        previousScore,
      );
    }

    return NextResponse.json({ success: true, result, alert });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Risk analysis failed",
        detail: error instanceof Error ? error.message : "unknown",
      },
      { status: 500 },
    );
  }
}
