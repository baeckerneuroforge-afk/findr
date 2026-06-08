import { getLocale, getTranslations } from "next-intl/server";
import { toBcp47 } from "@/i18n/locale";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import type { StageForecastBreakdown } from "@/lib/forecast/service";

interface StageBreakdownChartProps {
  stages: StageForecastBreakdown[];
  currency?: "EUR" | "USD";
}

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

function formatCurrency(
  value: number,
  currency: "EUR" | "USD",
  locale: string,
) {
  return new Intl.NumberFormat(toBcp47(locale), {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export async function StageBreakdownChart({
  stages,
  currency = "EUR",
}: StageBreakdownChartProps) {
  const t = await getTranslations("sales.forecast");
  const locale = await getLocale();
  const width = 760;
  const rowHeight = 54;
  const labelWidth = 138;
  const rightPadding = 24;
  const topPadding = 16;
  const chartWidth = width - labelWidth - rightPadding;
  const height = Math.max(120, topPadding * 2 + stages.length * rowHeight);
  const maxValue = Math.max(...stages.map((stage) => stage.value), 1);

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-h2 text-neutral-900">{t("stageTitle")}</h2>
            <p className="text-small text-neutral-500 mt-1">
              {t("stageSubtitle")}
            </p>
          </div>
          <div className="flex items-center gap-4 text-caption text-neutral-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-neutral-300" />
              {t("legendPipeline")}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-primary-500" />
              {t("legendWeighted")}
            </span>
          </div>
        </div>
      </CardHeader>
      <CardBody>
        {stages.length === 0 ? (
          <div className="py-8 text-center text-body text-neutral-500">
            {t("noOpenDeals")}
          </div>
        ) : (
          <svg
            viewBox={`0 0 ${width} ${height}`}
            className="w-full"
            role="img"
            aria-label={t("stageAria")}
          >
            {stages.map((stage, index) => {
              const y = topPadding + index * rowHeight;
              const valueWidth = (stage.value / maxValue) * chartWidth;
              const weightedWidth = (stage.weighted / maxValue) * chartWidth;

              return (
                <g key={stage.stage}>
                  <text
                    x="0"
                    y={y + 22}
                    fill="#171717"
                    fontSize="13"
                    fontWeight="600"
                  >
                    {STAGE_LABELS[stage.stage] ?? stage.stage}
                  </text>
                  <text x="0" y={y + 40} fill="#737373" fontSize="11">
                    {t("stageDealCount", { count: stage.count })}
                  </text>

                  <rect
                    x={labelWidth}
                    y={y + 6}
                    width={chartWidth}
                    height="10"
                    rx="5"
                    fill="#f5f5f5"
                  />
                  <rect
                    x={labelWidth}
                    y={y + 6}
                    width={valueWidth}
                    height="10"
                    rx="5"
                    fill="#d4d4d4"
                  />
                  <rect
                    x={labelWidth}
                    y={y + 25}
                    width={chartWidth}
                    height="10"
                    rx="5"
                    fill="#f5f5f5"
                  />
                  <rect
                    x={labelWidth}
                    y={y + 25}
                    width={weightedWidth}
                    height="10"
                    rx="5"
                    fill="#6f74ba"
                  />
                  <text
                    x={labelWidth + chartWidth}
                    y={y + 48}
                    fill="#737373"
                    fontSize="11"
                    textAnchor="end"
                  >
                    {t("weightedSuffix", {
                      value: formatCurrency(stage.weighted, currency, locale),
                    })}
                  </text>
                </g>
              );
            })}
          </svg>
        )}
      </CardBody>
    </Card>
  );
}
