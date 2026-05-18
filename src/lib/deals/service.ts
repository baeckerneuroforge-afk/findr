import "server-only";

import { MOCK_DEALS } from "./mock-data";
import type { Deal } from "./types";

/**
 * Fetch all deals for an org. Mock implementation returns all hardcoded deals
 * regardless of orgId. Replace with Supabase `WHERE org_id = orgId` once
 * the CRM-sync pipeline lands.
 */
export async function getDealsByOrg(_orgId: string): Promise<Deal[]> {
  return MOCK_DEALS;
}

export async function getDealById(dealId: string): Promise<Deal | null> {
  const deals = await getDealsByOrg("mock");
  return deals.find((d) => d.id === dealId) ?? null;
}
