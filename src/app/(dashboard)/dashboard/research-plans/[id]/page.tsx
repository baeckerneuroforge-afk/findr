import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { toBcp47 } from "@/i18n/locale";
import { OrgResolutionError, requireOrgId } from "@/lib/auth/org";
import { researchInterviewUrl } from "@/lib/email/research-invite";
import { getResearchPlan } from "@/lib/research/plans-service";
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
import { PlanQuotaPanel } from "@/components/dashboard/PlanQuotaPanel";
import { PlanStatusControl } from "@/components/dashboard/PlanStatusControl";
import { ScreeningQuestionsPanel } from "@/components/dashboard/ScreeningQuestionsPanel";
import { ScheduleInviteAction } from "@/components/dashboard/ScheduleInviteAction";
import { SendInviteAction } from "@/components/dashboard/SendInviteAction";

/**
 * /dashboard/research-plans/[id] — Detail-Seite.
 *
 * Read-only Darstellung des Plans plus Status-Lifecycle-Buttons + Teilnehmer-
 * Liste (Etappe B Teil 1). Topics werden hier nicht inline editiert (Edit-
 * Modal kommt in einer späteren Etappe). Scheduling + Mailversand pro
 * Invite (proposeSlots + scheduleAndSendInvite) sind Teil 2.
 */

type Status = "draft" | "active" | "completed" | "archived";

// Plan + invite status labels are translated via t(`status.*`) /
// t(`inviteStatus.*`); only the badge variants live here.
const STATUS_VARIANT: Record<Status, BadgeVariant> = {
  draft: "default",
  active: "success",
  completed: "low",
  archived: "default",
};

// Invite-status-Mapping. Halbwegs konservativ — "completed" leuchtet grün,
// "no_show" rot; die Zwischenzustände bleiben neutral, damit die Tabelle
// nicht wie ein Ampelfeuerwerk aussieht.
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

export default async function ResearchPlanDetailPage({
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
  const locale = await getLocale();

  const { id: planId } = await params;
  const plan = await getResearchPlan(orgId, planId);
  if (!plan) notFound();

  // Etappe B Teil 1 — read invites alongside the plan. Empty list reads as
  // "no participants yet"; listInvitesForPlan returns [] on transient
  // failure (safe degrade — the UI shows the InviteForm and the user can
  // refresh).
  const invites = await listInvitesForPlan(orgId, planId);

  // Participant-Pool + Screening-Quoten. Additiv zum bestehenden Invite-Flow —
  // unabhängige Reads, parallel. Alle drei degradieren auf [] bei Fehler.
  const [poolMembers, invitedPoolMemberIds, quotas] = await Promise.all([
    listPoolMembers(orgId),
    listInvitedPoolMemberIds(orgId, planId),
    listQuotaProgress(orgId, planId),
  ]);
  const poolRoles = [
    ...new Set(poolMembers.map((m) => m.role).filter((r): r is string => !!r)),
  ].sort();

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <div className="mb-2">
          <Link
            href="/dashboard/research-plans"
            className="text-small text-neutral-500 transition-colors hover:text-neutral-900"
          >
            {t("backAll")}
          </Link>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-display text-neutral-900">{plan.title}</h1>
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

          {(plan.persona || plan.sampleTarget !== null) && (
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
                  {plan.sampleTarget !== null ? (
                    t("sampleTargetValue", { count: plan.sampleTarget })
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

      {/* Topics (read-only — Edit modal lands in Etappe B) */}
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

      {/* Teilnehmer — Section unterhalb Topics, oberhalb Lifecycle.
          Reihenfolge folgt dem Mental Model: Plan definieren → Leute
          einladen → Lifecycle. Bulk-Anlage + Einzelanlage + Löschen
          sind alle hier verortet. */}
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
                  // Termin-/Versand-Aktionen deaktivieren wir, sobald der
                  // Plan nicht mehr bearbeitbar ist ODER die Zeile selbst
                  // einen Terminalstatus erreicht hat. Löschen bleibt
                  // davon UNBERÜHRT — wir wollen aufräumen können, auch
                  // wenn der Plan archiviert oder die Zeile abgesagt
                  // ist. Nur ein vollständig archivierter Plan friert
                  // alle Aktionen ein.
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
                        {/* Send-Button gating mirrors the API's pre-checks:
                            need scheduled_at + contact_email; idempotency
                            kicks in once invited_at is set. Same disabled
                            flag as Schedule — terminal invite / locked plan
                            → button locked too. Rows OHNE E-Mail haben
                            den Button automatisch deaktiviert (Hint
                            "E-Mail nötig") — Link kopieren funktioniert
                            trotzdem in der nächsten Spalte. */}
                        <SendInviteAction
                          inviteId={invite.id}
                          scheduledAt={invite.scheduled_at}
                          invitedAt={invite.invited_at}
                          contactEmail={invite.contact_email}
                          disabled={scheduleDisabled}
                        />
                      </TD>
                      <TD>
                        {/* Pure utility: copy the public interview URL to
                            the clipboard. The URL is resolved server-side
                            via the canonical researchInterviewUrl() helper
                            so it matches the link the invite mail sends.
                            Independent of Send — useful when the user
                            wants to share through Slack/WhatsApp instead
                            of (or in addition to) email, oder bei
                            Teilnehmern ohne hinterlegte E-Mail. */}
                        <CopyInterviewLinkButton
                          link={
                            invite.access_token
                              ? researchInterviewUrl(invite.access_token)
                              : null
                          }
                        />
                      </TD>
                      <TD>
                        {/* Edit + Delete share this cell as the row's
                            "Aktionen" column. Both are gated on the
                            archived-plan flag (deleteDisabled) — editing
                            a frozen plan is just as confusing as deleting
                            from it. */}
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

      {/* Screening-Fragen — inbound Qualifizierung VOR dem Interview. Der
          Researcher definiert Fragen + akzeptierte Antworten; die
          deterministische Auswertung (Etappe 4) entscheidet qualifiziert /
          abgewiesen. Leere Liste = kein Screening, jeder Eingeladene startet
          direkt ins Interview. Auf archivierten Plänen read-only. Sitzt
          bewusst zwischen Teilnehmer und Quoten ("erst screenen, dann
          quotieren"). */}
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

      {/* Screening-Quoten — manuelle Ziele pro Rolle, Fortschritt aus Pool-
          Einladungen. Deterministisch, additiv. Auf archivierten Plänen
          read-only (disabled). */}
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

      {/* Synthesis — link to the dedicated /synthesis route. Compact card,
          no data fetched here so the plan-detail page stays cheap. The
          synthesis page itself does the heavy lift (read + render + the
          re-run trigger). Additive section — does NOT alter the surrounding
          sections. */}
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
