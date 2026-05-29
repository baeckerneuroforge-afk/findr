import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { requireOrgIdOrError } from "@/lib/auth/org";
import {
  GongAuthError,
  GongConfigurationError,
  syncGongCalls,
} from "@/lib/gong/service";

export async function POST() {
  const t = await getTranslations("errors");
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
          error: t("integrations.gongNotConfiguredAdmin"),
          code: "GONG_NOT_CONFIGURED",
        },
        { status: 503 },
      );
    }

    if (err instanceof GongAuthError) {
      return NextResponse.json(
        {
          success: false,
          error: t("integrations.gongConnectionLost"),
          code: "GONG_AUTH_LOST",
        },
        { status: 401 },
      );
    }

    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : t("unexpected"),
      },
      { status: 500 },
    );
  }
}
