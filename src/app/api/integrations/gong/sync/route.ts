import { NextResponse } from "next/server";
import { requireOrgIdOrError } from "@/lib/auth/org";
import {
  GongAuthError,
  GongConfigurationError,
  syncGongCalls,
} from "@/lib/gong/service";

export async function POST() {
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;

  try {
    const result = await syncGongCalls(orgOrError.orgId);
    return NextResponse.json({
      success: true,
      syncedCalls: result.syncedCalls,
      syncedSegments: result.syncedSegments,
      unmatchedCalls: result.unmatchedCalls,
      errors: result.errors.slice(0, 10),
    });
  } catch (err) {
    if (err instanceof GongConfigurationError) {
      return NextResponse.json(
        {
          success: false,
          error: "Gong integration not configured. Contact administrator.",
          code: "GONG_NOT_CONFIGURED",
        },
        { status: 503 },
      );
    }

    if (err instanceof GongAuthError) {
      return NextResponse.json(
        {
          success: false,
          error: "Gong connection lost. Please reconnect.",
          code: "GONG_AUTH_LOST",
        },
        { status: 401 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Unknown Gong sync error",
      },
      { status: 500 },
    );
  }
}
