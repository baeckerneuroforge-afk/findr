import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { OrgResolutionError, requireOrgId } from "@/lib/auth/org";
import { getResearchPlan } from "@/lib/research/plans-service";
import { listInvitesForPlan } from "@/lib/research/scheduling";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { Table, TBody, TD, TH, THead, TR } from "@/components/ui/Table";
import { InviteForm } from "@/components/dashboard/InviteForm";
import { PlanStatusControl } from "@/components/dashboard/PlanStatusControl";
import { ScheduleInviteAction } from "@/components/dashboard/ScheduleInviteAction";

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
  pending: "Pending",
  scheduled: "Scheduled",
  in_progress: "In progress",
  completed: "Completed",
  cancelled: "Cancelled",
  no_show: "No show",
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

      {/* Participants (Etappe B Teil 1) — additive section below Topics,
          above Lifecycle. Sequencing matches the mental model: define the
          plan → add people → run the lifecycle. */}
      <section className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-h2 text-neutral-900">Participants</h2>
            <p className="text-body text-neutral-500">
              {invites.length === 0
                ? "Add people you want to interview. Scheduling + sending the invite mail is the next step."
                : `${invites.length} ${invites.length === 1 ? "participant" : "participants"} · scheduling + mail follow in the next step.`}
            </p>
          </div>
        </div>

        {invites.length > 0 && (
          <Card>
            <Table>
              <THead>
                <TR>
                  <TH>Contact</TH>
                  <TH>Email</TH>
                  <TH>Mode</TH>
                  <TH>Scheduled</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {invites.map((invite) => {
                  // Disable rescheduling when the plan is no longer in a
                  // workable state OR the invite has already moved to a
                  // terminal status. Keeps the UI honest about which rows
                  // are still actionable.
                  const planLocked =
                    plan.status === "archived" || plan.status === "completed";
                  const inviteTerminal =
                    invite.status === "completed" ||
                    invite.status === "cancelled" ||
                    invite.status === "no_show";
                  const scheduleDisabled = planLocked || inviteTerminal;
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
                This plan is archived — new participants can&apos;t be added.
              </p>
            </CardBody>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <h3 className="text-h3 text-neutral-900">Add participant</h3>
            </CardHeader>
            <CardBody>
              <InviteForm planId={plan.id} />
            </CardBody>
          </Card>
        )}
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
