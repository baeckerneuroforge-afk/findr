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
  TaskResultCard,
} from "@/components/dashboard/SessionTranscriptView";
import { TranscriptDrawer } from "@/components/dashboard/TranscriptDrawer";
import { ENABLED_MODULES } from "@/config/modules";

/**
 * E7b (Konsole-v5): abgefangene Session-Route — rendert das Transkript als
 * Drawer über der aktuellen Konsolen-Seite statt als Seitenwechsel.
 * Auth, Plan-Load, study_type-Guard und Session-Bindung sind IDENTISCH zur
 * Voll-Seite (sessions/[sessionId]/page.tsx); der Inhalt kommt aus den
 * GETEILTEN Bausteinen SessionMetaBadges/SessionConversationCard — die
 * beiden Ansichten können nicht driften.
 */
export default async function InterceptedSessionDrawerPage({
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

  const { id: planId, sessionId } = await params;
  const plan = await getResearchPlan(orgId, planId);
  if (!plan) notFound();

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

  const tm = await getTranslations("research.market");

  return (
    <TranscriptDrawer
      title={tm("transcriptTitle")}
      subtitle={plan.title}
      fullHref={`/dashboard/market-research/${planId}/sessions/${sessionId}`}
    >
      <SessionMetaBadges session={session} />
      {/* E2 — Signal-Block; identische Reihenfolge wie die Voll-Seite. */}
      <SessionSignalsCard session={session} />
      {/* Phase 2c — Usability-Ergebnis; rendert nur mit berechnetem task_result. */}
      <TaskResultCard session={session} />
      <SessionConversationCard session={session} stimuli={stimuli} />
    </TranscriptDrawer>
  );
}
