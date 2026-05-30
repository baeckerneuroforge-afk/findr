import "server-only";

import { createAdminSupabaseClient } from "@/lib/supabase/server";
import type { Account, AccountValueType } from "./types";
import {
  computeBuildingBlocks,
  computeNrr,
  type NrrSummary,
  type RetentionBuildingBlocks,
  type ValueSnapshot,
} from "./retention";

/**
 * Retention read layer — assembles the deterministic retention figures for the
 * CS-Health overview. NO AI. Combines:
 *   · honest building blocks (computed from the CURRENT accounts — always works)
 *   · true NRR from `account_value_snapshots` (real once history spans a period)
 *
 * Robust to the migration not being applied yet: if the snapshots table does not
 * exist (or the read errors for any reason), we degrade to an empty snapshot set,
 * and `computeNrr` returns `insufficient_history`. The building blocks still
 * render. This mirrors the churned_at "null fail-safe" philosophy.
 */

export interface RetentionSummary {
  blocks: RetentionBuildingBlocks;
  nrr: NrrSummary;
  /** Trailing window the NRR period spans, in months (for the UI caption). */
  periodMonths: number;
}

const NRR_PERIOD_MONTHS = 12;

/** Narrow the free-text DB column to the value-type union (fallback "monthly"). */
function toValueType(value: string | null): AccountValueType {
  return value === "yearly" || value === "one_time" ? value : "monthly";
}

async function fetchValueSnapshots(orgId: string): Promise<ValueSnapshot[]> {
  try {
    const supabase = createAdminSupabaseClient();
    const { data, error } = await supabase
      .from("account_value_snapshots")
      .select("account_id, value, value_type, currency, captured_at")
      .eq("org_id", orgId)
      .order("captured_at", { ascending: true })
      .limit(50000);

    if (error || !data) return [];
    return data.map((r) => ({
      accountId: r.account_id,
      value: r.value,
      valueType: toValueType(r.value_type),
      currency: r.currency === "USD" ? "USD" : "EUR",
      capturedAt: r.captured_at,
    }));
  } catch {
    // Table absent (migration not applied) or any transport error → no history.
    return [];
  }
}

/**
 * Build the retention summary for an org. `accounts` is passed in (the overview
 * page already fetched it) to avoid a second read.
 */
export async function getRetentionSummary(
  orgId: string,
  accounts: Account[],
): Promise<RetentionSummary> {
  const now = new Date();
  const blocks = computeBuildingBlocks(accounts, now);
  const snapshots = await fetchValueSnapshots(orgId);
  const nrr = computeNrr(snapshots, accounts, now, NRR_PERIOD_MONTHS);
  return { blocks, nrr, periodMonths: NRR_PERIOD_MONTHS };
}
