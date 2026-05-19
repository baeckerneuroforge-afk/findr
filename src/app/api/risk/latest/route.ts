import { NextResponse, type NextRequest } from "next/server";
import { requireOrgIdOrError } from "@/lib/auth/org";
import { getLatestRiskScore } from "@/lib/risk/service";

export async function GET(req: NextRequest) {
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;
  const orgId = orgOrError.orgId;

  const { searchParams } = new URL(req.url);
  const dealId = searchParams.get("dealId");
  if (!dealId) {
    return NextResponse.json({ error: "dealId required" }, { status: 400 });
  }

  try {
    const result = await getLatestRiskScore(orgId, dealId);
    return NextResponse.json({ result });
  } catch (err) {
    return NextResponse.json(
      {
        error: "Failed to fetch risk score",
        detail: err instanceof Error ? err.message : "unknown",
      },
      { status: 500 },
    );
  }
}
