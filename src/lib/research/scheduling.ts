import "server-only";

import {
  createResearchSupabase,
  type ResearchInviteRow,
} from "./db";

/**
 * Scheduling service for research interviews. Mirrors the read/write
 * pattern in src/lib/risk/service.ts + src/lib/accounts/health-service.ts:
 * typed Supabase reads via the admin client, narrow public record shape,
 * helpers that hide the underlying column-name pluralization.
 *
 * SCOPE per the v1 brief: a Findr user MANUALLY picks one scheduled_at per
 * invite. No Cal.com, no availability matching. proposeSlots is purely a
 * UI convenience (suggest a few default times); it does NOT reserve or
 * lock anything. The mutation that matters is scheduleInvite, which writes
 * a single timestamptz onto the row.
 *
 * Mode-agnostic: the invite carries a `mode_preference` ("text" | "voice" |
 * "video") that affects /interview/[token] rendering, NOT the schedule.
 * This service treats the value as opaque text.
 *
 * ── Merge note (proactive ↔ scheduling) ──────────────────────────────────
 * Originally this file carried its own DatabaseWithResearch augmentation
 * for research_invites with two columns differently named than what the
 * proactive branch shipped: contact_name (we use contact_label) and
 * research_plan_id (we use plan_id). At merge the DB-side won — those
 * names live in prod via the proactive Migration 20260611000000_research_layer.sql.
 * This file now imports the augmented client from ./db.ts (single source of
 * truth) and uses contact_label / plan_id throughout. The four scheduling-
 * specific columns (access_token, invited_at, reminder_24h_sent_at,
 * reminder_1h_sent_at) come from Migrations 20260614000000_research_invite_
 * reminders.sql and 20260615000000_research_invite_access_token.sql and
 * are part of the shared augmented type in db.ts.
 */

// ── Public record shape ─────────────────────────────────────────────────────

export interface ResearchInviteRecord {
  id: string;
  org_id: string | null;
  plan_id: string;
  /** Display label for the participant — see research_invites.contact_label
   *  in 20260611000000_research_layer.sql. May read as just a name or
   *  "Name, Company"; the mail templates use it as-is. */
  contact_label: string;
  contact_email: string;
  scheduled_at: string | null;
  mode_preference: string;
  access_token: string | null;
  invited_at: string | null;
  reminder_24h_sent_at: string | null;
  reminder_1h_sent_at: string | null;
  status: string;
}

function toRecord(row: ResearchInviteRow): ResearchInviteRecord {
  return {
    id: row.id,
    org_id: row.org_id,
    plan_id: row.plan_id,
    contact_label: row.contact_label,
    contact_email: row.contact_email ?? "",
    scheduled_at: row.scheduled_at,
    mode_preference: row.mode_preference,
    access_token: row.access_token,
    invited_at: row.invited_at,
    reminder_24h_sent_at: row.reminder_24h_sent_at,
    reminder_1h_sent_at: row.reminder_1h_sent_at,
    status: row.status,
  };
}

// ── proposeSlots — minimal UI helper ────────────────────────────────────────

/**
 * Suggest a few default scheduling slots — purely a UI convenience for the
 * "schedule this invite" form. NOT a calendar / availability check; the
 * Findr user is free to ignore these and pick any timestamp.
 *
 * Default: next N business days (Mon–Fri) at 10:00 in Europe/Berlin. v1
 * skips weekends and does not skip German public holidays — the calendar
 * UI on the manual side already shows the date so users notice if a slot
 * lands on a holiday.
 */
