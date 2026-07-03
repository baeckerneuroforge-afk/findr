import { NextResponse } from "next/server";
import { isAuthorizedCron } from "@/lib/auth/cron";
import { createAdminSupabaseClient } from "@/lib/supabase/server";
import { createResearchSupabase } from "@/lib/research/db";
import { RESEARCH_INTERVIEW_CALL_TYPE } from "@/lib/research/transcript-service";
import { cronHadAnyError } from "@/lib/cron/status";
import {
  KONSOUL_ACTION_LOG_RETENTION_DAYS,
  KONSOUL_THREADS_RETENTION_DAYS,
  KONSOUL_METRICS_RETENTION_DAYS,
} from "@/lib/settings/konsoul-retention";

/**
 * DSGVO G5 — daily retention sweep. Two scopes:
 *  1. interview_sessions (participant PII/transcript core): for each org that set
 *     a retention period (org_settings.interview_retention_days, null = off),
 *     deletes sessions whose created_at is older than that many days — plus the
 *     research-interview transcript COPIES in calls (call_type =
 *     'research_interview'), whose product_discovery_insights cascade via FK.
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

/**
 * A not-yet-created table (42P01 / PostgREST PGRST205) is a BENIGN skip, NOT a
 * DSGVO failure: the P5 tables are additive and their migration is applied AFTER
 * the code merges (the documented deferred-migration window). Treating a missing
 * relation as fatal would flip the whole nightly run to 500 and MASK the
 * interview-PII sweep's success. So the P5 sweeps tolerate it; once the table
 * exists they sweep normally.
 */
function isMissingRelation(
  error: { code?: string | null; message?: string | null } | null,
): boolean {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  return /does not exist|could not find the table/i.test(error.message ?? "");
}

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
    research_calls_deleted: 0,
    konsoul_action_log_deleted: 0,
    konsoul_threads_deleted: 0,
    konsoul_metrics_deleted: 0,
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
    // count statt .select("id"): der Sweep braucht nur die ZAHL — bei einem
    // großen Erst-Sweep reisten sonst zehntausende UUIDs zurück.
    const { count: markedCount, error: abandonError } = await supabase
      .from("interview_sessions")
      .update({ status: "abandoned" }, { count: "exact" })
      .eq("status", "open")
      .lt("created_at", abandonCutoff);
    if (abandonError) {
      results.errors.push(`abandon-sweep: ${abandonError.message}`);
    } else {
      results.abandoned = markedCount ?? 0;
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

      const { count: callsCount } = await supabase
        .from("calls")
        .select("id", { count: "exact", head: true })
        .eq("org_id", row.org_id)
        .eq("call_type", RESEARCH_INTERVIEW_CALL_TYPE)
        .lt("created_at", cutoff);
      results.research_calls_deleted += callsCount ?? 0;
      continue;
    }

    const { count: deletedCount, error: delError } = await supabase
      .from("interview_sessions")
      .delete({ count: "exact" })
      .eq("org_id", row.org_id)
      .lt("created_at", cutoff);
    if (delError) {
      results.errors.push(`${row.org_id}: ${delError.message}`);
      continue;
    }
    results.deleted += deletedCount ?? 0;

    // Die beim Abschluss persistierte Transkript-KOPIE (calls-Row aus
    // persistResearchTranscriptAndDiscovery) trägt dasselbe Teilnehmer-
    // Transkript und fällt unter dieselbe org-konfigurierte Frist. Scope
    // bewusst NUR call_type='research_interview' — Sales-/CS-Calls haben mit
    // der Interview-Retention nichts zu tun. Die abgeleiteten
    // product_discovery_insights (verbatim Verdichtungen = personenbezogen)
    // kaskadieren per FK (ON DELETE CASCADE auf source_call_id) mit; eine
    // bereits berechnete Studien-Synthese bleibt als aggregiertes Artefakt
    // unberührt, ein Re-Run rechnet auf dem verbleibenden Bestand.
    const { count: callsDeleted, error: callsError } = await supabase
      .from("calls")
      .delete({ count: "exact" })
      .eq("org_id", row.org_id)
      .eq("call_type", RESEARCH_INTERVIEW_CALL_TYPE)
      .lt("created_at", cutoff);
    if (callsError) {
      results.errors.push(`${row.org_id} (research calls): ${callsError.message}`);
      continue;
    }
    results.research_calls_deleted += callsDeleted ?? 0;
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
      const { count: konsoulDeletedCount, error: konsoulError } = await research
        .from("konsoul_action_log")
        .delete({ count: "exact" })
        .lt("proposed_at", konsoulCutoff);
      if (konsoulError) {
        results.errors.push(`konsoul-action-log: ${konsoulError.message}`);
      } else {
        results.konsoul_action_log_deleted = konsoulDeletedCount ?? 0;
      }
    }
  }

  // Konsoul P5 — konsoul_threads retention sweep. Org-side conversation text (no
  // participant raw-interview PII), its own fixed deadline (KONSOUL_THREADS_
  // RETENTION_DAYS). The clock runs on updated_at (LAST ACTIVITY) so an actively
  // continued thread does not age out. Global (all orgs), best-effort + fail-loud.
  {
    const research = createResearchSupabase();
    const threadsCutoff = new Date(
      Date.now() - KONSOUL_THREADS_RETENTION_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();
    if (dryRun) {
      const { count, error: countError } = await research
        .from("konsoul_threads")
        .select("id", { count: "exact", head: true })
        .lt("updated_at", threadsCutoff);
      if (countError && !isMissingRelation(countError))
        results.errors.push(`konsoul-threads: ${countError.message}`);
      else results.konsoul_threads_deleted = count ?? 0;
    } else {
      const { count: threadsDeletedCount, error: delError } = await research
        .from("konsoul_threads")
        .delete({ count: "exact" })
        .lt("updated_at", threadsCutoff);
      if (delError && !isMissingRelation(delError))
        results.errors.push(`konsoul-threads: ${delError.message}`);
      else results.konsoul_threads_deleted = threadsDeletedCount ?? 0;
    }
  }

  // Konsoul P5 — konsoul_metrics retention sweep. Metadata-only counters, own
  // fixed deadline (KONSOUL_METRICS_RETENTION_DAYS), clock on occurred_at.
  {
    const research = createResearchSupabase();
    const metricsCutoff = new Date(
      Date.now() - KONSOUL_METRICS_RETENTION_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();
    if (dryRun) {
      const { count, error: countError } = await research
        .from("konsoul_metrics")
        .select("id", { count: "exact", head: true })
        .lt("occurred_at", metricsCutoff);
      if (countError && !isMissingRelation(countError))
        results.errors.push(`konsoul-metrics: ${countError.message}`);
      else results.konsoul_metrics_deleted = count ?? 0;
    } else {
      const { count: metricsDeletedCount, error: delError } = await research
        .from("konsoul_metrics")
        .delete({ count: "exact" })
        .lt("occurred_at", metricsCutoff);
      if (delError && !isMissingRelation(delError))
        results.errors.push(`konsoul-metrics: ${delError.message}`);
      else results.konsoul_metrics_deleted = metricsDeletedCount ?? 0;
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
