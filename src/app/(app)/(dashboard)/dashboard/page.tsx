import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getTranslations, getLocale } from "next-intl/server";
import { toBcp47 } from "@/i18n/locale";
import { requireOrgId, OrgResolutionError } from "@/lib/auth/org";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatCard } from "@/components/ui/StatCard";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { AnalyzeAllButton } from "@/components/dashboard/AnalyzeAllButton";
import { DealTableWithFilters } from "@/components/dashboard/DealTableWithFilters";
import { OnboardingChecklist } from "@/components/dashboard/OnboardingChecklist";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { ENABLED_MODULES } from "@/config/modules";
import { currentUser } from "@clerk/nextjs/server";
import { loadOrgSyntheses } from "@/lib/mission-control/engine";
import {
  countCompletedSessionsForPlans,
  listResearchPlans,
} from "@/lib/research/plans-service";
import { listPoolMembers } from "@/lib/research/participant-pool";
import { HeuteGreeting } from "@/components/dashboard/HeuteGreeting";
import { AutoRefresh } from "@/components/dashboard/AutoRefresh";
import { getDealsByOrg } from "@/lib/deals/service";
import { buildForecastSummary } from "@/lib/forecast/service";
import { getOnboardingStatus } from "@/lib/onboarding/status";
import {
  averageSignalConfidence,
  getLatestRiskScoresForDeals,
} from "@/lib/risk/service";
import type { DealStage } from "@/lib/deals/types";

const ACTIVE_STAGES: ReadonlySet<DealStage> = new Set([
  "qualified",
  "demo",
  "proposal_sent",
  "negotiation",
  "verbal_commit",
]);

function DealTableFallback() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-9 w-full rounded-md" />
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-20" />
      </div>
      <div className="-mx-5 -mb-5 space-y-0 border-t border-neutral-200">
        <Skeleton className="mx-5 my-3 h-10 rounded-md" />
        <Skeleton className="mx-5 my-3 h-10 rounded-md" />
        <Skeleton className="mx-5 my-3 h-10 rounded-md" />
      </div>
    </div>
  );
}

