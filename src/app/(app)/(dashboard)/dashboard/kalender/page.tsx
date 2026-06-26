import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { OrgResolutionError, requireOrgId } from "@/lib/auth/org";
import { listResearchPlans } from "@/lib/research/plans-service";
import { AutoRefresh } from "@/components/dashboard/AutoRefresh";
import {
  KalenderView,
  type CalendarEvent,
  type DraftOption,
} from "@/components/dashboard/KalenderView";
import { EmptyState } from "@/components/ui/EmptyState";
import { currentIso } from "@/lib/scheduler/datetime";
import { isKonsoulCalendarEnabled } from "@/lib/konsoul/calendar-flag";
import { KonsoulCalendarDrawer } from "@/components/dashboard/KonsoulCalendarDrawer";

/**
 * /dashboard/kalender — the Studien-Zeitplaner (Kalender-Redesign).
 *
 * Server shell: org-scoped read of the market-research studies, mapped to a lean
 * calendar-event model, then handed to the interactive client <KalenderView>
 * (month grid + agenda toggle + quick-schedule). No extra query, no new backend.
 *
 * Each study is plotted on its most meaningful available date — scheduled ones on
 * scheduled_activation_at, running/completed ones on activated_at (falling back to
 * created_at, since research_plans has no completed_at/updated_at). Unscheduled
 * drafts are NOT plotted; they are the pool the quick-schedule dialog picks from.
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

export default async function KalenderPage({
  searchParams,
}: {
  // ?schedule=<uuid> (z. B. aus einem Konsoul-Termin-Vorschlag) öffnet den
  // Quick-Schedule-Picker für diesen Entwurf; ?konsoul ist reserviert.
  searchParams: Promise<{ schedule?: string; konsoul?: string }>;
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

  const t = await getTranslations("kalender");
  const locale = await getLocale();

  const plans = await listResearchPlans(orgId, "market_research");

  // P2: Konsoul-Drawer (flag-gated) + Deep-Link-Prefill für den Termin-Picker.
  // BEIDES nur bei aktivem Flag — so ist die Seite bei Flag-aus byte-gleich zum
  // Stand vor dem Feature (der ?schedule-Param ist dann komplett inert).
  const calendarEnabled = isKonsoulCalendarEnabled();
  const { schedule: rawSchedule } = await searchParams;
  const prefillStudyId = calendarEnabled
    ? (rawSchedule ?? "").trim() || undefined
    : undefined;
  const drawerStudies = plans.map((p) => ({
    studyId: p.id,
    studyTitle: p.title,
  }));

  // Map each study to its calendar anchor date + visual kind.
  const events: CalendarEvent[] = [];
  for (const p of plans) {
    if (p.activationState === "scheduled" && p.scheduledActivationAt) {
      events.push({
        id: p.id,
        title: p.title,
        dateIso: p.scheduledActivationAt,
        kind: "scheduled",
      });
    } else if (p.status === "active") {
      events.push({
        id: p.id,
        title: p.title,
        dateIso: p.activatedAt ?? p.createdAt,
        kind: "live",
      });
    } else if (p.status === "completed") {
      events.push({
        id: p.id,
        title: p.title,
        dateIso: p.activatedAt ?? p.createdAt,
        kind: "done",
      });
    }
    // draft (unscheduled) + archived → not plotted.
  }

  // Unscheduled drafts are the quick-schedule pool.
  const drafts: DraftOption[] = plans
    .filter((p) => p.status === "draft" && p.activationState !== "scheduled")
    .map((p) => ({ id: p.id, title: p.title }));

  const header = (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-h1 text-neutral-900">{t("pageTitle")}</h1>
        <p className="mt-1 text-body text-neutral-500">{t("pageSubtitle")}</p>
        <p className="mt-1 text-caption text-neutral-400">{t("tzNote")}</p>
      </div>
      {/* Flag-aus: GENAU der bare Link wie vor dem Feature (byte-gleich). Flag-an:
          der Drawer-Button + Link im Flex-Wrapper. */}
      {calendarEnabled ? (
        <div className="flex flex-wrap items-center gap-3">
          <KonsoulCalendarDrawer studies={drawerStudies} />
          <Link
            href="/dashboard/market-research/new"
            className="inline-flex h-9 items-center justify-center rounded-md bg-primary-600 px-4 text-body-strong font-medium text-white transition-colors hover:bg-primary-hover"
          >
            {t("planStudyCta")}
          </Link>
        </div>
      ) : (
        <Link
          href="/dashboard/market-research/new"
          className="inline-flex h-9 items-center justify-center rounded-md bg-primary-600 px-4 text-body-strong font-medium text-white transition-colors hover:bg-primary-hover"
        >
          {t("planStudyCta")}
        </Link>
      )}
    </div>
  );

  if (plans.length === 0) {
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
      <div className="st-rise" style={{ "--st": 1 } as React.CSSProperties}>
        <KalenderView
          // key macht einen neuen ?schedule-Deep-Link zu einem sauberen
          // Re-Mount → der Quick-Schedule-Dialog öffnet vorbefüllt (kein Effect).
          key={`kal-${prefillStudyId ?? ""}`}
          events={events}
          drafts={drafts}
          nowIso={currentIso()}
          locale={locale}
          prefillStudyId={prefillStudyId}
        />
      </div>
      <AutoRefresh />
    </div>
  );
}
