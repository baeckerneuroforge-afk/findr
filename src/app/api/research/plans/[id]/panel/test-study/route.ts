import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";

import { requireOrgIdOrError } from "@/lib/auth/org";
import {
  createProlificTestStudyForPlan,
  ProlificPublishError,
} from "@/lib/panel/service";
import { ProlificApiError } from "@/lib/panel/prolific";

/**
 * POST /api/research/plans/[id]/panel/test-study — klont den persistierten
 * Prolific-Draft als Test-Studie und published sie an die Test-Teilnehmer
 * des Workspace (verbraucht laut Prolific-Doku KEINE Credits; gratis
 * End-to-End-Probe des Publish-Flows). Kein Body. Preconditions teilt der
 * Service mit dem echten Publish (gleicher Helper); Workspace-Anforderungen
 * (≥1 Test-Teilnehmer, Feature freigeschaltet) meldet Prolific selbst —
 * der Wortlaut läuft als detail zur UI durch.
 */

function testStudyErrorStatus(code: ProlificPublishError["code"]) {
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
    const testStudy = await createProlificTestStudyForPlan(
      orgOrError.orgId,
      planId,
    );
    return NextResponse.json({ success: true, ...testStudy });
  } catch (err) {
    if (err instanceof ProlificPublishError) {
      return NextResponse.json(
        {
          success: false,
          error: err.code,
          ...(err.providerStatus ? { providerStatus: err.providerStatus } : {}),
        },
        { status: testStudyErrorStatus(err.code) },
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
    console.error("[panel/test-study] failed:", err);
    return NextResponse.json(
      { success: false, error: t("unexpected") },
      { status: 500 },
    );
  }
}
