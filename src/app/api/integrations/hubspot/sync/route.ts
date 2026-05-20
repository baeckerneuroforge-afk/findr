import { NextResponse } from "next/server";
import { requireOrgIdOrError } from "@/lib/auth/org";
import { syncHubspotDeals } from "@/lib/hubspot/service";

export async function POST() {
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;

  try {
    const result = await syncHubspotDeals(orgOrError.orgId);
    return NextResponse.json({
      success: true,
      synced: result.synced,
      errors: result.errors.slice(0, 10),
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
