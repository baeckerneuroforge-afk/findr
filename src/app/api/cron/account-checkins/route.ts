import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/auth/cron";
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
 *
 * COST CONTROLS:
 *   - ?dryRun=true runs the FULL due-check but triggers NOTHING (zero Opus
 *     calls, zero emails). The summary lists which accounts WOULD fire.
 *   - MAX_CHECKINS_PER_RUN caps how many check-ins a single run triggers; the
 *     overflow is deferred to the next run (counted as skipped_over_limit).
 */

// Hard cap on check-ins triggered per run — guards against a cost blow-up when
// many accounts come due at once. Overflow is picked up on the next run. Tune
// this single constant to raise/lower the per-run ceiling.
const MAX_CHECKINS_PER_RUN = 10;

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
  // Dry run: do the full due-check but trigger nothing (no Opus, no email).
  const dryRun = new URL(request.url).searchParams.get("dryRun") === "true";

  // Auth. The REAL run ALWAYS requires the cron token. A dry run is read-only
  // (zero Opus, zero email), so when NOT running on Vercel — i.e. local `next
  // dev` or `next start` — it may run WITHOUT the token, so the due-logic can be
  // tested locally without the Bearer dance. On Vercel (preview/prod) even a dry
  // run requires the token, so the deployed endpoint is never probeable
  // unauthenticated. (process.env.VERCEL is set only on Vercel.)
  const localDryRun = dryRun && !process.env.VERCEL;
  if (!localDryRun && !isAuthorizedCron(request)) {
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
    dry_run: dryRun,
    limit: MAX_CHECKINS_PER_RUN,
    total_orgs: orgs.length,
    enabled_accounts: 0,
    triggered: 0,
    skipped_not_due: 0,
    skipped_open: 0,
    skipped_no_email: 0,
    skipped_misconfigured: 0,
    skipped_over_limit: 0,
    failed: 0,
    /** Accounts selected to fire this run (or that WOULD, in dry run). */
    would_trigger: [] as { id: string; company: string }[],
    errors: [] as string[],
  };

  // Check-ins this run has committed to — caps real and dry-run alike, across
  // all orgs (a single global ceiling per run).
  let consumed = 0;

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

        // Eligible. Enforce the per-run cap (overflow waits for the next run).
        if (consumed >= MAX_CHECKINS_PER_RUN) {
          results.skipped_over_limit++;
          continue;
        }
        consumed++;
        results.would_trigger.push({
          id: account.id,
          company: account.companyName,
        });

        // Dry run stops here: full due-check done, but no Opus call, no email.
        if (dryRun) continue;

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
