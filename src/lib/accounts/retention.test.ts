import { describe, expect, it } from "vitest";

import type { Account, AccountStatus, AccountValueType } from "./types";
import {
  computeBuildingBlocks,
  computeNrr,
  monthlyRecurringValue,
  type ValueSnapshot,
} from "./retention";

// ── Fixtures ────────────────────────────────────────────────────────────────

const NOW = new Date("2026-06-01T00:00:00.000Z");

let seq = 0;
function account(partial: Partial<Account> = {}): Account {
  seq += 1;
  return {
    id: partial.id ?? `acc_${seq}`,
    companyName: "Acme",
    sponsorName: null,
    sponsorEmail: null,
    sponsorPhone: null,
    mrr: 100,
    valueType: "monthly",
    currency: "EUR",
    renewalDate: null,
    status: "active",
    churnedAt: null,
    sourceDealId: null,
    notes: null,
    checkinEnabled: false,
    checkinIntervalDays: null,
    lastCheckinAt: null,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    ...partial,
  };
}

function snap(
  accountId: string,
  value: number | null,
  capturedAt: string,
  valueType: AccountValueType = "monthly",
  currency: "USD" | "EUR" = "EUR",
): ValueSnapshot {
  return { accountId, value, valueType, currency, capturedAt };
}

// ── monthlyRecurringValue ───────────────────────────────────────────────────

describe("monthlyRecurringValue", () => {
  it("passes monthly through unchanged", () => {
    expect(monthlyRecurringValue(100, "monthly")).toBe(100);
  });
  it("divides yearly by 12", () => {
    expect(monthlyRecurringValue(1200, "yearly")).toBe(100);
  });
  it("excludes one_time (not recurring)", () => {
    expect(monthlyRecurringValue(9999, "one_time")).toBeNull();
  });
  it("returns null for an unknown amount", () => {
    expect(monthlyRecurringValue(null, "monthly")).toBeNull();
  });
});

// ── Building blocks (history-free) ──────────────────────────────────────────

describe("computeBuildingBlocks", () => {
  it("sums recurring MRR per currency, normalizing yearly and excluding one_time", () => {
    const accounts = [
      account({ mrr: 100, valueType: "monthly", currency: "EUR" }),
      account({ mrr: 1200, valueType: "yearly", currency: "EUR" }), // → 100/mo
      account({ mrr: 50, valueType: "monthly", currency: "USD" }),
      account({ mrr: 99999, valueType: "one_time", currency: "EUR" }), // excluded
    ];
    const b = computeBuildingBlocks(accounts, NOW);
    expect(b.recurringMrrByCurrency.EUR).toBe(200);
    expect(b.recurringMrrByCurrency.USD).toBe(50);
    expect(b.activeRecurringCount).toBe(3);
    expect(b.oneTimeCount).toBe(1);
    expect(b.totalAccounts).toBe(4);
  });

  it("counts a churned account as churn, not active MRR", () => {
    const accounts = [
      account({ mrr: 100, status: "active" }),
      account({
        mrr: 100,
        status: "churned",
        churnedAt: "2026-05-20T00:00:00.000Z", // within 90d of NOW
      }),
    ];
    const b = computeBuildingBlocks(accounts, NOW);
    expect(b.activeRecurringCount).toBe(1);
    expect(b.recurringMrrByCurrency.EUR).toBe(100);
    expect(b.churnedRecurringCount).toBe(1);
    expect(b.churnedInWindow).toBe(1);
    // 1 churned / (1 active + 1 churned) = 0.5
    expect(b.trailingChurnRate).toBeCloseTo(0.5, 5);
  });

  it("ignores churns older than the trailing window", () => {
    const accounts = [
      account({ mrr: 100, status: "active" }),
      account({
        mrr: 100,
        status: "churned",
        churnedAt: "2026-01-01T00:00:00.000Z", // > 90d before NOW
      }),
    ];
    const b = computeBuildingBlocks(accounts, NOW);
    expect(b.churnedInWindow).toBe(0);
    expect(b.trailingChurnRate).toBe(0);
  });

  it("a one_time account never counts as churn even when status=churned", () => {
    const accounts = [
      account({
        mrr: 5000,
        valueType: "one_time",
        status: "churned",
        churnedAt: "2026-05-20T00:00:00.000Z",
      }),
    ];
    const b = computeBuildingBlocks(accounts, NOW);
    expect(b.oneTimeCount).toBe(1);
    expect(b.churnedRecurringCount).toBe(0);
    expect(b.churnedInWindow).toBe(0);
  });
});

// ── NRR ─────────────────────────────────────────────────────────────────────

