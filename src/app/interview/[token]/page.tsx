import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import {
  ScreeningGate,
  type ParticipantStep,
} from "@/components/interview/ScreeningGate";
import { getPublicSession } from "@/lib/voice-agent/session-service";
import { getResearchPlan } from "@/lib/research/plans-service";
import { getOrgBranding } from "@/lib/settings/org-settings";
import { DEFAULT_LOCALE, type Locale } from "@/i18n/locale";
import { MESSAGES, translate } from "@/i18n/messages";

/**
 * Per-render memoization of getPublicSession. The Next App Router runs
 * generateMetadata and the Page component in PARALLEL for the same
 * request — both functions below call this helper with the same token.
 *
 * Without the cache(), each call independently goes through
 * getPublicSession's lazy-create branch when the session doesn't exist
 * yet (research-invite first-hit). That causes:
 *   - 2× Opus opening-message calls (cost waste)
 *   - a race on the INSERT: only one wins on the UNIQUE access_token
 *     constraint; the loser's createResearchInterview returns
 *     status='error' inside its own try/catch, so the wrapper's final
 *     loadByToken can fire BEFORE the winner's INSERT has committed —
 *     and return null. That null was the visible bug: the first hit
 *     showed 404, the reload then served the row written by the
 *     "winner" call.
 *
 * React.cache() memoizes per render (= per request) on the same
 * argument key. Both generateMetadata and the Page now share ONE
 * promise — one Opus call, one INSERT, both reads of the same
 * eventual result. Different requests (e.g. two participants who
 * happen to click within the same second) still hit the engine's
 * existing UNIQUE-constraint backstop on interview_sessions.access_token;
 * cache() only closes the SAME-render race, which is the one that
 * was breaking the first-hit experience.
 *
 * IMPORTANT: `cache` is imported from "react" — NOT from "next/cache".
 * The latter is a different API (revalidatePath / unstable_cache /
 * etc.) for cross-request caching, which is exactly what we do NOT
 * want here: we want per-render dedup, not persistence.
 */
const getCachedPublicSession = cache(getPublicSession);

/**
 * Per-token metadata, localized to the session's language (post_loss, checkin
 * AND research all carry one). Probes with no matching session fall back to the
 * default UI locale. Only `research` sessions get a plan-derived title; the plan
 * title is dynamic content interpolated as-is (never translated). Capability
 * links are never indexed.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const session = await getCachedPublicSession(token);
  const locale: Locale = session?.language ?? DEFAULT_LOCALE;
  const robots = { index: false, follow: false } as const;

  if (!session || session.kind !== "research") {
    return {
      title: translate(locale, "interview.meta.defaultTitle"),
      description: translate(locale, "interview.meta.defaultDescription"),
      robots,
    };
  }

  return {
    title: session.planTitle
      ? translate(locale, "interview.meta.researchTitleWithPlan", {
          plan: session.planTitle,
        })
      : translate(locale, "interview.meta.researchTitle"),
    description: translate(locale, "interview.meta.researchDescription"),
    robots,
  };
}

export default async function InterviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token } = await params;
  const session = await getCachedPublicSession(token);
  if (!session) notFound();

  const isResearch = session.kind === "research";
  // The session locale lives behind the unguessable token, not in a cookie, so
  // we override the request-resolved locale for this subtree EXPLICITLY. Only
  // the `interview` namespace is serialized to the client.
  const locale = session.language;

  // White-label: ONLY the research surface (already brandless / neutral) gets
  // the Findr customer's branding. post_loss / checkin keep the Findr chrome,
  // so branding stays null there and the render is byte-identical to before.
  // Service-role read by org_id (the participant is unauthenticated).
  const branding = isResearch ? await getOrgBranding(session.orgId) : null;

  // Etappe 3 (RENDER PATH ONLY): load the research plan's screening questions
  // so the gate can render the screening form. Read-only + additive — the
  // entry/lazy-create path in getPublicSession is untouched and NO session is
  // suppressed. The real gating (defer session + evaluateScreening) is E4.
  const screeningQuestions =
    isResearch && session.planId
      ? ((await getResearchPlan(session.orgId, session.planId))
          ?.screeningQuestions ?? [])
      : [];

  // Etappe-3 visual-QA override: ?screening=questions|rejected|interview lets a
  // Vercel preview deterministically show each white-label screen without a
  // real evaluation. Unknown/absent → null (the gate decides by config).
  // Removed in E4 (the real gate decides the step).
  const sp = await searchParams;
  const raw = typeof sp.screening === "string" ? sp.screening : null;
  const previewStep: ParticipantStep | null =
    raw === "questions"
      ? "screening"
      : raw === "rejected"
        ? "rejected"
        : raw === "interview"
          ? "interview"
          : null;

  return (
    <NextIntlClientProvider
      locale={locale}
      messages={{ interview: MESSAGES[locale].interview }}
    >
      <ScreeningGate
        token={token}
        initialConversation={session.conversation}
        initialStatus={session.status}
        company={session.company}
        // Research-only: drop the Findr branding (logo + "Powered by …"
        // footer) and use the plan title as the h1. For post_loss / checkin
        // both props default to false/null, so render is byte-identical.
        brandless={isResearch}
        headingOverride={isResearch ? session.planTitle : null}
        // White-label props (research only; null elsewhere → neutral fallback).
        brandName={branding?.brandName ?? null}
        accentColor={branding?.accentColor ?? null}
        logoUrl={branding?.logoUrl ?? null}
        // E3 render path + visual-QA override (see above).
        screeningQuestions={screeningQuestions}
        previewStep={previewStep}
      />
    </NextIntlClientProvider>
  );
}
