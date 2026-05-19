import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getLatestRiskScore } from "@/lib/risk/service";

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const dealId = searchParams.get("dealId");
  if (!dealId) {
    return NextResponse.json({ error: "dealId required" }, { status: 400 });
  }

  const result = await getLatestRiskScore(dealId);
  return NextResponse.json({ result });
}
