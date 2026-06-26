import Link from "next/link";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { getTranslations, getLocale } from "next-intl/server";

import { toBcp47 } from "@/i18n/locale";
import { OrgResolutionError, requireOrgId } from "@/lib/auth/org";
import { loadOrgSyntheses } from "@/lib/mission-control/engine";
import { CrossStudyAgentPanel } from "@/components/dashboard/CrossStudyAgentPanel";
import { isKonsoulP5Enabled } from "@/lib/konsoul/p5-flag";
import { listThreads, loadThread } from "@/lib/konsoul/threads/service";
import { logKonsoulMetric } from "@/lib/konsoul/metrics";
import type { KonsoulThreadTurn } from "@/lib/research/db";

/**
 * /dashboard/insights — cross-study surface. The "Chat" mode was removed: the org
 * keeps only the more capable Cross-Study-Agent (Konsoul) here, so this page now
 * renders <CrossStudyAgentPanel /> directly (no mode switcher). The agent does
 * multi-step research — lists studies, loads the relevant ones on demand, counts
 * exactly, and compares — before answering.
 *
 * Org-level (NOT inside a single study): ask questions ACROSS ALL of the org's
 * study syntheses and get answers with per-study verbatim citations that link
 * back to each source study's synthesis; the engine owns its own
 * anti-hallucination per-study anchor filter.
 *
 * Study titles come from the canonical loadOrgSyntheses() — the SAME read path
 * the engine uses per question, so there is no parallel data path. We keep only
 * the {studyId, studyTitle} the panel needs for the source links; the synthesis
 * content itself is re-loaded + re-anchored by the engine on every turn.
 *
 * Auth mirrors the synthesis page: requireOrgId(), redirect on no_auth/no_org.
 * The panel is session-local (no persistence).
 */

export default async function InsightsPage({
  searchParams,
}: {
  // Next 16 async searchParams — the global "Frag Konsoul" lane (Cmd+K) routes
  // a typed question here as ?q=… so the panel opens with it PREFILLED. Read-only
  // prefill: the page only seeds the textarea, it never auto-submits.
  // P5 (flag-gated): ?thread=<uuid> restores a persisted conversation.
  searchParams: Promise<{ q?: string; thread?: string }>;
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

  const syntheses = await loadOrgSyntheses(orgId);
  const studies = syntheses.map((s) => ({
    studyId: s.studyId,
    studyTitle: s.studyTitle,
  }));

  // Prefill from the Cmd+K "Frag Konsoul" door. Mirror the market-research page's
  // q handling: trim, fall back to undefined when empty so the panel keeps its
  // pristine empty-state when no question was carried in.
  const { q: rawQ, thread: rawThread } = await searchParams;
  const initialQuestion = (rawQ ?? "").trim() || undefined;

  const t = await getTranslations("missionControl");
  const ta = await getTranslations("crossStudyAgent");

  // P5 persisted threads (flag-gated): the recent-conversation list + a restored
  // thread. All org-scoped server-side (orgId from the session). When the flag is
  // off, none of this loads and the page renders exactly as before.
  const p5 = isKonsoulP5Enabled();
  const threadId = p5 ? ((rawThread ?? "").trim() || undefined) : undefined;
  const [recentThreads, restoredTurns] = await Promise.all([
    p5 ? listThreads(orgId) : Promise.resolve([]),
    threadId ? loadThread(orgId, threadId) : Promise.resolve(null),
  ]);
  const initialTurns: KonsoulThreadTurn[] | undefined = restoredTurns ?? undefined;
  // If the thread couldn't be loaded (deleted / foreign), drop the stale id so
  // the panel starts a fresh thread instead of updating a non-existent one.
  const initialThreadId = restoredTurns ? threadId : undefined;

  // org-side telemetry (metadata only) — fire AFTER the response so it never
  // blocks render. Only on a real restore.
  if (restoredTurns) {
    after(() =>
      logKonsoulMetric({
        orgId,
        event: "thread_resumed",
        counts: { turn_count: restoredTurns.length },
      }),
    );
  }

  const dateFmt = new Intl.DateTimeFormat(toBcp47(await getLocale()), {
    month: "short",
    day: "numeric",
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-display text-neutral-900">{t("pageTitle")}</h1>
        <p className="mt-1 text-body text-neutral-500">{t("pageIntro")}</p>
      </div>

      {p5 && recentThreads.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-small font-medium text-neutral-500">
            {ta("threadsTitle")}
          </span>
          {recentThreads.slice(0, 6).map((thread) => (
            <Link
              key={thread.id}
              href={`/dashboard/insights?thread=${thread.id}`}
              className={
                thread.id === initialThreadId
                  ? "inline-flex max-w-[16rem] items-center gap-2 truncate rounded-full border border-primary-300 bg-primary-50 px-3 py-1 text-small font-medium text-primary-700"
                  : "inline-flex max-w-[16rem] items-center gap-2 truncate rounded-full border border-neutral-200 bg-card px-3 py-1 text-small text-neutral-700 transition-colors hover:bg-neutral-50"
              }
            >
              <span className="truncate">
                {thread.title?.trim() || ta("threadUntitled")}
              </span>
              <span className="shrink-0 text-caption text-neutral-400">
                {dateFmt.format(new Date(thread.updatedAt))}
              </span>
            </Link>
          ))}
          {initialThreadId && (
            <Link
              href="/dashboard/insights"
              className="inline-flex items-center rounded-full px-3 py-1 text-small font-medium text-primary-700 hover:underline"
            >
              {ta("threadNew")}
            </Link>
          )}
        </div>
      )}

      <CrossStudyAgentPanel
        studies={studies}
        initialQuestion={initialQuestion}
        initialThreadId={initialThreadId}
        initialTurns={initialTurns}
      />
    </div>
  );
}
