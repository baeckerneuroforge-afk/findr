import { NextResponse } from "next/server";
import { requireOrgId, OrgResolutionError } from "@/lib/auth/org";
import { getForecast } from "@/lib/forecast/service";

export async function GET() {
  let orgId: string;
  try {
    orgId = await requireOrgId();
  } catch (err) {
    if (err instanceof OrgResolutionError) {
      return NextResponse.json({ error: err.code }, { status: 401 });
    }
    throw err;
  }

  const forecast = await getForecast(orgId);
  return NextResponse.json(forecast);
}
