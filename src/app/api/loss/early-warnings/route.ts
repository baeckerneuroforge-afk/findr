import { NextResponse } from "next/server";
import { requireOrgId, OrgResolutionError } from "@/lib/auth/org";
import { getEarlyWarnings } from "@/lib/loss/early-warning-service";

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

  const report = await getEarlyWarnings(orgId);
  return NextResponse.json(report);
}
