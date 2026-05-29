import { getLocale, getTranslations } from "next-intl/server";
import { toBcp47 } from "@/i18n/locale";
import { Badge } from "@/components/ui/Badge";
import { Card, CardBody } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import type { LossReportData } from "@/lib/loss/reports";
import type { LossReasonType } from "@/lib/loss/extractor";

const REASON_LABELS: Record<LossReasonType, string> = {
  pricing: "Pricing",
  compliance: "Compliance",
  competitor: "Competitor",
  timing: "Timing",
  budget: "Budget",
  champion_lost: "Champion Lost",
  feature_gap: "Feature Gap",
  no_decision: "No Decision",
  internal_priority: "Internal Priority",
  other: "Other",
};

function formatCurrency(value: number, locale: string): string {
  return new Intl.NumberFormat(toBcp47(locale), {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

export async function LossReasonBreakdown({
  breakdown,
}: {
  breakdown: LossReportData["breakdown"];
}) {
  const t = await getTranslations("sales.loss");
  const locale = await getLocale();
  if (breakdown.length === 0) {
    return (
      <EmptyState
        title={t("lrNoneTitle")}
        description={t("lrNoneDesc")}
        cta={{ label: t("reviewPipeline"), href: "/dashboard" }}
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {breakdown.map((item) => (
        <Card key={item.reason}>
          <CardBody className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-h3 text-neutral-900">
                  {REASON_LABELS[item.reason]}
                </div>
                <div className="text-small text-neutral-500">
                  {t("lrLostDeals", { count: item.count })}
                </div>
              </div>
              <Badge variant={item.percentage >= 40 ? "critical" : "default"}>
                {item.percentage.toFixed(0)}%
              </Badge>
            </div>

            <div>
              <div className="text-display text-neutral-900">
                {formatCurrency(item.value, locale)}
              </div>
              <div className="text-small text-neutral-500">
                {t("lrLostValue")}
              </div>
            </div>

            {item.sample_quotes.length > 0 && (
              <div className="space-y-2">
                <div className="text-caption font-medium uppercase tracking-wider text-neutral-400">
                  {t("lrEvidence")}
                </div>
                {item.sample_quotes.map((quote) => (
                  <blockquote
                    key={quote}
                    className="border-l-2 border-neutral-200 pl-3 text-small text-neutral-600"
                  >
                    {quote}
                  </blockquote>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
