import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { toBcp47 } from "@/i18n/locale";
import { OrgResolutionError, requireOrgId } from "@/lib/auth/org";
import {
  researchInterviewUrl,
  researchOpenLinkUrl,
} from "@/lib/email/research-invite";
import { getProlificCredentialSummary } from "@/lib/panel/service";
import {
  countCompletedSessionsForPlan,
  getResearchPlan,
} from "@/lib/research/plans-service";
import { getOpenLinkForPlan } from "@/lib/research/open-links";
import { listInvitesForPlan } from "@/lib/research/scheduling";
import {
  listInvitedPoolMemberIds,
  listPoolMembers,
  listQuotaProgress,
} from "@/lib/research/participant-pool";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { BulkInviteForm } from "@/components/dashboard/BulkInviteForm";
import { CopyInterviewLinkButton } from "@/components/dashboard/CopyInterviewLinkButton";
import { DeleteParticipantButton } from "@/components/dashboard/DeleteParticipantButton";
import { EditParticipantButton } from "@/components/dashboard/EditParticipantButton";
import { InviteForm } from "@/components/dashboard/InviteForm";
import { InviteFromPoolForm } from "@/components/dashboard/InviteFromPoolForm";
import { OpenLinkPanel } from "@/components/dashboard/OpenLinkPanel";
import { PlanQuotaPanel } from "@/components/dashboard/PlanQuotaPanel";
import { PlanStatusControl } from "@/components/dashboard/PlanStatusControl";
import { ProlificDraftPanel } from "@/components/dashboard/ProlificDraftPanel";
import { ScreeningQuestionsPanel } from "@/components/dashboard/ScreeningQuestionsPanel";
import { ScheduleInviteAction } from "@/components/dashboard/ScheduleInviteAction";
import { SendInviteAction } from "@/components/dashboard/SendInviteAction";

/**
 * /dashboard/market-research/[id] — Markt-Kampagne (Phase M3).
 *
 * Der KAMPAGNEN-FLOW: bündelt die schon existierenden Teile an EINEM Ort —
 * Topics/Ziel + Agenten-Script (Plan-Felder), Screening
 * (ScreeningQuestionsPanel), offener Link (OpenLinkPanel), Quoten
 * (PlanQuotaPanel) und die Auswertung (Synthese/Chat/Export, verlinkt auf den
 * GETEILTEN /synthesis-Pfad). ALLE Panels sind die der Product-Discovery-
 * Detailseite — WIEDERVERWENDET, nicht neu gebaut. Der Unterschied zu
 * Discovery ist study_type + die Bündelung als Kampagnen-Erlebnis +
 * der Ziel-Pool-Fortschritt (§7). DIESELBE Engine darunter.
 *
 * Die Synthese/Chat/Highlight-Reel/Export leben weiter auf
 * /dashboard/research-plans/[id]/synthesis — EIN Synthese-Pfad, eine Engine
 * (kein zweiter Auswertungs-Bau). Der Markt-Diskriminator macht die Engine
 * (M2) typ-bewusst; hier wird nur verlinkt.
 */

type Status = "draft" | "active" | "completed" | "archived";

const STATUS_VARIANT: Record<Status, BadgeVariant> = {
  draft: "default",
  active: "success",
  completed: "low",
  archived: "default",
};

type InviteStatus =
  | "pending"
  | "scheduled"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "no_show";

const INVITE_STATUS_VARIANT: Record<InviteStatus, BadgeVariant> = {
  pending: "default",
  scheduled: "default",
  in_progress: "default",
  completed: "success",
  cancelled: "default",
  no_show: "critical",
};

const MODE_LABEL: Record<string, string> = {
  text: "Text",
  voice: "Voice",
  video: "Video",
};

