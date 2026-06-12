import { NextResponse, type NextRequest } from "next/server";
import { getTranslations } from "next-intl/server";

import { requireOrgIdOrError } from "@/lib/auth/org";
import {
  detectAndPersistChurnSuggestions,
  listBridgeSuggestions,
} from "@/lib/bridge/cs-to-research";

/**
 * GET  /api/bridge/suggestions — list pending suggestions for the current org.
 * POST /api/bridge/suggestions — run the detector + persist new suggestions.
 *
 * Both share the same path + same auth + org-scope. The POST is a write
 * action (Opus-Call pro neuer Cluster) und steht hinter dem
 * Standard-Auth-Gate — kein Cron, kein public hook.
 *
 * Surface:
 *   401/403  — auth fail (via requireOrgIdOrError)
 *   500      — engine threw (Opus unavailable / DB read fail)
 *   200 GET  — { suggestions: BridgeSuggestion[] }
 *   200 POST — { scanned, created, skipped, failed, suggestions }
 */

export async function GET(_request: NextRequest): Promise<NextResponse> {
  const t = await getTranslations("errors");
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;
  const { orgId } = orgOrError;

  try {
    const suggestions = await listBridgeSuggestions(orgId);
    return NextResponse.json({ suggestions });
  } catch (err) {
    console.error(
      "[GET /api/bridge/suggestions] failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      {
        error: t("bridge.couldNotList"),
      },
      { status: 500 },
    );
  }
}

export async function POST(_request: NextRequest): Promise<NextResponse> {
  const t = await getTranslations("errors");
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;
  const { orgId } = orgOrError;

  try {
    const result = await detectAndPersistChurnSuggestions(orgId);
    // Return the updated suggestions list so the UI can refresh in one
    // round trip rather than chaining a follow-up GET.
    const suggestions = await listBridgeSuggestions(orgId);
    return NextResponse.json({ ...result, suggestions });
  } catch (err) {
    console.error(
      "[POST /api/bridge/suggestions] failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      {
        error: t("bridge.couldNotScan"),
      },
      { status: 500 },
    );
  }
}