export function proposeSlots(now: Date = new Date(), count = 3): Date[] {
  const slots: Date[] = [];
  // Start from the next day so the earliest suggestion is at least tomorrow
  // 10:00 — never "today in two hours", which usually isn't useful for a
  // participant we're inviting now.
  const cursor = new Date(now);
  cursor.setDate(cursor.getDate() + 1);

  while (slots.length < count) {
    const day = cursor.getDay(); // 0 = Sunday, 6 = Saturday
    if (day !== 0 && day !== 6) {
      // 10:00 Europe/Berlin ≈ 09:00 UTC in winter / 08:00 UTC in summer.
      // Without a TZ lib we approximate by setting the local time to 10:00
      // and trust the caller's runtime to be in or near CET. The actual
      // calendar invite (ICS) renders in the recipient's local TZ.
      const slot = new Date(cursor);
      slot.setHours(10, 0, 0, 0);
      slots.push(slot);
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return slots;
}

// ── Reads ───────────────────────────────────────────────────────────────────

export async function getResearchInvite(
  orgId: string,
  inviteId: string,
): Promise<ResearchInviteRecord | null> {
  const supabase = createResearchSupabase();
  const { data, error } = await supabase
    .from("research_invites")
    .select("*")
    .eq("org_id", orgId)
    .eq("id", inviteId)
    .maybeSingle();
  if (error || !data) return null;
  return toRecord(data);
}

/**
 * Token-only lookup — no org filter. Used by the public /interview/[token]
 * page (via getPublicSession) to resolve a research-invite link to its
 * underlying invite row when no interview_sessions row exists yet. The
 * lookup hits the partial UNIQUE index research_invites_access_token_idx
 * (migration 20260615), so it's a primary-key-class read; the index's
 * WHERE access_token IS NOT NULL clause keeps the index lean by skipping
 * legacy invite rows that pre-date the access_token column.
 *
 * Security: this read is intentionally org-agnostic — the public chat
 * page doesn't know which org owns the invite. The unguessable
 * access_token IS the capability credential. We go through the service-
 * role client (RLS-bypassing) and only ever match by access_token; we
 * never list, never enumerate, and never trust an org_id from the
 * request. Exactly the same security posture as loadByToken on
 * interview_sessions.
 */
export async function findInviteByAccessToken(
  token: string,
): Promise<ResearchInviteRecord | null> {
  const supabase = createResearchSupabase();
  const { data, error } = await supabase
    .from("research_invites")
    .select("*")
    .eq("access_token", token)
    .maybeSingle();
  if (error || !data) return null;
  return toRecord(data);
}

/**
 * All invites for a single plan, newest first. Powers the participant list
 * on /dashboard/research-plans/[id]. Returns [] on any error (transient
 * failure reads as "no invites yet" in the UI, which is the safe degrade
 * — the user can refresh).
 *
 * Plan ownership is checked at the route layer via getResearchPlan; this
 * function only filters by plan_id + org_id and trusts the caller. NOT
 * combined with listInvitesDueForReminder — that one window-filters for
 * the reminder cron, this one is for the plan-detail page (all statuses).
 */
export async function listInvitesForPlan(
  orgId: string,
  planId: string,
): Promise<ResearchInviteRecord[]> {
  const supabase = createResearchSupabase();
  const { data, error } = await supabase
    .from("research_invites")
    .select("*")
    .eq("org_id", orgId)
    .eq("plan_id", planId)
    .order("created_at", { ascending: false });
  if (error || !data) return [];
  return data.map(toRecord);
}

/**
 * Cron-facing fetch: invites due for a 24h or 1h reminder. Pulls a single
 * window covering both buckets [now+30min, now+25h] and lets the caller
 * split into 24h vs 1h candidates client-side. Skips invites with no
 * org_id (the cron can't resolve org context for them) and no
 * scheduled_at (not yet planned).
 *
 * `limit` caps the result set so a busy day doesn't load thousands of
 * rows at once; the cron has its own per-run cap on TOP of this.
 */
export async function listInvitesDueForReminder(
  limit = 200,
): Promise<ResearchInviteRecord[]> {
  const supabase = createResearchSupabase();
  const now = Date.now();
  const lowerBound = new Date(now + 30 * 60_000).toISOString();
  const upperBound = new Date(now + 25 * 60 * 60_000).toISOString();

  const { data, error } = await supabase
    .from("research_invites")
    .select("*")
    .not("org_id", "is", null)
    .not("scheduled_at", "is", null)
    .gte("scheduled_at", lowerBound)
    .lte("scheduled_at", upperBound)
    .order("scheduled_at", { ascending: true })
    .limit(limit);

  if (error || !data) return [];
  return data.map((row) => toRecord(row));
}

// ── Writes ──────────────────────────────────────────────────────────────────

export type ScheduleInviteStatus =
  | "scheduled"
  | "not_found"
  | "missing_org"
  | "in_past";

export interface ScheduleInviteResult {
  status: ScheduleInviteStatus;
  invite: ResearchInviteRecord | null;
  message: string | null;
}

/**
 * Set scheduled_at on a research invite AND advance the row's status to
 * 'scheduled' in the same update. v1 mutation surface — does NOT send
 * the email (that's the orchestration's job, see
 * src/lib/research/invite-orchestration.ts). Returns a typed result rather
 * than throwing for expected misses so the route layer can map them to
 * 404 / 409 / 422.
 *
 * Why bundle the status flip here? scheduled_at and status='scheduled'
 * are synonymous in the lifecycle — a row with one and not the other is
 * always a bug. Doing it in a single UPDATE keeps the row consistent
 * regardless of whether the caller is the manual UI (Teil 2a) or the
 * scheduling+send combo flow (Teil 2b). Re-scheduling a 'completed' or
 * 'cancelled' invite would step the status back — the UI restricts
 * which rows offer the action so that path isn't reachable in normal
 * use; if it happens via direct API call, that's the caller's
 * intent.
 *
 * Refuses to schedule into the past (defensive: a typo'd date doesn't
 * silently create a stale reminder window). Caller passes a Date; we
 * store ISO UTC.
 */
export async function scheduleInvite(
  orgId: string,
  inviteId: string,
  scheduledAt: Date,
): Promise<ScheduleInviteResult> {
  if (scheduledAt.getTime() <= Date.now()) {
    return {
      status: "in_past",
      invite: null,
      message: "scheduled_at must be in the future.",
    };
  }

  const invite = await getResearchInvite(orgId, inviteId);
  if (!invite) {
    return { status: "not_found", invite: null, message: "Invite not found." };
  }
  if (!invite.org_id) {
    return {
      status: "missing_org",
      invite,
      message: "Invite has no org_id — cannot schedule under an org context.",
    };
  }

  const supabase = createResearchSupabase();
  const { data, error } = await supabase
    .from("research_invites")
    .update({
      scheduled_at: scheduledAt.toISOString(),
      status: "scheduled",
    })
    .eq("org_id", orgId)
    .eq("id", inviteId)
    .select("*")
    .single();

  if (error || !data) {
    return {
      status: "not_found",
      invite,
      message: error?.message ?? "Update returned no row",
    };
  }
  return { status: "scheduled", invite: toRecord(data), message: null };
}

/** Stamps the moment we sent the initial scheduling-invite mail. Mirrors
 *  markInterviewInvited(). Called from the orchestration after the Resend
 *  call succeeded so a failed send doesn't get an audit timestamp. */
export async function markInviteSent(
  orgId: string,
  inviteId: string,
): Promise<string | null> {
  const now = new Date().toISOString();
  const supabase = createResearchSupabase();
  const { data, error } = await supabase
    .from("research_invites")
    .update({ invited_at: now })
    .eq("org_id", orgId)
    .eq("id", inviteId)
    .select("invited_at")
    .single();
  if (error || !data) return null;
  return data.invited_at;
}

/** Stamps one of the two reminder timestamps after a successful reminder
 *  send. The cron's idempotency relies on this — if the stamp is missing,
 *  the next cron tick re-fires the reminder. */
export async function markReminderSent(
  orgId: string,
  inviteId: string,
  kind: "24h" | "1h",
): Promise<string | null> {
  // Computed-key updates ({ [column]: now }) widen to a string-indexed type
  // that supabase-js's strict Update shape rejects (TS2345 — string index
  // signatures aren't assignable to `never`). Spell both branches out so
  // the Update type stays narrow.
  const now = new Date().toISOString();
  const supabase = createResearchSupabase();
  const update =
    kind === "24h"
      ? { reminder_24h_sent_at: now }
      : { reminder_1h_sent_at: now };

  const { data, error } = await supabase
    .from("research_invites")
    .update(update)
    .eq("org_id", orgId)
    .eq("id", inviteId)
    .select("reminder_24h_sent_at, reminder_1h_sent_at")
    .single();
  if (error || !data) return null;
  return kind === "24h" ? data.reminder_24h_sent_at : data.reminder_1h_sent_at;
}
