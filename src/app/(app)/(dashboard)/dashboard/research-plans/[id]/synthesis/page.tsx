import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";

import { toBcp47 } from "@/i18n/locale";
import { OrgResolutionError, requireOrgId } from "@/lib/auth/org";
import { getResearchPlan } from "@/lib/research/plans-service";
import {
  countInsightsForPlanSince,
  getStudySynthesis,
  mapInsightsToSessionIds,
  type EmergentTheme,
  type Tension,
  type TensionSide,
} from "@/lib/synthesis/service";
import { appBaseUrl } from "@/lib/email/research-invite";
import { listSynthesisShares } from "@/lib/synthesis/share-service";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ResearchAgentPanel } from "@/components/dashboard/ResearchAgentPanel";
import { ExportSynthesisPdfButton } from "@/components/dashboard/ExportSynthesisPdfButton";
import { ExportSynthesisPptxButton } from "@/components/dashboard/ExportSynthesisPptxButton";
import { HighlightReelPanel } from "@/components/dashboard/HighlightReelPanel";
import { SynthesisThemeCard } from "@/components/dashboard/SynthesisThemeCard";
import { FrequencyBarChart } from "@/components/dashboard/FrequencyBarChart";
import { buildThemeFrequencyChart } from "@/lib/synthesis/charts";
import { UpdateSynthesisButton } from "@/components/dashboard/UpdateSynthesisButton";
import { SynthesisShareManager } from "@/components/dashboard/SynthesisShareManager";
import { ENABLED_MODULES } from "@/config/modules";

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
  if (plan.studyType !== "market_research" && !ENABLED_MODULES.productDiscovery) {
    redirect("/dashboard");
  }

  const planDetailHref =
    plan.studyType === "market_research"
      ? `/dashboard/market-research/${planId}`
      : `/dashboard/research-plans/${planId}`;

  const synthesis = await getStudySynthesis(orgId, planId);
  const synthesisReady =
    synthesis !== null && synthesis.synthesized_at !== null;

  // E7: Beleg-Links nur für Markt-Studien (nur dort existiert die
  // sessions-Subroute) und nur bei fertiger Synthese. Die Auflösung kennt
  // nur Interviews mit session_id-Stempel — alles andere fällt in der UI
  // auf die reine ID-Anzeige zurück.
  const insightIdsForLinks =
    synthesisReady && synthesis && plan.studyType === "market_research"
      ? [
          ...new Set([
            ...synthesis.emergent_themes.flatMap(
              (theme) => theme.sourceInsightIds,
            ),
            ...synthesis.tensions.flatMap((tension) => [
              ...tension.side_a.sourceInsightIds,
              ...tension.side_b.sourceInsightIds,
            ]),
          ]),
        ]
      : [];

  // All reads depend only on `synthesis`, not on each other → one parallel
  // stage instead of sequential roundtrips (Perf-Audit 4.3).
  const [newInsightCount, shares, insightSessionIds] = await Promise.all([
    // "X new insights since the last synthesis". When `synthesized_at` is null
    // (synthesis row may exist but never ran; or no row at all) this counts
    // ALL insights for the plan — which is what the user wants to see as "the
    // first synthesis will draw from these".
    countInsightsForPlanSince(orgId, planId, synthesis?.synthesized_at ?? null),
    // Existing public share links for this synthesis (org-internal, newest
    // first). Loaded via the canonical service — same path the public route
    // uses — only when a populated synthesis exists, i.e. the same gate the
    // share manager and export buttons render under.
    synthesisReady ? listSynthesisShares(orgId, planId) : [],
    insightIdsForLinks.length > 0
      ? mapInsightsToSessionIds(orgId, planId, insightIdsForLinks)
      : ({} as Record<string, string>),
  ]);

  const sessionHrefById: Record<string, string> = {};
  for (const [insightId, sessionId] of Object.entries(insightSessionIds)) {
    sessionHrefById[insightId] =
      `/dashboard/market-research/${planId}/sessions/${sessionId}`;
  }

  const t = await getTranslations("research.synthesis");
  const locale = await getLocale();

  // Honest theme-prevalence chart — built purely from the engine-overridden
  // `frequency` per theme (unique respondents), never an LLM number. Null when
  // there are fewer than two themes to compare, or no synthesis yet.
  const themeChart = synthesis
    ? buildThemeFrequencyChart(
        synthesis.emergent_themes,
        synthesis.based_on_count,
      )
    : null;

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
      <div
        className="st-rise flex flex-wrap items-start justify-between gap-4"
        style={{ "--st": 0 } as React.CSSProperties}
      >
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
            synthesisReady={synthesisReady}
            currentDetailLevel={synthesis?.detail_level ?? "standard"}
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
          {/* „X neue seit letzter Synthese“ — als eigener Hinweis-Banner statt
              Meta-Nebensatz (Konsole-v5 E5): die eine Information, die eine
              Handlung verlangt, bekommt die eine hervorgehobene Fläche. */}
          {newInsightCount > 0 && (
            <div
              className="st-rise rounded-lg border border-primary-200 bg-primary-50 px-4 py-3 text-small text-primary-800"
              style={{ "--st": 1 } as React.CSSProperties}
            >
              {t("newSinceLastNotice", { count: newInsightCount })}
            </div>
          )}

          {/* E5 (Konsole-v5): ab lg zweispaltig — links die Lese-Strecke
              (Überblick, Themen, Spannungen), rechts die Werkzeuge (Chat,
              Agent, Highlight-Reel, Teilen). Alle Panels behalten identische
              Props — reine Anordnung; die Sektions-Einrückung darunter bleibt
              unangetastet (diff-schonend). */}
          <div
            className="st-rise lg:grid lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start lg:gap-8"
            style={{ "--st": 2 } as React.CSSProperties}
          >
            <div className="space-y-8">

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

          {/* Ausführlicher Überblick — optionale Erzähl-Stufe (verankert;
              re-narriert nur die belegte Substanz, keine Empfehlungen). */}
          {synthesis.executive_narrative && (
            <Card>
              <CardHeader>
                <h2 className="text-h3 text-neutral-900">
                  {t("narrativeTitle")}
                </h2>
              </CardHeader>
              <CardBody>
                <p className="whitespace-pre-wrap text-body leading-relaxed text-neutral-700">
                  {synthesis.executive_narrative}
                </p>
              </CardBody>
            </Card>
          )}

          {/* Beratung (nicht belegt) — interpretative Implikationen (Hypothesen
              aus Befunden), eval-abgesichert (basis = echter Befund, GATE). Klar
              als „nicht belegt" gekennzeichnet, nie als Fakt. */}
          {synthesis.implications.length > 0 && (
            <Card>
              <CardHeader>
                <h2 className="text-h3 text-neutral-900">
                  {t("advisoryTitle")}
                </h2>
                <p className="mt-1 text-small text-neutral-500">
                  {t("advisorySubtitle")}
                </p>
              </CardHeader>
              <CardBody>
                <ul className="space-y-3">
                  {synthesis.implications.map((imp, i) => (
                    <li
                      key={`impl-${i}`}
                      className="rounded-md border border-dashed border-warning-500/40 bg-warning-50 p-3"
                    >
                      <div className="text-caption font-medium uppercase tracking-wider text-warning-700">
                        {imp.basis}
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-body leading-relaxed text-neutral-800">
                        {imp.hypothesis}
                      </p>
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          )}

          {/* Themen-Häufigkeit auf einen Blick — nur aus Server-Zahlen. */}
          {themeChart && (
            <FrequencyBarChart
              chart={themeChart}
              title={t("chartThemeTitle")}
              unit={t("chartUnitInterviews")}
            />
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
                    sessionHrefById={sessionHrefById}
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

          {/* E7 — Stimulus-Auswertung. Rendert nur, wenn die Synthese einen
              Server-Stimulus-Block trägt (Set-Studien nach Re-Run). ALLE
              Kennzahlen kommen aus stimulus_summary (deterministisch, Server);
              die LLM-Anteile (Sektion-Prosa, Vergleich) sind anker-geprüft
              und unter Mindest-N hart unterdrückt (Engine). */}
          {synthesis.stimulus_summary && (
            <section className="space-y-4">
              <div>
                <h2 className="text-h2 text-neutral-900">
                  {t("stimuliTitle")}
                </h2>
                <p className="text-body text-neutral-500">
                  {t("stimuliDesc", {
                    fullReveal: synthesis.stimulus_summary.fullRevealSessions,
                    total: synthesis.stimulus_summary.totalSessions,
                    setSize: synthesis.stimulus_summary.setSize,
                  })}
                </p>
              </div>

              <div className="space-y-3">
                {synthesis.stimulus_summary.items.map((item) => {
                  const section = synthesis.stimulus_sections.find(
                    (sec) => sec.position === item.position,
                  );
                  return (
                    <Card key={`stimulus-${item.position}`}>
                      <CardBody className="space-y-3">
                        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                          <h3 className="text-body-strong text-neutral-900">
                            {item.label
                              ? t("stimulusHeadingLabeled", {
                                  position: item.position,
                                  label: item.label,
                                })
                              : t("stimulusHeading", {
                                  position: item.position,
                                })}
                          </h3>
                          <span className="text-caption text-neutral-500">
                            {t("stimulusSeen", {
                              count: item.seenSessions,
                              total:
                                synthesis.stimulus_summary!.totalSessions,
                            })}
                          </span>
                        </div>
                        {section ? (
                          <>
                            <p className="text-body leading-relaxed text-neutral-700">
                              {section.summary}
                            </p>
                            {section.quotes.length > 0 && (
                              <ul className="space-y-2">
                                {section.quotes.map((q, qi) => (
                                  <li
                                    key={qi}
                                    className="border-l-2 border-primary-200 pl-3 text-small italic text-neutral-600"
                                  >
                                    „{q}“
                                  </li>
                                ))}
                              </ul>
                            )}
                          </>
                        ) : (
                          <p className="text-small text-neutral-500">
                            {t("stimulusBelowMinN")}
                          </p>
                        )}
                      </CardBody>
                    </Card>
                  );
                })}
              </div>

              {synthesis.stimulus_summary.preference && (
                <Card>
                  <CardBody className="space-y-3">
                    <h3 className="text-body-strong text-neutral-900">
                      {t("stimulusPreferenceTitle")}
                    </h3>
                    <p className="text-small text-neutral-500">
                      {t("stimulusPreferenceCounted", {
                        counted: synthesis.stimulus_summary.preference.counted,
                      })}
                    </p>
                    <ul className="space-y-1">
                      {synthesis.stimulus_summary.preference.votes.map(
                        (vote) => {
                          const item =
                            synthesis.stimulus_summary!.items.find(
                              (i) => i.position === vote.position,
                            );
                          return (
                            <li
                              key={`vote-${vote.position}`}
                              className="flex items-baseline justify-between gap-4 text-body text-neutral-700"
                            >
                              <span>
                                {item?.label
                                  ? t("stimulusHeadingLabeled", {
                                      position: vote.position,
                                      label: item.label,
                                    })
                                  : t("stimulusHeading", {
                                      position: vote.position,
                                    })}
                              </span>
                              <span className="font-medium text-neutral-900">
                                {t("stimulusVotes", { count: vote.count })}
                              </span>
                            </li>
                          );
                        },
                      )}
                      {synthesis.stimulus_summary.preference.none > 0 && (
                        <li className="flex items-baseline justify-between gap-4 text-body text-neutral-500">
                          <span>{t("stimulusNoPreference")}</span>
                          <span className="font-medium">
                            {t("stimulusVotes", {
                              count:
                                synthesis.stimulus_summary.preference.none,
                            })}
                          </span>
                        </li>
                      )}
                    </ul>
                    {synthesis.stimulus_comparison && (
                      <p className="border-t border-neutral-100 pt-3 text-body leading-relaxed text-neutral-700">
                        {synthesis.stimulus_comparison}
                      </p>
                    )}
                    <p className="text-caption text-neutral-400">
                      {t("stimulusPreferenceDisclaimer")}
                    </p>
                  </CardBody>
                </Card>
              )}
            </section>
          )}

          {/* E4 — Antwort-Signale (Kennzahlen NUR aus signals_summary, dem
              server-berechneten Block — nie aus LLM-Text) + Methodik-Abschnitt
              („Warum wurde was gefragt?", aus den echten WHY-Rationales E3).
              Beide rendern nur mit Befund — Bestands-Synthesen byte-identisch. */}
          {synthesis.signals_summary && (
            <section className="space-y-4">
              <div>
                <h2 className="text-h2 text-neutral-900">
                  {t("signalsTitle")}
                </h2>
                <p className="text-body text-neutral-500">
                  {t("signalsSessions", {
                    signalSessions: synthesis.signals_summary.signalSessions,
                    totalSessions: synthesis.signals_summary.totalSessions,
                  })}
                </p>
              </div>
              <Card>
                <CardBody className="space-y-3">
                  <p className="text-body-strong text-neutral-900">
                    {t("signalsAnswers", {
                      total: synthesis.signals_summary.totalAnswers,
                      direct: synthesis.signals_summary.direct,
                      partial: synthesis.signals_summary.partial,
                      evasive: synthesis.signals_summary.evasive,
                      declined: synthesis.signals_summary.declined,
                    })}
                  </p>
                  {synthesis.signal_observations.length > 0 && (
                    <ul className="list-disc space-y-1 pl-5 text-body text-neutral-700">
                      {synthesis.signal_observations.map((obs, i) => (
                        <li key={`obs-${i}`}>{obs}</li>
                      ))}
                    </ul>
                  )}
                  <p className="text-caption text-neutral-400">
                    {t("signalsDisclaimer")}
                  </p>
                </CardBody>
              </Card>
            </section>
          )}

          {/* Phase D — Usability-Aggregat (Kennzahlen NUR aus interaction_summary,
              server-deterministisch berechnet — nie aus LLM-Text). Aggregate-only,
              ab Mindest-N; rendert nur mit Befund → Bestand byte-identisch. */}
          {synthesis.interaction_summary && (
            <section className="space-y-4">
              <div>
                <h2 className="text-h2 text-neutral-900">
                  {t("usabilityTitle")}
                </h2>
                <p className="text-body text-neutral-500">
                  {t("usabilitySessions", {
                    n: synthesis.interaction_summary.sessionsWithResults,
                  })}
                </p>
              </div>
              <Card>
                <CardBody className="space-y-3">
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
                    <div>
                      <dt className="text-caption text-neutral-500">
                        {t("usabilitySuccessRate")}
                      </dt>
                      <dd className="text-body text-neutral-900">
                        {synthesis.interaction_summary!.successRate === null
                          ? "—"
                          : `${Math.round(synthesis.interaction_summary!.successRate * 100)} %`}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-caption text-neutral-500">
                        {t("usabilityAvgTime")}
                      </dt>
                      <dd className="text-body text-neutral-900">
                        {synthesis.interaction_summary!.avgTimeSeconds === null
                          ? "—"
                          : t("usabilitySeconds", {
                              n: synthesis.interaction_summary!.avgTimeSeconds,
                            })}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-caption text-neutral-500">
                        {t("usabilityAvgClicks")}
                      </dt>
                      <dd className="text-body text-neutral-900">
                        {synthesis.interaction_summary!.avgClicks}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-caption text-neutral-500">
                        {t("usabilityFrictionRate")}
                      </dt>
                      <dd className="text-body text-neutral-900">
                        {`${Math.round(synthesis.interaction_summary!.frictionRate * 100)} %`}
                      </dd>
                    </div>
                  </dl>
                  {synthesis.interaction_summary!.judgeAgreement !== null && (
                    <p className="text-caption text-neutral-500">
                      {t("usabilityJudgeAgreement", {
                        n: Math.round(
                          synthesis.interaction_summary!.judgeAgreement * 100,
                        ),
                      })}
                    </p>
                  )}
                  <p className="text-caption text-neutral-400">
                    {t("usabilityDisclaimer")}
                  </p>
                </CardBody>
              </Card>
            </section>
          )}

          {synthesis.methodology && (
            <section className="space-y-4">
              <div>
                <h2 className="text-h2 text-neutral-900">
                  {t("methodologyTitle")}
                </h2>
                <p className="text-body text-neutral-500">
                  {t("methodologyDesc")}
                </p>
              </div>
              <Card>
                <CardBody className="space-y-3">
                  <p className="whitespace-pre-wrap text-body leading-relaxed text-neutral-700">
                    {synthesis.methodology.summary}
                  </p>
                  {synthesis.methodology.themes.length > 0 && (
                    <dl className="space-y-2">
                      {synthesis.methodology.themes.map((mt, i) => (
                        <div key={`mtheme-${i}`}>
                          <dt className="text-body-strong text-neutral-900">
                            {mt.topic}
                          </dt>
                          <dd className="text-body text-neutral-700">
                            {mt.rationale}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}
                  {synthesis.methodology.coverageNote && (
                    <p className="text-caption text-neutral-400">
                      {synthesis.methodology.coverageNote}
                    </p>
                  )}
                </CardBody>
              </Card>
            </section>
          )}

          {synthesis.model && (
            <p className="text-caption text-neutral-400">
              {t("model", { model: synthesis.model })}
            </p>
          )}
            </div>

            <div className="mt-8 space-y-8 lg:mt-0">

          {/* Research-Agent — build deliverables (summary / breakdown /
              theme-ranking) on instruction from THIS synthesis. Same readiness
              gate; multi-turn lives in the panel's local state. The engine
              re-anchors every turn against the synthesis, so follow-ups stay
              grounded. */}
          <ResearchAgentPanel planId={planId} ready={true} />

          {/* Highlight-Reel — same readiness gate. The reel is derived
              on-demand from the verdichtungen + synthesis (no persistence),
              and the panel only triggers on an explicit click — the engine
              short-circuits empty inputs to zero-token responses. */}
          <HighlightReelPanel planId={planId} ready={true} />

          {/* Share — create / list / revoke public read-only links to this
              synthesis. Same readiness gate as the export buttons; the
              show_quotes opt-in (default off) lives in the manager. baseUrl is
              the canonical appBaseUrl() — same source as the invite emails. */}
          <SynthesisShareManager
            planId={planId}
            initialShares={shares}
            baseUrl={appBaseUrl()}
          />
            </div>
          </div>
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
              className="border-l-2 border-primary-200 pl-3 text-small italic text-neutral-600"
            >
              „{q}“
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
