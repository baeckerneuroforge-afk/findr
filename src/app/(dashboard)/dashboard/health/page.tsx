import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { toBcp47 } from "@/i18n/locale";
import { requireOrgId, OrgResolutionError } from "@/lib/auth/org";
import { getAccounts } from "@/lib/accounts/service";
import { getRetentionSummary } from "@/lib/accounts/retention-service";
import { accountValueKey, formatAccountAmount } from "@/lib/accounts/value";
import { RetentionSection } from "@/components/dashboard/RetentionSection";
import {
  getLatestHealthScoresForAccounts,
  type HealthScoreRecord,
} from "@/lib/accounts/health-service";
import type { Account, HealthLevel } from "@/lib/accounts/types";
import { StatCard } from "@/components/ui/StatCard";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Badge } from "@/components/ui/Badge";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { HealthBadge } from "@/components/dashboard/HealthBadge";
import { HealthLevelBreakdown } from "@/components/dashboard/HealthLevelBreakdown";

/**
 * Customer Health Overview — the CS-side reporting page, parallel to
 * /dashboard/forecast on the Sales side. NO new AI calls: this is a pure
 * roll-up of the latest health analyses already stored per account.
 *
 * Sections (top to bottom):
 *   1. KPI tiles  — analyzed total, needs-attention, critical, with signals
 *   2. Health distribution chart (the 5-level breakdown)
 *   3. Top churn signals across all accounts (frequency rollup with sample)
 *   4. Most urgent accounts list, linking to each account's detail page
 */

// ── Static label maps ──────────────────────────────────────────────────────

// Churn-signal vocabulary is analysis taxonomy — kept in the source language
// in both locales (mirrors Etappe 3's SIGNAL_LABELS) and interpolated into the
// translated chrome as a {var}. Only the chrome around it is translated.
const SIGNAL_LABELS: Record<string, string> = {
  CHAMPION_LOSS: "Champion Loss",
  CHAMPION_DISENGAGEMENT: "Champion Disengagement",
  STAKEHOLDER_CHURN: "Stakeholder Churn",
  LATE_DECISION_MAKER: "Late Decision Maker",
  BUDGET_FRICTION: "Budget Friction",
  COMPETITOR_PRESSURE: "Competitor Pressure",
  STALLING_PATTERN: "Stalling Pattern",
  ENGAGEMENT_DROP: "Engagement Drop",
  MULTI_THREADING_FAILURE: "Multi-Threading Failure",
};

/** Lower rank = more urgent. Mirrors the order in /dashboard/accounts. */
const LEVEL_RANK: Record<HealthLevel, number> = {
  critical: 0,
  at_risk: 1,
  lukewarm: 2,
  healthy: 3,
  thriving: 4,
};

// ── Helpers ────────────────────────────────────────────────────────────────

interface AnalyzedRow {
  account: Account;
  health: HealthScoreRecord;
}

