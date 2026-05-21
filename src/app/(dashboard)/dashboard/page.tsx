import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requireOrgId, OrgResolutionError } from "@/lib/auth/org";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatCard } from "@/components/ui/StatCard";
import { Card, CardBody } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { AnalyzeAllButton } from "@/components/dashboard/AnalyzeAllButton";
import { DealTableWithFilters } from "@/components/dashboard/DealTableWithFilters";
import { OnboardingChecklist } from "@/components/dashboard/OnboardingChecklist";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { getDealsByOrg } from "@/lib/deals/service";
import { buildForecastSummary } from "@/lib/forecast/service";
import { getOnboardingStatus } from "@/lib/onboarding/status";
import {
  averageSignalConfidence,
  getLatestRiskScoresForDeals,
} from "@/lib/risk/service";
import type { DealStage } from "@/lib/deals/types";

const ACTIVE_STAGES: ReadonlySet<DealStage> = new Set([
  "qualified",
  "demo",
  "proposal_sent",
  "negotiation",
  "verbal_commit",
]);

function DealTableFallback() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-9 w-full rounded-md" />
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-20" />
      </div>
      <div className="-mx-5 -mb-5 space-y-0 border-t border-neutral-200">
        <Skeleton className="mx-5 my-3 h-10 rounded-md" />
        <Skeleton className="mx-5 my-3 h-10 rounded-md" />
        <Skeleton className="mx-5 my-3 h-10 rounded-md" />
      </div>
    </div>
  );
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function PlugIcon() {
  return (
    <svg
      className="h-6 w-6"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244"
      />
    </svg>
  );
}

export default async function DashboardPage() {
  let orgId: string;
  try {
    orgId = await requireOrgId();
  } catch (err) {
    if (err instanceof OrgResolutionError) {
      if (err.code === "no_auth") redirect("/sign-in");
      if (err.code === "no_org") redirect("/onboarding/create-org");
      redirect("/sign-in");
    }
    throw err;
  }

  const [baseDeals, onboardingStatus] = await Promise.all([
    getDealsByOrg(orgId),
    getOnboardingStatus(orgId),
  ]);
  const riskMap = await getLatestRiskScoresForDeals(
    orgId,
    baseDeals.map((d) => d.id),
  );

  const deals = baseDeals.map((deal) => {
    const risk = riskMap.get(deal.id);
    if (!risk) return deal;
    return {
      ...deal,
      riskScore: risk.risk_score,
      riskLevel: risk.risk_level,
      riskSignals: risk.signals.map((s) => s.type),
      riskReasoning: risk.overall_reasoning,
      lastRiskUpdate: risk.analyzed_at,
      avgSignalConfidence: averageSignalConfidence(risk.signals),
    };
  });

  const forecast = buildForecastSummary(deals);
  const forecastByDealId = new Map(
    forecast.forecasts.map((dealForecast) => [
      dealForecast.deal_id,
      dealForecast.win_probability,
    ]),
  );
  const tableDeals = deals.map((deal) => ({
    ...deal,
    winProbability: forecastByDealId.get(deal.id),
  }));
  const atRisk = deals.filter(
    (d) => d.riskScore !== undefined && d.riskScore >= 60,
  ).length;
  const analyzed = deals.filter((d) => d.riskScore !== undefined).length;
  const atRiskSubtitle =
    analyzed === 0
      ? "No deals analyzed yet"
      : atRisk === 0
        ? "All clear"
        : `${analyzed} analyzed`;
  const active = deals.filter((d) => ACTIVE_STAGES.has(d.stage)).length;
  const closingSoon = deals.filter((d) => {
    if (!ACTIVE_STAGES.has(d.stage)) return false;
    const close = new Date(d.closeDate).getTime();
    const days = (close - Date.now()) / (1000 * 60 * 60 * 24);
    return days >= 0 && days <= 30;
  }).length;

  if (deals.length === 0) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-display text-neutral-900">Pipeline</h1>
          <p className="text-body text-neutral-500 mt-1">
            Connect Hubspot to start importing deals.
          </p>
        </div>
        <OnboardingChecklist status={onboardingStatus} />
        <EmptyState
          icon={<PlugIcon />}
          title="No deals yet"
          description="Connect Hubspot or wait for your first sync. Once deals land, Findr will show risk signals, weighted forecast, and deal-level recommendations here."
          action={{
            label: "Connect Hubspot",
            href: "/dashboard/integrations/hubspot",
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-display text-neutral-900">Pipeline</h1>
          <p className="text-body text-neutral-500 mt-1">
            {deals.length} {deals.length === 1 ? "deal" : "deals"} in your
            active pipeline
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/dashboard/forecast"
            className="text-body-strong text-neutral-700 hover:text-neutral-900"
          >
            View full forecast -&gt;
          </Link>
          <AnalyzeAllButton
            deals={deals.map((d) => ({ id: d.id, name: d.name }))}
          />
        </div>
      </div>

      <OnboardingChecklist status={onboardingStatus} />

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label="Total deals" value={deals.length} />
        <StatCard
          label="Deals at risk"
          value={atRisk}
          subtitle={atRiskSubtitle}
          status={atRisk > 0 ? "critical" : "default"}
        />
        <StatCard label="Active" value={active} />
        <StatCard
          label={
            <>
              Weighted forecast
              <InfoTooltip label="Pipeline value adjusted by each deal's win probability." />
            </>
          }
          value={formatCurrency(forecast.weighted_pipeline_value)}
          subtitle="Risk-adjusted"
          status="primary"
        />
        <StatCard label="Closing in 30d" value={closingSoon} />
      </div>

      {/* Deal table */}
      <Card>
        <CardBody>
          <Suspense fallback={<DealTableFallback />}>
            <DealTableWithFilters deals={tableDeals} />
          </Suspense>
        </CardBody>
      </Card>

      {/* Hint */}
      <p className="text-small text-neutral-500">
        Click a deal to view call history, risk-score timeline, and run a fresh
        analysis. Risk signals are recalculated daily by the background cron.
      </p>
    </div>
  );
}
