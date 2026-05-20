import { redirect } from "next/navigation";
import { requireOrgId, OrgResolutionError } from "@/lib/auth/org";
import { LossReasonBreakdown } from "@/components/dashboard/LossReasonBreakdown";
import { LossReportPanel } from "@/components/dashboard/LossReportPanel";
import { StatCard } from "@/components/ui/StatCard";
import { Card, CardBody } from "@/components/ui/Card";
import { generateQuarterlyReport } from "@/lib/loss/reports";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

export default async function LossAnalysisPage() {
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

  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 90);
  const report = await generateQuarterlyReport(orgId, start, end);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-display text-neutral-900">Loss analysis</h1>
        <p className="mt-1 text-body text-neutral-500">
          Auto-tagged closed-lost reasons from CRM status changes and call
          transcripts.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard label="Lost deals" value={report.total_lost_deals} />
        <StatCard
          label="Lost value"
          value={formatCurrency(report.total_lost_value)}
          status={report.total_lost_value > 0 ? "critical" : "default"}
        />
        <StatCard
          label="Top reason"
          value={report.breakdown[0]?.reason.replaceAll("_", " ") ?? "None"}
          subtitle="Last 90 days"
        />
      </div>

      <LossReportPanel />

      <section className="space-y-4">
        <div>
          <h2 className="text-h2 text-neutral-900">Reason breakdown</h2>
          <p className="text-body text-neutral-500">
            Ranked by lost deal count, with sample call evidence.
          </p>
        </div>
        <LossReasonBreakdown breakdown={report.breakdown} />
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-h2 text-neutral-900">Top lost companies</h2>
          <p className="text-body text-neutral-500">
            Largest closed-lost opportunities in the selected period.
          </p>
        </div>
        <Card>
          <CardBody>
            {report.top_lost_companies.length === 0 ? (
              <div className="text-body text-neutral-500">
                No closed-lost companies found for this period.
              </div>
            ) : (
              <div className="divide-y divide-neutral-100">
                {report.top_lost_companies.map((company) => (
                  <div
                    key={`${company.name}-${company.value}-${company.reason}`}
                    className="grid gap-2 py-3 md:grid-cols-[1fr_auto_auto]"
                  >
                    <div className="text-body-strong text-neutral-900">
                      {company.name}
                    </div>
                    <div className="text-body text-neutral-700">
                      {formatCurrency(company.value)}
                    </div>
                    <div className="text-small text-neutral-500">
                      {company.reason.replaceAll("_", " ")}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </section>
    </div>
  );
}
