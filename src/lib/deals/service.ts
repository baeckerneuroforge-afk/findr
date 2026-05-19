import "server-only";

import { MOCK_DEALS } from "./mock-data";
import type { Deal } from "./types";

/**
 * Fetch all deals for an org.
 *
 * Current implementation: returns hardcoded MOCK_DEALS regardless of orgId.
 * The orgId is accepted on the signature so callers stay correct once a real
 * CRM-sync replaces the mock. Until then, every org sees the same demo data.
 *
 * TODO: replace with `supabase.from('deals').select('*').eq('org_id', orgId)`
 * once CRM-sync lands.
 */
export async function getDealsByOrg(_orgId: string): Promise<Deal[]> {
  return MOCK_DEALS;
}

export async function getDealById(
  orgId: string,
  dealId: string,
): Promise<Deal | null> {
  const deals = await getDealsByOrg(orgId);
  return deals.find((d) => d.id === dealId) ?? null;
}
