import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { toBcp47 } from "@/i18n/locale";
import { OrgResolutionError, requireOrgId } from "@/lib/auth/org";
import { getResearchPlan } from "@/lib/research/plans-service";
import {
  countInsightsForPlanSince,
  getStudyPersonas,
  mapInsightsToSessionIds,
} from "@/lib/synthesis/service";
import {
  MIN_PERSONA_INTERVIEWS,
  PERSONA_QUALITY_HINT_UNTIL,
} from "@/lib/synthesis/audience-personas";
import { EmptyState } from "@/components/ui/EmptyState";
import { GeneratePersonasButton } from "@/components/dashboard/GeneratePersonasButton";
import { PersonaCard } from "@/components/dashboard/PersonaCard";

/**
 * /dashboard/research-plans/[id]/personas — Persona stage (Spec
 * docs/klymeo-personas-feature-spec-2026-06-21.md). Separate sub-route, exactly
 * like the synthesis page (no tabs on the plan-detail page). v1 is
 * market_research only — the evidence chain always resolves to interview
 * sessions there. A small "View personas →" card on the market-research detail
 * page links here.
 */

function formatDate(iso: string, locale: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(toBcp47(locale), {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function PersonasIcon() {
  return (
    <svg
      className="h-6 w-6"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden="true"
    >
      <circle cx="9" cy="9" r="3.25" strokeLinecap="round" />
      <path d="M3.5 19a5.5 5.5 0 0 1 11 0" strokeLinecap="round" />
      <path d="M16 6.5a3.25 3.25 0 0 1 0 6" strokeLinecap="round" />
      <path d="M17 14.2a5.5 5.5 0 0 1 3.5 4.8" strokeLinecap="round" />
    </svg>
  );
}

export default async function ResearchPlanPersonasPage({
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

  const { id: planId } = await params;
  const plan = await getResearchPlan(orgId, planId);
  if (!plan) notFound();
  // v1: Personas nur für Marktforschungs-Studien (dort lösen Belegketten zu
  // echten Interview-Sessions auf). Andere Typen kommen hier nicht hin (der
  // Link erscheint nur auf der Markt-Detailseite) — defensiv zum Dashboard.
  if (plan.studyType !== "market_research") redirect("/dashboard");

  const planDetailHref = `/dashboard/market-research/${planId}`;

  const personas = await getStudyPersonas(orgId, planId);
  const insightCount = await countInsightsForPlanSince(orgId, planId, null);
  const canGenerate = insightCount >= MIN_PERSONA_INTERVIEWS;
  const hasExisting = personas !== null;

  // Beleg-Links: alle in Personas + Evidence zitierten Insight-IDs auflösen.
  const linkIds = personas
    ? [
        ...new Set(
          personas.personas.flatMap((p) => [
            ...p.sourceInsightIds,
            ...p.evidence.flatMap((e) => e.sourceInsightIds),
          ]),
        ),
      ]
    : [];
  const insightSessionIds =
    linkIds.length > 0
      ? await mapInsightsToSessionIds(orgId, planId, linkIds)
      : ({} as Record<string, string>);
  const sessionHrefById: Record<string, string> = {};
  for (const [insightId, sessionId] of Object.entries(insightSessionIds)) {
    sessionHrefById[insightId] =
      `/dashboard/market-research/${planId}/sessions/${sessionId}`;
  }

  const t = await getTranslations("research.personas");
  const locale = await getLocale();
  const total = personas?.summary?.totalInsights ?? insightCount;

  return (
    <div className="space-y-8">
      {/* Breadcrumb */}
      <div>
        <Link
          href={planDetailHref}
          className="text-small text-neutral-500 transition-colors hover:text-neutral-900"
        >
          {t("backToPlan")}
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-display text-neutral-900">{t("title")}</h1>
          <p className="mt-1 text-body text-neutral-500">{plan.title}</p>
          {personas?.generatedAt && (
            <p className="mt-2 text-small text-neutral-500">
              {t("basedOnPrefix")}
              <span className="font-medium text-neutral-700">
                {t("basedOnInterviews", { count: total })}
              </span>
              {" · "}
              <span className="font-medium text-neutral-700">
                {t("asOf", { date: formatDate(personas.generatedAt, locale) })}
              </span>
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          <GeneratePersonasButton
            planId={planId}
            hasExisting={hasExisting}
            disabled={!canGenerate}
            minInterviews={MIN_PERSONA_INTERVIEWS}
          />
          {!canGenerate && (
            <span className="max-w-72 text-right text-caption text-neutral-500">
              {t("gateHint", { min: MIN_PERSONA_INTERVIEWS, count: insightCount })}
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      {personas === null ? (
        <EmptyState
          icon={<PersonasIcon />}
          title={t("emptyTitle")}
          description={
            canGenerate
              ? t("emptyDescReady", { count: insightCount })
              : t("emptyDescBelowGate", {
                  min: MIN_PERSONA_INTERVIEWS,
                  count: insightCount,
                })
          }
        />
      ) : personas.personas.length === 0 ? (
        <EmptyState
          icon={<PersonasIcon />}
          title={t("generatedEmptyTitle")}
          description={t("generatedEmptyDesc")}
        />
      ) : (
        <>
          {personas.summary?.qualityHint && (
            <div className="rounded-lg border border-warning-500/40 bg-warning-50 px-4 py-3 text-small text-warning-700">
              {t("qualityHintNotice", {
                count: total,
                recommended: PERSONA_QUALITY_HINT_UNTIL,
              })}
            </div>
          )}

          <section className="space-y-4">
            <div>
              <h2 className="text-h2 text-neutral-900">
                {t("galleryTitle", { count: personas.personas.length })}
              </h2>
              <p className="text-body text-neutral-500">{t("galleryDesc")}</p>
            </div>
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
              {personas.personas.map((persona, i) => (
                <PersonaCard
                  key={`persona-${i}`}
                  persona={persona}
                  total={total}
                  sessionHrefById={sessionHrefById}
                />
              ))}
            </div>
          </section>

          {personas.summary && personas.summary.unassigned > 0 && (
            <p className="text-caption text-neutral-400">
              {t("unassignedNote", { count: personas.summary.unassigned })}
            </p>
          )}
        </>
      )}
    </div>
  );
}
