import { getTranslations } from "next-intl/server";

import { toBcp47 } from "@/i18n/locale";
import { formatAccountAmount } from "@/lib/accounts/value";
import type { Currency } from "@/lib/accounts/retention";
import type { RetentionSummary } from "@/lib/accounts/retention-service";
import { Card, CardBody } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";

/**
 * Retention & recurring-revenue roll-up for the CS-Health overview.
 *
 * Deterministic finance metrics — NO AI, NO health-score coupling. Shows the
 * honest building blocks that are computable today (recurring MRR, active vs.
 * churned, trailing churn) plus true NRR once value history spans a period; until
 * then NRR is marked "available from <date>" rather than invented from one point.
 * one_time (project) accounts are excluded from every recurring figure here.
 */
export async function RetentionSection({
  retention,
  locale,
}: {
  retention: RetentionSummary;
  locale: string;
}) {
  const t = await getTranslations("health.overview");
  const { blocks, nrr } = retention;

  // Primary recurring-revenue currency = the bucket with the largest monthly MRR.
  const currencyBuckets = (
    Object.entries(blocks.recurringMrrByCurrency) as [Currency, number][]
  )
    .filter(([, amount]) => amount > 0)
    .sort((a, b) => b[1] - a[1]);
  const [primaryCurrency, primaryMrr] = currencyBuckets[0] ?? ["EUR", 0];
  const otherCurrencyCount = Math.max(0, currencyBuckets.length - 1);

  const recurringValue = formatAccountAmount(primaryMrr, primaryCurrency, locale);
  const recurringArr = formatAccountAmount(
    primaryMrr * 12,
    primaryCurrency,
    locale,
  );
  let recurringSub = t("recurringRevenueSub", { arr: recurringArr });
  if (otherCurrencyCount > 0) {
    recurringSub = `${recurringSub} · ${t("recurringRevenueMulti", {
      count: otherCurrencyCount,
    })}`;
  }

  // NRR tile.
  const nrrOk = nrr.status === "ok";
  const nrrValue = nrrOk ? `${(nrr.primary.nrr * 100).toFixed(0)}%` : "—";
  let nrrSub: string;
  if (nrrOk) {
    nrrSub = t("nrrPeriodSub", { months: retention.periodMonths });
  } else if (nrr.availableFrom) {
    const when = new Date(nrr.availableFrom).toLocaleDateString(
      toBcp47(locale),
      { year: "numeric", month: "long" },
    );
    nrrSub = t("nrrPendingFrom", { date: when });
  } else {
    nrrSub = t("nrrPending");
  }
  const nrrStatus: "default" | "success" | "warning" = !nrrOk
    ? "default"
    : nrr.primary.nrr >= 1
      ? "success"
      : "warning";

  // Active-customers subtitle: surface the excluded project (one_time) accounts.
  const activeSub =
    blocks.oneTimeCount > 0
      ? t("statActiveCustomersSub", { count: blocks.oneTimeCount })
      : undefined;

  const churnRatePct = (blocks.trailingChurnRate * 100).toFixed(0);

  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-h2 text-neutral-900">{t("retentionTitle")}</h2>
        <p className="text-body text-neutral-500">{t("retentionSubtitle")}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard
          label={t("statRecurringRevenue")}
          value={recurringValue}
          subtitle={recurringSub}
          status="primary"
        />
        <StatCard
          label={t("statNrr")}
          value={nrrValue}
          subtitle={nrrSub}
          status={nrrStatus}
        />
        <StatCard
          label={t("statActiveCustomers")}
          value={blocks.activeRecurringCount}
          subtitle={activeSub}
        />
        <StatCard
          label={t("statChurn90d")}
          value={blocks.churnedInWindow}
          subtitle={t("churnRateSub", { rate: churnRatePct })}
          status={blocks.churnedInWindow > 0 ? "warning" : "default"}
        />
      </div>

      <Card>
        <CardBody className="space-y-1">
          <p className="text-small text-neutral-600">{t("retentionNote")}</p>
          <p className="text-caption text-neutral-400">{t("nrrTargetRef")}</p>
        </CardBody>
      </Card>
    </section>
  );
}
