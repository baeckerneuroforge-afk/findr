import "server-only";

import { getOrgName } from "@/lib/auth/org";
import { getOrgBranding } from "@/lib/settings/org-settings";
import { sendEmail } from "@/lib/email/resend";
import {
  buildResearchInvite,
  buildResearchReminder,
  buildResearchIcsAttachment,
  researchInterviewUrl,
} from "@/lib/email/research-invite";
import { translate } from "@/i18n/messages";
import {
  getResearchInvite,
  markInviteSent,
  markReminderSent,
  scheduleInvite,
  type ResearchInviteRecord,
} from "@/lib/research/scheduling";
import { getResearchPlan } from "@/lib/research/plans-service";
import { estimateInterviewMinutes } from "@/lib/research/interview-duration";

/**
 * Research-interview send flows. Pattern-matches src/lib/voice-agent/
 * checkin-orchestration.ts and src/lib/voice-agent/interview-orchestration.ts:
 *
 *  - load context (org name + invite),
 *  - validate the preconditions (email present, access_token present, etc.),
 *  - build the mail (+ ICS attachment),
 *  - send via Resend,
 *  - stamp an audit timestamp,
 *  - return a typed result and NEVER throw for expected misses.
 *
 * The send step is mode-agnostic (text / voice / video share copy + ICS).
 * The mode flows through to /interview/[token] which decides how to render
 * the session; nothing about the invite mail changes with mode.
 *
 * Dauer (E-Mail + ICS): wird jetzt PRO STUDIE aus der echten Konfiguration
 * abgeleitet — resolveInviteDurationMinutes liest den Plan (Zeitlimit gewinnt,
 * sonst Fragen-Obergrenze, zentral in interview-duration.ts). Die feste
 * 30-Minuten-Konstante ist nur noch der Fallback, wenn der Plan nicht ladbar
 * ist.
 */

const DEFAULT_DURATION_MINUTES = 30;

/**
 * Geschätzte Interviewdauer (ganze Minuten) für E-Mail-Text + ICS-DTEND,
 * abgeleitet aus dem zugehörigen Research-Plan. Dieselbe zentrale Funktion wie
 * Erstellungs-Vorschau + Längen-Readout — damit Teilnehmer nie eine andere
 * Dauer angekündigt bekommen, als die Studie tatsächlich vorsieht. Fällt auf
 * DEFAULT_DURATION_MINUTES zurück, falls der Plan (nicht mehr) sichtbar ist.
 */
async function resolveInviteDurationMinutes(
  orgId: string,
  planId: string,
): Promise<number> {
  const plan = await getResearchPlan(orgId, planId);
  if (!plan) return DEFAULT_DURATION_MINUTES;
  return estimateInterviewMinutes({
    maxRounds: plan.maxRounds,
    maxDurationSeconds: plan.maxDurationSeconds,
  });
}

// ── sendResearchInvite ──────────────────────────────────────────────────────

export type SendResearchInviteStatus =
  | "sent"
  | "not_found"
  | "missing_org"
  | "missing_token"
  | "missing_schedule"
  | "missing_contact"
  | "error";

export interface SendResearchInviteResult {
  status: SendResearchInviteStatus;
  sentTo: string | null;
  invitedAt: string | null;
  accessToken: string | null;
  message: string | null;
}

function emptySendResult(): SendResearchInviteResult {
  return {
    status: "error",
    sentTo: null,
    invitedAt: null,
    accessToken: null,
    message: null,
  };
}

function validateForSend(
  invite: ResearchInviteRecord,
): SendResearchInviteResult | null {
  if (!invite.org_id) {
    return {
      ...emptySendResult(),
      status: "missing_org",
      message: "Invite has no org_id.",
    };
  }
  if (!invite.scheduled_at) {
    return {
      ...emptySendResult(),
      status: "missing_schedule",
      message: "Invite has no scheduled_at — schedule it first.",
    };
  }
  if (!invite.access_token) {
    return {
      ...emptySendResult(),
      status: "missing_token",
      message:
        "Invite has no access_token — the /interview/[token] link can't be built.",
    };
  }
  if (!invite.contact_email.trim()) {
    return {
      ...emptySendResult(),
      status: "missing_contact",
      message: "Invite has no contact_email.",
    };
  }
  return null;
}

