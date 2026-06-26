import "server-only";

import type { Json } from "@/types/database";

import {
  createResearchSupabase,
  type ActivationMode,
  type SchedulerEventType,
} from "./db";
import { getResearchPlan, type ResearchPlanRecord } from "./plans-service";
import { listInvitesForPlan } from "./scheduling";
import { sendResearchInvite } from "./invite-orchestration";

/**
 * Deferred Activation service — Phase 1 of the Kalender/Scheduler feature
 * (docs/klymeo-scheduler-kalender-plan-2026-06-26.md).
 *
 * A study is PREPARED as a draft (pool + Prolific draft staged) and RELEASED
 * later. Phase 1 is fully MANUAL (no cron): the researcher schedules an
 * activation time for the overview, and a "Jetzt aktivieren" button releases it.
 *
 * The hard part — never double-activate — is solved with a Postgres
 * compare-and-set on status='draft' (mirroring the voice-interview
 * bridge-service CAS on status='open'). Exactly one caller can flip a given
 * draft to active; everyone else gets 0 rows back and treats it as a no-op. The
 * CAS keys on status='draft', NOT on activation_state, so the same primitive
 * covers BOTH a scheduled release AND a spontaneous "activate now" on an
 * un-scheduled draft (activation_state='none').
 *
 * org scoping: every query filters org_id explicitly — createResearchSupabase is
 * the service-role client (RLS-bypassing), so the .eq("org_id", orgId) IS the
 * trust boundary, exactly like the rest of the research layer.
 */

// ── audit log ───────────────────────────────────────────────────────────────

export interface SchedulerEventInput {
  userId?: string | null;
  email?: string | null;
  detail?: Json | null;
}

/**
 * Append one scheduler_events row. Best-effort + fail-open: an audit-write
 * failure is logged but never breaks the user-facing action (the activation /
 * schedule already succeeded by the time we record it).
 */
export async function recordSchedulerEvent(
  orgId: string,
  planId: string,
  eventType: SchedulerEventType,
  input: SchedulerEventInput = {},
): Promise<void> {
  try {
    const supabase = createResearchSupabase();
    const { error } = await supabase.from("scheduler_events").insert({
      org_id: orgId,
      plan_id: planId,
      event_type: eventType,
      triggered_by: "manual",
      triggered_by_user_id: input.userId ?? null,
      triggered_by_email: input.email ?? null,
      detail: input.detail ?? null,
    });
    if (error) {
      console.warn(
        `[recordSchedulerEvent] could not write ${eventType} for plan ${planId}:`,
        error.message,
      );
    }
  } catch (err) {
    console.warn(
      `[recordSchedulerEvent] threw for plan ${planId}:`,
      err instanceof Error ? err.message : err,
    );
  }
}

// ── schedule / reschedule / cancel ───────────────────────────────────────────

export interface SchedulePlanInput {
  scheduledAt: Date;
  mode: ActivationMode;
  userId?: string | null;
  email?: string | null;
}

export type ScheduleResultReason = "not_found_or_not_draft";

export interface ScheduleResult {
  ok: boolean;
  reason?: ScheduleResultReason;
  plan?: ResearchPlanRecord | null;
}

/**
 * Set (or move) a study's planned activation time. Only a draft can be
 * scheduled — the CAS on status='draft' returns 0 rows for any non-draft or
 * cross-org plan, which the route maps to 409/404. Clears any prior
 * activation_error so a re-schedule after a failed release is clean.
 */
export async function schedulePlanActivation(
  orgId: string,
  planId: string,
  input: SchedulePlanInput,
): Promise<ScheduleResult> {
  const supabase = createResearchSupabase();
  const { data, error } = await supabase
    .from("research_plans")
    .update({
      scheduled_activation_at: input.scheduledAt.toISOString(),
      activation_mode: input.mode,
      activation_state: "scheduled",
      scheduled_by_user_id: input.userId ?? null,
      scheduled_by_email: input.email ?? null,
      activation_error: null,
    })
    .eq("org_id", orgId)
    .eq("id", planId)
    .eq("status", "draft")
    .select("id")
    .maybeSingle();

  if (error) {
    // A transport/DB error (not a 0-row CAS miss) — log it for observability.
    // The caller still maps this to the same not_found_or_not_draft outcome;
    // the route's try/catch only catches THROWN errors, not returned ones.
    console.error(
      `[scheduler] CAS transport error for plan ${planId}:`,
      error.message,
    );
  }
  if (error || !data) {
    return { ok: false, reason: "not_found_or_not_draft" };
  }
  return { ok: true, plan: await getResearchPlan(orgId, planId) };
}

/**
 * Cancel a planned activation — back to the inert unscheduled state. Only a
 * draft is touched (the CAS on status='draft'); an already-activated study is
 * never reset. Clears the scheduler audit fields too.
 */
