import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { OrgResolutionError, requireOrgId } from "@/lib/auth/org";
import {
  getResearchPlan,
  getSessionWithTranscript,
  listPlanStimuli,
  resolveStimulusSet,
} from "@/lib/research/plans-service";
import {
  SessionConversationCard,
  SessionMetaBadges,
  SessionSignalsCard,
} from "@/components/dashboard/SessionTranscriptView";
import { ENABLED_MODULES } from "@/config/modules";

/**
 * /dashboard/market-research/[id]/sessions/[sessionId] — Interview-Transkript
 * (Voice Phase 2 E2). Reine Lese-Ansicht des vollständigen Gesprächs.
 *
 * Mirrors the dry-run subroute's auth + plan-load + study_type guard EXACTLY
 * (test/page.tsx): requireOrgId → getResearchPlan(orgId, planId) → market
 * guard. Die Session selbst kommt aus getSessionWithTranscript, das die
 * plan_id-Bindung serverseitig erzwingt — eine fremde sessionId unter dieser
 * Plan-URL löst nie auf (null → notFound()).
 *
 * E7b: Badge-Zeile + Gesprächsverlauf leben in den geteilten Bausteinen
 * SessionMetaBadges/SessionConversationCard — dieselben rendert der
 * Intercepting-Drawer (@drawer/(.)sessions), die Ansichten driften nie.
 */

export default async function MarketSessionTranscriptPage({
  params,
}: {
  params: Promise<{ id: string; sessionId: string }>;
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

  const tm = await getTranslations("research.market");

  const { id: planId, sessionId } = await params;
  const plan = await getResearchPlan(orgId, planId);
  if (!plan) notFound();

  // Symmetric guard to the campaign detail page: this is the Market-Research
  // experience only. A discovery plan reached here belongs on the discovery side.
  if (plan.studyType !== "market_research") {
    if (!ENABLED_MODULES.productDiscovery) redirect("/dashboard");
    redirect(`/dashboard/research-plans/${planId}`);
  }

  const session = await getSessionWithTranscript(orgId, planId, sessionId);
  if (!session) notFound();
  // E7 Multi-Stimulus — Set fürs Reveal-Marker-Labeling (leer für Studien
  // ohne Set → Transkript byte-identisch). Aufgelöst über den Dual-Read,
  // dieselbe Quelle wie die Detailseite.
  const stimuli = resolveStimulusSet(
    plan,
    await listPlanStimuli(orgId, planId),
  ).map((item) => ({ position: item.position, label: item.label }));

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="mb-2">
          <Link
            href={`/dashboard/market-research/${planId}`}
            className="text-small text-neutral-500 transition-colors hover:text-neutral-900"
          >
            {tm("transcriptBack")}
          </Link>
        </div>
        <h1 className="text-display text-neutral-900">
          {tm("transcriptTitle")}
        </h1>
        <p className="mt-1 text-small text-neutral-400">{plan.title}</p>
        <SessionMetaBadges session={session} className="mt-3" />
      </div>

      {/* E2 — Signal-Block überm Transkript; rendert nur mit Sidecar-Befund. */}
      <SessionSignalsCard session={session} />

      {/* Gesprächsverlauf — geteilter Baustein mit dem Drawer (E7b). */}
      <SessionConversationCard session={session} stimuli={stimuli} />
    </div>
  );
}
