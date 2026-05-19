import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getSlackIntegration, sendSlackAlert } from "@/lib/slack/service";

const FINDR_DEV_ORG_ID = "4909c8ee-017f-4d9a-bdb6-d3b90f0806a0";

export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const integration = await getSlackIntegration(FINDR_DEV_ORG_ID);
  if (!integration) {
    return NextResponse.json(
      { success: false, error: "No Slack integration configured" },
      { status: 400 },
    );
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const result = await sendSlackAlert(integration, {
    dealName: "Test Deal — Nordbank Enterprise",
    dealId: "test_deal",
    riskScore: 82,
    riskLevel: "critical",
    topSignals: [
      { type: "CHAMPION_LOSS", confidence: 0.95 },
      { type: "COMPETITOR_PRESSURE", confidence: 0.78 },
      { type: "BUDGET_FRICTION", confidence: 0.65 },
    ],
    overallReasoning:
      "This is a test alert from Findr. Your Slack integration is working correctly.",
    topRecommendation: "Schedule a re-engagement call within 48 hours.",
    dashboardUrl: `${baseUrl}/dashboard`,
  });

  return NextResponse.json(result);
}
