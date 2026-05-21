import type { DealStage, RiskLevel } from "@/lib/deals/types";

export type DealRiskFilter =
  | "all"
  | RiskLevel
  | "unanalyzed";

export type DealSortKey =
  | "name"
  | "amount"
  | "risk"
  | "activity"
  | "win_probability";

export type SortDirection = "asc" | "desc";

export interface DashboardDealRow {
  id: string;
  name: string;
  companyName: string;
  currency: "USD" | "EUR";
  stage: DealStage;
  ownerName: string;
  amount: number;
  daysSinceLastActivity: number;
  riskScore?: number;
  riskLevel?: RiskLevel;
  winProbability?: number;
}

export interface DealFilterState {
  search: string;
  stage: DealStage | "all";
  risk: DealRiskFilter;
  owner: string;
  sortBy: DealSortKey;
  sortDir: SortDirection;
}

export const DEFAULT_DEAL_FILTERS: DealFilterState = {
  search: "",
  stage: "all",
  risk: "all",
  owner: "all",
  sortBy: "amount",
  sortDir: "desc",
};

export function hasActiveDealFilters(filters: DealFilterState): boolean {
  return (
    filters.search.trim() !== "" ||
    filters.stage !== "all" ||
    filters.risk !== "all" ||
    filters.owner !== "all"
  );
}

function matchesRiskFilter(
  deal: DashboardDealRow,
  riskFilter: DealRiskFilter,
): boolean {
  if (riskFilter === "all") return true;
  if (riskFilter === "unanalyzed") return deal.riskScore === undefined;
  if (deal.riskScore === undefined) return false;

  if (riskFilter === "critical") return deal.riskScore >= 80;
  if (riskFilter === "high") {
    return deal.riskScore >= 60 && deal.riskScore < 80;
  }
  if (riskFilter === "medium") {
    return deal.riskScore >= 35 && deal.riskScore < 60;
  }
  return deal.riskScore < 35;
}

function compareNullableNumber(
  a: number | undefined,
  b: number | undefined,
): number {
  if (a === undefined && b === undefined) return 0;
  if (a === undefined) return -1;
  if (b === undefined) return 1;
  return a - b;
}

function compareDeals(
  a: DashboardDealRow,
  b: DashboardDealRow,
  sortBy: DealSortKey,
): number {
  if (sortBy === "name") return a.name.localeCompare(b.name);
  if (sortBy === "risk") return compareNullableNumber(a.riskScore, b.riskScore);
  if (sortBy === "activity") {
    return a.daysSinceLastActivity - b.daysSinceLastActivity;
  }
  if (sortBy === "win_probability") {
    return compareNullableNumber(a.winProbability, b.winProbability);
  }
  return a.amount - b.amount;
}

export function applyDealFilters(
  deals: DashboardDealRow[],
  filters: DealFilterState,
): DashboardDealRow[] {
  const query = filters.search.trim().toLowerCase();

  return deals
    .filter((deal) => {
      if (!query) return true;

      return (
        deal.name.toLowerCase().includes(query) ||
        deal.companyName.toLowerCase().includes(query) ||
        deal.ownerName.toLowerCase().includes(query)
      );
    })
    .filter((deal) =>
      filters.stage === "all" ? true : deal.stage === filters.stage,
    )
    .filter((deal) => matchesRiskFilter(deal, filters.risk))
    .filter((deal) =>
      filters.owner === "all" ? true : deal.ownerName === filters.owner,
    )
    .sort((a, b) => {
      const comparison = compareDeals(a, b, filters.sortBy);
      return filters.sortDir === "desc" ? -comparison : comparison;
    });
}
