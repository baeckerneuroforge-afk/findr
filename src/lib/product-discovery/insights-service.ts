import "server-only";

import type { ProductDiscoveryResult } from "@/lib/schemas/product-discovery";

/**
 * Read-side service for Phase 3 Product Discovery insights. The persistence
 * table (`product_discovery_insights`) and the writer that runs the classifier
 * on each call are built in a sibling worktree. This file declares the SHAPE
 * the read side is built against:
 *
 *   - one record PER CALL (the latest analysis for that call — re-runs are
 *     idempotent, so in practice there is exactly one row per call_id)
 *   - source_kind + source_label are pre-joined: the writer denormalizes the
 *     parent Deal.name / Account.companyName onto the row so the rollup page
 *     can render without an extra round-trip
 *
 * The Phase-3-Persistenz worktree will replace the stub `getLatestProductDiscoveryInsights`
 * implementation with the real Supabase query — the signature above is the
 * contract. The rollup page imports against THIS file and stays untouched.
 */

export interface ProductDiscoveryInsightRecord {
  id: string;
  org_id: string;
  call_id: string;
  /** Set when the call belongs to a pre-sale deal. */
  deal_id: string | null;
  /** Set when the call belongs to a post-sale account. */
  account_id: string | null;
  /** Either "deal" or "account" — drives the link target on the rollup page. */
  source_kind: "deal" | "account";
  /** Pre-joined Account.companyName / Deal.name. Saves the page an N+1 fan-out. */
  source_label: string;
  analyzed_at: string;
  result: ProductDiscoveryResult;
}

/**
 * Latest Product Discovery insight per call across the org.
 *
 * Stub implementation: returns `[]` so the rollup page renders its empty
 * state. The Phase-3-Persistenz worktree replaces the body with a real query
 * against `product_discovery_insights` (latest-per-call_id, ordered by
 * analyzed_at desc, pre-joined with deals.name / accounts.company_name).
 */
export async function getLatestProductDiscoveryInsights(
  _orgId: string,
): Promise<ProductDiscoveryInsightRecord[]> {
  return [];
}
