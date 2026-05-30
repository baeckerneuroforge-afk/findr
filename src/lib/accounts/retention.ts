import type { Account, AccountValueType } from "./types";

/**
 * Renewal / Net Revenue Retention — deterministic retention math for CS Health.
 * =============================================================================
 * NO AI, NO model call: pure arithmetic over account values and timestamps. This
 * module is the single source of truth for the retention formula; the DB read
 * lives in `retention-service.ts` and the display in the health overview page.
 *
 * WHAT NRR IS
 * -----------
 * Net Revenue Retention measures how much recurring revenue a COHORT of existing
 * customers keeps over a period, including expansion and net of churn/downgrade:
 *
 *     NRR = (recurring revenue of the cohort at period END)
 *           ───────────────────────────────────────────────
 *           (recurring revenue of the SAME cohort at period START)
 *
 *   · cohort      = accounts that were recurring customers at the period start
 *                   (had a value snapshot on/before periodStart with a positive
 *                   monthly recurring value). New accounts added DURING the period
 *                   are excluded — NRR is an existing-customer metric.
 *   · end value   = the account's recurring value at period end, OR 0 if it
 *                   churned by period end (churned_at <= periodEnd) or flipped to
 *                   one_time. Downgrades lower it; upsells raise it above start.
 *   · > 100%      = expansion outweighed losses; < 100% = net contraction.
 *
 * Gross retention is the same ratio with each account capped at its start value
 * (expansion ignored), so it can never exceed 100% — it isolates pure leakage.
 *
 * ONE-TIME IS EXCLUDED. NRR is a RECURRING-revenue metric. `one_time` accounts
 * (project / contract values — law firms, Mittelstand, project businesses) are
 * not recurring revenue and never enter the cohort or any total here. `value_type`
 * is exactly the discriminator that lets us exclude them cleanly.
 *
 * CHURN comes from `churned_at` (the canonical churn moment), not from a value of
 * 0 — a churned account keeps its last known value on the row, so we read the
 * churn timestamp to zero its END value.
 *
 * HISTORY REQUIRED. A true NRR needs the cohort's value at TWO points in time.
 * Until value history spans a full period, {@link computeNrr} returns
 * `insufficient_history` rather than inventing a number from a single snapshot.
 */

export type Currency = "USD" | "EUR";

/** A single value observation, as recorded in `account_value_snapshots`. */
export interface ValueSnapshot {
  accountId: string;
  /** Raw value amount as captured; null when the amount was unknown. */
  value: number | null;
  valueType: AccountValueType;
  currency: Currency;
  /** ISO timestamp of the observation. */
  capturedAt: string;
}

/**
 * Normalize an account value to a MONTHLY recurring figure.
 *  - one_time      → null  (NOT recurring; excluded from every retention figure)
 *  - yearly        → amount / 12
 *  - monthly       → amount
 *  - null / NaN    → null
 */
export function monthlyRecurringValue(
  amount: number | null,
  valueType: AccountValueType,
): number | null {
  if (amount === null || !Number.isFinite(amount)) return null;
  if (valueType === "one_time") return null;
  if (valueType === "yearly") return amount / 12;
  return amount; // monthly
}

// ── Honest building blocks (computable today, WITHOUT history) ───────────────

export interface RetentionBuildingBlocks {
  /** Monthly recurring revenue of non-churned recurring accounts, per currency. */
  recurringMrrByCurrency: Record<Currency, number>;
  /** Non-churned accounts that carry a recurring value (monthly/yearly, amount set). */
  activeRecurringCount: number;
  /** Churned accounts that were recurring (one_time churns are not counted here). */
  churnedRecurringCount: number;
  /** one_time (project) accounts — excluded from retention, surfaced for context. */
  oneTimeCount: number;
  /** Recurring accounts churned within the trailing window (default 90 days). */
  churnedInWindow: number;
  /**
   * Trailing logical churn rate: churnedInWindow / (activeRecurringCount +
   * churnedInWindow). Without history, (active now + recently churned) is the best
   * available proxy for "active at the window's start". 0 when the denominator is 0.
   */
  trailingChurnRate: number;
  /** Total accounts considered (all value types). */
  totalAccounts: number;
}