describe("computeNrr", () => {
  it("returns insufficient_history with no snapshots", () => {
    const res = computeNrr([], [account()], NOW, 12);
    expect(res.status).toBe("insufficient_history");
  });

  it("returns insufficient_history when history does not span a full period", () => {
    // Only a recent snapshot (3 months ago) — no observation 12 months back.
    const a = account({ id: "a1" });
    const res = computeNrr(
      [snap("a1", 100, "2026-03-01T00:00:00.000Z")],
      [a],
      NOW,
      12,
    );
    expect(res.status).toBe("insufficient_history");
    if (res.status === "insufficient_history") {
      // earliest snapshot (2026-03-01) + 12 months
      expect(res.availableFrom).toBe("2027-03-01T00:00:00.000Z");
    }
  });

  it("computes flat 100% NRR when the cohort value is unchanged", () => {
    const a = account({ id: "a1" });
    const res = computeNrr(
      [snap("a1", 100, "2025-01-01T00:00:00.000Z")],
      [a],
      NOW,
      12,
    );
    expect(res.status).toBe("ok");
    if (res.status === "ok") {
      expect(res.primary.nrr).toBeCloseTo(1, 5);
      expect(res.primary.grossRetention).toBeCloseTo(1, 5);
      expect(res.primary.cohortSize).toBe(1);
    }
  });

  it("reflects expansion above 100% and caps gross retention at 100%", () => {
    const a = account({ id: "a1", mrr: 150 });
    const res = computeNrr(
      [
        snap("a1", 100, "2025-01-01T00:00:00.000Z"), // start
        snap("a1", 150, "2026-04-01T00:00:00.000Z"), // upsell within period
      ],
      [a],
      NOW,
      12,
    );
    expect(res.status).toBe("ok");
    if (res.status === "ok") {
      expect(res.primary.nrr).toBeCloseTo(1.5, 5);
      expect(res.primary.grossRetention).toBeCloseTo(1, 5); // expansion removed
    }
  });

  it("counts a churned account as 0 end value (churned_at within period)", () => {
    const kept = account({ id: "keep", mrr: 100 });
    const lost = account({
      id: "lost",
      mrr: 100,
      status: "churned",
      churnedAt: "2026-04-01T00:00:00.000Z",
    });
    const res = computeNrr(
      [
        snap("keep", 100, "2025-01-01T00:00:00.000Z"),
        snap("lost", 100, "2025-01-01T00:00:00.000Z"),
      ],
      [kept, lost],
      NOW,
      12,
    );
    expect(res.status).toBe("ok");
    if (res.status === "ok") {
      // start = 200, end = 100 (lost → 0) → 50%
      expect(res.primary.startMrr).toBe(200);
      expect(res.primary.endMrr).toBe(100);
      expect(res.primary.nrr).toBeCloseTo(0.5, 5);
      expect(res.primary.cohortSize).toBe(2);
    }
  });

  it("excludes one_time accounts from the cohort entirely", () => {
    const recurring = account({ id: "rec", mrr: 100 });
    const project = account({ id: "proj", mrr: 5000, valueType: "one_time" });
    const res = computeNrr(
      [
        snap("rec", 100, "2025-01-01T00:00:00.000Z"),
        snap("proj", 5000, "2025-01-01T00:00:00.000Z", "one_time"),
      ],
      [recurring, project],
      NOW,
      12,
    );
    expect(res.status).toBe("ok");
    if (res.status === "ok") {
      expect(res.primary.cohortSize).toBe(1); // only the recurring account
      expect(res.primary.startMrr).toBe(100);
    }
  });

  it("excludes accounts added DURING the period (no start observation)", () => {
    const existing = account({ id: "old", mrr: 100 });
    const fresh = account({ id: "new", mrr: 100 });
    const res = computeNrr(
      [
        snap("old", 100, "2025-01-01T00:00:00.000Z"), // before period start
        snap("new", 100, "2026-04-01T00:00:00.000Z"), // added mid-period
      ],
      [existing, fresh],
      NOW,
      12,
    );
    expect(res.status).toBe("ok");
    if (res.status === "ok") {
      expect(res.primary.cohortSize).toBe(1); // only the pre-existing account
    }
  });

  it("excludes an account whose currency changed mid-period (no FX mixing)", () => {
    const flipped = account({ id: "flip", mrr: 120, currency: "USD" });
    const stable = account({ id: "stable", mrr: 100, currency: "EUR" });
    const res = computeNrr(
      [
        snap("flip", 100, "2025-01-01T00:00:00.000Z", "monthly", "EUR"), // start EUR
        snap("flip", 120, "2026-04-01T00:00:00.000Z", "monthly", "USD"), // flipped USD
        snap("stable", 100, "2025-01-01T00:00:00.000Z", "monthly", "EUR"),
      ],
      [flipped, stable],
      NOW,
      12,
    );
    expect(res.status).toBe("ok");
    if (res.status === "ok") {
      // The flipped account is dropped entirely; only the stable EUR one remains.
      expect(res.byCurrency).toHaveLength(1);
      expect(res.primary.currency).toBe("EUR");
      expect(res.primary.cohortSize).toBe(1);
      expect(res.primary.startMrr).toBe(100);
      expect(res.primary.endMrr).toBe(100);
    }
  });

  it("omits a past availableFrom when history is old but no recurring cohort qualifies", () => {
    // A pure project-business org: only one_time snapshots, older than the period.
    const project = account({ id: "proj", mrr: 5000, valueType: "one_time" });
    const res = computeNrr(
      [snap("proj", 5000, "2024-01-01T00:00:00.000Z", "one_time")],
      [project],
      NOW,
      12,
    );
    expect(res.status).toBe("insufficient_history");
    if (res.status === "insufficient_history") {
      // earliest (2024-01-01) + 12mo = 2025-01-01 is PAST relative to NOW
      // (2026-06-01) → not a meaningful "available from" date → null.
      expect(res.availableFrom).toBeNull();
    }
  });
});
