import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/supabase/server";

/**
 * DSGVO G5 — daily interview-data retention sweep. For each org that set a
 * retention period (org_settings.interview_retention_days, null = off), deletes
 * interview_sessions whose created_at is older than that many days. Scope is
 * interview_sessions ONLY (the participant PII/transcript core; Sales/Risk is no
 * longer an offered module).
 *
 * Auth mirrors /api/cron/account-checkins: Bearer CRON_SECRET. ?dryRun=true
 * reports what WOULD be deleted without deleting; on Vercel a dry run still
 * requires the token, so the endpoint is never probeable unauthenticated.
 */
function isAuthorizedCron(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${cronSecret}`;
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

  return NextResponse.json({
    success: true,
    timestamp: new Date().toISOString(),
    ...results,
  });
}
