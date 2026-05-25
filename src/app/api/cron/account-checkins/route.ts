import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { getCheckinEnabledAccounts } from "@/lib/accounts/service";
import { getAccountCheckin } from "@/lib/voice-agent/session-service";
import { createAndInviteCheckin } from "@/lib/voice-agent/checkin-orchestration";

/**
 * Daily scheduler for account check-ins (Etappe B). Mirrors /api/cron/reanalyze:
 * Bearer CRON_SECRET auth, loop orgs → entities, do work, return a summary.
 *
 * There is NO dynamic cron plan. This runs daily and, per account, triggers a
 * check-in only when it is DUE: checkin_enabled, interval set, and
 * (last_checkin_at + interval_days) reached (or never checked in). It skips
 * accounts without a sponsor email and never double-triggers an already-open
 * check-in.
 */

function isAuthorizedCron(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${cronSecret}`;
}

function isDue(
  lastCheckinAt: string | null,
  intervalDays: number | null,
): boolean {
  if (intervalDays === null) return false; // enabled but misconfigured
  if (!lastCheckinAt) return true; // never checked in → due now
  const last = new Date(lastCheckinAt).getTime();
  if (!Number.isFinite(last)) return true;
  const dueAt = last + intervalDays * 24 * 60 * 60 * 1000;
  return dueAt <= Date.now();
}

export async function GET(request: Request) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminSupabaseClient();
  const { data: orgs, error: orgsError } = await supabase
    .from("organizations")
    .select("id, name");

  if (orgsError || !orgs) {
    return NextResponse.json({ error: "Failed to fetch orgs" }, { status: 500 });
  }

  const results = {
    total_orgs: orgs.length,
    enabled_accounts: 0,
    triggered: 0,
    skipped_not_due: 0,
    skipped_open: 0,
    skipped_no_email: 0,
    skipped_misconfigured: 0,
    failed: 0,
    errors: [] as string[],
  };

  for (const org of orgs) {
    // getCheckinEnabledAccounts swallows DB errors (returns []), so no try here.
    const accounts = await getCheckinEnabledAccounts(org.id);
    results.enabled_accounts += accounts.length;

    for (const account of accounts) {
      try {
        if (account.checkinIntervalDays === null) {
          results.skipped_misconfigured++;
          continue;
        }
        if (!isDue(account.lastCheckinAt, account.checkinIntervalDays)) {
          results.skipped_not_due++;
          continue;
        }
        if (!account.sponsorEmail?.trim()) {
          results.skipped_no_email++;
          continue;
        }

        // Never double-trigger: skip if a check-in is already open (awaiting a
        // reply). It only becomes due again after it completes + the interval.
        const existing = await getAccountCheckin(org.id, account.id);
        if (existing && existing.status === "open") {
          results.skipped_open++;
          continue;
        }

        const result = await createAndInviteCheckin(org.id, account.id);
        if (result.status === "sent") {
          results.triggered++;
        } else if (result.status === "missing_contact") {
          results.skipped_no_email++;
        } else {
          results.failed++;
          results.errors.push(`${org.id}/${account.id}: ${result.status}`);
        }
      } catch (err) {
        results.failed++;
        results.errors.push(
          `${org.id}/${account.id}: ${err instanceof Error ? err.message : "unknown"}`,
        );
      }
    }
  }

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    ...results,
  });
}
