import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";

import { requireOrgIdOrError } from "@/lib/auth/org";
import {
  detectAndPersistResearchRiskSuggestions,
  listResearchRiskSuggestions,
} from "@/lib/bridge/research-to-sales";

/**
 * POST /api/bridge/research-to-sales/scan
 *
 * Runs Brücke #3's LLM-detector over all study_synthesis rows in the org
 * and persists pending research-to-risk suggestions (one Opus call per
 * NEW emergent theme above the frequency threshold; dedup on planId +
 * themeTitle keeps repeated scans cheap).
 *
 * Returns the updated list (pending + approved) so the Sales-surface
 * panel refreshes in one round trip.
 *
 * Surface:
 *   401/403  — auth fail
 *   500      — engine threw (Opus unavailable / DB read fail)
 *   200      — { scanned, created, skipped, refused, failed, suggestions }
 */
export async function POST(_request: NextRequest): Promise<NextResponse> {
  const t = await getTranslations("errors");
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;
  const { orgId } = orgOrError;

  try {
    const result = await detectAndPersistResearchRiskSuggestions(orgId);
    const suggestions = await listResearchRiskSuggestions(orgId);
    return NextResponse.json({ ...result, suggestions });
  } catch (err) {
    console.error(
      "[POST /api/bridge/research-to-sales/scan] failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      {
        error: t("bridge.couldNotScanResearchToRisk"),
      },
      { status: 500 },
    );
  }
}
