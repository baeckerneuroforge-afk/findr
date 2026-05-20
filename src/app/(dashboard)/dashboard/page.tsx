import { redirect } from "next/navigation";
import { requireOrgId, OrgResolutionError } from "@/lib/auth/org";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import DashboardHeader from "@/components/dashboard/DashboardHeader";
import DealList from "@/components/dashboard/DealList";
import { EmptyState } from "@/components/ui/EmptyState";
import { getDealsByOrg } from "@/lib/deals/service";
import { getLatestRiskScoresForDeals } from "@/lib/risk/service";

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
      // TODO: build /onboarding/create-org route; for now fall back to sign-in
      if (err.code === "no_org") redirect("/?need_org=1");
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

  const atRiskCount = deals.filter(
    (d) => d.riskScore !== undefined && d.riskScore > 60,
  ).length;
  const allAnalyzedClear =
    deals.length > 0 &&
    deals.every((d) => d.riskScore !== undefined) &&
    atRiskCount === 0;

  const stats: { label: string; value: string; subtitle?: string }[] = [
    { label: "Active Deals", value: String(deals.length) },
    {
      label: "Deals at Risk",
      value: String(atRiskCount),
      subtitle: allAnalyzedClear
        ? "All clear"
        : atRiskCount === 0
          ? "Run Analyze to score deals"
          : undefined,
    },
    { label: "Saved by Findr", value: "0" },
    { label: "Loss Patterns", value: "0" },
  ];

  return (
    <div className="min-h-screen bg-obsidian text-white">
      <DashboardSidebar />
      <DashboardHeader title="Dashboard" />

      <main className="min-h-screen pl-60 pt-16">
        <div className="p-8">
          {deals.length === 0 ? (
            <div className="mx-auto max-w-3xl">
              <EmptyState
                icon={<PlugIcon />}
                title="No deals yet"
                description="Connect Hubspot to start importing your pipeline. Once deals land, Findr begins analyzing risk signals from your calls and CRM activity."
                action={{
                  label: "Connect Hubspot",
                  href: "/dashboard/integrations/hubspot",
                }}
              />
            </div>
          ) : (
            <>
              {/* Stats row */}
              <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-4">
                {stats.map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-lg border border-mist/15 bg-mist/5 p-5"
                  >
                    <p className="text-xs uppercase tracking-wider text-mist">
                      {stat.label}
                    </p>
                    <p className="mt-2 text-3xl font-medium text-white">
                      {stat.value}
                    </p>
                    {stat.subtitle && (
                      <p className="mt-1 text-xs text-mist">{stat.subtitle}</p>
                    )}
                  </div>
                ))}
              </div>

              {/* Deals table */}
              <DealList deals={deals} />
            </>
          )}
        </div>
      </main>
    </div>
  );
}