/**
 * Send the initial scheduling invitation for a research interview. Assumes
 * the invite is already scheduled (scheduled_at set) — call scheduleInvite
 * or scheduleAndSendInvite first if not. Builds the mail + ICS attachment,
 * sends via Resend, stamps invited_at on success.
 *
 * Idempotency: this function does NOT short-circuit when invited_at is
 * already set — callers may legitimately want to resend (e.g. after a
 * delivery failure flagged by the user). If you need first-send-only
 * semantics, gate at the caller.
 */
export async function sendResearchInvite(
  orgId: string,
  inviteId: string,
): Promise<SendResearchInviteResult> {
  const invite = await getResearchInvite(orgId, inviteId);
  if (!invite) {
    return {
      ...emptySendResult(),
      status: "not_found",
      message: "Invite not found.",
    };
  }
  const invalid = validateForSend(invite);
  if (invalid) return invalid;

  // After validateForSend, these are known non-null. TS doesn't narrow
  // through the helper return, so re-assert for clarity.
  const scheduledAt = new Date(invite.scheduled_at!);
  const accessToken = invite.access_token!;
  const email = invite.contact_email.trim();

  try {
    const orgName = await getOrgName(orgId);
    const branding = await getOrgBranding(orgId);
    const url = researchInterviewUrl(accessToken);
    const locale = invite.language;
    const durationMinutes = await resolveInviteDurationMinutes(
      orgId,
      invite.plan_id,
    );

    const { subject, html, text } = buildResearchInvite({
      contactName: invite.contact_label,
      orgName,
      scheduledAt,
      durationMinutes,
      url,
      locale,
      branding,
    });

    const ics = buildResearchIcsAttachment({
      uid: invite.id,
      orgName,
      summary: translate(locale, "email.research.ics.summary", {
        org: orgName,
      }),
      description: translate(locale, "email.research.ics.description", {
        minutes: durationMinutes,
        url,
      }),
      scheduledAt,
      durationMinutes,
      url,
    });

    await sendEmail({
      to: email,
      subject,
      html,
      text,
      attachments: [ics],
    });
    const invitedAt = await markInviteSent(orgId, inviteId);

    return {
      status: "sent",
      sentTo: email,
      invitedAt,
      accessToken,
      message: null,
    };
  } catch (err) {
    console.error(
      `[sendResearchInvite] failed for invite ${inviteId}:`,
      err instanceof Error ? err.message : err,
    );
    if (err instanceof Error && err.cause !== undefined) {
      console.error("[sendResearchInvite] underlying cause:", err.cause);
    }
    return {
      ...emptySendResult(),
      status: "error",
      message: "Could not send the research invite.",
    };
  }
}

// ── scheduleAndSendInvite (combo, happy path) ───────────────────────────────

export interface ScheduleAndSendResult {
  scheduleStatus: "scheduled" | "not_found" | "missing_org" | "in_past";
  sendStatus: SendResearchInviteStatus | "skipped";
  sentTo: string | null;
  invitedAt: string | null;
  accessToken: string | null;
  scheduledAt: string | null;
  message: string | null;
}

/**
 * Convenience combo: scheduleInvite() + sendResearchInvite() in sequence.
 * If the schedule step fails the send is skipped — and the result reports
 * scheduleStatus separately from sendStatus so the route layer can render
 * a precise error message.
 */
