import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { toBcp47 } from "@/i18n/locale";
import { OrgResolutionError, requireOrgId } from "@/lib/auth/org";
import { getResearchPlan } from "@/lib/research/plans-service";
import {
  countInsightsForPlanSince,
  getStudySynthesis,
  type EmergentTheme,
  type Tension,
  type TensionSide,
} from "@/lib/synthesis/service";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ChatWithDataPanel } from "@/components/dashboard/ChatWithDataPanel";
import { ExportSynthesisPdfButton } from "@/components/dashboard/ExportSynthesisPdfButton";
import { ExportSynthesisPptxButton } from "@/components/dashboard/ExportSynthesisPptxButton";
import { HighlightReelPanel } from "@/components/dashboard/HighlightReelPanel";
import { SynthesisThemeCard } from "@/components/dashboard/SynthesisThemeCard";
import { UpdateSynthesisButton } from "@/components/dashboard/UpdateSynthesisButton";

/**
 * /dashboard/research-plans/[id]/synthesis — Stage-2 cross-call synthesis.
 *
 * Separate route (not a section on the plan-detail page) because:
 *  - the synthesis is content-heavy (overview + N themes + M tensions, each
 *    with expandable quote drilldowns) and would dominate the existing
 *    plan-detail page,
 *  - it has its own update lifecycle (Re-run button + "X new since"-badge),
 *  - it's the natural anchor for future iterations (synthesis history,
 *    diff-against-previous, etc.).
 *
 * The plan-detail page gets a small additive "View synthesis →" link
 * pointing here. No changes to existing sections of that page.
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

function DiscoveryIcon() {
  return (
    <svg
      className="h-6 w-6"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden="true"
    >
      <circle cx="11" cy="11" r="6.5" strokeLinecap="round" />
      <path d="m20 20-4.35-4.35" strokeLinecap="round" />
    </svg>
  );
}

export default async function ResearchPlanSynthesisPage({
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

  const synthesis = await getStudySynthesis(orgId, planId);
  // "X new insights since the last synthesis". When `synthesized_at` is null
  // (synthesis row may exist but never ran; or no row at all) this counts
  // ALL insights for the plan — which is what the user wants to see as "the
  // first synthesis will draw from these".
  const newInsightCount = await countInsightsForPlanSince(
    orgId,
    planId,
    synthesis?.synthesized_at ?? null,
  );

  const t = await getTranslations("research.synthesis");
  const locale = await getLocale();

  return (
    <div className="space-y-8">
      {/* Breadcrumb */}
      <div>
        <Link
          href={`/dashboard/research-plans/${planId}`}
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
          {synthesis ? (
            <p className="mt-2 text-small text-neutral-500">
              {synthesis.synthesized_at ? (
                <>
                  {t("basedOnPrefix")}
                  <span className="font-medium text-neutral-700">
                    {t("basedOnInterviews", {
                      count: synthesis.based_on_count,
                    })}
                  </span>
                  {" · "}
                  <span className="font-medium text-neutral-700">
                    {t("asOf", {
                      date: formatDate(synthesis.synthesized_at, locale),
                    })}
                  </span>
                  {newInsightCount > 0 && (
                    <>
                      {" · "}
                      <span className="font-medium text-primary-700">
                        {t("newSinceLast", { count: newInsightCount })}
                      </span>
                    </>
                  )}
                </>
              ) : (
                <>{t("slotNeverComputed")}</>
              )}
            </p>
          ) : (
            <p className="mt-2 text-small text-neutral-500">
              {t("noSynthesisYet", { count: newInsightCount })}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-2">
          <UpdateSynthesisButton
            planId={planId}
            hasExisting={synthesis !== null && synthesis.synthesized_at !== null}
          />
          {/* PDF-Export: nur sinnvoll wenn eine fertige Synthese da ist.
              Bei einem unsynthesisierten Slot bleibt der Button weg —
              kein „PDF eines leeren Reports". */}
          {synthesis !== null && synthesis.synthesized_at !== null && (
            <>
              <ExportSynthesisPdfButton planId={planId} />
              <ExportSynthesisPptxButton planId={planId} />
            </>
          )}
        </div>
      </div>

      {/* Body — empty state OR overview + themes + tensions */}
      {synthesis === null || synthesis.synthesized_at === null ? (
        <EmptyState
          icon={<DiscoveryIcon />}
          title={t("emptyTitle")}
          description={
            newInsightCount > 0
              ? t("emptyDescWithInsights", { count: newInsightCount })
              : t("emptyDescNoInsights")
          }
        />
      ) : (
        <>
          {/* Overview */}
          {synthesis.overview && (
            <Card>
              <CardHeader>
                <h2 className="text-h3 text-neutral-900">
                  {t("overviewTitle")}
                </h2>
              </CardHeader>
              <CardBody>
                <p className="whitespace-pre-wrap text-body leading-relaxed text-neutral-700">
                  {synthesis.overview}
                </p>
              </CardBody>
            </Card>
          )}

          {/* Emergent themes */}
          <section className="space-y-4">
            <div>
              <h2 className="text-h2 text-neutral-900">
                {t("emergentThemesTitle", {
                  count: synthesis.emergent_themes.length,
                })}
              </h2>
              <p className="text-body text-neutral-500">
                {t("emergentThemesDesc")}
              </p>
            </div>
            {synthesis.emergent_themes.length === 0 ? (
              <Card>
                <CardBody>
                  <p className="py-4 text-center text-body text-neutral-500">
                    {t("noEmergentThemes")}
                  </p>
                </CardBody>
              </Card>
            ) : (
              <div className="space-y-3">
                {synthesis.emergent_themes.map((theme: EmergentTheme, i) => (
                  <SynthesisThemeCard
                    key={`theme-${i}`}
                    theme={theme}
                    totalParticipants={synthesis.based_on_count}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Tensions */}
          <section className="space-y-4">
            <div>
              <h2 className="text-h2 text-neutral-900">
                {t("tensionsTitle", { count: synthesis.tensions.length })}
              </h2>
              <p className="text-body text-neutral-500">{t("tensionsDesc")}</p>
            </div>
            {synthesis.tensions.length === 0 ? (
              <Card>
                <CardBody>
                  <p className="py-4 text-center text-body text-neutral-500">
                    {t("noTensions")}
                  </p>
                </CardBody>
              </Card>
            ) : (
              <div className="space-y-4">
                {synthesis.tensions.map((tension: Tension, i) => (
                  <Card key={`tension-${i}`}>
                    <CardBody className="space-y-4">
                      <p className="text-body-strong text-neutral-900">
                        {tension.description}
                      </p>
                      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                        <TensionSidePanel
                          side={tension.side_a}
                          sideName={t("sideA")}
                        />
                        <TensionSidePanel
                          side={tension.side_b}
                          sideName={t("sideB")}
                        />
                      </div>
                    </CardBody>
                  </Card>
                ))}
              </div>
            )}
          </section>

          {synthesis.model && (
            <p className="text-caption text-neutral-400">
              {t("model", { model: synthesis.model })}
            </p>
          )}

          {/* Chat-with-data — only when the synthesis actually exists. The
              engine would short-circuit a zero-insight study server-side,
              but the panel needs the synthesis surface to be coherent
              before we offer "ask your data". `ready` is the same gate as
              "PDF export button is shown". */}
          <ChatWithDataPanel planId={planId} ready={true} />

          {/* Highlight-Reel — same readiness gate. The reel is derived
              on-demand from the verdichtungen + synthesis (no persistence),
              and the panel only triggers on an explicit click — the engine
              short-circuits empty inputs to zero-token responses. */}
          <HighlightReelPanel planId={planId} ready={true} />
        </>
      )}
    </div>
  );
}

/**
 * Pure-presentational side of a tension. The schema requires `side.label`
 * (3-160 chars) so it's always present — no fallback chain needed. The
 * `sideName` prop ("Side A" / "Side B") is purely the column label above
 * the heading, not a content fallback.
 */
async function TensionSidePanel({
  side,
  sideName,
}: {
  side: TensionSide;
  sideName: string;
}) {
  const t = await getTranslations("research.synthesis");
  return (
    <div className="rounded-md border border-neutral-200 bg-neutral-50/50 p-4">
      <div className="mb-1 text-caption font-medium uppercase tracking-wider text-neutral-500">
        {sideName}
      </div>
      <p className="text-body-strong text-neutral-900">{side.label}</p>
      {side.quotes.length > 0 && (
        <ul className="mt-3 space-y-2">
          {side.quotes.map((q, i) => (
            <li
              key={i}
              className="border-l-2 border-neutral-200 pl-3 text-small italic text-neutral-600"
            >
              „{q}"
            </li>
          ))}
        </ul>
      )}
      {side.sourceInsightIds.length > 0 && (
        <p className="mt-3 font-mono text-caption text-neutral-400">
          {t("sourceInterviews", { count: side.sourceInsightIds.length })}
        </p>
      )}
    </div>
  );
}
