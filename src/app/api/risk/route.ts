import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getDealById } from "@/lib/deals/service";
import { getCallsByDealId } from "@/lib/calls/service";
import { analyzeDealRisk } from "@/lib/risk/classifier";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

const FINDR_DEV_ORG_ID = "4909c8ee-017f-4d9a-bdb6-d3b90f0806a0";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as
    | { dealId?: string }
    | null;
  const dealId = body?.dealId;
  if (!dealId) {
    return NextResponse.json({ error: "dealId required" }, { status: 400 });
  }

  const deal = await getDealById(dealId);
  if (!deal) {
    return NextResponse.json({ error: "deal not found" }, { status: 404 });
  }

  try {
    const calls = await getCallsByDealId(dealId);
    const result = await analyzeDealRisk(deal, calls);

    const supabase = createAdminSupabaseClient();
    const { error: insertError } = await supabase
      .from("risk_scores" as never)
      .insert({
        org_id: FINDR_DEV_ORG_ID,
        deal_id: dealId,
        risk_score: result.riskScore,
        risk_level: result.riskLevel,
        overall_reasoning: result.overallReasoning,
        recommendations: result.recommendations ?? [],
        signals: result.signals,
      } as never);

    if (insertError) {
      console.error("Failed to persist risk_score:", insertError.message);
    }

    return NextResponse.json({ success: true, result });
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
