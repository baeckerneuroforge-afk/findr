import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { requireOrgIdOrError } from "@/lib/auth/org";
import {
  GongAuthError,
  GongConfigurationError,
  syncGongCalls,
} from "@/lib/gong/service";

// Backfill-Route: fetchGongCalls paged bis 1.000 Calls und syncGongCalls
// schreibt (6+N) Roundtrips PRO Call — ein großer Backfill riss Vercels
// 60s-Default als silent partial sync (Perf-Audit 4.5). Gleicher Wert wie
// auf den LLM-Routen (Etappe A).
export const maxDuration = 300;

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

    console.error("[integrations/gong/sync] failed:", err);
    return NextResponse.json(
      { success: false, error: t("unexpected") },
      { status: 500 },
    );
  }
}
