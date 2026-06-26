import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { Badge } from "@/components/ui/Badge";
import { Card, CardHeader } from "@/components/ui/Card";
import type { ResearchPlanRecord } from "@/lib/research/plans-service";
import {
  formatActivationDateTime,
  relativeActivation,
} from "@/lib/scheduler/datetime";

/**
 * "Anstehende Studien" — the Heute-dashboard glance at scheduled activations
 * (Deferred Activation, Phase 1). Server component, fed the already-loaded plan
 * list so it costs no extra query. Renders nothing when no study is scheduled,
 * so the dashboard stays clean for researchers who don't use scheduling.
 *
 * It deliberately reads only the scheduled subset; the full agenda (scheduled +
 * live + drafts) lives at /dashboard/kalender.
 */
export async function UpcomingStudiesWidget({
  plans,
  locale,
}: {
  plans: ResearchPlanRecord[];
  locale: string;
}) {
  const t = await getTranslations("kalender");

  const upcoming = plans
    .filter((p) => p.activationState === "scheduled" && p.scheduledActivationAt)
    .sort((a, b) =>
      (a.scheduledActivationAt as string) < (b.scheduledActivationAt as string)
        ? -1
        : 1,
    )
    .slice(0, 5);

  if (upcoming.length === 0) return null;

  return (
    <Card>
      <CardHeader className="flex items-center justify-between gap-4">
        <h2 className="text-h3 text-neutral-900">{t("widgetTitle")}</h2>
        <Link
          href="/dashboard/kalender"
          className="text-small font-medium text-neutral-500 transition-colors hover:text-neutral-900"
        >
          {t("widgetSeeAll")}
        </Link>
      </CardHeader>
      {upcoming.map((plan) => (
        <Link
          key={plan.id}
          href={`/dashboard/market-research/${plan.id}`}
          className="flex items-center justify-between gap-4 border-b border-neutral-100 px-5 py-4 transition-colors last:border-b-0 hover:bg-neutral-50"
        >
          <div className="min-w-0">
            <p className="truncate text-body-strong text-neutral-900">
              {plan.title}
            </p>
            <p className="mt-0.5 text-small text-neutral-500">
              {t("scheduledForLabel", {
                when: formatActivationDateTime(
                  plan.scheduledActivationAt as string,
                  locale,
                ),
              })}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <Badge variant="medium">{t("state.scheduled")}</Badge>
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
  );
}
