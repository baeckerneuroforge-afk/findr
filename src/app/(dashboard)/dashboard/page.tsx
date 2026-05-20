import Link from "next/link";
import { redirect } from "next/navigation";
import { requireOrgId, OrgResolutionError } from "@/lib/auth/org";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatCard } from "@/components/ui/StatCard";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Table, THead, TH, TBody, TR, TD } from "@/components/ui/Table";
import { RiskBadge } from "@/components/dashboard/RiskBadge";
import { AnalyzeButton } from "@/components/dashboard/AnalyzeButton";
import { AnalyzeAllButton } from "@/components/dashboard/AnalyzeAllButton";
import { getDealsByOrg } from "@/lib/deals/service";
import { getLatestRiskScoresForDeals } from "@/lib/risk/service";
import type { DealStage } from "@/lib/deals/types";

const STAGE_LABELS: Record<DealStage, string> = {
  qualified: "Qualified",
  demo: "Demo",
  proposal_sent: "Proposal sent",
  negotiation: "Negotiation",
  verbal_commit: "Verbal commit",
  closed_won: "Closed won",
  closed_lost: "Closed lost",
};

const ACTIVE_STAGES: ReadonlySet<DealStage> = new Set([
  "qualified",
  "demo",
  "proposal_sent",
  "negotiation",
  "verbal_commit",
]);

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

  const baseDeals = await getDealsByOrg(orgId);
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
    };
  });

  const atRisk = deals.filter(
    (d) => d.riskScore !== undefined && d.riskScore >= 60,
  ).length;
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
        <EmptyState
          icon={<PlugIcon />}
          title="No deals yet"
          description="Connect Hubspot to start importing your pipeline. Once deals land, Findr begins analyzing risk signals from calls and CRM activity."
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
        <AnalyzeAllButton deals={deals.map((d) => ({ id: d.id, name: d.name }))} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard label="Total deals" value={deals.length} />
        <StatCard
          label="Deals at risk"
          value={atRisk}
          status={atRisk > 0 ? "critical" : "default"}
        />
        <StatCard label="Active" value={active} />
        <StatCard label="Closing in 30d" value={closingSoon} />
      </div>

      {/* Deal table */}
      <Card>
        <Table>
          <THead>
            <TR>
              <TH>Deal</TH>
              <TH>Stage</TH>
              <TH>Owner</TH>
              <TH className="text-right">Amount</TH>
              <TH>Risk</TH>
              <TH>Last activity</TH>
              <TH className="text-right">Action</TH>
            </TR>
          </THead>
          <TBody>
            {deals.map((deal) => (
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
                  {new Intl.NumberFormat("de-DE", {
                    style: "currency",
                    currency: deal.currency,
                    maximumFractionDigits: 0,
                  }).format(deal.amount)}
                </TD>
                <TD>
                  <RiskBadge
                    score={deal.riskScore}
                    level={deal.riskLevel}
                    size="sm"
                  />
                </TD>
                <TD className="text-small text-neutral-500 whitespace-nowrap">
                  {deal.daysSinceLastActivity === 0
                    ? "Today"
                    : `${deal.daysSinceLastActivity}d ago`}
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
      </Card>

      {/* Hint */}
      <p className="text-small text-neutral-500">
        Click a deal to view call history, risk-score timeline, and run a fresh
        analysis. Risk signals are recalculated daily by the background cron.
      </p>
    </div>
  );
}
