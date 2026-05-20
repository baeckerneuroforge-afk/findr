import { NextResponse } from "next/server";
import { requireOrgIdOrError } from "@/lib/auth/org";
import { disconnectGongIntegration } from "@/lib/gong/service";

export async function POST() {
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;

  try {
    await disconnectGongIntegration(orgOrError.orgId);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Unknown disconnect error",
      },
      { status: 500 },
    );
  }
}
