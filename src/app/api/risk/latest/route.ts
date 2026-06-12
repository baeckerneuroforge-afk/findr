import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";
import { requireOrgIdOrError } from "@/lib/auth/org";
import { getLatestRiskScore } from "@/lib/risk/service";

export async function GET(req: NextRequest) {
  const t = await getTranslations("errors");
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;
  const orgId = orgOrError.orgId;

  const { searchParams } = new URL(req.url);
  const dealId = searchParams.get("dealId");
  if (!dealId) {
    return NextResponse.json({ error: t("risk.dealIdRequired") }, { status: 400 });
  }

  try {
    const result = await getLatestRiskScore(orgId, dealId);
    return NextResponse.json({ result });
  } catch (err) {
    console.error("[risk/latest] failed:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      {
        error: t("risk.fetchFailed"),
      },
      { status: 500 },
    );
  }
}
