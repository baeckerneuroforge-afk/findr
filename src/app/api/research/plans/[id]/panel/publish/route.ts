import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";

import { requireOrgIdOrError } from "@/lib/auth/org";
import {
  ProlificPublishError,
  publishProlificStudyForPlan,
} from "@/lib/panel/service";
import { ProlificApiError } from "@/lib/panel/prolific";

/**
 * POST /api/research/plans/[id]/panel/publish — die einzige GELD-NAHE
 * Panel-Route (E7): schaltet den persistierten Prolific-Draft live, was
 * Prolific aus dem Workspace-Guthaben des verbundenen Accounts finanziert.
 * Kein Body; alle Preconditions erzwingt der Service serverseitig (inkl.
 * Live-Status-Check gegen Doppel-Publish). Die UI hängt davor einen
 * expliziten Confirm-Schritt — Klymeo published nie automatisch.
 *
 * Fehler-Mapping wie die Geschwister-Routen; ProlificApiError trägt
 * zusätzlich `detail` = Prolifics wörtliche Begründung (z. B. bei
 * unzureichendem Guthaben — die Form ist nicht dokumentiert, deshalb
 * geben wir den Provider-Text weiter statt Codes zu raten).
 */

function publishErrorStatus(code: ProlificPublishError["code"]) {
  if (code === "study_not_found") return 404;
  if (code === "not_unpublished") return 409;
  if (code === "publish_failed") return 500;
  return 400;
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
    const result = await publishProlificStudyForPlan(orgOrError.orgId, planId);
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    if (err instanceof ProlificPublishError) {
      return NextResponse.json(
        {
          success: false,
          error: err.code,
          ...(err.providerStatus ? { providerStatus: err.providerStatus } : {}),
        },
        { status: publishErrorStatus(err.code) },
      );
    }
    if (err instanceof ProlificApiError) {
      return NextResponse.json(
        {
          success: false,
          error: "prolific_api_error",
          status: err.status,
          detail: err.providerMessage,
        },
        { status: err.status >= 400 && err.status < 500 ? 400 : 502 },
      );
    }
    console.error("[panel/publish] failed:", err);
    return NextResponse.json(
      { success: false, error: t("unexpected") },
      { status: 500 },
    );
  }
}
