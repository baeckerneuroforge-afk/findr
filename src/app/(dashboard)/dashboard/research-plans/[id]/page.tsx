import Link from "next/link";
import { notFound, redirect } from "next/navigation";
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

const STATUS_LABEL: Record<Status, string> = {
  draft: "Draft",
  active: "Active",
  completed: "Completed",
  archived: "Archived",
};

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

const INVITE_STATUS_LABEL: Record<InviteStatus, string> = {
  pending: "Ausstehend",
  scheduled: "Terminiert",
  in_progress: "Läuft",
  completed: "Abgeschlossen",
  cancelled: "Abgesagt",
  no_show: "Nicht erschienen",
};

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

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("de-DE", {
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
            ← All research plans
          </Link>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-display text-neutral-900">{plan.title}</h1>
              <Badge variant={STATUS_VARIANT[plan.status]}>
                {STATUS_LABEL[plan.status]}
              </Badge>
            </div>
            <p className="mt-1 text-small text-neutral-500">
              Created {formatDate(plan.createdAt)}
            </p>
          </div>
        </div>
      </div>

      {/* Objective + persona + sample-target */}
      <Card>
        <CardHeader>
          <h2 className="text-h3 text-neutral-900">Objective</h2>
        </CardHeader>
        <CardBody>
          <p className="whitespace-pre-wrap text-body text-neutral-700">
            {plan.objective}
          </p>

          {(plan.persona || plan.sampleTarget !== null) && (
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div>
                <div className="text-caption font-medium uppercase tracking-wider text-neutral-400">
                  Target persona
                </div>
                <p className="mt-1 whitespace-pre-wrap text-body text-neutral-700">
                  {plan.persona ?? (
                    <span className="text-neutral-400">— not specified —</span>
                  )}
                </p>
              </div>
              <div>
                <div className="text-caption font-medium uppercase tracking-wider text-neutral-400">
                  Sample target
                </div>
                <p className="mt-1 text-body text-neutral-700">
                  {plan.sampleTarget !== null ? (
                    `${plan.sampleTarget} completed interviews`
                  ) : (
                    <span className="text-neutral-400">— open-ended —</span>
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
          <h2 className="text-h2 text-neutral-900">Topics</h2>
          <p className="text-body text-neutral-500">
            The agent covers each topic in 2–4 turns, formulating questions
            from the intent.
          </p>
        </div>
        {plan.topics.length === 0 ? (
          <Card>
            <CardBody>
              <p className="py-4 text-center text-body text-neutral-500">
                No topics yet — the agent will run purely off the objective.
              </p>
            </CardBody>
          </Card>
        ) : (
          <ul className="space-y-3">
            {plan.topics.map((t, i) => (
              <li key={i}>
                <Card>
                  <CardBody className="space-y-3">
                    <div>
                      <div className="text-caption font-medium uppercase tracking-wider text-neutral-400">
                        Topic {i + 1}
                      </div>
                      <div className="mt-0.5 text-h3 text-neutral-900">
                        {t.topic}
                      </div>
                    </div>
                    <div>
                      <div className="text-caption font-medium uppercase tracking-wider text-neutral-400">
                        Intent
                      </div>
                      <p className="mt-1 whitespace-pre-wrap text-body text-neutral-700">
                        {t.intent}
                      </p>
                    </div>
                    {t.hypotheses && t.hypotheses.length > 0 && (
                      <div>
                        <div className="text-caption font-medium uppercase tracking-wider text-neutral-400">
                          Private hypotheses · {t.hypotheses.length}
                        </div>
                        <ul className="mt-1 space-y-1">
                          {t.hypotheses.map((h, hi) => (
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
            <h2 className="text-h2 text-neutral-900">Teilnehmer</h2>
            <p className="text-body text-neutral-500">
              {invites.length === 0
                ? "Personen für Interviews hinzufügen. Termin + Mailversand sind eigene Aktionen pro Zeile."
                : `${invites.length} ${invites.length === 1 ? "Teilnehmer" : "Teilnehmer"} · Termin + Mailversand pro Zeile.`}
            </p>
          </div>
        </div>

        {invites.length > 0 && (
          <Card>
            <Table>
              <THead>
                <TR>
                  <TH>Name</TH>
                  <TH>E-Mail</TH>
                  <TH>Modus</TH>
                  <TH>Termin</TH>
                  <TH>Status</TH>
                  <TH>Senden</TH>
                  <TH>Link</TH>
                  <TH>Aktionen</TH>
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
                          {INVITE_STATUS_LABEL[invite.status as InviteStatus] ??
                            invite.status}
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
                Dieser Plan ist archiviert – keine neuen Teilnehmer möglich.
              </p>
            </CardBody>
          </Card>
        ) : (
          <>
            <Card>
              <CardHeader>
                <h3 className="text-h3 text-neutral-900">
                  Teilnehmer hinzufügen
                </h3>
              </CardHeader>
              <CardBody>
                <InviteForm planId={plan.id} />
              </CardBody>
            </Card>
            <Card>
              <CardHeader>
                <h3 className="text-h3 text-neutral-900">
                  Mehrere auf einmal
                </h3>
              </CardHeader>
              <CardBody>
                <BulkInviteForm planId={plan.id} />
              </CardBody>
            </Card>
            <Card>
              <CardHeader>
                <h3 className="text-h3 text-neutral-900">Aus Pool einladen</h3>
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

      {/* Screening-Quoten — manuelle Ziele pro Rolle, Fortschritt aus Pool-
          Einladungen. Deterministisch, additiv. Auf archivierten Plänen
          read-only (disabled). */}
      <section className="space-y-3">
        <div>
          <h2 className="text-h3 text-neutral-900">Screening-Quoten</h2>
          <p className="text-small text-neutral-500">
            Manuelle Ziele pro Rolle. Der Fortschritt zählt aus dem Pool
            eingeladene Personen – manuell angelegte Teilnehmer (ohne Rolle)
            fließen nicht ein.
          </p>
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
          <h2 className="text-h3 text-neutral-900">Synthesis</h2>
          <p className="text-small text-neutral-500">
            Cross-call themes and tensions distilled by the Stage-2 engine
            from this plan&apos;s interviews.
          </p>
        </div>
        <Card>
          <CardBody>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-body text-neutral-700">
                Emergente Themen, Spannungen und ein freitext-Overview, mit
                klickbaren Quell-Interviews und wörtlichen Zitaten.
              </p>
              <Link
                href={`/dashboard/research-plans/${plan.id}/synthesis`}
                className="shrink-0 text-body-strong text-primary-700 hover:underline"
              >
                View synthesis →
              </Link>
            </div>
          </CardBody>
        </Card>
      </section>

      {/* Status-Lifecycle */}
      <section className="space-y-3">
        <div>
          <h2 className="text-h3 text-neutral-900">Lifecycle</h2>
          <p className="text-small text-neutral-500">
            Drafts are editable but participants can&apos;t be invited yet.
            Activate to start, mark complete when sampling is done, archive
            to retire.
          </p>
        </div>
        <PlanStatusControl planId={plan.id} status={plan.status} />
      </section>
    </div>
  );
}
