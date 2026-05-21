import { NextResponse } from "next/server";
import { requireOrgIdOrError } from "@/lib/auth/org";
import { getEarlyWarnings } from "@/lib/loss/early-warning-service";

export async function GET() {
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;
  const orgId = orgOrError.orgId;

  try {
    const report = await getEarlyWarnings(orgId);
    return NextResponse.json(report);
  } catch (err) {
    return NextResponse.json(
      {
        error: "Failed to compute early warnings",
        detail: err instanceof Error ? err.message : "unknown",
      },
      { status: 500 },
    );
  }
}
