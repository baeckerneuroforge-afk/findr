import Link from "next/link";
import { redirect } from "next/navigation";
import { requireOrgId, OrgResolutionError } from "@/lib/auth/org";
import { getForecast } from "@/lib/forecast/service";
import { ForecastScenarios } from "@/components/dashboard/ForecastScenarios";
import { StageBreakdownChart } from "@/components/dashboard/StageBreakdownChart";
import { WinProbabilityBar } from "@/components/dashboard/WinProbabilityBar";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
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

  const forecast = await getForecast(orgId);

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
          label="Weighted forecast"
          value={formatCurrency(forecast.weighted_pipeline_value)}
          subtitle="Likely case"
          status="primary"
        />
        <StatCard
          label="At-risk value"
          value={formatCurrency(forecast.deals_at_risk_value)}
          subtitle="Risk score 60+"
          status={forecast.deals_at_risk_value > 0 ? "critical" : "default"}
        />
        <StatCard label="Open deals" value={forecast.open_deal_count} />
      </div>

      <ForecastScenarios
        bestCase={forecast.best_case}
        likelyCase={forecast.likely_case}
        worstCase={forecast.worst_case}
      />

      <StageBreakdownChart stages={forecast.by_stage} />

      <Card>
        <Table>
          <THead>
            <TR>
              <TH>Deal</TH>
              <TH>Stage</TH>
              <TH className="text-right">Amount</TH>
              <TH>Win probability</TH>
              <TH className="text-right">Weighted value</TH>
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
              </TR>
            ))}
          </TBody>
        </Table>
      </Card>
    </div>
  );
}
