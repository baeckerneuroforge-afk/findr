import { Card, CardBody } from "@/components/ui/Card";

interface ForecastScenariosProps {
  bestCase: number;
  likelyCase: number;
  worstCase: number;
  currency?: "EUR" | "USD";
}

function formatCurrency(value: number, currency: "EUR" | "USD") {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

export function ForecastScenarios({
  bestCase,
  likelyCase,
  worstCase,
  currency = "EUR",
}: ForecastScenariosProps) {
  const scenarios = [
    {
      label: "Best case",
      value: bestCase,
      description: "High-probability deals close",
      tone: "text-success-700",
    },
    {
      label: "Likely",
      value: likelyCase,
      description: "Risk-adjusted weighted forecast",
      tone: "text-primary-700",
    },
    {
      label: "Worst case",
      value: worstCase,
      description: "Only near-certain deals close",
      tone: "text-danger-700",
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      {scenarios.map((scenario) => (
        <Card key={scenario.label}>
          <CardBody>
            <div className="text-caption text-neutral-500 mb-2 uppercase tracking-wider font-medium">
              {scenario.label}
            </div>
            <div className={`text-display ${scenario.tone}`}>
              {formatCurrency(scenario.value, currency)}
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
