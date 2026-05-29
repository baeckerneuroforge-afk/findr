import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { toBcp47 } from "@/i18n/locale";
import { requireOrgId, OrgResolutionError } from "@/lib/auth/org";
import { getAccount } from "@/lib/accounts/service";
import {
  getAccountTranscriptCount,
  getHealthScoreHistory,
  getLatestHealthScore,
} from "@/lib/accounts/health-service";
import { getSavePlays } from "@/lib/accounts/save-play-service";
import { getDealById } from "@/lib/deals/service";
import { getCallsByAccountId } from "@/lib/calls/service";
import { getLatestInsightsForCalls } from "@/lib/product-discovery/service";
import { getAccountCheckin } from "@/lib/voice-agent/session-service";
import { AccountHealthPanel } from "@/components/dashboard/AccountHealthPanel";
import { SavePlayPanel } from "@/components/dashboard/SavePlayPanel";
import { AccountCheckinPanel } from "@/components/dashboard/AccountCheckinPanel";
import { AccountMasterCard } from "@/components/dashboard/AccountMasterCard";
import { AccountStatusControl } from "@/components/dashboard/AccountStatusControl";
import { CallProductDiscoverySection } from "@/components/dashboard/CallProductDiscoverySection";

function formatMrr(
  mrr: number | null,
  currency: "USD" | "EUR",
  notSet: string,
  locale: string,
): string {
  if (mrr === null) return notSet;
  return new Intl.NumberFormat(toBcp47(locale), {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(mrr);
}

function formatDate(date: string | null, locale: string): string | null {
  if (!date) return null;
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date;
  return parsed.toLocaleDateString(toBcp47(locale), {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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

  const t = await getTranslations("health.detail");
  // Product-Discovery-Sektion (Etappe 5) ist eigene Domäne — eigener Namespace.
  const td = await getTranslations("research.discovery");
  const locale = await getLocale();

  const { id } = await params;
  const account = await getAccount(orgId, id);
  if (!account) notFound();

  // Resolve the originating deal (for a back-link), if any. May be gone.
  const sourceDeal = account.sourceDealId
    ? await getDealById(orgId, account.sourceDealId)
    : null;

  const renewal = formatDate(account.renewalDate, locale);

  // Health data (Etappe 2): latest score + history for the chart + transcript
  // count for the honesty line. Keyed by the account id (text column, consistent
  // with risk_scores.deal_id).
  const [latestHealth, healthHistory, transcriptCount, checkin, accountCalls] =
    await Promise.all([
      getLatestHealthScore(orgId, account.id),
      getHealthScoreHistory(orgId, account.id, 30),
      getAccountTranscriptCount(orgId, account.id),
      getAccountCheckin(orgId, account.id),
      getCallsByAccountId(orgId, account.id),
    ]);
  // Batched latest-insight lookup for the Product Discovery section below —
  // one indexed query for all of the account's calls. N+1-safe even with
  // many calls per account.
  const productDiscoveryByCall = await getLatestInsightsForCalls(
    orgId,
    accountCalls.map((c) => c.id),
  );
  const healthHistoryPoints = healthHistory.map((point) => ({
    date: point.analyzed_at,
    score: point.health_score,
    level: point.health_level,
  }));

  // Save-play only makes sense once a health analysis exists (mirrors the deal
  // page gating the Solution layer behind a risk analysis). Load the latest so it
  // survives a reload.
  const latestSavePlay = latestHealth
    ? ((await getSavePlays(orgId, account.id, 1))[0] ?? null)
    : null;

  return (
    <div>
      {/* Breadcrumb */}
      <nav
        aria-label="Breadcrumb"
        className="mb-6 flex items-center gap-2 text-small text-neutral-500"
      >
        <Link
          href="/dashboard/accounts"
          className="transition-colors hover:text-neutral-900"
        >
          {t("breadcrumbAccounts")}
        </Link>
        <span aria-hidden="true">/</span>
        <span className="truncate text-neutral-900">{account.companyName}</span>
      </nav>

      {/* Header */}
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-2 flex flex-wrap items-center gap-3">
            <h1 className="text-display text-neutral-900">
              {account.companyName}
            </h1>
            <AccountStatusControl
              accountId={account.id}
              initialStatus={account.status}
            />
          </div>
          <div className="flex flex-wrap items-center gap-3 text-body text-neutral-500">
            <span>{formatMrr(account.mrr, account.currency, t("mrrNotSet"), locale)}</span>
            {renewal && (
              <>
                <span aria-hidden="true">·</span>
                <span>{t("renews", { date: renewal })}</span>
              </>
            )}
            {account.sourceDealId && (
              <>
                <span aria-hidden="true">·</span>
                {sourceDeal ? (
                  <Link
                    href={`/dashboard/deals/${account.sourceDealId}`}
                    className="text-primary-700 hover:underline"
                  >
                    {t("fromDeal", { name: sourceDeal.name })}
                  </Link>
                ) : (
                  <span>{t("createdFromWonDeal")}</span>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Health score (Etappe 2): paste a post-sale transcript → score via the
          existing risk engine, inverted to health. */}
      <div className="mb-8">
        <AccountHealthPanel
          accountId={account.id}
          latest={
            latestHealth
              ? {
                  healthScore: latestHealth.health_score,
                  healthLevel: latestHealth.health_level,
                  overallReasoning: latestHealth.overall_reasoning,
                  recommendations: latestHealth.recommendations,
                  signals: latestHealth.signals,
                  analysisMethod: latestHealth.analysis_method,
                  analyzedAt: latestHealth.analyzed_at,
                }
              : null
          }
          history={healthHistoryPoints}
          transcriptCount={transcriptCount}
        />
      </div>

      {/* Save-play (retention recommendations) — only once a health score exists */}
      {latestHealth && (
        <div className="mb-8">
          <SavePlayPanel accountId={account.id} initialReport={latestSavePlay} />
        </div>
      )}

      {/* Customer check-in — short AI satisfaction chat that feeds the health score */}
      <div className="mb-8">
        <AccountCheckinPanel
          accountId={account.id}
          sponsorEmail={account.sponsorEmail}
          initialCheckin={checkin}
          initialEnabled={account.checkinEnabled}
          initialIntervalDays={account.checkinIntervalDays}
          lastCheckinAt={account.lastCheckinAt}
        />
      </div>

      {/* Product Discovery — per-call extraction of feature requests, pain
          points and themes. New here (the Account page never listed calls
          historically because it's account-level, not call-level). Each call
          gets the analyse-trigger plus, once analysed, the persisted insight
          card; the rollup of all of these across the org lives at
          /dashboard/product-discovery. */}
      <div className="mb-8">
        <h2 className="mb-4 text-h2 text-neutral-900">{td("sectionTitle")}</h2>
        {accountCalls.length === 0 ? (
          <p className="text-body text-neutral-500">{td("sectionEmpty")}</p>
        ) : (
          <div className="space-y-6">
            {accountCalls.map((call) => {
              const recordedAt = call.recorded_at
                ? new Date(call.recorded_at).toLocaleDateString(toBcp47(locale), {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })
                : "—";
              return (
                <div
                  key={call.id}
                  className="space-y-3 rounded-lg border border-neutral-200 bg-white p-4"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <div>
                      <div className="text-body-strong text-neutral-900">
                        {call.call_type ?? td("callFallback")}
                      </div>
                      <div className="text-small text-neutral-500">
                        {recordedAt}
                      </div>
                    </div>
                  </div>
                  {call.transcript_summary && (
                    <p className="text-small text-neutral-600">
                      {call.transcript_summary}
                    </p>
                  )}
                  <CallProductDiscoverySection
                    callId={call.id}
                    insight={productDiscoveryByCall.get(call.id) ?? null}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Master data (editable) */}
      <div className="mb-8">
        <AccountMasterCard
          accountId={account.id}
          initial={{
            companyName: account.companyName,
            sponsorName: account.sponsorName,
            sponsorEmail: account.sponsorEmail,
            sponsorPhone: account.sponsorPhone,
            mrr: account.mrr,
            currency: account.currency,
            renewalDate: account.renewalDate,
            notes: account.notes,
          }}
        />
      </div>
    </div>
  );
}
