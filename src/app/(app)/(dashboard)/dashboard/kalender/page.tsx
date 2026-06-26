import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { OrgResolutionError, requireOrgId } from "@/lib/auth/org";
import { listResearchPlans } from "@/lib/research/plans-service";
import type { ResearchPlanRecord } from "@/lib/research/plans-service";
import { AutoRefresh } from "@/components/dashboard/AutoRefresh";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { StatCard } from "@/components/ui/StatCard";
import {
  activationBucket,
  formatActivationDay,
  formatActivationTime,
  relativeActivation,
  type ActivationBucket,
} from "@/lib/scheduler/datetime";

/**
 * /dashboard/kalender — the Studien-Zeitplaner (Deferred Activation, Phase 1).
 *
 * A fluid AGENDA (not a static month grid): scheduled activations grouped into
 * time sections (due now / today / tomorrow / this week / later), then the live
 * studies, then un-scheduled drafts you could plan. Pure read view over the
 * existing org-scoped listResearchPlans(orgId, "market_research") — no extra
 * query, no new backend. The activation action itself lives one click away on
 * each study's detail page (ScheduleActivationPanel).
 *
 * Display timezone is fixed to Europe/Berlin (datetime.ts); an org-configurable
 * timezone is Phase 3.
 */

function CalendarIcon() {
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
        d="M8 3v3m8-3v3M4 8h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z"
      />
    </svg>
  );
}

// Section order for the scheduled buckets. 'past' (overdue, since Phase 1 has no
// cron to auto-fire) comes first as the actionable "due now" group.
const BUCKET_ORDER: ActivationBucket[] = [
  "past",
  "today",
  "tomorrow",
  "thisWeek",
  "later",
];