function formatCurrency(value: number, locale: string) {
  return new Intl.NumberFormat(toBcp47(locale), {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

function PlugIcon() {
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
        d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244"
      />
    </svg>
  );
}

function formatDate(iso: string, locale: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(toBcp47(locale), {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/** Ein regelbasierter „Nächster Schritt“ auf der Heute-Seite — rein aus
 *  Status + Zählungen abgeleitet, kein Score, keine Heuristik-Magie. */
interface HeuteNextStep {
  key: string;
  planTitle: string;
  action: string;
  desc: string;
  cta: string;
  href: string;
}

/**
 * „Heute“ — die Startseite der Konsole (Konsole-v5 E2.5, Plan §8 / O9).
 *
 * Ersetzt die Modul-Einstiegskarten (die nur Sidebar-Links doppelten) durch
 * eine echte Übersicht: Was läuft, was ist der nächste Schritt, wo steht die
 * Auswertung. STRENG ADDITIV nach dem Muster der MR-Übersicht — ausschließlich
 * vorhandene org-scoped Reads (listResearchPlans, countCompletedSessions-
 * ForPlans, loadOrgSyntheses, listPoolMembers), kein neues Backend, keine
 * Migration. Jede Zahl ist eine echte Zählung; jeder „Nächste Schritt“ eine
 * deterministische Regel mit fester Priorität:
 *   R1 Synthese fehlt (aktiv, Interviews da, nie verdichtet)
 *   R2 Feld leer (aktiv, Zählung bekannt und 0)
 *   R3 Entwurf offen (status draft)
 * Fail-open wie auf der MR-Seite: ein Lesefehler degradiert Zahlen zu „—“
 * bzw. lässt Schritte weg — nie die Seite.
 */
async function HeuteDashboard({ orgId }: { orgId: string }) {
  const t = await getTranslations("heute");
  const tm = await getTranslations("research.market");
  const nav = await getTranslations("nav");
  const locale = await getLocale();

  // Begrüßung ist Deko — ein Clerk-Schluckauf darf die Startseite nie kippen.
  const user = await currentUser().catch(() => null);
  const firstName = user?.firstName ?? null;

  const plans = await listResearchPlans(orgId, "market_research");

  const greetingHeader = (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <HeuteGreeting name={firstName} />
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/dashboard/market-research"
          className="text-body-strong text-neutral-700 transition-colors hover:text-neutral-900"
        >
          {nav("item.marketResearch")}
        </Link>
        <Link
          href="/dashboard/market-research/new"
          className="inline-flex h-9 items-center justify-center rounded-md bg-primary-600 px-4 text-body-strong font-medium text-white transition-colors hover:bg-primary-700"
        >
          {nav("item.newStudy")}
        </Link>
      </div>
    </div>
  );

  if (plans.length === 0) {
    return (
      <div className="space-y-8">
        <div className="st-rise" style={{ "--st": 0 } as React.CSSProperties}>
          {greetingHeader}
        </div>
        <div className="st-rise" style={{ "--st": 1 } as React.CSSProperties}>
          <EmptyState
            icon={<PlugIcon />}
            title={t("emptyTitle")}
            description={t("emptyDesc")}
            cta={{
              label: t("emptyCta"),
              href: "/dashboard/market-research/new",
            }}
          />
        </div>
      </div>
    );
  }

  // Zwei READ-ONLY-Batches über vorhandene Queries, parallel — identisches
  // Muster (inkl. fail-open-Verhalten) wie /dashboard/market-research.
  const [completedCounts, synthesisPlanIds, poolMembers] = await Promise.all([
    countCompletedSessionsForPlans(
      orgId,
      plans.map((plan) => plan.id),
    ),
    loadOrgSyntheses(orgId)
      .then((rows) => new Set(rows.map((row) => row.studyId)))
      .catch(() => new Set<string>()),
    // listPoolMembers degradiert selbst zu [] — liest hier als „0 Profile“.
    listPoolMembers(orgId).catch(() => []),
  ]);

  const activePlans = plans.filter((p) => p.status === "active");
  const draftPlans = plans.filter((p) => p.status === "draft");
  const plansWithSynthesis = plans.filter((p) => synthesisPlanIds.has(p.id));

  const knownCounts = completedCounts ? [...completedCounts.values()] : [];
  const completedTotal = knownCounts.reduce((sum, c) => sum + c, 0);
  const completedDisplay: string | number =
    completedCounts === null ? tm("poolCountUnknown") : completedTotal;

  const digestParts = [
    t("digestActive", { count: activePlans.length }),
    ...(completedCounts !== null
      ? [t("digestCompleted", { count: completedTotal })]
      : []),
    t("digestSyntheses", { count: plansWithSynthesis.length }),
  ];

  // ── Nächste Schritte (R1 → R2 → R3, max. 3) ─────────────────────────────
  const nextSteps: HeuteNextStep[] = [];
  for (const plan of activePlans) {
    const completed = completedCounts?.get(plan.id) ?? 0;
    if (completed > 0 && !synthesisPlanIds.has(plan.id)) {
      nextSteps.push({
        key: `synthesis-${plan.id}`,
        planTitle: plan.title,
        action: t("actionFirstSynthesis"),
        desc: t("descFirstSynthesis", { count: completed }),
        cta: t("ctaSynthesis"),
        href: `/dashboard/research-plans/${plan.id}/synthesis`,
      });
    }
  }
  if (completedCounts !== null) {
    for (const plan of activePlans) {
      if ((completedCounts.get(plan.id) ?? 0) === 0) {
        nextSteps.push({
          key: `field-${plan.id}`,
          planTitle: plan.title,
          action: t("actionOpenField"),
          desc: t("descOpenField"),
          cta: t("ctaStudy"),
          href: `/dashboard/market-research/${plan.id}`,
        });
      }
    }
  }
  for (const plan of draftPlans) {
    nextSteps.push({
      key: `draft-${plan.id}`,
      planTitle: plan.title,
      action: t("actionFinishDraft"),
      desc: t("descFinishDraft", {
        date: formatDate(plan.createdAt, locale),
      }),
      cta: t("ctaDraft"),
      href: `/dashboard/market-research/${plan.id}`,
    });
  }
  const topSteps = nextSteps.slice(0, 3);

  const runningPlans = activePlans.slice(0, 4);
  const synthesizedPlans = plansWithSynthesis.slice(0, 5);

  return (
    <div className="space-y-8">
      <div className="st-rise" style={{ "--st": 0 } as React.CSSProperties}>
        {greetingHeader}
        <p className="mt-2 text-body text-neutral-500">
          {digestParts.join(" · ")}
        </p>
      </div>

      {/* Kennzahlen — alles aus den schon geladenen Reads. */}
      <div
        className="st-rise grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4"
        style={{ "--st": 1 } as React.CSSProperties}
      >
        <StatCard
          label={t("kpiActive")}
          value={activePlans.length}
          status={activePlans.length > 0 ? "success" : "default"}
        />
        <StatCard
          label={t("kpiCompleted")}
          value={completedDisplay}
          subtitle={t("kpiCompletedSub")}
        />
        <StatCard
          label={t("kpiSyntheses")}
          value={plansWithSynthesis.length}
          subtitle={t("kpiSynthesesSub")}
          status={plansWithSynthesis.length > 0 ? "primary" : "default"}
        />
        <StatCard
          label={t("kpiPool")}
          value={poolMembers.length}
          subtitle={t("kpiPoolSub")}
        />
      </div>

      {topSteps.length > 0 && (
        <Card
          className="st-rise"
          style={{ "--st": 2 } as React.CSSProperties}
        >
          <CardHeader className="flex items-center justify-between gap-4">
            <h2 className="text-h3 text-neutral-900">{t("nextTitle")}</h2>
            <span className="text-caption text-neutral-400">
              {t("nextHint")}
            </span>
          </CardHeader>
          {topSteps.map((step) => (
            <div
              key={step.key}
              className="flex items-center justify-between gap-4 border-b border-neutral-100 px-5 py-4 last:border-b-0"
            >
              <div className="min-w-0">
                <p className="text-body-strong text-neutral-900">
                  {step.action}
                  <span className="font-normal text-neutral-500">
                    {" "}
                    — {step.planTitle}
                  </span>
                </p>
                <p className="mt-0.5 text-small text-neutral-500">
                  {step.desc}
                </p>
              </div>
              <Link
                href={step.href}
                className="inline-flex h-8 shrink-0 items-center justify-center rounded-md border border-neutral-200 bg-white px-3 text-small font-medium text-neutral-900 transition-colors hover:bg-neutral-50"
              >
                {step.cta}
              </Link>
            </div>
          ))}
        </Card>
      )}

      <div
        className="st-rise grid grid-cols-1 items-start gap-4 lg:grid-cols-5"
        style={{ "--st": 3 } as React.CSSProperties}
      >
        {/* Läuft gerade — aktive Studien mit Ziel-Pool-Fortschritt. */}
        <Card className="lg:col-span-3">
          <CardHeader className="flex items-center justify-between gap-4">
            <h2 className="text-h3 text-neutral-900">{t("runningTitle")}</h2>
            <Link
              href="/dashboard/market-research"
              className="text-small font-medium text-neutral-500 transition-colors hover:text-neutral-900"
            >
              {nav("item.marketResearch")}
            </Link>
          </CardHeader>
          {runningPlans.length === 0 ? (
            <CardBody>
              <p className="text-small text-neutral-500">
                {t("runningEmpty")}
              </p>
            </CardBody>
          ) : (
            runningPlans.map((plan) => {
              const completed = completedCounts?.get(plan.id) ?? null;
              const pct =
                completed !== null && plan.sampleTarget
                  ? Math.min(
                      100,
                      Math.round((completed / plan.sampleTarget) * 100),
                    )
                  : null;
              return (
                <div
                  key={plan.id}
                  className="flex items-center justify-between gap-4 border-b border-neutral-100 px-5 py-4 last:border-b-0"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/dashboard/market-research/${plan.id}`}
                      className="text-body-strong text-neutral-900 hover:text-primary-700 hover:underline"
                    >
                      {plan.title}
                    </Link>
                    {plan.objective && (
                      <p className="mt-0.5 line-clamp-1 text-small text-neutral-500">
                        {plan.objective}
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-mono text-small text-neutral-700">
                      {completed === null
                        ? tm("poolCountUnknown")
                        : plan.sampleTarget !== null
                          ? tm("poolProgress", {
                              completed,
                              target: plan.sampleTarget,
                            })
                          : completed}
                    </p>
                    {pct !== null && (
                      <div className="mt-1.5 h-1.5 w-28 overflow-hidden rounded-full bg-neutral-100">
                        <div
                          className="h-full rounded-full bg-primary-600"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </Card>

        {/* Auswertung — Studien mit vorhandener Synthese. */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <h2 className="text-h3 text-neutral-900">{t("synthTitle")}</h2>
          </CardHeader>
          {synthesizedPlans.length === 0 ? (
            <CardBody>
              <p className="text-small text-neutral-500">{t("synthEmpty")}</p>
            </CardBody>
          ) : (
            synthesizedPlans.map((plan) => (
              <div
                key={plan.id}
                className="flex items-center justify-between gap-4 border-b border-neutral-100 px-5 py-4 last:border-b-0"
              >
                <p className="min-w-0 truncate text-body-strong text-neutral-900">
                  {plan.title}
                </p>
                <Link
                  href={`/dashboard/research-plans/${plan.id}/synthesis`}
                  className="shrink-0 text-small font-medium text-primary-700 transition-colors hover:text-primary-800"
                >
                  {t("synthOpen")}
                </Link>
              </div>
            ))
          )}
        </Card>
      </div>
    </div>
  );
}

export default async function DashboardPage() {
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

  if (!ENABLED_MODULES.salesIntelligence) {
    return (
      <>
        <HeuteDashboard orgId={orgId} />
        {/* O6: stilles 30s-Polling über die vorhandenen Reads — nur bei
            sichtbarem Tab. Digest, KPIs und Listen bleiben so aktuell,
            ohne dass jemand neu laden muss. */}
        <AutoRefresh />
      </>
    );
  }

  const t = await getTranslations("sales.pipeline");
  const tc = await getTranslations("sales.common");
  const locale = await getLocale();

  const [baseDeals, onboardingStatus] = await Promise.all([
    getDealsByOrg(orgId),
    getOnboardingStatus(orgId),
  ]);
  const riskMap = await getLatestRiskScoresForDeals(
    orgId,
    baseDeals.map((d) => d.id),
  );

  const deals = baseDeals.map((deal) => {
    const risk = riskMap.get(deal.id);
    if (!risk) return deal;
    return {
      ...deal,
      riskScore: risk.risk_score,
      riskLevel: risk.risk_level,
      riskSignals: risk.signals.map((s) => s.type),
      riskReasoning: risk.overall_reasoning,
      lastRiskUpdate: risk.analyzed_at,
      avgSignalConfidence: averageSignalConfidence(risk.signals),
    };
  });

  const forecast = buildForecastSummary(deals);
  const forecastByDealId = new Map(
    forecast.forecasts.map((dealForecast) => [
      dealForecast.deal_id,
      dealForecast.win_probability,
    ]),
  );
  const tableDeals = deals.map((deal) => ({
    ...deal,
    winProbability: forecastByDealId.get(deal.id),
  }));
  const atRisk = deals.filter(
    (d) => d.riskScore !== undefined && d.riskScore >= 60,
  ).length;
  const analyzed = deals.filter((d) => d.riskScore !== undefined).length;
  const atRiskSubtitle =
    analyzed === 0
      ? t("atRiskNone")
      : atRisk === 0
        ? t("atRiskAllClear")
        : t("atRiskAnalyzed", { count: analyzed });
  const active = deals.filter((d) => ACTIVE_STAGES.has(d.stage)).length;
  const closingSoon = deals.filter((d) => {
    if (!ACTIVE_STAGES.has(d.stage)) return false;
    const close = new Date(d.closeDate).getTime();
    const days = (close - Date.now()) / (1000 * 60 * 60 * 24);
    return days >= 0 && days <= 30;
  }).length;

  if (deals.length === 0) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-display text-neutral-900">{t("title")}</h1>
          <p className="text-body text-neutral-500 mt-1">{t("leadEmpty")}</p>
        </div>
        <OnboardingChecklist status={onboardingStatus} />
        <EmptyState
          icon={<PlugIcon />}
          title={t("emptyTitle")}
          description={t("emptyDesc")}
          action={{
            label: t("openDataSources"),
            href: "/dashboard/data-sources",
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-display text-neutral-900">{t("title")}</h1>
          <p className="text-body text-neutral-500 mt-1">
            {t("activeCount", { count: deals.length })}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/dashboard/forecast"
            className="text-body-strong text-neutral-700 hover:text-neutral-900"
          >
            {t("viewFullForecast")}
          </Link>
          <AnalyzeAllButton
            deals={deals.map((d) => ({ id: d.id, name: d.name }))}
          />
        </div>
      </div>

      <OnboardingChecklist status={onboardingStatus} />

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard label={t("statTotalDeals")} value={deals.length} />
        <StatCard
          label={tc("dealsAtRisk")}
          value={atRisk}
          subtitle={atRiskSubtitle}
          status={atRisk > 0 ? "critical" : "default"}
        />
        <StatCard label={t("statActive")} value={active} />
        <StatCard
          label={
            <>
              {tc("weightedForecast")}
              <InfoTooltip label={tc("weightedForecastTip")} />
            </>
          }
          value={formatCurrency(forecast.weighted_pipeline_value, locale)}
          subtitle={t("riskAdjusted")}
          status="primary"
        />
        <StatCard label={t("statClosingSoon")} value={closingSoon} />
      </div>

      {/* Deal table */}
      <Card>
        <CardBody>
          <Suspense fallback={<DealTableFallback />}>
            <DealTableWithFilters deals={tableDeals} />
          </Suspense>
        </CardBody>
      </Card>

      {/* Hint */}
      <p className="text-small text-neutral-500">{t("tableHint")}</p>
    </div>
  );
}
