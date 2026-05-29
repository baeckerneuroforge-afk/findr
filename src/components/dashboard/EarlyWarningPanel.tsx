import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { toBcp47 } from "@/i18n/locale";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import type {
  DealLossWarning,
  WarningStrength,
} from "@/lib/loss/early-warning";
import type { LossReasonType } from "@/lib/loss/extractor";

interface EarlyWarningPanelProps {
  hasEnoughData: boolean;
  totalLossesAnalyzed: number;
  topLossReason?: LossReasonType;
  topLossPercentage?: number;
  warnings: DealLossWarning[];
}

const SIGNAL_LABELS: Record<string, string> = {
  champion_loss: "Champion loss",
  competitor_pressure: "Competitor pressure",
  stalling: "Stalling",
  stalling_pattern: "Stalling",
  budget_friction: "Budget friction",
  late_decision_maker: "Late decision-maker",
  stakeholder_churn: "Stakeholder churn",
  engagement_drop: "Engagement drop",
  multi_threading_failure: "Multi-threading",
  champion_disengagement: "Champion disengagement",
};

function formatSignal(sig: string): string {
  return (
    SIGNAL_LABELS[sig] ??
    sig.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

function formatLossReason(reason: LossReasonType): string {
  return reason.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatCurrency(value: number, locale: string): string {
  return new Intl.NumberFormat(toBcp47(locale), {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function strengthBadgeVariant(strength: WarningStrength): BadgeVariant {
  if (strength === "high") return "critical";
  return "default";
}

function strengthLabelKey(
  strength: WarningStrength,
): "ewStrengthHigh" | "ewStrengthMedium" | "ewStrengthLow" {
  if (strength === "high") return "ewStrengthHigh";
  if (strength === "medium") return "ewStrengthMedium";
  return "ewStrengthLow";
}

export async function EarlyWarningPanel({
  hasEnoughData,
  totalLossesAnalyzed,
  topLossReason,
  topLossPercentage,
  warnings,
}: EarlyWarningPanelProps) {
  const t = await getTranslations("sales.loss");
  const locale = await getLocale();
  if (!hasEnoughData) {
    return (
      <Card>
        <CardBody>
          <h2 className="text-h2 text-neutral-900">{t("ewTitle")}</h2>
          <p className="mt-1 text-body text-neutral-500">
            {t("ewNeedData", { count: totalLossesAnalyzed })}
          </p>
        </CardBody>
      </Card>
    );
  }

  const headlineReason =
    topLossReason && topLossPercentage !== undefined
      ? t("ewHeadline", {
          pct: topLossPercentage,
          reason: formatLossReason(topLossReason),
        })
      : null;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="text-h2 text-neutral-900">{t("ewTitle")}</h2>
            <p className="mt-1 text-small text-neutral-500">{t("ewSubtitle")}</p>
          </div>
          <span className="text-caption text-neutral-500 uppercase tracking-wider">
            {t("ewLossesAnalyzed", { count: totalLossesAnalyzed })}
          </span>
        </div>
      </CardHeader>
      <CardBody>
        {headlineReason && (
          <div className="mb-5 rounded-md border border-primary-100 bg-primary-50 px-4 py-3 text-body text-neutral-900">
            {headlineReason}
          </div>
        )}

        {warnings.length === 0 ? (
          <p className="text-body text-neutral-500">{t("ewNoWarnings")}</p>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {warnings.map((warning) => (
              <li
                key={warning.deal_id}
                className="flex flex-wrap items-start justify-between gap-3 py-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      href={`/dashboard/deals/${warning.deal_id}`}
                      className="text-body-strong text-neutral-900 hover:text-primary-700"
                    >
                      {warning.deal_name}
                    </Link>
                    <Badge variant={strengthBadgeVariant(warning.warning_strength)}>
                      {t(strengthLabelKey(warning.warning_strength))}
                    </Badge>
                  </div>
                  <p className="mt-1 text-small text-neutral-500">
                    {t("ewShowsPattern", {
                      reason: formatLossReason(warning.matched_pattern),
                      pct: warning.pattern_percentage,
                    })}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {warning.matching_signals.map((sig) => (
                      <span
                        key={sig}
                        className="rounded-md border border-neutral-200 bg-neutral-50 px-2 py-0.5 text-caption text-neutral-700"
                      >
                        {formatSignal(sig)}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-body-strong text-neutral-900">
                    {formatCurrency(warning.deal_amount, locale)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
