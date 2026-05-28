import Link from "next/link";
import { notFound, redirect } from "next/navigation";

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

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("de-DE", {
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

  return (
    <div className="space-y-8">
      {/* Breadcrumb */}
      <div>
        <Link
          href={`/dashboard/research-plans/${planId}`}
          className="text-small text-neutral-500 transition-colors hover:text-neutral-900"
        >
          ← Zurück zum Plan
        </Link>
      </div>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-display text-neutral-900">Synthese</h1>
          <p className="mt-1 text-body text-neutral-500">{plan.title}</p>
          {synthesis ? (
            <p className="mt-2 text-small text-neutral-500">
              {synthesis.synthesized_at ? (
                <>
                  Basiert auf{" "}
                  <span className="font-medium text-neutral-700">
                    {synthesis.based_on_count}{" "}
                    {synthesis.based_on_count === 1
                      ? "Interview"
                      : "Interviews"}
                  </span>
                  {" · "}
                  Stand{" "}
                  <span className="font-medium text-neutral-700">
                    {formatDate(synthesis.synthesized_at)}
                  </span>
                  {newInsightCount > 0 && (
                    <>
                      {" · "}
                      <span className="font-medium text-primary-700">
                        {newInsightCount}{" "}
                        {newInsightCount === 1
                          ? "neues Interview"
                          : "neue Interviews"}{" "}
                        seit der letzten Synthese
                      </span>
                    </>
                  )}
                </>
              ) : (
                <>Synthese-Slot existiert, aber noch nie berechnet.</>
              )}
            </p>
          ) : (
            <p className="mt-2 text-small text-neutral-500">
              Noch keine Synthese — {newInsightCount}{" "}
              {newInsightCount === 1
                ? "Interview verfügbar"
                : "Interviews verfügbar"}
              .
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
            <ExportSynthesisPdfButton planId={planId} />
          )}
        </div>
      </div>

      {/* Body — empty state OR overview + themes + tensions */}
      {synthesis === null || synthesis.synthesized_at === null ? (
        <EmptyState
          icon={<DiscoveryIcon />}
          title="Noch keine Synthese erstellt"
          description={
            newInsightCount > 0
              ? `${newInsightCount} ${
                  newInsightCount === 1 ? "Interview steht" : "Interviews stehen"
                } für die erste Synthese bereit. Klick „Synthese erstellen" oben rechts, um Stage 2 zu starten.`
              : "Sobald Interviews zu diesem Plan ausgewertet sind, kann hier die Cross-Call-Synthese erstellt werden."
          }
        />
      ) : (
        <>
          {/* Overview */}
          {synthesis.overview && (
            <Card>
              <CardHeader>
                <h2 className="text-h3 text-neutral-900">Überblick</h2>
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
                Emergente Themen ({synthesis.emergent_themes.length})
              </h2>
              <p className="text-body text-neutral-500">
                Themen, die in mehreren Interviews aufgetaucht sind. Klick ein
                Thema, um Zitate und Quell-Interviews zu sehen.
              </p>
            </div>
            {synthesis.emergent_themes.length === 0 ? (
              <Card>
                <CardBody>
                  <p className="py-4 text-center text-body text-neutral-500">
                    Stage 2 hat keine cross-call-Themen extrahiert — die
                    Interviews scheinen sich inhaltlich wenig zu überlappen.
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
                Spannungen ({synthesis.tensions.length})
              </h2>
              <p className="text-body text-neutral-500">
                Punkte, an denen Teilnehmer sich widersprechen — die
                Reibungsstellen, die der Synthese-Engine aufgefallen sind.
              </p>
            </div>
            {synthesis.tensions.length === 0 ? (
              <Card>
                <CardBody>
                  <p className="py-4 text-center text-body text-neutral-500">
                    Keine widersprüchlichen Lager über die Interviews hinweg
                    erkennbar.
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
                        <TensionSidePanel side={tension.side_a} sideName="Seite A" />
                        <TensionSidePanel side={tension.side_b} sideName="Seite B" />
                      </div>
                    </CardBody>
                  </Card>
                ))}
              </div>
            )}
          </section>

          {synthesis.model && (
            <p className="text-caption text-neutral-400">
              Model: {synthesis.model}
            </p>
          )}

          {/* Chat-with-data — only when the synthesis actually exists. The
              engine would short-circuit a zero-insight study server-side,
              but the panel needs the synthesis surface to be coherent
              before we offer "ask your data". `ready` is the same gate as
              "PDF export button is shown". */}
          <ChatWithDataPanel planId={planId} ready={true} />
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
function TensionSidePanel({
  side,
  sideName,
}: {
  side: TensionSide;
  sideName: string;
}) {
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
          {side.sourceInsightIds.length}{" "}
          {side.sourceInsightIds.length === 1
            ? "Quell-Interview"
            : "Quell-Interviews"}
        </p>
      )}
    </div>
  );
}