const WINDOW_DAYS_DEFAULT = 90;

function isRecurringType(valueType: AccountValueType): boolean {
  return valueType !== "one_time";
}

/**
 * Roll up the honest, history-free building blocks from the current account set.
 * Deterministic; `now` is injected so the result is testable.
 */
export function computeBuildingBlocks(
  accounts: Account[],
  now: Date,
  windowDays: number = WINDOW_DAYS_DEFAULT,
): RetentionBuildingBlocks {
  const recurringMrrByCurrency: Record<Currency, number> = { USD: 0, EUR: 0 };
  let activeRecurringCount = 0;
  let churnedRecurringCount = 0;
  let oneTimeCount = 0;
  let churnedInWindow = 0;

  const windowStart = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);

  for (const a of accounts) {
    if (!isRecurringType(a.valueType)) {
      oneTimeCount += 1;
      continue;
    }

    const churned = a.status === "churned";
    if (churned) {
      churnedRecurringCount += 1;
      if (a.churnedAt) {
        const churnedAt = new Date(a.churnedAt);
        if (!Number.isNaN(churnedAt.getTime()) && churnedAt >= windowStart) {
          churnedInWindow += 1;
        }
      }
      continue;
    }

    // Non-churned recurring account: contributes to active count + MRR.
    const mrr = monthlyRecurringValue(a.mrr, a.valueType);
    if (mrr !== null) {
      activeRecurringCount += 1;
      recurringMrrByCurrency[a.currency] += mrr;
    }
  }

  const churnDenom = activeRecurringCount + churnedInWindow;
  const trailingChurnRate = churnDenom === 0 ? 0 : churnedInWindow / churnDenom;

  return {
    recurringMrrByCurrency,
    activeRecurringCount,
    churnedRecurringCount,
    oneTimeCount,
    churnedInWindow,
    trailingChurnRate,
    totalAccounts: accounts.length,
  };
}

// ── True NRR (needs value history spanning a period) ────────────────────────

/** Per-currency NRR result for one cohort. */
export interface NrrBucket {
  currency: Currency;
  /** Cohort recurring MRR at period start. */
  startMrr: number;
  /** Cohort recurring MRR at period end (churned → 0). */
  endMrr: number;
  /** endMrr / startMrr. */
  nrr: number;
  /** Σ min(start, end) per account ÷ startMrr — expansion removed, ≤ 1. */
  grossRetention: number;
  /** Number of accounts in the cohort. */
  cohortSize: number;
}

export type NrrSummary =
  | {
      status: "insufficient_history";
      /** ISO date when a full period of history will first exist, or null. */
      availableFrom: string | null;
    }
  | {
      status: "ok";
      periodStart: string;
      periodEnd: string;
      periodMonths: number;
      /** Headline bucket = the currency with the largest start MRR. */
      primary: NrrBucket;
      /** All currency buckets with a cohort. */
      byCurrency: NrrBucket[];
    };

/**
 * Add `months` to a date in UTC (negative subtracts). Uses setUTCMonth so the
 * result is host-timezone-independent — consistent with the UTC/ISO arithmetic
 * everywhere else in this module. Day-of-month overflow rolls FORWARD (e.g.
 * Feb 29 − 12mo → Mar 1); it does NOT clamp. That is immaterial for the
 * whole-month NRR periods used here.
 */
