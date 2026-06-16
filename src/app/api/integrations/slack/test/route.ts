import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { requireOrgIdOrError } from "@/lib/auth/org";
import { getSlackIntegration, sendSlackAlert } from "@/lib/slack/service";

export async function POST() {
  const t = await getTranslations("errors");
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;
  const orgId = orgOrError.orgId;

  const integration = await getSlackIntegration(orgId);
  if (!integration) {
    return NextResponse.json(
      { success: false, error: t("integrations.slackNotConfigured") },
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
      "This is a test alert from Klymeo. Your Slack integration is working correctly.",
    topRecommendation: "Schedule a re-engagement call within 48 hours.",
    dashboardUrl: `${baseUrl}/dashboard`,
  });

  return NextResponse.json(result);
}
