import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";

import { requireOrgIdOrError } from "@/lib/auth/org";
import {
  ProlificSyncError,
  syncProlificStudyForPlan,
} from "@/lib/panel/service";
import { ProlificApiError } from "@/lib/panel/prolific";

/**
 * POST /api/research/plans/[id]/panel/sync — manueller Status-/Submissions-
 * Sync (E5) für den jüngsten persistierten Prolific-Draft des Plans. Kein
 * Body; das Ergebnis ist die aktualisierte panel_studies-Summary, die der
 * Aktualisieren-Button im ProlificDraftPanel per router.refresh() ohnehin
 * gleich als Server-Prop nachlädt. Fehler-Mapping spiegelt die
 * prolific-draft-Route (ProlificApiError 4xx→400, sonst 502).
 */

function syncErrorStatus(code: ProlificSyncError["code"]) {
  if (code === "missing_credentials") return 400;
  if (code === "study_not_found") return 404;
  return 500;
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const t = await getTranslations("errors");
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;

  const { id: planId } = await params;

  try {
    const study = await syncProlificStudyForPlan(orgOrError.orgId, planId);
    return NextResponse.json({ success: true, study });
  } catch (err) {
    if (err instanceof ProlificSyncError) {
      return NextResponse.json(
        { success: false, error: err.code },
        { status: syncErrorStatus(err.code) },
      );
    }
    if (err instanceof ProlificApiError) {
      return NextResponse.json(
        {
          success: false,
          error: "prolific_api_error",
          status: err.status,
        },
        { status: err.status >= 400 && err.status < 500 ? 400 : 502 },
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
