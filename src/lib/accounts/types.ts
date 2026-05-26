/** Lifecycle status of a customer account (CS Health). Manually set. */
export type AccountStatus = "active" | "at_risk" | "churned";

export const ACCOUNT_STATUSES = ["active", "at_risk", "churned"] as const;

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
  /** Monthly recurring revenue; null when unknown. */
  mrr: number | null;
  currency: "USD" | "EUR";
  /** ISO date (YYYY-MM-DD) or null. */
  renewalDate: string | null;
  status: AccountStatus;
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
