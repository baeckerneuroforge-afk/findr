import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { OrgResolutionError, requireOrgId } from "@/lib/auth/org";
import {
  countCompletedSessionsForPlan,
  getResearchPlan,
} from "@/lib/research/plans-service";
import { getLiveKitVoiceEnv } from "@/lib/voice-interview/livekit";
import { Card, CardBody } from "@/components/ui/Card";
import { EditStudyForm } from "@/components/dashboard/EditStudyForm";
import { ENABLED_MODULES } from "@/config/modules";

/**
 * /dashboard/research-plans/[id]/edit — einen bestehenden Product-Discovery-Plan
 * bearbeiten. Mirror der Market-Edit-Seite; das Gating (nur ohne abgeschlossene
 * Interviews) und die Studientyp-Weiche spiegeln die Detail-Seite.
 */
export default async function EditResearchPlanPage({
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

  const t = await getTranslations("research.plans");

  const { id: planId } = await params;
  const plan = await getResearchPlan(orgId, planId);
  if (!plan) notFound();

  // Studientyp-Weiche wie auf der Detail-Seite: Market-Studien gehören in ihren
  // eigenen Editor; ist Discovery abgeschaltet, zurück aufs Dashboard.
  if (plan.studyType === "market_research") {
    redirect(`/dashboard/market-research/${planId}/edit`);
  }
  if (!ENABLED_MODULES.productDiscovery) {
    redirect("/dashboard");
  }

  const completed = await countCompletedSessionsForPlan(orgId, planId);
  const editable = completed === 0;

  return (
    <div className="space-y-8">
      <div>
        <div className="mb-2">
          <Link
            href={`/dashboard/research-plans/${planId}`}
            className="text-small text-neutral-500 transition-colors hover:text-neutral-900"
          >
            {t("editBackToStudy")}
          </Link>
        </div>
        <h1 className="text-display text-neutral-900">{t("editTitle")}</h1>
        <p className="mt-1 text-body text-neutral-500">{t("editSubtitle")}</p>
      </div>

      {editable ? (
        <EditStudyForm
          plan={{
            id: plan.id,
            studyType: "product_discovery",
            title: plan.title,
            objective: plan.objective,
            persona: plan.persona,
            sampleTarget: plan.sampleTarget,
            topics: plan.topics,
            language: plan.language,
            voiceEnabled: plan.voiceEnabled,
            ttsEnabled: plan.ttsEnabled,
            visualCaptureEnabled: plan.visualCaptureEnabled,
            signalsEnabled: plan.signalsEnabled,
            useCase: plan.useCase,
            audienceType: plan.audienceType,
            maxRounds: plan.maxRounds,
            maxDurationSeconds: plan.maxDurationSeconds,
            interviewDepth: plan.interviewDepth,
            taskDefinition: plan.taskDefinition,
          }}
          voiceAvailable={getLiveKitVoiceEnv() !== null}
        />
      ) : (
        <Card>
          <CardBody className="space-y-2">
            <h2 className="text-h3 text-neutral-900">{t("editLockedTitle")}</h2>
            <p className="text-body text-neutral-600">{t("editLockedBody")}</p>
            <Link
              href={`/dashboard/research-plans/${planId}`}
              className="inline-block pt-1 text-body-strong text-primary-700 hover:underline"
            >
              {t("editBackToStudy")}
            </Link>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
