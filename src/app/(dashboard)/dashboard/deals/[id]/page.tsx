import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { requireOrgId, OrgResolutionError } from "@/lib/auth/org";
import { getDealById } from "@/lib/deals/service";
import { getCallsByDealId } from "@/lib/calls/service";
import { getRiskScoreHistory } from "@/lib/risk/service";
import { CallDetail } from "@/components/dashboard/CallDetail";
import { RiskBadge } from "@/components/dashboard/RiskBadge";
import { RiskHistoryChart } from "@/components/dashboard/RiskHistoryChart";
import { EmptyState } from "@/components/ui/EmptyState";

function PhoneIcon() {
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
        d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z"
      />
    </svg>
  );
}

export default async function DealDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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

  const { id } = await params;
  const deal = await getDealById(orgId, id);
  if (!deal) notFound();

  const calls = await getCallsByDealId(orgId, id);
  const history = await getRiskScoreHistory(orgId, id, 30);
  const historyPoints = history.map((point) => ({
    date: point.analyzed_at,
    score: point.risk_score,
    level: point.risk_level,
  }));

  return (
    <div>
      {/* Breadcrumb */}
      <nav
        aria-label="Breadcrumb"
        className="mb-6 flex items-center gap-2 text-small text-neutral-500"
      >
        <Link
          href="/dashboard"
          className="transition-colors hover:text-neutral-900"
        >
          Pipeline
        </Link>
        <span aria-hidden="true">/</span>
        <span className="truncate text-neutral-900">{deal.name}</span>
      </nav>

      {/* Header */}
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-display text-neutral-900 mb-2">{deal.name}</h1>
          <div className="flex flex-wrap items-center gap-3 text-body text-neutral-500">
            <span>{deal.stage}</span>
            <span aria-hidden="true">·</span>
            <span>
              {new Intl.NumberFormat("de-DE", {
                style: "currency",
                currency: deal.currency,
                maximumFractionDigits: 0,
              }).format(deal.amount)}
            </span>
            <span aria-hidden="true">·</span>
            <span>Champion: {deal.championName}</span>
          </div>
        </div>
        <RiskBadge level={deal.riskLevel} score={deal.riskScore} size="large" />
      </div>

      {/* Risk history chart */}
      <div className="mb-6">
        <RiskHistoryChart history={historyPoints} />
      </div>

      {/* Calls */}
      <div className="mb-8">
        <h2 className="mb-4 text-h2 text-neutral-900">
          Call history ({calls.length})
        </h2>
        {calls.length === 0 ? (
          <EmptyState
            icon={<PhoneIcon />}
            title="No calls recorded yet"
            description="Once you connect a calling provider (Gong, Chorus, Zoom) or upload transcripts, Findr will analyze every conversation for risk signals."
            variant="default"
          />
        ) : (
          <div className="space-y-4">
            {calls.map((call) => (
              <CallDetail key={call.id} call={call} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
