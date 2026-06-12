"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toBcp47 } from "@/i18n/locale";
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

const RISK_FILTERS: Array<{ value: DealRiskFilter; labelKey: string }> = [
  { value: "all", labelKey: "riskAll" },
  { value: "critical", labelKey: "riskCritical" },
  { value: "high", labelKey: "riskHigh" },
  { value: "medium", labelKey: "riskMedium" },
  { value: "low", labelKey: "riskLow" },
  { value: "unanalyzed", labelKey: "riskUnanalyzed" },
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

function formatCurrency(value: number, currency: "EUR" | "USD", locale: string) {
  return new Intl.NumberFormat(toBcp47(locale), {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
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
      className="h-9 rounded-md border border-neutral-200 bg-card px-3 text-body text-neutral-700 outline-none transition-colors focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10"
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
  const t = useTranslations("sales.table");
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  // The free-text search is held in local state, not the URL: filtering is
  // already 100% client-side (applyDealFilters), but the dashboard page is
  // dynamic, so a URL-controlled value made every keystroke a `router.replace`
  // → full RSC refetch (getDealsByOrg + risk scores + forecast). Local state
  // makes typing instant. The URL `?q=` is still kept as a *shareable
  // snapshot* via the native History API (replaceState), which syncs with
  // useSearchParams WITHOUT a server round-trip. Seeded from `?q=` so a shared
  // link still populates the box on first paint. Dropdown filters (rarely
  // changed) keep their URL params.
  const [search, setSearch] = useState(
    () => searchParams.get("q") ?? DEFAULT_DEAL_FILTERS.search,
  );
  // Memoized so its identity is stable across renders (it is the dependency
  // of the filteredDeals memo below); recomputed only when the URL params or
  // the local search text actually change.
  const filters = useMemo(
    () => ({ ...getFilterState(searchParams), search }),
    [searchParams, search],
  );

  const formatLastActivity = (days: number) =>
    days === 0 ? t("today") : t("daysAgo", { days });

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

  function updateSearch(value: string) {
    // Instant: local state re-runs applyDealFilters client-side. NO navigation
    // and NO RSC refetch — that is the whole point of FUND 5.1.
    setSearch(value);
    // Mirror to the URL purely as a shareable snapshot. `replaceState` (not
    // `pushState`) keeps the back button clean — per-keystroke URLs must not
    // become individual history entries — and per Next 16 it syncs with
    // useSearchParams without a server round-trip.
    const params = new URLSearchParams(searchParams.toString());
    if (value === "") {
      params.delete("q");
    } else {
      params.set("q", value);
    }
    const query = params.toString();
    window.history.replaceState(
      null,
      "",
      query ? `${pathname}?${query}` : pathname,
    );
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
    setSearch("");
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
          aria-label={t("searchAria")}
          placeholder={t("searchPlaceholder")}
          value={search}
          onChange={(event) => updateSearch(event.target.value)}
          className="h-9 min-w-[240px] flex-1 rounded-md border border-neutral-200 bg-card px-3 text-body text-neutral-900 outline-none transition-colors placeholder:text-neutral-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/10"
        />

        <Select
          label={t("filterStageAria")}
          value={filters.stage}
          onChange={(value) => updateParam("stage", value)}
        >
          <option value="all">{t("allStages")}</option>
          {stages.map((stage) => (
            <option key={stage} value={stage}>
              {STAGE_LABELS[stage]}
            </option>
          ))}
        </Select>

        <Select
          label={t("filterRiskAria")}
          value={filters.risk}
          onChange={(value) => updateParam("risk", value)}
        >
          {RISK_FILTERS.map((filter) => (
            <option key={filter.value} value={filter.value}>
              {t(filter.labelKey)}
            </option>
          ))}
        </Select>

        <Select
          label={t("filterOwnerAria")}
          value={filters.owner}
          onChange={(value) => updateParam("owner", value)}
        >
          <option value="all">{t("allOwners")}</option>
          {owners.map((owner) => (
            <option key={owner} value={owner}>
              {owner}
            </option>
          ))}
        </Select>
      </div>

      <div className="flex items-center justify-between gap-4">
        <span className="text-small text-neutral-500">
          {t("count", { count: filteredDeals.length })}
          {hasFilters ? t("filteredFrom", { total: deals.length }) : ""}
        </span>
        {hasFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="text-small font-medium text-primary-600 transition-colors hover:text-primary-700"
          >
            {t("clearFilters")}
          </button>
        )}
      </div>

      {filteredDeals.length === 0 ? (
        <div className="rounded-lg border border-neutral-200 bg-neutral-50 py-12 text-center">
          <div className="text-body-strong text-neutral-900">
            {t("noMatchTitle")}
          </div>
          <div className="mt-1 text-small text-neutral-500">
            {t("noMatchDesc")}
          </div>
        </div>
      ) : (
        <div className="-mx-5 -mb-5">
          <Table>
            <thead className="border-b border-neutral-200 bg-neutral-50">
              <TR>
                <SortableHeader
                  label={t("colDeal")}
                  sortKey="name"
                  currentSort={filters.sortBy}
                  currentDir={filters.sortDir}
                  onSort={updateSort}
                />
                <StaticHeader>{t("colStage")}</StaticHeader>
                <StaticHeader>{t("colOwner")}</StaticHeader>
                <SortableHeader
                  label={t("colAmount")}
                  sortKey="amount"
                  currentSort={filters.sortBy}
                  currentDir={filters.sortDir}
                  align="right"
                  onSort={updateSort}
                />
                <SortableHeader
                  label={t("colRisk")}
                  sortKey="risk"
                  currentSort={filters.sortBy}
                  currentDir={filters.sortDir}
                  onSort={updateSort}
                />
                <SortableHeader
                  label={t("colWinProb")}
                  sortKey="win_probability"
                  currentSort={filters.sortBy}
                  currentDir={filters.sortDir}
                  onSort={updateSort}
                />
                <SortableHeader
                  label={t("colLastActivity")}
                  sortKey="activity"
                  currentSort={filters.sortBy}
                  currentDir={filters.sortDir}
                  onSort={updateSort}
                />
                <StaticHeader align="right">{t("colAction")}</StaticHeader>
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
                    {formatCurrency(deal.amount, deal.currency, locale)}
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
                      : t("winProbNa")}
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
