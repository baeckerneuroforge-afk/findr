/** Lifecycle status of a customer account (CS Health). Manually set. */
export type AccountStatus = "active" | "at_risk" | "churned";

export const ACCOUNT_STATUSES = ["active", "at_risk", "churned"] as const;

/**
 * Computed health level (inverse of churn risk; high health = good). Distinct
 * from the manual AccountStatus — this one is derived from transcript analysis.
 */
export type HealthLevel = "healthy" | "at_risk" | "critical";

export const HEALTH_LEVELS = ["healthy", "at_risk", "critical"] as const;

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