function formatRenewal(renewalDate: string | null, locale: string): string {
  if (!renewalDate) return "—";
  const parsed = new Date(renewalDate);
  if (Number.isNaN(parsed.getTime())) return renewalDate;
  return parsed.toLocaleDateString(toBcp47(locale), {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function topSignalType(health: HealthScoreRecord): string | null {
  if (health.signals.length === 0) return null;
  const top = [...health.signals].sort(
    (a, b) => b.confidence - a.confidence,
  )[0];
  return SIGNAL_LABELS[top.type] ?? top.type;
}

function HealthIcon() {
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
        d="M3 12h3.75l2.25-6 4.5 12 2.25-6H21"
      />
    </svg>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default async function CustomerHealthOverviewPage() {
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

  const t = await getTranslations("health.overview");
  // Account value labels (amount + period suffix) live in health.common.
  const tv = await getTranslations("health.common");
  const locale = await getLocale();

  // One batch fetch per dimension — no AI, no Opus, all reads.
  const accounts = await getAccounts(orgId);
  // Deterministic retention/NRR roll-up over the full account base (independent
  // of whether an account has a health analysis yet).
  const retention = await getRetentionSummary(orgId, accounts);
  const healthMap = await getLatestHealthScoresForAccounts(
    orgId,
    accounts.map((a) => a.id),
  );

  // Pair each account with its latest health (drop those without an analysis).
  const analyzed: AnalyzedRow[] = accounts
    .map((account) => ({
      account,
      health: healthMap.get(account.id) ?? null,
    }))
    .filter((row): row is AnalyzedRow => row.health !== null);

  // Empty-state: no account has been analyzed yet.
  if (analyzed.length === 0) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-display text-neutral-900">{t("title")}</h1>
          <p className="mt-1 text-body text-neutral-500">{t("subtitle")}</p>
        </div>

        {accounts.length > 0 && (
          <RetentionSection retention={retention} locale={locale} />
        )}

        <EmptyState
          icon={<HealthIcon />}
          title={t("emptyTitle")}
          description={
            accounts.length === 0
              ? t("emptyDescNoAccounts")
              : t("emptyDescHasAccounts")
          }
          cta={{
            label:
              accounts.length === 0 ? t("ctaCreate") : t("ctaGoToAccounts"),
            href: "/dashboard/accounts",
          }}
        />
      </div>
    );
  }

  // ── Aggregations ────────────────────────────────────────────────────────

  const countByLevel: Record<HealthLevel, number> = {
    critical: 0,
    at_risk: 0,
    lukewarm: 0,
    healthy: 0,
    thriving: 0,
  };
  for (const { health } of analyzed) {
    countByLevel[health.health_level] =
      (countByLevel[health.health_level] ?? 0) + 1;
  }
  const needsAttentionCount =
    countByLevel.critical + countByLevel.at_risk + countByLevel.lukewarm;
  const accountsWithSignals = analyzed.filter(
    (r) => r.health.signals.length > 0,
  ).length;

  // Top churn-signal rollup: count of distinct signal occurrences across all
  // latest health snapshots + one sample evidence quote per type (first found).
  const signalRollup = new Map<
    string,
    { count: number; sample: { quote: string; accountName: string } | null }
  >();
  for (const { account, health } of analyzed) {
    for (const signal of health.signals) {
      const entry = signalRollup.get(signal.type) ?? { count: 0, sample: null };
      entry.count += 1;
      if (!entry.sample && signal.quotes.length > 0) {
        entry.sample = {
          quote: signal.quotes[0],
          accountName: account.companyName,
        };
      }
      signalRollup.set(signal.type, entry);
    }
  }
  const topSignals = Array.from(signalRollup.entries())
    .map(([type, entry]) => ({ type, ...entry }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  // Most-urgent accounts: critical → at_risk → lukewarm, then score-asc.
  const urgent = analyzed
    .filter(
      (r) =>
        r.health.health_level !== "healthy" &&
        r.health.health_level !== "thriving",
    )
    .sort((a, b) => {
      const byLevel =
        LEVEL_RANK[a.health.health_level] - LEVEL_RANK[b.health.health_level];
      if (byLevel !== 0) return byLevel;
      return a.health.health_score - b.health.health_score;
    })
    .slice(0, 10);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-display text-neutral-900">{t("title")}</h1>
        <p className="mt-1 text-body text-neutral-500">
          {t("subtitleCount", { count: analyzed.length })}
        </p>
      </div>

      {/* Retention & recurring revenue (deterministic, no AI) */}
      <RetentionSection retention={retention} locale={locale} />

      {/* KPI tiles */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard label={t("statAnalyzed")} value={analyzed.length} />
        <StatCard
          label={t("statNeedsAttention")}
          value={needsAttentionCount}
          subtitle={t("statNeedsAttentionSub")}
          status={needsAttentionCount > 0 ? "warning" : "default"}
        />
        <StatCard
          label={t("statCritical")}
          value={countByLevel.critical}
          status={countByLevel.critical > 0 ? "critical" : "default"}
        />
        <StatCard
          label={t("statWithSignals")}
          value={accountsWithSignals}
          subtitle={t("statWithSignalsSub")}
          status={accountsWithSignals > 0 ? "warning" : "default"}
        />
      </div>

      {/* Health distribution */}
      <HealthLevelBreakdown counts={countByLevel} />

      {/* Top churn signals */}
      <section className="space-y-4">
        <div>
          <h2 className="text-h2 text-neutral-900">{t("topSignalsTitle")}</h2>
          <p className="text-body text-neutral-500">
            {t("topSignalsSubtitle")}
          </p>
        </div>
        {topSignals.length === 0 ? (
          <Card>
            <CardBody>
              <p className="py-4 text-center text-body text-neutral-500">
                {t("noSignals")}
              </p>
            </CardBody>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {topSignals.map((s) => {
              const label = SIGNAL_LABELS[s.type] ?? s.type;
              const sharePct =
                analyzed.length > 0 ? (s.count / analyzed.length) * 100 : 0;
              return (
                <Card key={s.type}>
                  <CardBody className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-h3 text-neutral-900">{label}</div>
                        <div className="text-small text-neutral-500">
                          {t("signalAccountCount", { count: s.count })}
                        </div>
                      </div>
                      <Badge variant={sharePct >= 25 ? "critical" : "default"}>
                        {sharePct.toFixed(0)}%
                      </Badge>
                    </div>
                    {s.sample && (
                      <div className="space-y-1">
                        <div className="text-caption font-medium uppercase tracking-wider text-neutral-400">
                          {t("sample", { account: s.sample.accountName })}
                        </div>
                        <blockquote className="border-l-2 border-neutral-200 pl-3 text-small text-neutral-600">
                          {s.sample.quote}
                        </blockquote>
                      </div>
                    )}
                  </CardBody>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      {/* Most urgent accounts */}
      <section className="space-y-4">
        <div>
          <h2 className="text-h2 text-neutral-900">{t("urgentTitle")}</h2>
          <p className="text-body text-neutral-500">{t("urgentSubtitle")}</p>
        </div>
        {urgent.length === 0 ? (
          <Card>
            <CardBody>
              <p className="py-4 text-center text-body text-neutral-500">
                {t("urgentEmpty")}
              </p>
            </CardBody>
          </Card>
        ) : (
          <Card>
            <Table>
              <THead>
                <TR>
                  <TH>{t("colAccount")}</TH>
                  <TH>{t("colHealth")}</TH>
                  <TH>{t("colTopSignal")}</TH>
                  <TH className="text-right">{t("colValue")}</TH>
                  <TH>{t("colRenewal")}</TH>
                </TR>
              </THead>
              <TBody>
                {urgent.map(({ account, health }) => (
                  <TR key={account.id}>
                    <TD>
                      <Link
                        href={`/dashboard/accounts/${account.id}`}
                        className="text-body-strong text-neutral-900 hover:text-primary-700 hover:underline"
                      >
                        {account.companyName}
                      </Link>
                    </TD>
                    <TD>
                      <HealthBadge
                        score={health.health_score}
                        level={health.health_level}
                        size="sm"
                      />
                    </TD>
                    <TD className="text-neutral-700">
                      {topSignalType(health) ?? "—"}
                    </TD>
                    <TD className="text-right whitespace-nowrap font-medium text-neutral-900">
                      {account.mrr === null
                        ? "—"
                        : tv(accountValueKey(account.valueType), {
                            amount: formatAccountAmount(
                              account.mrr,
                              account.currency,
                              locale,
                            ),
                          })}
                    </TD>
                    <TD className="text-neutral-700 whitespace-nowrap">
                      {formatRenewal(account.renewalDate, locale)}
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </Card>
        )}
      </section>
    </div>
  );
}