export async function cancelPlanActivation(
  orgId: string,
  planId: string,
): Promise<ScheduleResult> {
  const supabase = createResearchSupabase();
  const { data, error } = await supabase
    .from("research_plans")
    .update({
      scheduled_activation_at: null,
      activation_state: "none",
      activation_mode: "manual",
      scheduled_by_user_id: null,
      scheduled_by_email: null,
      activation_error: null,
    })
    .eq("org_id", orgId)
    .eq("id", planId)
    .eq("status", "draft")
    .select("id")
    .maybeSingle();

  if (error) {
    // A transport/DB error (not a 0-row CAS miss) — log it for observability.
    // The caller still maps this to the same not_found_or_not_draft outcome;
    // the route's try/catch only catches THROWN errors, not returned ones.
    console.error(
      `[scheduler] CAS transport error for plan ${planId}:`,
      error.message,
    );
  }
  if (error || !data) {
    return { ok: false, reason: "not_found_or_not_draft" };
  }
  return { ok: true, plan: await getResearchPlan(orgId, planId) };
}

// ── activation (release) ──────────────────────────────────────────────────────

/**
 * Outcome of releasing the prepared pool invites on activation. Honest about
 * the two-step invite model: sendResearchInvite requires a per-invite
 * scheduled_at (the interview slot), so invites with no slot land in
 * needsSchedule rather than being silently dropped.
 */
export interface InviteReleaseSummary {
  total: number;
  sent: number;
  needsSchedule: number;
  needsContact: number;
  failed: number;
}

function emptyReleaseSummary(): InviteReleaseSummary {
  return { total: 0, sent: 0, needsSchedule: 0, needsContact: 0, failed: 0 };
}

/**
 * Send every PREPARED invite of a plan (invited_at IS NULL = not yet sent).
 * Best-effort, idempotent: already-sent invites are skipped (filtered out), and
 * each send is bucketed into one of four counts — sent / needsSchedule /
 * needsContact / failed, where `failed` covers every remaining error status
 * (missing_token, missing_org, not_found, error). Never throws — a per-invite
 * failure is counted, not propagated.
 */
export async function releasePreparedInvites(
  orgId: string,
  planId: string,
): Promise<InviteReleaseSummary> {
  const invites = await listInvitesForPlan(orgId, planId);
  const prepared = invites.filter((i) => i.invited_at === null);
  const summary = emptyReleaseSummary();
  summary.total = prepared.length;

  for (const invite of prepared) {
    const result = await sendResearchInvite(orgId, invite.id);
    switch (result.status) {
      case "sent":
        summary.sent += 1;
        break;
      case "missing_schedule":
        summary.needsSchedule += 1;
        break;
      case "missing_contact":
        summary.needsContact += 1;
        break;
      default:
        // missing_token / missing_org / not_found / error
        summary.failed += 1;
        break;
    }
  }
  return summary;
}

export type ActivateResultReason = "not_found_or_not_draft";

export interface ActivateResult {
  ok: boolean;
  reason?: ActivateResultReason;
  plan?: ResearchPlanRecord | null;
  invites?: InviteReleaseSummary;
}

/**
 * Release a study NOW: flip draft→active via the compare-and-set, then send the
 * prepared pool invites. The CAS guarantees at-most-once activation (a
 * concurrent click or a future cron tick that loses the race gets 0 rows and is
 * a no-op). Invite release runs only for the winner, so invites are never
 * double-sent.
 *
 * Returns reason='not_found_or_not_draft' when the plan is missing, belongs to
 * another org, or is already past draft (already active / completed / archived).
 */
export async function activatePlanNow(
  orgId: string,
  planId: string,
): Promise<ActivateResult> {
  const supabase = createResearchSupabase();
  const { data, error } = await supabase
    .from("research_plans")
    .update({
      status: "active",
      activation_state: "activated",
      activated_at: new Date().toISOString(),
      activation_error: null,
    })
    .eq("org_id", orgId)
    .eq("id", planId)
    .eq("status", "draft")
    .select("id")
    .maybeSingle();

  if (error) {
    // A transport/DB error (not a 0-row CAS miss) — log it for observability.
    // The caller still maps this to the same not_found_or_not_draft outcome;
    // the route's try/catch only catches THROWN errors, not returned ones.
    console.error(
      `[scheduler] CAS transport error for plan ${planId}:`,
      error.message,
    );
  }
  if (error || !data) {
    return { ok: false, reason: "not_found_or_not_draft" };
  }

  const invites = await releasePreparedInvites(orgId, planId);
  return {
    ok: true,
    plan: await getResearchPlan(orgId, planId),
    invites,
  };
}
