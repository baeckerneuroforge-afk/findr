import { NextResponse } from "next/server";

import { isAuthorizedCron } from "@/lib/auth/cron";
import { listInvitesDueForReminder } from "@/lib/research/scheduling";
import { sendResearchReminder } from "@/lib/research/invite-orchestration";

/**
 * ⚠️ PARKED — intentionally NOT scheduled in vercel.json. An hourly (sub-daily)
 * cron silently blocks EVERY deploy on the Vercel Hobby plan, so this scheduler
 * is dormant until the project moves to Pro (or gains an alternative trigger).
 * The handler is kept functional and CRON_SECRET-gated so it can be invoked
 * manually or re-wired without a rewrite — it is NOT dead code, just unscheduled.
 *
 * Hourly reminder scheduler for research interviews. Mirrors
 * /api/cron/account-checkins: Bearer CRON_SECRET auth, dryRun support
 * (local-only bypass), a per-run cap, structured summary response.
 *
 * What it does each tick:
 *   1. Fetch all research_invites whose scheduled_at lands in the next
 *      30 minutes … 25 hours (one wide query, covers both reminder
 *      buckets — see listInvitesDueForReminder).
 *   2. For each invite, decide which reminder bucket it falls into:
 *        - 24h:  scheduled_at − now ∈ [23h, 25h]  AND  reminder_24h_sent_at IS NULL
 *        - 1h:   scheduled_at − now ∈ [30min, 90min]  AND  reminder_1h_sent_at IS NULL
 *      An invite can match BOTH if the cron tick lands at the boundary
 *      (e.g. cron lateness on a 1h-from-now invite) — we prefer the 1h
 *      reminder in that edge case because it's the more urgent signal.
 *   3. Send via sendResearchReminder, which is itself row-level idempotent
 *      (re-checks the reminder_*_sent_at stamp before sending).
 *
 * COST CONTROLS:
 *   - ?dryRun=true does the full window-check + dedup-decision but sends
 *     zero emails. Off-Vercel it doesn't require the Bearer token (mirrors
 *     account-checkins) so the logic can be tested locally without keys.
 *   - MAX_REMINDERS_PER_RUN caps how many emails fire per tick; the
 *     overflow waits for the next run.
 *
 * SCHEDULING expectations: this should be wired to run roughly every 30
 * minutes via Vercel cron. Wider gaps (e.g. 90 min) risk missing the 1h
 * window for an invite whose scheduled_at lands between two ticks. The
 * cron schedule itself is set in vercel.json / dashboard, not here.
 */

const MAX_REMINDERS_PER_RUN = 30;

type Bucket = "24h" | "1h";

interface BucketDecision {
  bucket: Bucket | null;
  /** Human-readable reason when bucket === null (logged in skip stats). */
  reason: string;
}

function pickBucket(
  scheduledAt: string,
  reminder24h: string | null,
  reminder1h: string | null,
  now: number,
): BucketDecision {
  const target = Date.parse(scheduledAt);
  if (!Number.isFinite(target)) {
    return { bucket: null, reason: "invalid scheduled_at" };
  }
  const minutesAhead = (target - now) / 60_000;

  // 1h bucket first: if both windows match (boundary cron lateness), the
  // imminent reminder wins — it's the one a participant actually needs.
  const in1hWindow = minutesAhead >= 30 && minutesAhead <= 90;
  if (in1hWindow && reminder1h === null) {
    return { bucket: "1h", reason: "in 1h window" };
  }

  const hoursAhead = minutesAhead / 60;
  const in24hWindow = hoursAhead >= 23 && hoursAhead <= 25;
  if (in24hWindow && reminder24h === null) {
    return { bucket: "24h", reason: "in 24h window" };
  }

  if (in1hWindow && reminder1h !== null) {
    return { bucket: null, reason: "1h reminder already sent" };
  }
  if (in24hWindow && reminder24h !== null) {
    return { bucket: null, reason: "24h reminder already sent" };
  }
  return { bucket: null, reason: "outside reminder windows" };
}

export async function GET(request: Request): Promise<NextResponse> {
  const dryRun = new URL(request.url).searchParams.get("dryRun") === "true";

  // Same local-dryRun bypass as account-checkins: a dry run that mutates
  // nothing is read-only enough to test without the Bearer token, but only
  // off-Vercel. On Vercel even a dry run requires the token so the deployed
  // endpoint isn't probeable.
  const localDryRun = dryRun && !process.env.VERCEL;
  if (!localDryRun && !isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const invites = await listInvitesDueForReminder();
  const now = Date.now();

  const results = {
    dry_run: dryRun,
    limit: MAX_REMINDERS_PER_RUN,
    candidates_scanned: invites.length,
    sent_24h: 0,
    sent_1h: 0,
    skipped_outside_window: 0,
    skipped_already_sent: 0,
    skipped_over_limit: 0,
    failed: 0,
    would_trigger: [] as Array<{
      id: string;
      bucket: Bucket;
      scheduledAt: string;
      contact: string;
    }>,
    errors: [] as string[],
  };

  let consumed = 0;

  for (const invite of invites) {
    if (!invite.org_id || !invite.scheduled_at) {
      // listInvitesDueForReminder already filters these out, but double-check
      // before doing send work — these can't be reminded.
      results.skipped_outside_window++;
      continue;
    }

    const decision = pickBucket(
      invite.scheduled_at,
      invite.reminder_24h_sent_at,
      invite.reminder_1h_sent_at,
      now,
    );

    if (!decision.bucket) {
      if (decision.reason.includes("already sent")) {
        results.skipped_already_sent++;
      } else {
        results.skipped_outside_window++;
      }
      continue;
    }

    if (consumed >= MAX_REMINDERS_PER_RUN) {
      results.skipped_over_limit++;
      continue;
    }
    consumed++;
    results.would_trigger.push({
      id: invite.id,
      bucket: decision.bucket,
      scheduledAt: invite.scheduled_at,
      contact: invite.contact_email,
    });

    if (dryRun) continue;

    try {
      const result = await sendResearchReminder(
        invite.org_id,
        invite.id,
        decision.bucket,
      );
      if (result.status === "sent") {
        if (decision.bucket === "24h") results.sent_24h++;
        else results.sent_1h++;
      } else if (result.status === "already_sent") {
        // Defense-in-depth dedup tripped — count it as "already" not "failed".
        results.skipped_already_sent++;
      } else {
        results.failed++;
        results.errors.push(`${invite.id} (${decision.bucket}): ${result.status}`);
      }
    } catch (err) {
      results.failed++;
      results.errors.push(
        `${invite.id} (${decision.bucket}): ${err instanceof Error ? err.message : "unknown"}`,
      );
    }
  }

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    ...results,
  });
}
