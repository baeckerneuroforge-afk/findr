/** Lifecycle status of a customer account (CS Health). Manually set. */
export type AccountStatus = "active" | "at_risk" | "churned";

export const ACCOUNT_STATUSES = ["active", "at_risk", "churned"] as const;

/**
 * How an account's value amount (`Account.mrr`) should be interpreted. Not every
 * customer is a subscription — law firms, Mittelstand and project businesses
 * often have a one-time project contract value or a yearly retainer instead of
 * a monthly recurring fee. This is DISPLAY/CONTEXT only — never a health-score
 * input (the health score measures satisfaction, not how the customer pays).
 *  - monthly   — the amount recurs every month (classic MRR)
 *  - yearly    — the amount recurs every year (annual retainer / ACV)
 *  - one_time  — a single project / contract value (no recurrence)
 */
export type AccountValueType = "monthly" | "yearly" | "one_time";

export const ACCOUNT_VALUE_TYPES = ["monthly", "yearly", "one_time"] as const;

/**
 * Computed health level — derived from transcript analysis by the dedicated
 * CS Health classifier (src/lib/health/). Distinct from the manual
 * AccountStatus. Five levels (replaces the legacy 3-level inversion from
 * the risk engine):
 *  - thriving  — happy, expansion signals, clear value
 *  - healthy   — solid, unspectacular, minor friction at most
 *  - lukewarm  — flat, no enthusiasm, no acute event (THIS is what the
 *                old `health = 100 − risk` inversion missed: no risk
 *                signals ≠ healthy)
 *  - at_risk   — strong baseline BUT a sharp acute signal, OR axes alone
 *                in the 25-39 band
 *  - critical  — multiple stacking critical signals, account in immediate
 *                danger
 */
export type HealthLevel =
  | "thriving"
  | "healthy"
  | "lukewarm"
  | "at_risk"
  | "critical";

export const HEALTH_LEVELS = [
  "thriving",
  "healthy",
  "lukewarm",
  "at_risk",
  "critical",
] as const;

/**
 * A customer account — the central CS Health object. It has its own life after a
 * deal is won (its own data stream lands in later sprints). May be born from a
 * won deal (`sourceDealId`) or created manually.
 */
export interface Account {
  id: string;
  companyName: string;
  sponsorName: string | null;
  sponsorEmail: string | null;
  sponsorPhone: string | null;
  /**
   * The account's value amount; null when unknown. Interpreted by `valueType`
   * (monthly recurring / yearly recurring / one-time project value) — kept under
   * the historical `mrr` name to avoid breaking the many existing read sites.
   */
  mrr: number | null;
  /** How to interpret `mrr` (monthly / yearly / one_time). Defaults to monthly. */
  valueType: AccountValueType;
  currency: "USD" | "EUR";
  /** ISO date (YYYY-MM-DD) or null. */
  renewalDate: string | null;
  status: AccountStatus;
  /**
   * When the account transitioned into `churned` (set by the accounts_churned_at
   * DB trigger — migration 20260624000000); null = never churned / legacy row.
   * Read-only here: the trigger owns it. Used as the canonical churn moment by
   * the retention math (src/lib/accounts/retention.ts) and the cs→research bridge.
   */
  churnedAt: string | null;
  /** The won deal this account was created from, if any. */
  sourceDealId: string | null;
  notes: string | null;
  /** Automatic check-in opt-in + cadence (Etappe B). */
  checkinEnabled: boolean;
  checkinIntervalDays: number | null;
  /** When a check-in was last triggered (manual or cron); null = never. */
  lastCheckinAt: string | null;
  createdAt: string;
  updatedAt: string;
}
