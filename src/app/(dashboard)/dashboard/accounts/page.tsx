import Link from "next/link";
import { redirect } from "next/navigation";
import { requireOrgId, OrgResolutionError } from "@/lib/auth/org";
import { getAccounts } from "@/lib/accounts/service";
import { getDealsByOrg } from "@/lib/deals/service";
import { ACCOUNT_STATUS_META } from "@/lib/accounts/status";
import {
  AccountsToolbar,
  type ConvertibleDeal,
} from "@/components/dashboard/AccountsToolbar";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { StatCard } from "@/components/ui/StatCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { Table, THead, TBody, TH, TR, TD } from "@/components/ui/Table";
import type { Account } from "@/lib/accounts/types";

function formatMrr(mrr: number | null, currency: "USD" | "EUR"): string {
  if (mrr === null) return "—";
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(mrr);
}

function formatDate(date: string | null): string {
  if (!date) return "—";
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString("de-DE", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
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

  const [accounts, deals] = await Promise.all([
    getAccounts(orgId),
    getDealsByOrg(orgId),
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

  const active = accounts.filter((a) => a.status === "active").length;
  const atRisk = accounts.filter((a) => a.status === "at_risk").length;
  const churned = accounts.filter((a) => a.status === "churned").length;

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
              }`}
        </p>
      </div>

      {/* Stats */}
      {accounts.length > 0 && (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard label="Total accounts" value={accounts.length} />
          <StatCard label="Active" value={active} />
          <StatCard
            label="At risk"
            value={atRisk}
            status={atRisk > 0 ? "critical" : "default"}
          />
          <StatCard label="Churned" value={churned} />
        </div>
      )}

      <AccountsToolbar convertibleDeals={convertibleDeals} />

      {/* Table */}
      {accounts.length === 0 ? (
        <EmptyState
          icon={<BuildingIcon />}
          title="No accounts yet"
          description="Customer accounts are the heart of CS Health. Add one manually, or create an account from a deal you've already won — its company and contact details are copied over."
        />
      ) : (
        <Card className="overflow-hidden">
          <Table>
            <THead>
              <tr>
                <TH>Company</TH>
                <TH>Sponsor</TH>
                <TH className="text-right">MRR</TH>
                <TH>Renewal</TH>
                <TH>Status</TH>
              </tr>
            </THead>
            <TBody>
              {accounts.map((account: Account) => {
                const meta = ACCOUNT_STATUS_META[account.status];
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
                    <TD>{account.sponsorName ?? "—"}</TD>
                    <TD className="text-right tabular-nums">
                      {formatMrr(account.mrr, account.currency)}
                    </TD>
                    <TD>{formatDate(account.renewalDate)}</TD>
                    <TD>
                      <Badge variant={meta.variant}>{meta.label}</Badge>
                    </TD>
                  </TR>
                );
              })}
            </TBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