export default async function KalenderPage() {
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

  const t = await getTranslations("kalender");
  const locale = await getLocale();

  const plans = await listResearchPlans(orgId, "market_research");

  const scheduled = plans
    .filter((p) => p.activationState === "scheduled" && p.scheduledActivationAt)
    .sort((a, b) =>
      (a.scheduledActivationAt as string) < (b.scheduledActivationAt as string)
        ? -1
        : 1,
    );
  const running = plans.filter((p) => p.status === "active");
  const draftsUnscheduled = plans.filter(
    (p) => p.status === "draft" && p.activationState !== "scheduled",
  );

  // Group scheduled studies into time buckets, preserving the sorted order.
  const byBucket = new Map<ActivationBucket, ResearchPlanRecord[]>();
  for (const plan of scheduled) {
    const bucket = activationBucket(plan.scheduledActivationAt as string);
    const list = byBucket.get(bucket) ?? [];
    list.push(plan);
    byBucket.set(bucket, list);
  }

  const nothing =
    scheduled.length === 0 &&
    running.length === 0 &&
    draftsUnscheduled.length === 0;

  const header = (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-h1 text-neutral-900">{t("pageTitle")}</h1>
        <p className="mt-1 text-body text-neutral-500">{t("pageSubtitle")}</p>
        <p className="mt-1 text-caption text-neutral-400">{t("tzNote")}</p>
      </div>
      <Link
        href="/dashboard/market-research/new"
        className="inline-flex h-9 items-center justify-center rounded-md bg-primary-600 px-4 text-body-strong font-medium text-white transition-colors hover:bg-primary-hover"
      >
        {t("planStudyCta")}
      </Link>
    </div>
  );

  if (nothing) {
    return (
      <div className="space-y-8">
        <div className="st-rise" style={{ "--st": 0 } as React.CSSProperties}>
          {header}
        </div>
        <div className="st-rise" style={{ "--st": 1 } as React.CSSProperties}>
          <EmptyState
            icon={<CalendarIcon />}
            title={t("emptyTitle")}
            description={t("emptyDesc")}
            cta={{ label: t("emptyCta"), href: "/dashboard/market-research/new" }}
          />
        </div>
        <AutoRefresh />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="st-rise" style={{ "--st": 0 } as React.CSSProperties}>
        {header}
      </div>

      <div
        className="st-rise grid grid-cols-1 gap-4 sm:grid-cols-3"
        style={{ "--st": 1 } as React.CSSProperties}
      >
        <StatCard label={t("kpiScheduled")} value={scheduled.length} />
        <StatCard label={t("kpiActive")} value={running.length} />
        <StatCard label={t("kpiDrafts")} value={draftsUnscheduled.length} />
      </div>

      {/* Geplante Aktivierungen — Zeit-Sektionen (Agenda statt Raster). */}
      {BUCKET_ORDER.map((bucket) => {
        const items = byBucket.get(bucket);
        if (!items || items.length === 0) return null;
        return (
          <section
            key={bucket}
            className="st-rise space-y-3"
            style={{ "--st": 2 } as React.CSSProperties}
          >
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-h3 text-neutral-900">
                {t(`bucket.${bucket}`)}
              </h2>
              {bucket === "past" && (
                <span className="text-caption text-warning-700">
                  {t("dueHint")}
                </span>
              )}
            </div>
            <Card>
              {items.map((plan) => (
                <Link
                  key={plan.id}
                  href={`/dashboard/market-research/${plan.id}`}
                  className="flex items-center gap-4 border-b border-neutral-100 px-5 py-4 transition-colors last:border-b-0 hover:bg-neutral-50"
                >
                  <div className="w-28 shrink-0">
                    <p className="text-body-strong tabular-nums text-neutral-900">
                      {formatActivationTime(
                        plan.scheduledActivationAt as string,
                        locale,
                      )}
                    </p>
                    <p className="text-caption text-neutral-400">
                      {formatActivationDay(
                        plan.scheduledActivationAt as string,
                        locale,
                      )}
                    </p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body-strong text-neutral-900">
                      {plan.title}
                    </p>
                    <p className="mt-0.5 truncate text-small text-neutral-500">
                      {plan.objective}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge variant={bucket === "past" ? "high" : "medium"}>
                      {t("state.scheduled")}
                    </Badge>
                    <span className="text-caption text-neutral-400">
                      {relativeActivation(
                        plan.scheduledActivationAt as string,
                        locale,
                      )}
                    </span>
                  </div>
                </Link>
              ))}
            </Card>
          </section>
        );
      })}

      {/* Laufend — aktive Studien. */}
      {running.length > 0 && (
        <section
          className="st-rise space-y-3"
          style={{ "--st": 3 } as React.CSSProperties}
        >
          <h2 className="text-h3 text-neutral-900">{t("sectionRunning")}</h2>
          <Card>
            {running.map((plan) => (
              <Link
                key={plan.id}
                href={`/dashboard/market-research/${plan.id}`}
                className="flex items-center justify-between gap-4 border-b border-neutral-100 px-5 py-4 transition-colors last:border-b-0 hover:bg-neutral-50"
              >
                <div className="min-w-0">
                  <p className="truncate text-body-strong text-neutral-900">
                    {plan.title}
                  </p>
                  <p className="mt-0.5 truncate text-small text-neutral-500">
                    {plan.objective}
                  </p>
                </div>
                <Badge variant="success">{t("runningLabel")}</Badge>
              </Link>
            ))}
          </Card>
        </section>
      )}

      {/* Nicht terminierte Entwürfe — planbar. */}
      {draftsUnscheduled.length > 0 && (
        <section
          className="st-rise space-y-3"
          style={{ "--st": 4 } as React.CSSProperties}
        >
          <h2 className="text-h3 text-neutral-900">{t("sectionDrafts")}</h2>
          <Card>
            {draftsUnscheduled.map((plan) => (
              <Link
                key={plan.id}
                href={`/dashboard/market-research/${plan.id}`}
                className="flex items-center justify-between gap-4 border-b border-neutral-100 px-5 py-4 transition-colors last:border-b-0 hover:bg-neutral-50"
              >
                <div className="min-w-0">
                  <p className="truncate text-body-strong text-neutral-900">
                    {plan.title}
                  </p>
                  <p className="mt-0.5 truncate text-small text-neutral-500">
                    {plan.objective}
                  </p>
                </div>
                <span className="shrink-0 text-small font-medium text-primary-700">
                  {t("scheduleCta")}
                </span>
              </Link>
            ))}
          </Card>
        </section>
      )}

      <AutoRefresh />
    </div>
  );
}
