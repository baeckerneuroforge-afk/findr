import { redirect } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { toBcp47 } from "@/i18n/locale";
import { requireOrgId, OrgResolutionError } from "@/lib/auth/org";
import { LossReasonBreakdown } from "@/components/dashboard/LossReasonBreakdown";
import { LossReportPanel } from "@/components/dashboard/LossReportPanel";
import { EarlyWarningPanel } from "@/components/dashboard/EarlyWarningPanel";
import { StatCard } from "@/components/ui/StatCard";
import { Card, CardBody } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { generateQuarterlyReport } from "@/lib/loss/reports";
import { getEarlyWarnings } from "@/lib/loss/early-warning-service";
import { ENABLED_MODULES } from "@/config/modules";

function formatCurrency(value: number, locale: string): string {
  return new Intl.NumberFormat(toBcp47(locale), {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

export default async function LossAnalysisPage() {
  if (!ENABLED_MODULES.salesIntelligence) redirect("/dashboard");

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

  const t = await getTranslations("sales.loss");
  const locale = await getLocale();

  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 90);
  const [report, earlyWarnings] = await Promise.all([
    generateQuarterlyReport(orgId, start, end),
    getEarlyWarnings(orgId),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-display text-neutral-900">{t("title")}</h1>
        <p className="mt-1 text-body text-neutral-500">{t("subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <StatCard label={t("statLostDeals")} value={report.total_lost_deals} />
        <StatCard
          label={t("statLostValue")}
          value={formatCurrency(report.total_lost_value, locale)}
          status={report.total_lost_value > 0 ? "critical" : "default"}
        />
        <StatCard
          label={t("statTopReason")}
          value={
            report.breakdown[0]?.reason.replaceAll("_", " ") ??
            t("topReasonNone")
          }
          subtitle={t("last90Days")}
        />
      </div>

      <EarlyWarningPanel
        hasEnoughData={earlyWarnings.has_enough_data}
        totalLossesAnalyzed={earlyWarnings.total_losses_analyzed}
        topLossReason={earlyWarnings.top_loss_reason}
        topLossPercentage={earlyWarnings.top_loss_percentage}
        warnings={earlyWarnings.warnings}
      />

      <LossReportPanel />

      <section className="space-y-4">
        <div>
          <h2 className="text-h2 text-neutral-900">{t("breakdownTitle")}</h2>
          <p className="text-body text-neutral-500">{t("breakdownSubtitle")}</p>
        </div>
        <LossReasonBreakdown breakdown={report.breakdown} />
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-h2 text-neutral-900">{t("topCompaniesTitle")}</h2>
          <p className="text-body text-neutral-500">
            {t("topCompaniesSubtitle")}
          </p>
        </div>
        <Card>
          <CardBody>
            {report.top_lost_companies.length === 0 ? (
              <EmptyState
                title={t("noCompaniesTitle")}
                description={t("noCompaniesDesc")}
                cta={{ label: t("reviewPipeline"), href: "/dashboard" }}
                variant="subtle"
              />
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
                      {formatCurrency(company.value, locale)}
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
