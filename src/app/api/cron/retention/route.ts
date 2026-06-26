import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/auth/cron";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { createResearchSupabase } from "@/lib/research/db";
import { cronHadAnyError } from "@/lib/cron/status";
import { KONSOUL_ACTION_LOG_RETENTION_DAYS } from "@/lib/settings/konsoul-retention";

/**
 * DSGVO G5 — daily retention sweep. Two scopes:
 *  1. interview_sessions (participant PII/transcript core): for each org that set
 *     a retention period (org_settings.interview_retention_days, null = off),
 *     deletes sessions whose created_at is older than that many days.
 *  2. konsoul_action_log (Konsoul P3.0 audit METADATA, no participant PII):
 *     global, one fixed deadline from a code constant
 *     (KONSOUL_ACTION_LOG_RETENTION_DAYS) — its own clock, independent of the
 *     per-org interview retention. Deletes rows older than that deadline.
 * Sales/Risk is no longer an offered module and is out of scope.
 *
 * Auth mirrors /api/cron/account-checkins: Bearer CRON_SECRET (timing-safe,
 * see lib/auth/cron). ?dryRun=true reports what WOULD be deleted without
 * deleting; on Vercel a dry run still requires the token, so the endpoint is
 * never probeable unauthenticated.
 */

export async function GET(request: Request) {
  const dryRun = new URL(request.url).searchParams.get("dryRun") === "true";
  // A dry run is read-only, so off-Vercel (local dev) it may run without the
  // token; on Vercel even a dry run requires it.
  const localDryRun = dryRun && !process.env.VERCEL;
  if (!localDryRun && !isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminSupabaseClient();
  const { data: orgs, error } = await supabase
    .from("org_settings")
    .select("org_id, interview_retention_days")
    .not("interview_retention_days", "is", null);

  if (error) {
    return NextResponse.json(
      { error: "Failed to read retention settings" },
      { status: 500 },
    );
  }

  const results = {
    dry_run: dryRun,
    orgs_with_retention: orgs?.length ?? 0,
    abandoned: 0,
    deleted: 0,
    konsoul_action_log_deleted: 0,
    errors: [] as string[],
  };

  // F7 — sweep stale 'open' interview sessions to 'abandoned'. A text/voice
  // interview lasts minutes, so an 'open' session older than this is dead (e.g.
  // a voice crash that never closed it, which otherwise stays open forever).
  // Global (all orgs), independent of retention settings; best-effort.
  const abandonCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  if (dryRun) {
    const { count } = await supabase
      .from("interview_sessions")
      .select("id", { count: "exact", head: true })
      .eq("status", "open")
      .lt("created_at", abandonCutoff);
    results.abandoned = count ?? 0;
  } else {
    const { data: marked, error: abandonError } = await supabase
      .from("interview_sessions")
      .update({ status: "abandoned" })
      .eq("status", "open")
      .lt("created_at", abandonCutoff)
      .select("id");
    if (abandonError) {
      results.errors.push(`abandon-sweep: ${abandonError.message}`);
    } else {
      results.abandoned = marked?.length ?? 0;
    }
  }

  for (const row of orgs ?? []) {
    const days = row.interview_retention_days;
    if (days === null || days < 1) continue;
    const cutoff = new Date(
      Date.now() - days * 24 * 60 * 60 * 1000,
    ).toISOString();

    if (dryRun) {
      const { count } = await supabase
        .from("interview_sessions")
        .select("id", { count: "exact", head: true })
        .eq("org_id", row.org_id)
        .lt("created_at", cutoff);
      results.deleted += count ?? 0;
      continue;
    }

    const { data: deleted, error: delError } = await supabase
      .from("interview_sessions")
      .delete()
      .eq("org_id", row.org_id)
      .lt("created_at", cutoff)
      .select("id");
    if (delError) {
      results.errors.push(`${row.org_id}: ${delError.message}`);
      continue;
    }
    results.deleted += deleted?.length ?? 0;
  }

  // Konsoul P3.0 — konsoul_action_log retention sweep (Design-Doc §3, Auflage
  // 3). Global (all orgs), one fixed deadline from a code constant — the audit
  // log carries org-side METADATA, not participant PII, so it has its own clock
  // (KONSOUL_ACTION_LOG_RETENTION_DAYS) independent of interview_retention_days.
  // Deletes rows whose proposed_at is older than the deadline. Uses the research-
  // typed service-role client (the table isn't in the generated Database type
  // yet). Best-effort + fail-loud: any error joins results.errors → run fails.
  {
    const research = createResearchSupabase();
    const konsoulCutoff = new Date(
      Date.now() - KONSOUL_ACTION_LOG_RETENTION_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();

    if (dryRun) {
      const { count, error: countError } = await research
        .from("konsoul_action_log")
        .select("id", { count: "exact", head: true })
        .lt("proposed_at", konsoulCutoff);
      if (countError) {
        results.errors.push(`konsoul-action-log: ${countError.message}`);
      } else {
        results.konsoul_action_log_deleted = count ?? 0;
      }
    } else {
      const { data: konsoulDeleted, error: konsoulError } = await research
        .from("konsoul_action_log")
        .delete()
        .lt("proposed_at", konsoulCutoff)
        .select("id");
      if (konsoulError) {
        results.errors.push(`konsoul-action-log: ${konsoulError.message}`);
      } else {
        results.konsoul_action_log_deleted = konsoulDeleted?.length ?? 0;
      }
    }
  }

  // DSGVO-critical: any deletion/abandon error fails the run (Vercel marks the
  // non-2xx invocation as failed). The summary still travels in the body.
  const failed = cronHadAnyError(results.errors.length);
  return NextResponse.json(
    {
      success: !failed,
      timestamp: new Date().toISOString(),
      ...results,
    },
    { status: failed ? 500 : 200 },
  );
}
