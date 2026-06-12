import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";
import { requireOrgIdOrError } from "@/lib/auth/org";
import { getDealById } from "@/lib/deals/service";
import { getCallsByDealId } from "@/lib/calls/service";
import { analyzeDealRiskWithFallback } from "@/lib/risk/classifier";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { maybeTriggerAlert, getPreviousScore } from "@/lib/alerts/trigger";
import { AnalyzeRiskRequestSchema } from "@/lib/schemas/risk";
import type { Json } from "@/types/database";
import { getLatestRiskScore } from "@/lib/risk/service";
import { getDemoRiskSnapshot } from "@/lib/seed/demo-data";

// Risk analysis runs the Opus classifier (plus alert evaluation) inside the
// request — explicit ceiling like the other LLM routes (voice: 300).
export const maxDuration = 300;

function getMockDealId(rawData: Json | null, externalId: string): string {
  if (rawData && typeof rawData === "object" && !Array.isArray(rawData)) {
    const mockDealId = rawData.mock_deal_id;
    if (typeof mockDealId === "string") return mockDealId;
  }

  return externalId;
}

export async function POST(req: NextRequest) {
  const t = await getTranslations("errors");
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;
  const orgId = orgOrError.orgId;

  const rawBody = await req.json().catch(() => null);
  const parsed = AnalyzeRiskRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: t("invalidRequestBody"), details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { dealId } = parsed.data;

  const deal = await getDealById(orgId, dealId);
  if (!deal) {
    return NextResponse.json({ error: t("notFound.deal") }, { status: 404 });
  }

  const supabase = createAdminSupabaseClient();
  const { data: dealRow } = await supabase
    .from("deals")
    .select("data_source, external_id, raw_data")
    .eq("org_id", orgId)
    .eq("id", dealId)
    .maybeSingle();

  if (dealRow?.data_source === "mock") {
    const latest = await getLatestRiskScore(orgId, dealId);
    if (latest) {
      const result = {
        riskScore: latest.risk_score,
        riskLevel: latest.risk_level,
        signals: latest.signals,
        overallReasoning: latest.overall_reasoning,
        recommendations: latest.recommendations,
      };
      const alert = await maybeTriggerAlert(
        orgId,
        dealId,
        deal.name,
        latest.id,
        result,
        null,
        {
          deal_amount: deal.amount,
          deal_owner: deal.ownerName,
          metadata: {
            champion_name: deal.championName,
          },
        },
      );

      return NextResponse.json({
        success: true,
        source: "demo_snapshot",
        result,
        alert,
      });
    }

    const snapshot = getDemoRiskSnapshot(
      getMockDealId(dealRow.raw_data, dealRow.external_id),
    );
    if (snapshot) {
      const alert = await maybeTriggerAlert(
        orgId,
        dealId,
        deal.name,
        "demo_snapshot",
        snapshot,
        null,
        {
          deal_amount: deal.amount,
          deal_owner: deal.ownerName,
          metadata: {
            champion_name: deal.championName,
          },
        },
      );

      return NextResponse.json({
        success: true,
        source: "demo_snapshot",
        result: snapshot,
        alert,
      });
    }
  }

  if (!dealRow) {
    const snapshot = getDemoRiskSnapshot(dealId);
    if (snapshot) {
      const alert = await maybeTriggerAlert(
        orgId,
        dealId,
        deal.name,
        "demo_snapshot",
        snapshot,
        null,
        {
          deal_amount: deal.amount,
          deal_owner: deal.ownerName,
          metadata: {
            champion_name: deal.championName,
          },
        },
      );

      return NextResponse.json({
        success: true,
        source: "demo_snapshot",
        result: snapshot,
        alert,
      });
    }
  }

  try {
    const calls = await getCallsByDealId(orgId, dealId);
    const previousScore = await getPreviousScore(orgId, dealId);
    const { result, source } = await analyzeDealRiskWithFallback(
      deal,
      calls,
      orgId,
    );

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
        // Honest provenance: "ai" = Claude (Opus), "heuristic" = rule-based
        // fallback (e.g. LLM call failed / key missing).
        analysis_method: source === "llm" ? "ai" : "heuristic",
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
        {
          deal_amount: deal.amount,
          deal_owner: deal.ownerName,
          metadata: {
            champion_name: deal.championName,
          },
        },
      );
    }

    return NextResponse.json({ success: true, result, alert, source });
  } catch (error) {
    console.error("[risk] analysis failed:", error instanceof Error ? error.message : error);
    return NextResponse.json(
      {
        error: t("risk.analysisFailed"),
      },
      { status: 500 },
    );
  }
}
