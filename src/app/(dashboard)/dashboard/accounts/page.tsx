import Link from "next/link";
import { redirect } from "next/navigation";
import { requireOrgId, OrgResolutionError } from "@/lib/auth/org";
import { getAccounts } from "@/lib/accounts/service";
import {
  getLatestHealthScoresForAccounts,
  type HealthScoreRecord,
} from "@/lib/accounts/health-service";
import { getDealsByOrg } from "@/lib/deals/service";
import { ACCOUNT_STATUS_META } from "@/lib/accounts/status";
import {
  AccountsToolbar,
  type ConvertibleDeal,
} from "@/components/dashboard/AccountsToolbar";
import { HealthBadge } from "@/components/dashboard/HealthBadge";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Table, THead, TBody, TH, TR, TD } from "@/components/ui/Table";
import type { Account, HealthLevel } from "@/lib/accounts/types";

interface AccountRow {
  account: Account;
  health: HealthScoreRecord | null;
}
type AnalyzedRow = { account: Account; health: HealthScoreRecord };

// Most critical first when sorting "Needs attention".
/** Lower rank = more urgent. Used to sort "Needs attention" — criticals
 *  surface first, thriving last. Matches the 5-level health classifier. */
const LEVEL_RANK: Record<HealthLevel, number> = {
  critical: 0,
  at_risk: 1,
  lukewarm: 2,
  healthy: 3,
  thriving: 4,
};

/** CHAMPION_DISENGAGEMENT → "Champion Disengagement" (matches the drilldown labels). */
function formatSignal(type: string): string {
  return type
    .split("_")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ");
}

/** Strongest churn signal (highest confidence) of a health record, or "—". */
function topSignal(health: HealthScoreRecord | null): string {
  if (!health || health.signals.length === 0) return "—";
  const top = [...health.signals].sort((a, b) => b.confidence - a.confidence)[0];
  return formatSignal(top.type);
}

function BuildingIcon() {
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
        d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21"
      />
    </svg>
  );
}

/**
 * One section (Needs attention / Healthy / Not analyzed). Columns are health-only
 * — Account · Health · Top signal · Status. NO MRR/Renewal (those assume a
 * subscription model that doesn't fit every customer; they return later). The
 * Status column shows the MANUAL account.status, kept distinct from the COMPUTED
 * health level shown in the badge.
 */
function Section({
  title,
  count,
  rows,
  muted = false,
}: {
  title: string;
  count: number;
  rows: AccountRow[];
  muted?: boolean;
}) {
  return (
    <section>
      <h2 className="mb-3 text-h2 text-neutral-900">
        {title} <span className="text-body text-neutral-400">({count})</span>
      </h2>
      <Card className="overflow-hidden">
        <Table>
          <THead>
            <tr>
              <TH>Account</TH>
              <TH>Health</TH>
              <TH>Top signal</TH>
              <TH>Status</TH>
            </tr>
          </THead>
          <TBody>
            {rows.map(({ account, health }) => {
              const statusMeta = ACCOUNT_STATUS_META[account.status];
              return (
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
                      score={health?.health_score}
                      level={health?.health_level}
                      size="sm"
                    />
                  </TD>
                  <TD className={muted ? "text-neutral-400" : "text-neutral-700"}>
                    {topSignal(health)}
                  </TD>
                  <TD>
                    <Badge variant={statusMeta.variant}>
                      {statusMeta.label}
                    </Badge>
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      </Card>
    </section>
  );
}

export default async function AccountsPage() {
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

  const accounts = await getAccounts(orgId);
  // Pure reads — no AI, no Opus. One batch query for all accounts' latest score.
  const [deals, healthMap] = await Promise.all([
    getDealsByOrg(orgId),
    getLatestHealthScoresForAccounts(
      orgId,
      accounts.map((a) => a.id),
    ),
  ]);

  // Won deals not yet turned into an account → offer one-click conversion.
  const convertedDealIds = new Set(
    accounts
      .map((a) => a.sourceDealId)
      .filter((id): id is string => id !== null),
  );
  const convertibleDeals: ConvertibleDeal[] = deals
    .filter((d) => d.outcome === "won" && !convertedDealIds.has(d.id))
    .map((d) => ({ id: d.id, name: d.name, companyName: d.companyName }));

  const rows: AccountRow[] = accounts.map((account) => ({
    account,
    health: healthMap.get(account.id) ?? null,
  }));
  const analyzed = rows.filter((r): r is AnalyzedRow => r.health !== null);

  // Group + sort by the COMPUTED health level (not the manual account.status).
  // "Doing well" buckets healthy + thriving (the two positive levels).
  // "Needs attention" everything else — lukewarm, at_risk, critical.
  const needsAttention = analyzed
    .filter(
      (r) =>
        r.health.health_level !== "healthy" &&
        r.health.health_level !== "thriving",
    )
    .sort((a, b) => {
      const byLevel =
        LEVEL_RANK[a.health.health_level] - LEVEL_RANK[b.health.health_level];
      return byLevel !== 0
        ? byLevel
        : a.health.health_score - b.health.health_score; // lowest score first
    });
  const healthy = analyzed
    .filter(
      (r) =>
        r.health.health_level === "healthy" ||
        r.health.health_level === "thriving",
    )
    .sort((a, b) => b.health.health_score - a.health.health_score);
  const notAnalyzed = rows
    .filter((r) => r.health === null)
    .sort((a, b) =>
      a.account.companyName.localeCompare(b.account.companyName),
    );

  const criticalCount = analyzed.filter(
    (r) => r.health.health_level === "critical",
  ).length;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-display text-neutral-900">Accounts</h1>
        <p className="mt-1 text-body text-neutral-500">
          {accounts.length === 0
            ? "Create a customer account manually or from a won deal."
            : `${accounts.length} customer ${
                accounts.length === 1 ? "account" : "accounts"
              } · health overview`}
        </p>
      </div>

      {/* Health-based stats */}
      {accounts.length > 0 && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard
            label="Needs attention"
            value={needsAttention.length}
            status={needsAttention.length > 0 ? "critical" : "default"}
          />
          <StatCard
            label="Critical"
            value={criticalCount}
            status={criticalCount > 0 ? "critical" : "default"}
          />
          <StatCard label="Healthy" value={healthy.length} />
          <StatCard label="Not analyzed" value={notAnalyzed.length} />
        </div>
      )}

      <AccountsToolbar convertibleDeals={convertibleDeals} />

      {accounts.length === 0 ? (
        <EmptyState
          icon={<BuildingIcon />}
          title="No accounts yet"
          description="Customer accounts are the heart of CS Health. Add one manually, or create an account from a deal you've already won — its company and contact details are copied over."
        />
      ) : (
        <div className="space-y-8">
          {needsAttention.length > 0 ? (
            <Section
              title="Needs attention"
              count={needsAttention.length}
              rows={needsAttention}
            />
          ) : analyzed.length > 0 ? (
            <div className="rounded-lg border border-success-500/30 bg-success-50 px-4 py-3 text-body text-success-700">
              All clear — no analyzed account currently needs attention.
            </div>
          ) : null}

          {healthy.length > 0 && (
            <Section title="Healthy" count={healthy.length} rows={healthy} />
          )}

          {notAnalyzed.length > 0 && (
            <Section
              title="Not analyzed"
              count={notAnalyzed.length}
              rows={notAnalyzed}
              muted
            />
          )}
        </div>
      )}
    </div>
  );
}
