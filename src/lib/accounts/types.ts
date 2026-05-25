/** Lifecycle status of a customer account (CS Health). */
export type AccountStatus = "active" | "at_risk" | "churned";

export const ACCOUNT_STATUSES = ["active", "at_risk", "churned"] as const;

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
  createdAt: string;
  updatedAt: string;
}
