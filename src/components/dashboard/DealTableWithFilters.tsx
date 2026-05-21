"use client";

import Link from "next/link";
import { useMemo, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { AnalyzeButton } from "@/components/dashboard/AnalyzeButton";
import { RiskBadge } from "@/components/dashboard/RiskBadge";
import { Badge } from "@/components/ui/Badge";
import { Table, TBody, TD, TR } from "@/components/ui/Table";
import {
  applyDealFilters,
  DEFAULT_DEAL_FILTERS,
  hasActiveDealFilters,
  type DashboardDealRow,
  type DealFilterState,
  type DealRiskFilter,
  type DealSortKey,
  type SortDirection,
} from "@/lib/deals/filtering";
import type { DealStage } from "@/lib/deals/types";

interface DealTableWithFiltersProps {
  deals: DashboardDealRow[];
}

const STAGE_LABELS: Record<DealStage, string> = {
  qualified: "Qualified",
  demo: "Demo",
  proposal_sent: "Proposal sent",
  negotiation: "Negotiation",
  verbal_commit: "Verbal commit",
  closed_won: "Closed won",
  closed_lost: "Closed lost",
};

const STAGE_ORDER: DealStage[] = [
  "qualified",
  "demo",
  "proposal_sent",
  "negotiation",
  "verbal_commit",
  "closed_won",
  "closed_lost",
];

const RISK_FILTERS: Array<{ value: DealRiskFilter; label: string }> = [
  { value: "all", label: "All risk levels" },
  { value: "critical", label: "Critical (80+)" },
  { value: "high", label: "High (60-79)" },
  { value: "medium", label: "Medium (35-59)" },
  { value: "low", label: "Low (<35)" },
  { value: "unanalyzed", label: "Not analyzed" },
];

const SORT_KEYS: DealSortKey[] = [
  "name",
  "amount",
  "risk",
  "activity",
  "win_probability",
];

const RISK_VALUES = RISK_FILTERS.map((filter) => filter.value);

function isDealStage(value: string | null): value is DealStage {
  return STAGE_ORDER.includes(value as DealStage);
}

function getFilterState(searchParams: ReturnType<typeof useSearchParams>) {
  const stage = searchParams.get("stage");
  const risk = searchParams.get("risk");
  const sort = searchParams.get("sort");
  const dir = searchParams.get("dir");

  return {
    search: searchParams.get("q") ?? DEFAULT_DEAL_FILTERS.search,
    stage: isDealStage(stage) ? stage : DEFAULT_DEAL_FILTERS.stage,
    risk: RISK_VALUES.includes(risk as DealRiskFilter)
      ? (risk as DealRiskFilter)
      : DEFAULT_DEAL_FILTERS.risk,
    owner: searchParams.get("owner") ?? DEFAULT_DEAL_FILTERS.owner,
    sortBy: SORT_KEYS.includes(sort as DealSortKey)
      ? (sort as DealSortKey)
      : DEFAULT_DEAL_FILTERS.sortBy,
    sortDir:
      dir === "asc" || dir === "desc"
        ? (dir as SortDirection)
        : DEFAULT_DEAL_FILTERS.sortDir,
  } satisfies DealFilterState;
}

function formatCurrency(value: number, currency: "EUR" | "USD") {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatLastActivity(days: number) {
  if (days === 0) return "Today";
  return `${days}d ago`;
}

function Select({
  value,
  onChange,
  children,
  label,
}: {
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
  label: string;
}) {
  return (
    <select
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-9 rounded-md border border-neutral-200 bg-white px-3 text-body text-neutral-700 outline-none transition-colors focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10"
    >
      {children}
    </select>
  );
}

function SortableHeader({
  label,
  sortKey,
  currentSort,
  currentDir,
  align = "left",
  onSort,
}: {
  label: string;
  sortKey: DealSortKey;
  currentSort: DealSortKey;
  currentDir: SortDirection;
  align?: "left" | "right";
  onSort: (sortKey: DealSortKey) => void;
}) {
  const active = currentSort === sortKey;

  return (
    <th
      scope="col"
      onClick={() => onSort(sortKey)}
      className={`cursor-pointer select-none px-4 py-2.5 text-caption font-medium uppercase tracking-wider text-neutral-500 transition-colors hover:text-neutral-700 ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      <span
        className={`inline-flex items-center gap-1 ${
          align === "right" ? "justify-end" : ""
        }`}
      >
        {label}
        {active && (
          <span className="text-primary-500">
            {currentDir === "desc" ? "desc" : "asc"}
          </span>
        )}
      </span>
    </th>
  );
}

function StaticHeader({
  children,
  align = "left",
}: {
  children: ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      scope="col"
      className={`px-4 py-2.5 text-caption font-medium uppercase tracking-wider text-neutral-500 ${
        align === "right" ? "text-right" : "text-left"
      }`}
    >
      {children}
    </th>
  );
}

export function DealTableWithFilters({ deals }: DealTableWithFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filters = getFilterState(searchParams);

  const stages = useMemo(() => {
    const present = new Set(deals.map((deal) => deal.stage));
    return STAGE_ORDER.filter((stage) => present.has(stage));
  }, [deals]);

  const owners = useMemo(
    () =>
      Array.from(new Set(deals.map((deal) => deal.ownerName))).sort((a, b) =>
        a.localeCompare(b),
      ),
    [deals],
  );

  const filteredDeals = useMemo(
    () => applyDealFilters(deals, filters),
    [deals, filters],
  );

  const hasFilters = hasActiveDealFilters(filters);

  function replaceParams(params: URLSearchParams) {
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all" || value === "") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    replaceParams(params);
  }

  function updateSort(sortKey: DealSortKey) {
    const params = new URLSearchParams(searchParams.toString());
    const nextDir =
      filters.sortBy === sortKey && filters.sortDir === "desc" ? "asc" : "desc";

    if (sortKey === DEFAULT_DEAL_FILTERS.sortBy) {
      params.delete("sort");
    } else {
      params.set("sort", sortKey);
    }

    if (nextDir === DEFAULT_DEAL_FILTERS.sortDir) {
      params.delete("dir");
    } else {
      params.set("dir", nextDir);
    }

    replaceParams(params);
  }

  function clearFilters() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("q");
    params.delete("stage");
    params.delete("risk");
    params.delete("owner");
    replaceParams(params);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="search"
          aria-label="Search deals"
          placeholder="Search deals, companies, owners..."
          value={filters.search}
          onChange={(event) => updateParam("q", event.target.value)}
          className="h-9 min-w-[240px] flex-1 rounded-md border border-neutral-200 bg-white px-3 text-body text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10"
        />

        <Select
          label="Filter by stage"
          value={filters.stage}
          onChange={(value) => updateParam("stage", value)}
        >
          <option value="all">All stages</option>
          {stages.map((stage) => (
            <option key={stage} value={stage}>
              {STAGE_LABELS[stage]}
            </option>
          ))}
        </Select>

        <Select
          label="Filter by risk level"
          value={filters.risk}
          onChange={(value) => updateParam("risk", value)}
        >
          {RISK_FILTERS.map((filter) => (
            <option key={filter.value} value={filter.value}>
              {filter.label}
            </option>
          ))}
        </Select>

        <Select
          label="Filter by owner"
          value={filters.owner}
          onChange={(value) => updateParam("owner", value)}
        >
          <option value="all">All owners</option>
          {owners.map((owner) => (
            <option key={owner} value={owner}>
              {owner}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex items-center justify-between gap-4">
        <span className="text-small text-neutral-500">
          {filteredDeals.length} {filteredDeals.length === 1 ? "deal" : "deals"}
          {hasFilters ? ` (filtered from ${deals.length})` : ""}
        </span>
        {hasFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="text-small font-medium text-primary-600 transition-colors hover:text-primary-700"
          >
            Clear filters
          </button>
        )}
      </div>

      {filteredDeals.length === 0 ? (
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 py-12 text-center">
          <div className="text-body-strong text-neutral-900">
            No deals match your filters.
          </div>
          <div className="mt-1 text-small text-neutral-500">
            Adjust the search or clear filters to return to the full pipeline.
          </div>
        </div>
      ) : (
        <div className="-mx-5 -mb-5">
          <Table>
            <thead className="border-b border-neutral-200 bg-neutral-50">
              <TR>
                <SortableHeader
                  label="Deal"
                  sortKey="name"
                  currentSort={filters.sortBy}
                  currentDir={filters.sortDir}
                  onSort={updateSort}
                />
                <StaticHeader>Stage</StaticHeader>
                <StaticHeader>Owner</StaticHeader>
                <SortableHeader
                  label="Amount"
                  sortKey="amount"
                  currentSort={filters.sortBy}
                  currentDir={filters.sortDir}
                  align="right"
                  onSort={updateSort}
                />
                <SortableHeader
                  label="Risk"
                  sortKey="risk"
                  currentSort={filters.sortBy}
                  currentDir={filters.sortDir}
                  onSort={updateSort}
                />
                <SortableHeader
                  label="Win prob."
                  sortKey="win_probability"
                  currentSort={filters.sortBy}
                  currentDir={filters.sortDir}
                  onSort={updateSort}
                />
                <SortableHeader
                  label="Last activity"
                  sortKey="activity"
                  currentSort={filters.sortBy}
                  currentDir={filters.sortDir}
                  onSort={updateSort}
                />
                <StaticHeader align="right">Action</StaticHeader>
              </TR>
            </thead>
            <TBody>
              {filteredDeals.map((deal) => (
                <TR key={deal.id}>
                  <TD>
                    <Link
                      href={`/dashboard/deals/${deal.id}`}
                      className="block -mx-4 -my-3 px-4 py-3 hover:bg-neutral-50"
                    >
                      <div className="text-body-strong text-neutral-900">
                        {deal.name}
                      </div>
                      <div className="text-small text-neutral-500">
                        {deal.companyName}
                      </div>
                    </Link>
                  </TD>
                  <TD>
                    <Badge>{STAGE_LABELS[deal.stage]}</Badge>
                  </TD>
                  <TD className="text-neutral-700">{deal.ownerName}</TD>
                  <TD className="text-right font-medium text-neutral-900 whitespace-nowrap">
                    {formatCurrency(deal.amount, deal.currency)}
                  </TD>
                  <TD>
                    <RiskBadge
                      score={deal.riskScore}
                      level={deal.riskLevel}
                      size="sm"
                    />
                  </TD>
                  <TD className="text-small text-neutral-600 whitespace-nowrap">
                    {deal.winProbability !== undefined
                      ? `${deal.winProbability}%`
                      : "n/a"}
                  </TD>
                  <TD className="text-small text-neutral-500 whitespace-nowrap">
                    {formatLastActivity(deal.daysSinceLastActivity)}
                  </TD>
                  <TD className="text-right">
                    <AnalyzeButton
                      dealId={deal.id}
                      hasScore={deal.riskScore !== undefined}
                    />
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      )}
    </div>
  );
}
