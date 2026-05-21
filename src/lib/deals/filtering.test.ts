import { describe, expect, it } from "vitest";
import {
  applyDealFilters,
  DEFAULT_DEAL_FILTERS,
  hasActiveDealFilters,
  type DashboardDealRow,
  type DealFilterState,
} from "@/lib/deals/filtering";

const DEALS: DashboardDealRow[] = [
  {
    id: "deal_1",
    name: "Nordbank Enterprise",
    companyName: "Nordbank AG",
    currency: "EUR",
    stage: "negotiation",
    ownerName: "Sarah Mueller",
    amount: 120_000,
    daysSinceLastActivity: 3,
    riskScore: 84,
    riskLevel: "critical",
    winProbability: 28,
  },
  {
    id: "deal_2",
    name: "MunichSoft Expansion",
    companyName: "MunichSoft GmbH",
    currency: "EUR",
    stage: "proposal_sent",
    ownerName: "Mike Johnson",
    amount: 45_000,
    daysSinceLastActivity: 18,
    riskScore: 64,
    riskLevel: "high",
    winProbability: 34,
  },
  {
    id: "deal_3",
    name: "Lattix Renewal",
    companyName: "Lattix SE",
    currency: "EUR",
    stage: "verbal_commit",
    ownerName: "Sarah Mueller",
    amount: 30_000,
    daysSinceLastActivity: 1,
    riskScore: 18,
    riskLevel: "low",
    winProbability: 81,
  },
  {
    id: "deal_4",
    name: "CloudCommerce Pilot",
    companyName: "CloudCommerce GmbH",
    currency: "EUR",
    stage: "demo",
    ownerName: "Aylin Demir",
    amount: 70_000,
    daysSinceLastActivity: 9,
    riskScore: 52,
    riskLevel: "medium",
    winProbability: 29,
  },
  {
    id: "deal_5",
    name: "Helven Discovery",
    companyName: "Helven Systems",
    currency: "EUR",
    stage: "qualified",
    ownerName: "Aylin Demir",
    amount: 15_000,
    daysSinceLastActivity: 40,
    winProbability: 10,
  },
];

function filters(
  overrides: Partial<DealFilterState> = {},
): DealFilterState {
  return { ...DEFAULT_DEAL_FILTERS, ...overrides };
}

describe("applyDealFilters", () => {
  it("searches by deal name", () => {
    const result = applyDealFilters(DEALS, filters({ search: "nord" }));

    expect(result.map((deal) => deal.id)).toEqual(["deal_1"]);
  });

  it("searches by company", () => {
    const result = applyDealFilters(DEALS, filters({ search: "lattix" }));

    expect(result.map((deal) => deal.id)).toEqual(["deal_3"]);
  });

  it("searches by owner", () => {
    const result = applyDealFilters(DEALS, filters({ search: "mike" }));

    expect(result.map((deal) => deal.id)).toEqual(["deal_2"]);
  });

  it("filters by stage", () => {
    const result = applyDealFilters(DEALS, filters({ stage: "demo" }));

    expect(result.map((deal) => deal.id)).toEqual(["deal_4"]);
  });

  it("filters critical risk as 80+", () => {
    const result = applyDealFilters(DEALS, filters({ risk: "critical" }));

    expect(result.map((deal) => deal.id)).toEqual(["deal_1"]);
  });

  it("filters high risk as 60-79", () => {
    const result = applyDealFilters(DEALS, filters({ risk: "high" }));

    expect(result.map((deal) => deal.id)).toEqual(["deal_2"]);
  });

  it("filters medium risk as 35-59", () => {
    const result = applyDealFilters(DEALS, filters({ risk: "medium" }));

    expect(result.map((deal) => deal.id)).toEqual(["deal_4"]);
  });

  it("filters low risk without including unanalyzed deals", () => {
    const result = applyDealFilters(DEALS, filters({ risk: "low" }));

    expect(result.map((deal) => deal.id)).toEqual(["deal_3"]);
  });

  it("filters unanalyzed deals", () => {
    const result = applyDealFilters(DEALS, filters({ risk: "unanalyzed" }));

    expect(result.map((deal) => deal.id)).toEqual(["deal_5"]);
  });

  it("filters by owner", () => {
    const result = applyDealFilters(DEALS, filters({ owner: "Aylin Demir" }));

    expect(result.map((deal) => deal.id)).toEqual(["deal_4", "deal_5"]);
  });

  it("combines multiple filters", () => {
    const result = applyDealFilters(
      DEALS,
      filters({
        search: "cloud",
        owner: "Aylin Demir",
        risk: "medium",
        stage: "demo",
      }),
    );

    expect(result.map((deal) => deal.id)).toEqual(["deal_4"]);
  });

  it("sorts by amount ascending and descending", () => {
    const asc = applyDealFilters(
      DEALS,
      filters({ sortBy: "amount", sortDir: "asc" }),
    );
    const desc = applyDealFilters(
      DEALS,
      filters({ sortBy: "amount", sortDir: "desc" }),
    );

    expect(asc.map((deal) => deal.id)).toEqual([
      "deal_5",
      "deal_3",
      "deal_2",
      "deal_4",
      "deal_1",
    ]);
    expect(desc.map((deal) => deal.id)).toEqual([
      "deal_1",
      "deal_4",
      "deal_2",
      "deal_3",
      "deal_5",
    ]);
  });

  it("sorts by risk with unanalyzed deals last in descending order", () => {
    const result = applyDealFilters(
      DEALS,
      filters({ sortBy: "risk", sortDir: "desc" }),
    );

    expect(result.map((deal) => deal.id)).toEqual([
      "deal_1",
      "deal_2",
      "deal_4",
      "deal_3",
      "deal_5",
    ]);
  });

  it("sorts by name", () => {
    const result = applyDealFilters(
      DEALS,
      filters({ sortBy: "name", sortDir: "asc" }),
    );

    expect(result.map((deal) => deal.id)).toEqual([
      "deal_4",
      "deal_5",
      "deal_3",
      "deal_2",
      "deal_1",
    ]);
  });

  it("sorts by last activity age", () => {
    const result = applyDealFilters(
      DEALS,
      filters({ sortBy: "activity", sortDir: "asc" }),
    );

    expect(result.map((deal) => deal.id)).toEqual([
      "deal_3",
      "deal_1",
      "deal_4",
      "deal_2",
      "deal_5",
    ]);
  });

  it("sorts by win probability", () => {
    const result = applyDealFilters(
      DEALS,
      filters({ sortBy: "win_probability", sortDir: "desc" }),
    );

    expect(result.map((deal) => deal.id)).toEqual([
      "deal_3",
      "deal_2",
      "deal_4",
      "deal_1",
      "deal_5",
    ]);
  });

  it("returns an empty result when no deal matches", () => {
    const result = applyDealFilters(DEALS, filters({ search: "does-not-exist" }));

    expect(result).toEqual([]);
  });
});

describe("hasActiveDealFilters", () => {
  it("detects inactive default filters", () => {
    expect(hasActiveDealFilters(DEFAULT_DEAL_FILTERS)).toBe(false);
  });

  it("detects active filters and reset-to-default behavior", () => {
    const active = filters({ search: "nord", risk: "critical" });

    expect(hasActiveDealFilters(active)).toBe(true);
    expect(hasActiveDealFilters(DEFAULT_DEAL_FILTERS)).toBe(false);
  });
});
