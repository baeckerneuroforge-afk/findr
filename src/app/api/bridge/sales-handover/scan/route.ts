import { NextResponse, type NextRequest } from "next/server";

import { requireOrgIdOrError } from "@/lib/auth/org";
import {
  detectAndPersistSalesHandoverSuggestions,
  listSalesHandoverSuggestions,
} from "@/lib/bridge/sales-to-cs";

/**
 * POST /api/bridge/sales-handover/scan
 *
 * Runs Brücke #2's deterministic detector over recently-won deals and
 * persists pending starter-context suggestions for the ones with non-empty
 * mappings. Returns the updated suggestion list so the panel refreshes in
 * one round trip.
 *
 * Surface:
 *   401/403  — auth fail (via requireOrgIdOrError)
 *   500      — engine threw (DB read fail / unexpected exception)
 *   200      — { scanned, created, skipped, clean, failed, suggestions }
 *
 * No-LLM endpoint — explicitly Documented as such so cost-tracking tooling
 * doesn't expect token accounting here. Brücke #1 has its own POST endpoint
 * at /api/bridge/suggestions; we do NOT touch it.
 */
export async function POST(_request: NextRequest): Promise<NextResponse> {
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;
  const { orgId } = orgOrError;

  try {
    const result = await detectAndPersistSalesHandoverSuggestions(orgId);
    const suggestions = await listSalesHandoverSuggestions(orgId);
    return NextResponse.json({ ...result, suggestions });
  } catch (err) {
    console.error(
      "[POST /api/bridge/sales-handover/scan] failed:",
      err instanceof Error ? err.message : err,
    );
    return NextResponse.json(
      {
        error: "Could not scan for sales-handover suggestions",
        detail: err instanceof Error ? err.message : "unknown",
      },
      { status: 500 },
    );
  }
}
