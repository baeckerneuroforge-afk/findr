import Link from "next/link";
import { redirect } from "next/navigation";
import { requireOrgId, OrgResolutionError } from "@/lib/auth/org";
import {
  getForecast,
  forecastRiskImpact,
  dealRiskImpact,
} from "@/lib/forecast/service";
import { listResearchRiskSuggestions } from "@/lib/bridge/research-to-sales";
import { ForecastScenarios } from "@/components/dashboard/ForecastScenarios";
import { ResearchRiskPanel } from "@/components/dashboard/ResearchRiskPanel";
import { StageBreakdownChart } from "@/components/dashboard/StageBreakdownChart";
import { WinProbabilityBar } from "@/components/dashboard/WinProbabilityBar";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { StatCard } from "@/components/ui/StatCard";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";

const STAGE_LABELS: Record<string, string> = {
  qualified: "Qualified",
  discovery: "Discovery",
  demo: "Demo",
  proposal_sent: "Proposal sent",
  negotiation: "Negotiation",
  verbal_commit: "Verbal commit",
  closed_won: "Closed won",
  closed_lost: "Closed lost",
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function ForecastIcon() {
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
        d="M3 13.5h4.5l3-7.5 4.5 12 3-4.5H21"
      />
    </svg>
  );
}

export default async function ForecastPage() {
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

  // Parallel pure reads. researchRiskSuggestions is independent of the
  // pipeline state — the watch-list should appear even when the forecast
  // is empty (research-derived patterns are useful before a single deal
  // is open).
  const [forecast, researchRiskSuggestions] = await Promise.all([
    getForecast(orgId),
    listResearchRiskSuggestions(orgId),
  ]);
  const riskImpact = forecastRiskImpact(forecast);
  const impactSignificant = riskImpact.percentage > 20;

  if (forecast.open_deal_count === 0) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-display text-neutral-900">Forecast</h1>
          <p className="text-body text-neutral-500 mt-1">
            Risk-adjusted pipeline value from current deal stage, risk, and
            engagement.
          </p>
        </div>

        <EmptyState
          icon={<ForecastIcon />}
          title="No open deals to forecast"
          description="Once you have active pipeline, Findr will show weighted projections, best-case and worst-case scenarios, and deal-level win probabilities here."
          cta={{ label: "Go to pipeline", href: "/dashboard" }}
        />

        {/* Brücke #3: research-derived Risk-Watch-List bleibt sichtbar
            auch wenn keine offenen Deals existieren — Sales-Teams können
            so VOR der ersten Pipeline-Aktivität bekannte Research-Muster
            ins Bewusstsein nehmen. */}
        <ResearchRiskPanel initialSuggestions={researchRiskSuggestions} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-display text-neutral-900">Forecast</h1>
          <p className="text-body text-neutral-500 mt-1">
            Risk-adjusted pipeline value from current deal stage, risk, and
            engagement.
          </p>
        </div>
        <a
          href="/api/forecast/pdf"
          download
          className="inline-flex h-8 items-center justify-center rounded-md border border-neutral-200 bg-white px-3 text-body-strong text-neutral-900 transition-colors hover:border-neutral-300 hover:bg-neutral-50"
        >
          Download PDF
        </a>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard
          label="Total pipeline"
          value={formatCurrency(forecast.total_pipeline_value)}
          subtitle={`${forecast.open_deal_count} open deals`}
        />
        <StatCard
          label={
            <>
              Weighted forecast
              <InfoTooltip label="Pipeline value adjusted by each deal's win probability." />
            </>
          }
          value={formatCurrency(forecast.weighted_pipeline_value)}
          subtitle="Likely case"
          status="primary"
        />
        <StatCard
          label={
            <>
              At-risk value
              <InfoTooltip label="Total value of deals with risk score 60 or higher." />
            </>
          }
          value={formatCurrency(forecast.deals_at_risk_value)}
          subtitle="Risk score 60+"
          status={forecast.deals_at_risk_value > 0 ? "critical" : "default"}
        />
        <StatCard label="Open deals" value={forecast.open_deal_count} />
      </div>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="min-w-0">
            <div className="text-caption uppercase tracking-wider text-neutral-500">
              Forecast impact of risk
            </div>
            <p className="mt-1 text-body text-neutral-700">
              Risk and stage weighting are reducing your forecast by{" "}
              <span
                className={`font-semibold ${
                  impactSignificant ? "text-danger-700" : "text-neutral-900"
                }`}
              >
                {formatCurrency(riskImpact.absolute)} (
                {Math.round(riskImpact.percentage)}%)
              </span>{" "}
              versus raw pipeline.
            </p>
          </div>
          <div
            className={`text-display ${
              impactSignificant ? "text-danger-700" : "text-neutral-900"
            }`}
          >
            {Math.round(riskImpact.percentage)}%
          </div>
        </div>
      </Card>

      <ForecastScenarios
        bestCase={forecast.best_case}
        likelyCase={forecast.likely_case}
        worstCase={forecast.worst_case}
      />

      <StageBreakdownChart stages={forecast.by_stage} />

      {/* Brücke #3: research-derived Risk-Watch-List. Steht zwischen den
          aggregierten Stage/Forecast-Visuals und der Deal-Tabelle, damit
          team-bestätigte Muster sichtbar sind, BEVOR der User in einzelne
          Deals taucht. */}
      <ResearchRiskPanel initialSuggestions={researchRiskSuggestions} />

      <Card>
        <Table>
          <THead>
            <TR>
              <TH>Deal</TH>
              <TH>Stage</TH>
              <TH className="text-right">Amount</TH>
              <TH>
                <span className="inline-flex items-center gap-1.5">
                  Win probability
                  <InfoTooltip label="Estimated from deal stage, risk score, and recent engagement." />
                </span>
              </TH>
              <TH className="text-right">Weighted value</TH>
              <TH className="text-right">
                <span className="inline-flex items-center gap-1.5">
                  Risk impact
                  <InfoTooltip label="Forecast value this deal loses to weighting (amount minus weighted value)." />
                </span>
              </TH>
            </TR>
          </THead>
          <TBody>
            {forecast.forecasts.map((deal) => (
              <TR key={deal.deal_id}>
                <TD>
                  <Link
                    href={`/dashboard/deals/${deal.deal_id}`}
                    className="block -mx-4 -my-3 px-4 py-3 hover:bg-neutral-50"
                  >
                    <div className="text-body-strong text-neutral-900">
                      {deal.deal_name}
                    </div>
                    <div className="text-small text-neutral-500">
                      Risk score {deal.risk_score}/100
                    </div>
                  </Link>
                </TD>
                <TD>
                  <Badge>{STAGE_LABELS[deal.stage] ?? deal.stage}</Badge>
                </TD>
                <TD className="text-right font-medium text-neutral-900 whitespace-nowrap">
                  {formatCurrency(deal.amount)}
                </TD>
                <TD>
                  <WinProbabilityBar
                    probability={deal.win_probability}
                    confidence={deal.confidence}
                  />
                </TD>
                <TD className="text-right font-medium text-neutral-900 whitespace-nowrap">
                  {formatCurrency(deal.weighted_value)}
                </TD>
                <TD className="text-right whitespace-nowrap">
                  {(() => {
                    const impact = dealRiskImpact(deal);
                    const heavy =
                      deal.amount > 0 && impact / deal.amount > 0.5;
                    return (
                      <span
                        className={
                          heavy
                            ? "font-medium text-danger-700"
                            : "text-neutral-500"
                        }
                      >
                        −{formatCurrency(impact)}
                      </span>
                    );
                  })()}
                </TD>
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