export async function scheduleAndSendInvite(
  orgId: string,
  inviteId: string,
  scheduledAt: Date,
): Promise<ScheduleAndSendResult> {
  const scheduled = await scheduleInvite(orgId, inviteId, scheduledAt);
  if (scheduled.status !== "scheduled") {
    return {
      scheduleStatus: scheduled.status,
      sendStatus: "skipped",
      sentTo: null,
      invitedAt: null,
      accessToken: scheduled.invite?.access_token ?? null,
      scheduledAt: scheduled.invite?.scheduled_at ?? null,
      message: scheduled.message,
    };
  }

  const sent = await sendResearchInvite(orgId, inviteId);
  return {
    scheduleStatus: "scheduled",
    sendStatus: sent.status,
    sentTo: sent.sentTo,
    invitedAt: sent.invitedAt,
    accessToken: sent.accessToken,
    scheduledAt: scheduled.invite?.scheduled_at ?? null,
    message: sent.message,
  };
}

// ── sendResearchReminder ────────────────────────────────────────────────────

export type SendReminderStatus =
  | "sent"
  | "not_found"
  | "missing_org"
  | "missing_token"
  | "missing_schedule"
  | "missing_contact"
  | "already_sent"
  | "error";

export interface SendReminderResult {
  status: SendReminderStatus;
  kind: "24h" | "1h";
  sentTo: string | null;
  reminderSentAt: string | null;
  message: string | null;
}

function reminderAlreadySent(
  invite: ResearchInviteRecord,
  kind: "24h" | "1h",
): boolean {
  return kind === "24h"
    ? invite.reminder_24h_sent_at !== null
    : invite.reminder_1h_sent_at !== null;
}

/**
 * Send a single reminder (24h or 1h) for a research invite. Idempotent at
 * the row level via the reminder_*_sent_at column — if the stamp is
 * already set, this returns "already_sent" without re-emailing. The cron
 * relies on this so jittery scheduling can't double-fire.
 *
 * The cron also pre-filters by stamp + window, so under normal conditions
 * the guard here is defense-in-depth, not the primary dedup.
 */
export async function sendResearchReminder(
  orgId: string,
  inviteId: string,
  kind: "24h" | "1h",
): Promise<SendReminderResult> {
  const base: SendReminderResult = {
    status: "error",
    kind,
    sentTo: null,
    reminderSentAt: null,
    message: null,
  };

  const invite = await getResearchInvite(orgId, inviteId);
  if (!invite) {
    return { ...base, status: "not_found", message: "Invite not found." };
  }
  if (!invite.org_id) {
    return { ...base, status: "missing_org", message: "No org_id on invite." };
  }
  if (!invite.scheduled_at) {
    return {
      ...base,
      status: "missing_schedule",
      message: "Invite has no scheduled_at.",
    };
  }
  if (!invite.access_token) {
    return { ...base, status: "missing_token", message: "No access_token." };
  }
  if (!invite.contact_email.trim()) {
    return {
      ...base,
      status: "missing_contact",
      message: "No contact_email.",
    };
  }
  if (reminderAlreadySent(invite, kind)) {
    return {
      ...base,
      status: "already_sent",
      message: `Reminder ${kind} already sent for this invite.`,
    };
  }

  try {
    const orgName = await getOrgName(orgId);
    const branding = await getOrgBranding(orgId);
    const scheduledAt = new Date(invite.scheduled_at);
    const url = researchInterviewUrl(invite.access_token);
    const email = invite.contact_email.trim();
    const durationMinutes = await resolveInviteDurationMinutes(
      orgId,
      invite.plan_id,
    );

    const { subject, html, text } = buildResearchReminder({
      kind,
      contactName: invite.contact_label,
      orgName,
      scheduledAt,
      durationMinutes,
      url,
      locale: invite.language,
      branding,
    });

    await sendEmail({ to: email, subject, html, text });
    const reminderSentAt = await markReminderSent(orgId, inviteId, kind);

    return {
      status: "sent",
      kind,
      sentTo: email,
      reminderSentAt,
      message: null,
    };
  } catch (err) {
    console.error(
      `[sendResearchReminder ${kind}] failed for invite ${inviteId}:`,
      err instanceof Error ? err.message : err,
    );
    if (err instanceof Error && err.cause !== undefined) {
      console.error("[sendResearchReminder] underlying cause:", err.cause);
    }
    return {
      ...base,
      status: "error",
      message: `Could not send ${kind} reminder.`,
    };
  }
}
