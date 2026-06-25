import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { OrgResolutionError, requireOrgId } from "@/lib/auth/org";
import { researchOpenLinkUrl } from "@/lib/email/research-invite";
import { getResearchPlan } from "@/lib/research/plans-service";
import { getOpenLinkForPlan } from "@/lib/research/open-links";
import {
  listInvitedPoolMemberIds,
  listPoolMembers,
} from "@/lib/research/participant-pool";
import {
  getProlificCredentialSummary,
  getProlificStudyForPlan,
} from "@/lib/panel/service";
import { Card, CardBody } from "@/components/ui/Card";
import { WizardSteps } from "@/components/dashboard/guided-study/wizard-ui";
import { InviteFromPoolForm } from "@/components/dashboard/InviteFromPoolForm";
import { OpenLinkPanel } from "@/components/dashboard/OpenLinkPanel";
import { ProlificDraftPanel } from "@/components/dashboard/ProlificDraftPanel";
import { ScreeningQuestionsPanel } from "@/components/dashboard/ScreeningQuestionsPanel";

/**
 * /dashboard/market-research/[id]/launch — fokussierte Verteilung direkt nach
 * „Studie starten" im gefuehrten Wizard.
 *
 * Statt den Nutzer auf die dichte Studien-Detailseite zu werfen, landet er hier
 * auf einem ruhigen „Wie gewinnst du Teilnehmer:innen?"-Screen, der die ECHTEN,
 * bewährten Panels der Detailseite 1:1 wiederverwendet — Screening, öffentlicher
 * Link, **Teilnehmerpool-Einladung** und **Prolific (inkl. Kosten-Prediction
 * via panel/cost-estimate)**. Server-Komponente: holt dieselben Daten wie die
 * Detailseite (Pool, Open-Link, Prolific-Credential + Draft) und reicht sie
 * unverändert an die Client-Panels. Keine neue API, keine Duplikat-Logik.
 */
export default async function StudyLaunchPage({
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
  // Markt-Bereich only — ein Discovery-Plan gehört auf seine Detailseite.
  if (plan.studyType !== "market_research") {
    redirect(`/dashboard/research-plans/${planId}`);
  }

  const t = await getTranslations("research.plans");
  const tm = await getTranslations("research.market");
  const tw = await getTranslations("research.wizard");

  // Dieselben unabhängigen Reads wie die Detailseite (parallel, kein N+1).
  const [
    poolMembers,
    invitedPoolMemberIds,
    openLink,
    prolificCredential,
    prolificStudy,
  ] = await Promise.all([
    listPoolMembers(orgId),
    listInvitedPoolMemberIds(orgId, planId),
    getOpenLinkForPlan(orgId, planId),
    getProlificCredentialSummary(orgId),
    getProlificStudyForPlan(orgId, planId),
  ]);

  const openLinkView = openLink
    ? {
        status: openLink.status,
        maxSessions: openLink.max_sessions,
        validUntil: openLink.valid_until,
        label: openLink.label,
      }
    : null;
  const openLinkShareUrl = openLink
    ? researchOpenLinkUrl(openLink.access_token)
    : null;
  const hasScreening = plan.screeningQuestions.length > 0;
  const panelCompletionConfigured = Boolean(
    openLink?.panel_completion?.complete_url ||
      openLink?.panel_completion?.screenout_url,
  );
  const archived = plan.status === "archived";

  const stepLabels = [
    tw("stepBriefing"),
    tw("stepProposal"),
    tw("stepInterview"),
    tw("stepStart"),
    tw("stepDistribution"),
  ];

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      {/* Derselbe Wizard-Fortschritt — Schritt 5 (Verteilung) aktiv: die Seite
          liest sich als letzter Schritt des gefuehrten Flows, nicht als
          fremde Seite. */}
      <WizardSteps labels={stepLabels} current={4} />

      <div className="st-rise" style={{ "--st": 0 } as React.CSSProperties}>
        <h1 className="text-display text-neutral-900">{tw("launchTitle")}</h1>
        <p className="mt-2 max-w-[54ch] text-body text-neutral-500">
          {tw("launchDesc")}
        </p>
      </div>

      {/* Screening (optionaler Gate für den öffentlichen Link) */}
      <section
        className="st-rise space-y-3"
        style={{ "--st": 1 } as React.CSSProperties}
      >
        <div>
          <h2 className="text-h3 text-neutral-900">{t("screeningTitle")}</h2>
          <p className="text-small text-neutral-500">{t("screeningDesc")}</p>
        </div>
        <Card>
          <CardBody>
            <ScreeningQuestionsPanel
              planId={plan.id}
              initialQuestions={plan.screeningQuestions}
              disabled={archived}
            />
          </CardBody>
        </Card>
      </section>

      {/* Öffentlicher Link */}
      <section
        className="st-rise space-y-3"
        style={{ "--st": 2 } as React.CSSProperties}
      >
        <div>
          <h2 className="text-h3 text-neutral-900">{t("openLinkTitle")}</h2>
          <p className="text-small text-neutral-500">{t("openLinkDesc")}</p>
        </div>
        <Card>
          <CardBody>
            <OpenLinkPanel
              planId={plan.id}
              openLink={openLinkView}
              shareUrl={openLinkShareUrl}
              hasScreening={hasScreening}
              disabled={archived}
            />
          </CardBody>
        </Card>
      </section>

      {/* Teilnehmerpool */}
      <section
        className="st-rise space-y-3"
        style={{ "--st": 3 } as React.CSSProperties}
      >
        <div>
          <h2 className="text-h3 text-neutral-900">{t("fromPoolTitle")}</h2>
        </div>
        <Card>
          <CardBody>
            <InviteFromPoolForm
              planId={plan.id}
              poolMembers={poolMembers}
              invitedMemberIds={invitedPoolMemberIds}
            />
          </CardBody>
        </Card>
      </section>

      {/* Prolific-Panel inkl. Kosten-Prediction */}
      <section
        className="st-rise space-y-3"
        style={{ "--st": 4 } as React.CSSProperties}
      >
        <div>
          <h2 className="text-h3 text-neutral-900">{tm("prolificTitle")}</h2>
          <p className="text-small text-neutral-500">{tm("prolificDesc")}</p>
        </div>
        <Card>
          <CardBody>
            <ProlificDraftPanel
              planId={plan.id}
              planTitle={plan.title}
              planObjective={plan.objective}
              sampleTarget={plan.sampleTarget}
              openLink={
                openLink
                  ? { status: openLink.status, maxSessions: openLink.max_sessions }
                  : null
              }
              credentialStatus={prolificCredential?.status ?? "missing"}
              panelCompletionConfigured={panelCompletionConfigured}
              panelStudy={
                prolificStudy
                  ? {
                      providerStudyId: prolificStudy.providerStudyId,
                      status: prolificStudy.status,
                      createdAt: prolificStudy.createdAt,
                      submissionCounts: prolificStudy.submissionCounts,
                      totalCostCents: prolificStudy.totalCostCents,
                      lastSyncedAt: prolificStudy.lastSyncedAt,
                    }
                  : null
              }
              disabled={archived}
            />
          </CardBody>
        </Card>
      </section>

      <div
        className="st-rise flex justify-end"
        style={{ "--st": 5 } as React.CSSProperties}
      >
        <Link
          href={`/dashboard/market-research/${plan.id}`}
          className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 text-body-strong text-white shadow-sm transition-colors hover:bg-primary-hover"
        >
          {tw("launchToStudy")} →
        </Link>
      </div>
    </div>
  );
}
