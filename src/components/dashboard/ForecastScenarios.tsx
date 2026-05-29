import { getLocale, getTranslations } from "next-intl/server";
import { toBcp47 } from "@/i18n/locale";
import { Card, CardBody } from "@/components/ui/Card";

interface ForecastScenariosProps {
  bestCase: number;
  likelyCase: number;
  worstCase: number;
  currency?: "EUR" | "USD";
}

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

export async function ForecastScenarios({
  bestCase,
  likelyCase,
  worstCase,
  currency = "EUR",
}: ForecastScenariosProps) {
  const t = await getTranslations("sales.forecast");
  const locale = await getLocale();
  const scenarios = [
    {
      id: "best",
      label: t("scenarioBest"),
      value: bestCase,
      description: t("scenarioBestDesc"),
      tone: "text-success-700",
    },
    {
      id: "likely",
      label: t("scenarioLikely"),
      value: likelyCase,
      description: t("scenarioLikelyDesc"),
      tone: "text-primary-700",
    },
    {
      id: "worst",
      label: t("scenarioWorst"),
      value: worstCase,
      description: t("scenarioWorstDesc"),
      tone: "text-danger-700",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {scenarios.map((scenario) => (
        <Card key={scenario.id}>
          <CardBody>
            <div className="text-caption text-neutral-500 mb-2 uppercase tracking-wider font-medium">
              {scenario.label}
            </div>
            <div className={`text-display ${scenario.tone}`}>
              {formatCurrency(scenario.value, currency, locale)}
            </div>
            <div className="mt-1 text-small text-neutral-500">
              {scenario.description}
            </div>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}
