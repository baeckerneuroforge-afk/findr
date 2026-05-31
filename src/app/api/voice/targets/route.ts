import { NextResponse, type NextRequest } from "next/server";

import { requireOrgIdFromBearer } from "@/lib/auth/voice-token";
import { getAccounts } from "@/lib/accounts/service";
import { getDealsByOrg } from "@/lib/deals/service";
import { listResearchPlans } from "@/lib/research/plans-service";

/**
 * GET /api/voice/targets — schlanke Zuordnungs-Ziele für die Pre-Call-Dropdowns
 * (Desktop) und die Posteingang-Assign-Action: Accounts, Deals, Research-Plans
 * der Org in EINEM Call. Wiederverwendung der bestehenden org-gescopten Loader;
 * Bearer-Auth wie die übrigen Voice-Routes.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  const orgOrError = await requireOrgIdFromBearer(request);
  if ("error" in orgOrError) return orgOrError.error;
  const { orgId } = orgOrError;

  const [accounts, deals, plans] = await Promise.all([
    getAccounts(orgId),
    getDealsByOrg(orgId),
    listResearchPlans(orgId),
  ]);

  return NextResponse.json({
    success: true,
    // kind-Tags spiegeln das Assignment-Schema, damit der Client direkt eine
    // gültige assignment-Variante bauen kann.
    accounts: accounts.map((a) => ({
      kind: "existing_customer" as const,
      id: a.id,
      label: a.companyName,
      status: a.status,
    })),
    deals: deals.map((d) => ({
      kind: "sales_call" as const,
      id: d.id,
      label: d.name,
      companyName: d.companyName,
      stage: d.stage,
    })),
    plans: plans.map((p) => ({
      kind: "discovery" as const,
      id: p.id,
      label: p.title,
      status: p.status,
    })),
  });
}