function addMonths(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

/** Latest snapshot for an account with capturedAt <= at (snaps must be pre-sorted ascending). */
function snapshotAsOf(
  sorted: ValueSnapshot[],
  at: Date,
): ValueSnapshot | null {
  let found: ValueSnapshot | null = null;
  for (const s of sorted) {
    if (new Date(s.capturedAt).getTime() <= at.getTime()) found = s;
    else break;
  }
  return found;
}

/**
 * Compute Net Revenue Retention for the trailing `periodMonths` ending at
 * `periodEnd`, from value snapshots + the current accounts (for churn status).
 *
 * Returns `insufficient_history` when no account has a snapshot at/before the
 * period start — i.e. the history does not yet span a full period — together with
 * the date a full period will first be available (earliest snapshot + period).
 */
export function computeNrr(
  snapshots: ValueSnapshot[],
  accounts: Account[],
  periodEnd: Date,
  periodMonths: number = 12,
): NrrSummary {
  if (snapshots.length === 0) {
    return { status: "insufficient_history", availableFrom: null };
  }

  const periodStart = addMonths(periodEnd, -periodMonths);

  // Group snapshots per account, sorted ascending by capturedAt.
  const byAccount = new Map<string, ValueSnapshot[]>();
  let earliest = Number.POSITIVE_INFINITY;
  for (const s of snapshots) {
    const list = byAccount.get(s.accountId) ?? [];
    list.push(s);
    byAccount.set(s.accountId, list);
    const t = new Date(s.capturedAt).getTime();
    if (!Number.isNaN(t) && t < earliest) earliest = t;
  }
  for (const list of byAccount.values()) {
    list.sort(
      (a, b) =>
        new Date(a.capturedAt).getTime() - new Date(b.capturedAt).getTime(),
    );
  }

  const churnedAtById = new Map<string, Date | null>();
  for (const a of accounts) {
    churnedAtById.set(
      a.id,
      a.churnedAt ? new Date(a.churnedAt) : null,
    );
  }

  // Accumulate per currency.
  const buckets = new Map<
    Currency,
    { startMrr: number; endMrr: number; gross: number; cohortSize: number }
  >();
  let cohortFound = false;

  for (const [accountId, snaps] of byAccount) {
    const startSnap = snapshotAsOf(snaps, periodStart);
    if (!startSnap) continue; // not observed at period start → not in cohort
    const startVal = monthlyRecurringValue(startSnap.value, startSnap.valueType);
    if (startVal === null || startVal <= 0) continue; // wasn't recurring at start

    const currency = startSnap.currency;

    // End value: 0 if churned by period end; else the latest snapshot <= periodEnd.
    let endVal = 0;
    const churnedAt = churnedAtById.get(accountId) ?? null;
    const churnedByEnd =
      churnedAt !== null &&
      !Number.isNaN(churnedAt.getTime()) &&
      churnedAt.getTime() <= periodEnd.getTime();
    if (!churnedByEnd) {
      const endSnap = snapshotAsOf(snaps, periodEnd);
      if (endSnap && endSnap.currency !== currency) {
        // Currency reclassified mid-period — start and end are in different
        // units and we have no FX rate. Exclude the account from the cohort
        // entirely rather than summing (say) a USD figure into the EUR bucket.
        continue;
      }
      endVal = endSnap
        ? monthlyRecurringValue(endSnap.value, endSnap.valueType) ?? 0
        : 0;
    }

    cohortFound = true;
    const b = buckets.get(currency) ?? {
      startMrr: 0,
      endMrr: 0,
      gross: 0,
      cohortSize: 0,
    };
    b.startMrr += startVal;
    b.endMrr += endVal;
    b.gross += Math.min(startVal, endVal);
    b.cohortSize += 1;
    buckets.set(currency, b);
  }

  if (!cohortFound) {
    // availableFrom = when a full period of history will FIRST exist. It is only
    // meaningful as a FUTURE date: if a full period already exists (candidate <=
    // periodEnd) the real cause is "no recurring cohort qualified", not "history
    // too short" — so omit the date rather than render a contradictory past one.
    let availableFrom: string | null = null;
    if (Number.isFinite(earliest)) {
      const candidate = addMonths(new Date(earliest), periodMonths);
      if (candidate.getTime() > periodEnd.getTime()) {
        availableFrom = candidate.toISOString();
      }
    }
    return { status: "insufficient_history", availableFrom };
  }

  const byCurrency: NrrBucket[] = Array.from(buckets.entries())
    .map(([currency, b]) => ({
      currency,
      startMrr: b.startMrr,
      endMrr: b.endMrr,
      nrr: b.startMrr > 0 ? b.endMrr / b.startMrr : 0,
      grossRetention: b.startMrr > 0 ? b.gross / b.startMrr : 0,
      cohortSize: b.cohortSize,
    }))
    .sort((a, b) => b.startMrr - a.startMrr);

  return {
    status: "ok",
    periodStart: periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    periodMonths,
    primary: byCurrency[0],
    byCurrency,
  };
}
