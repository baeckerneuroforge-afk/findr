import { NextResponse } from "next/server";

import { requireOrgIdOrError } from "@/lib/auth/org";
import { getDealsByOrg } from "@/lib/deals/service";
import { getAccounts } from "@/lib/accounts/service";
import type { SearchIndex } from "@/lib/search/types";

/**
 * GET /api/search/index — hydrate the Cmd+K palette with the org's deals
 * and accounts. Returns a lean shape (`SearchIndex` in src/lib/search/
 * types.ts) — only id + display fields + the single context label per row.
 *
 * Auth gate is mandatory: requireOrgIdOrError() short-circuits to 401/403
 * via the standard auth-helper pattern. Both downstream service calls are
 * already org-scoped, so the palette is structurally incapable of leaking
 * cross-org data (RLS plus explicit `.eq("org_id", orgId)` filters in the
 * services).
 *
 * Hydration is one-shot per palette session (lazy on first open) — see
 * src/components/search/CommandPalette.tsx. There is no per-keystroke
 * server hit; the client filters the snapshot in memory.
 */
export async function GET(): Promise<NextResponse> {
  const orgOrError = await requireOrgIdOrError();
  if ("error" in orgOrError) return orgOrError.error;
  const { orgId } = orgOrError;

  const [deals, accounts] = await Promise.all([
    getDealsByOrg(orgId),
    getAccounts(orgId),
  ]);

  const payload: SearchIndex = {
    deals: deals.map((d) => ({
      id: d.id,
      name: d.name,
      companyName: d.companyName,
      stage: d.stage,
    })),
    accounts: accounts.map((a) => ({
      id: a.id,
      companyName: a.companyName,
      sponsorName: a.sponsorName,
      status: a.status,
    })),
  };

  return NextResponse.json(payload);
}