function formatDate(iso: string, locale: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(toBcp47(locale), {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function MarketCampaignDetailPage({
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
  const tm = await getTranslations("research.market");
  const ts = await getTranslations("syntheticTest");
  const locale = await getLocale();

  const { id: planId } = await params;
  const plan = await getResearchPlan(orgId, planId);
  if (!plan) notFound();

  // Symmetric guard to the discovery detail's market-redirect: this area is the
  // Market-Research experience only. A product_discovery plan reached here
  // (stale link / hand-typed URL) belongs on the discovery detail — send it
  // there rather than render the campaign chrome around it.
  if (plan.studyType !== "market_research") {
    redirect(`/dashboard/research-plans/${planId}`);
  }

  const invites = await listInvitesForPlan(orgId, planId);

  // Pool + Quoten + offener Link + Ziel-Pool-Fortschritt + Prolific-Credential —
  // alle unabhängig, parallel (kein N+1). Der completed-Count ist die §7-
  // Messung; null → "—" (fail-open). getProlificCredentialSummary degradiert auf
  // null, wenn kein Token verbunden ist — das Panel zeigt dann den "erst Prolific
  // verbinden"-Leerzustand, genau wie auf der Product-Discovery-Detailseite.
  const [
    poolMembers,
    invitedPoolMemberIds,
    quotas,
    openLink,
    completed,
    prolificCredential,
  ] = await Promise.all([
    listPoolMembers(orgId),
    listInvitedPoolMemberIds(orgId, planId),
    listQuotaProgress(orgId, planId),
    getOpenLinkForPlan(orgId, planId),
    countCompletedSessionsForPlan(orgId, planId),
    getProlificCredentialSummary(orgId),
  ]);
  const poolRoles = [
    ...new Set(poolMembers.map((m) => m.role).filter((r): r is string => !!r)),
  ].sort();

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
  // Spiegelt die PD-Seite: zeigt im Panel den "Completion wired"-Badge, sobald
  // ein früherer Draft die Complete-/Screen-out-URLs in den offenen Link
  // geschrieben hat. Reiner Read aus openLink.panel_completion, kein Backend.
  const panelCompletionConfigured = Boolean(
    openLink?.panel_completion?.complete_url ||
      openLink?.panel_completion?.screenout_url,
  );

  // Ziel-Pool-Fortschritt (§7) — sample_target ist das studienweite Ziel,
  // completed der gemessene Fortschritt (NUR status='completed'). Die drei
  // Quota-Begriffe bleiben getrennt (siehe countCompletedSessionsForPlan).
  const sampleTarget = plan.sampleTarget;
  const targetReached =
    sampleTarget !== null && completed !== null && completed >= sampleTarget;
  const targetPct =
    sampleTarget !== null && sampleTarget > 0 && completed !== null
      ? Math.min(100, Math.round((completed / sampleTarget) * 100))
      : 0;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="mb-2">
          <Link
            href="/dashboard/market-research"
            className="text-small text-neutral-500 transition-colors hover:text-neutral-900"
          >
            {tm("backToCampaigns")}
          </Link>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-display text-neutral-900">{plan.title}</h1>
              <Badge variant="low">{tm("studyTypeBadge")}</Badge>
              <Badge variant={STATUS_VARIANT[plan.status]}>
                {t(`status.${plan.status}`)}
              </Badge>
            </div>
            <p className="mt-1 text-small text-neutral-500">
              {t("createdAt", { date: formatDate(plan.createdAt, locale) })}
            </p>
          </div>
        </div>
      </div>

      {/* Objective + persona + sample-target */}
      <Card>
        <CardHeader>
          <h2 className="text-h3 text-neutral-900">{t("objective")}</h2>
        </CardHeader>
        <CardBody>
          <p className="whitespace-pre-wrap text-body text-neutral-700">
            {plan.objective}
          </p>

          {(plan.persona || sampleTarget !== null) && (
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div>
                <div className="text-caption font-medium uppercase tracking-wider text-neutral-400">
                  {t("targetPersona")}
                </div>
                <p className="mt-1 whitespace-pre-wrap text-body text-neutral-700">
                  {plan.persona ?? (
                    <span className="text-neutral-400">
                      {t("personaNotSpecified")}
                    </span>
                  )}
                </p>
              </div>
              <div>
                <div className="text-caption font-medium uppercase tracking-wider text-neutral-400">
                  {t("sampleTargetField")}
                </div>
                <p className="mt-1 text-body text-neutral-700">
                  {sampleTarget !== null ? (
                    t("sampleTargetValue", { count: sampleTarget })
                  ) : (
                    <span className="text-neutral-400">
                      {t("sampleOpenEnded")}
                    </span>
                  )}
                </p>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Ziel-Pool-Fortschritt (§7) — "47 von 200". Misst sample_target gegen
          abgeschlossene Interviews. Bewusst GETRENNT von den Rollen-Quoten
          (unten) und vom max_sessions-Spend-Cap des offenen Links. */}
      <section className="space-y-3">
        <div>
          <h2 className="text-h3 text-neutral-900">{tm("poolTitle")}</h2>
          <p className="text-small text-neutral-500">{tm("poolDesc")}</p>
        </div>
        <Card>
          <CardBody>
            {completed === null ? (
              <p className="text-small text-neutral-500">
                {tm("poolCountUnknownDesc")}
              </p>
            ) : sampleTarget !== null ? (
              <div className="space-y-2">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <span className="text-h2 text-neutral-900">
                    {tm("poolProgress", {
                      completed,
                      target: sampleTarget,
                    })}
                  </span>
                  <span className="text-small text-neutral-500">
                    {tm("poolProgressCaption")}
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-100">
                  <div
                    className={`h-full rounded-full ${
                      targetReached ? "bg-success-500" : "bg-primary-500"
                    }`}
                    style={{ width: `${targetPct}%` }}
                  />
                </div>
              </div>
            ) : (
              <p className="text-body text-neutral-700">
                {tm("poolNoTarget")}{" "}
                <span className="text-neutral-500">
                  {tm("poolNoTargetCount", { completed })}
                </span>
              </p>
            )}
          </CardBody>
        </Card>
      </section>

      {/* Topics (read-only) */}
      <section className="space-y-4">
        <div>
          <h2 className="text-h2 text-neutral-900">{t("topicsTitle")}</h2>
          <p className="text-body text-neutral-500">{t("topicsDesc")}</p>
        </div>
        {plan.topics.length === 0 ? (
          <Card>
            <CardBody>
              <p className="py-4 text-center text-body text-neutral-500">
                {t("noTopics")}
              </p>
            </CardBody>
          </Card>
        ) : (
          <ul className="space-y-3">
            {plan.topics.map((topic, i) => (
              <li key={i}>
                <Card>
                  <CardBody className="space-y-3">
                    <div>
                      <div className="text-caption font-medium uppercase tracking-wider text-neutral-400">
                        {t("topicN", { n: i + 1 })}
                      </div>
                      <div className="mt-0.5 text-h3 text-neutral-900">
                        {topic.topic}
                      </div>
                    </div>
                    <div>
                      <div className="text-caption font-medium uppercase tracking-wider text-neutral-400">
                        {t("intent")}
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-body text-neutral-700">
                        {topic.intent}
                      </p>
                    </div>
                    {topic.hypotheses && topic.hypotheses.length > 0 && (
                      <div>
                        <div className="text-caption font-medium uppercase tracking-wider text-neutral-400">
                          {t("privateHypothesesCount", {
                            count: topic.hypotheses.length,
                          })}
                        </div>
                        <ul className="mt-1 space-y-1">
                          {topic.hypotheses.map((h, hi) => (
                            <li
                              key={hi}
                              className="border-l-2 border-neutral-200 pl-3 text-small text-neutral-600"
                            >
                              {h}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardBody>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Studie testen (Trockenlauf) — synthetische Test-Teilnehmer, BEVOR echte
          Menschen eingeladen werden. Eigene Route + eigene (separate) Tabellen;
          zählt NICHT in den Ziel-Pool und fließt NICHT in die echte Synthese. */}
      <section className="space-y-3">
        <div>
          <h2 className="text-h3 text-neutral-900">{ts("linkOutTitle")}</h2>
          <p className="text-small text-neutral-500">{ts("linkOutDesc")}</p>
        </div>
        <Card>
          <CardBody>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-body text-neutral-700">{ts("pageSubtitle")}</p>
              <Link
                href={`/dashboard/market-research/${plan.id}/test`}
                className="shrink-0 text-body-strong text-primary-700 hover:underline"
              >
                {ts("linkOutCta")}
              </Link>
            </div>
          </CardBody>
        </Card>
      </section>

      {/* Teilnehmer */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-h2 text-neutral-900">
              {t("participantsTitle")}
            </h2>
            <p className="text-body text-neutral-500">
              {invites.length === 0
                ? t("participantsEmptyDesc")
                : t("participantsCountDesc", { count: invites.length })}
            </p>
          </div>
        </div>

        {invites.length > 0 && (
          <Card>
            <Table>
              <THead>
                <TR>
                  <TH>{t("colName")}</TH>
                  <TH>{t("colEmail")}</TH>
                  <TH>{t("colMode")}</TH>
                  <TH>{t("colSchedule")}</TH>
                  <TH>{t("colStatus")}</TH>
                  <TH>{t("colSend")}</TH>
                  <TH>{t("colLink")}</TH>
                  <TH>{t("colActions")}</TH>
                </TR>
              </THead>
              <TBody>
                {invites.map((invite) => {
                  const planLocked =
                    plan.status === "archived" || plan.status === "completed";
                  const inviteTerminal =
                    invite.status === "completed" ||
                    invite.status === "cancelled" ||
                    invite.status === "no_show";
                  const scheduleDisabled = planLocked || inviteTerminal;
                  const deleteDisabled = plan.status === "archived";
                  return (
                    <TR key={invite.id}>
                      <TD className="text-body-strong text-neutral-900">
                        {invite.contact_label}
                      </TD>
                      <TD className="text-neutral-700">
                        {invite.contact_email ?? (
                          <span className="text-neutral-400">—</span>
                        )}
                      </TD>
                      <TD className="text-neutral-700">
                        {MODE_LABEL[invite.mode_preference] ??
                          invite.mode_preference}
                      </TD>
                      <TD>
                        <ScheduleInviteAction
                          inviteId={invite.id}
                          scheduledAt={invite.scheduled_at}
                          disabled={scheduleDisabled}
                        />
                      </TD>
                      <TD>
                        <Badge
                          variant={
                            INVITE_STATUS_VARIANT[
                              invite.status as InviteStatus
                            ] ?? "default"
                          }
                        >
                          {INVITE_STATUS_VARIANT[invite.status as InviteStatus]
                            ? t(`inviteStatus.${invite.status}`)
                            : invite.status}
                        </Badge>
                      </TD>
                      <TD>
                        <SendInviteAction
                          inviteId={invite.id}
                          scheduledAt={invite.scheduled_at}
                          invitedAt={invite.invited_at}
                          contactEmail={invite.contact_email}
                          disabled={scheduleDisabled}
                        />
                      </TD>
                      <TD>
                        <CopyInterviewLinkButton
                          link={
                            invite.access_token
                              ? researchInterviewUrl(invite.access_token)
                              : null
                          }
                        />
                      </TD>
                      <TD>
                        <div className="flex items-center gap-1">
                          <EditParticipantButton
                            planId={plan.id}
                            participantId={invite.id}
                            initialLabel={invite.contact_label}
                            initialEmail={invite.contact_email}
                            disabled={deleteDisabled}
                          />
                          <DeleteParticipantButton
                            planId={plan.id}
                            participantId={invite.id}
                            contactLabel={invite.contact_label}
                            disabled={deleteDisabled}
                          />
                        </div>
                      </TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </Card>
        )}

        {plan.status === "archived" ? (
          <Card>
            <CardBody>
              <p className="py-3 text-center text-small text-neutral-500">
                {t("archivedNote")}
              </p>
            </CardBody>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader>
                <h3 className="text-h3 text-neutral-900">
                  {t("addParticipant")}
                </h3>
              </CardHeader>
              <CardBody>
                <InviteForm planId={plan.id} />
              </CardBody>
            </Card>
            <Card>
              <CardHeader>
                <h3 className="text-h3 text-neutral-900">{t("bulkTitle")}</h3>
              </CardHeader>
              <CardBody>
                <BulkInviteForm planId={plan.id} />
              </CardBody>
            </Card>
            <Card>
              <CardHeader>
                <h3 className="text-h3 text-neutral-900">
                  {t("fromPoolTitle")}
                </h3>
              </CardHeader>
              <CardBody>
                <InviteFromPoolForm
                  planId={plan.id}
                  poolMembers={poolMembers}
                  invitedMemberIds={invitedPoolMemberIds}
                />
              </CardBody>
            </Card>
          </>
        )}
      </section>

      {/* Screening-Fragen */}
      <section className="space-y-3">
        <div>
          <h2 className="text-h3 text-neutral-900">{t("screeningTitle")}</h2>
          <p className="text-small text-neutral-500">{t("screeningDesc")}</p>
        </div>
        <Card>
          <CardBody>
            <ScreeningQuestionsPanel
              planId={plan.id}
              initialQuestions={plan.screeningQuestions}
              disabled={plan.status === "archived"}
            />
          </CardBody>
        </Card>
      </section>

      {/* Offener Link — der Kern des Markt-Outreach: EIN studienweiter,
          öffentlich teilbarer Link für anonyme Walk-ins. */}
      <section className="space-y-3">
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
              disabled={plan.status === "archived"}
            />
          </CardBody>
        </Card>
      </section>

      {/* Prolific Panel-Anbieter — baut NUR einen unveröffentlichten Draft im
          Kunden-Prolific aus dem AKTIVEN offenen Link und schreibt die erzeugten
          Completion-URLs additiv in research_open_links.panel_completion. Kein
          Publish, kein Funding. Identische Verdrahtung wie auf der Product-
          Discovery-Detailseite — dieselbe Komponente, dieselben Props; nur die
          Section-Überschrift ist markt-passend (de+en via research.market).
          Sitzt bewusst direkt unter dem offenen Link (der die Teilnehmer-URL
          liefert) und vor den Quoten. */}
      <section className="space-y-3">
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
                  ? {
                      status: openLink.status,
                      maxSessions: openLink.max_sessions,
                    }
                  : null
              }
              credentialStatus={prolificCredential?.status ?? "missing"}
              panelCompletionConfigured={panelCompletionConfigured}
              disabled={plan.status === "archived"}
            />
          </CardBody>
        </Card>
      </section>

      {/* Screening-Quoten (Rollen-Pool) — bewusst getrennt vom Ziel-Pool oben. */}
      <section className="space-y-3">
        <div>
          <h2 className="text-h3 text-neutral-900">{t("quotasTitle")}</h2>
          <p className="text-small text-neutral-500">{t("quotasDesc")}</p>
        </div>
        <Card>
          <CardBody>
            <PlanQuotaPanel
              planId={plan.id}
              quotas={quotas}
              availableRoles={poolRoles}
              disabled={plan.status === "archived"}
            />
          </CardBody>
        </Card>
      </section>

      {/* Auswertung — GETEILTER Synthese-Pfad (eine Engine, M2-typ-bewusst). */}
      <section className="space-y-3">
        <div>
          <h2 className="text-h3 text-neutral-900">
            {t("synthesisLinkTitle")}
          </h2>
          <p className="text-small text-neutral-500">
            {t("synthesisLinkDesc")}
          </p>
        </div>
        <Card>
          <CardBody>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-body text-neutral-700">
                {t("synthesisLinkBody")}
              </p>
              <Link
                href={`/dashboard/research-plans/${plan.id}/synthesis`}
                className="shrink-0 text-body-strong text-primary-700 hover:underline"
              >
                {t("viewSynthesis")}
              </Link>
            </div>
          </CardBody>
        </Card>
      </section>

      {/* Status-Lifecycle */}
      <section className="space-y-3">
        <div>
          <h2 className="text-h3 text-neutral-900">{t("lifecycleTitle")}</h2>
          <p className="text-small text-neutral-500">{t("lifecycleDesc")}</p>
        </div>
        <PlanStatusControl planId={plan.id} status={plan.status} />
      </section>
    </div>
  );
}
