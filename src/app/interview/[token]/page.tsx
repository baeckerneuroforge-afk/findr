import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { InterviewChat } from "@/components/interview/InterviewChat";
import { ScreeningGate } from "@/components/interview/ScreeningGate";
import { getResearchPlan } from "@/lib/research/plans-service";
import { resolvePublicEntry } from "@/lib/voice-agent/session-service";
import { getOrgBranding } from "@/lib/settings/org-settings";
import { DEFAULT_LOCALE, type Locale } from "@/i18n/locale";
import { MESSAGES, translate } from "@/i18n/messages";

/**
 * Per-render memoization of resolvePublicEntry. The Next App Router runs
 * generateMetadata and the Page component in PARALLEL for the same request —
 * both call this helper with the same token. Without cache(), each would
 * independently run the entry resolution; for a no-screening research invite
 * that means the lazy-create branch fires twice (2× Opus opening calls + an
 * INSERT race on the UNIQUE access_token). React.cache() memoizes per render so
 * both share ONE resolution. (For a screening-deferred or needs_screening token
 * no session is created at all, so there's nothing to race.)
 *
 * IMPORTANT: `cache` is from "react" (per-render dedup), NOT "next/cache".
 */
const getCachedEntry = cache(resolvePublicEntry);

/** Derive the metadata-relevant bits from either entry mode. */
function metaBits(
  entry: Awaited<ReturnType<typeof resolvePublicEntry>>,
): { isResearch: boolean; planTitle: string | null; language: Locale } | null {
  if (!entry) return null;
  if (entry.mode === "needs_screening") {
    return {
      isResearch: true,
      planTitle: entry.screening.planTitle,
      language: entry.screening.language,
    };
  }
  return {
    isResearch: entry.session.kind === "research",
    planTitle: entry.session.planTitle,
    language: entry.session.language,
  };
}

/**
 * Per-token metadata, localized to the session/invite language. Only `research`
 * surfaces (incl. needs_screening) get a plan-derived title; the plan title is
 * dynamic content interpolated as-is (never translated). Capability links are
 * never indexed.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const bits = metaBits(await getCachedEntry(token));
  const locale: Locale = bits?.language ?? DEFAULT_LOCALE;
  const robots = { index: false, follow: false } as const;

  if (!bits || !bits.isResearch) {
    return {
      title: translate(locale, "interview.meta.defaultTitle"),
      description: translate(locale, "interview.meta.defaultDescription"),
      robots,
    };
  }

  return {
    title: bits.planTitle
      ? translate(locale, "interview.meta.researchTitleWithPlan", {
          plan: bits.planTitle,
        })
      : translate(locale, "interview.meta.researchTitle"),
    description: translate(locale, "interview.meta.researchDescription"),
    robots,
  };
}

export default async function InterviewPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const entry = await getCachedEntry(token);
  if (!entry) notFound();

  // ── needs_screening — research invite whose plan has screening questions and
  // no session yet. The session was DEFERRED server-side (no Opus turn, no row);
  // render the white-label screening gate. The gate's submit hits
  // /api/interview/[token]/screen → qualified reloads into the session branch,
  // rejected shows the rejection screen.
  if (entry.mode === "needs_screening") {
    const s = entry.screening;
    // Screening is research-only → always white-label. Service-role read by
    // org_id (participant is unauthenticated); org_id never reaches the client.
    const branding = await getOrgBranding(s.orgId);
    return (
      <NextIntlClientProvider
        locale={s.language}
        messages={{ interview: MESSAGES[s.language].interview }}
      >
        <ScreeningGate
          token={token}
          questions={s.questions}
          planTitle={s.planTitle}
          brandName={branding?.brandName ?? null}
          accentColor={branding?.accentColor ?? null}
          logoUrl={branding?.logoUrl ?? null}
        />
      </NextIntlClientProvider>
    );
  }

  // ── session — existing or just-created (incl. post-qualified-screening). The
  // interview renders directly; screening is already passed or not required, so
  // there is no gate here. Behavior for post_loss / checkin / no-screening
  // research is byte-identical to before E4.
  const session = entry.session;
  const isResearch = session.kind === "research";
  // The session locale lives behind the unguessable token, not in a cookie, so
  // we override the request-resolved locale for this subtree EXPLICITLY. Only
  // the `interview` namespace is serialized to the client.
  const locale = session.language;

  // White-label: ONLY the research surface gets the Findr customer's branding.
  // post_loss / checkin keep the Findr chrome (branding null → neutral fallback).
  const [branding, plan] = await Promise.all([
    isResearch ? getOrgBranding(session.orgId) : Promise.resolve(null),
    isResearch && session.planId
      ? getResearchPlan(session.orgId, session.planId)
      : Promise.resolve(null),
  ]);
  const visualCaptureEnabled =
    isResearch && plan?.visualCaptureEnabled === true;

  return (
    <NextIntlClientProvider
      locale={locale}
      messages={{ interview: MESSAGES[locale].interview }}
    >
      <InterviewChat
        token={token}
        initialConversation={session.conversation}
        initialStatus={session.status}
        company={session.company}
        // Research-only: drop the Findr branding (logo + "Powered by …" footer)
        // and use the plan title as the h1. For post_loss / checkin both props
        // default to false/null, so render is byte-identical.
        brandless={isResearch}
        headingOverride={isResearch ? session.planTitle : null}
        // White-label props (research only; null elsewhere → neutral fallback).
        brandName={branding?.brandName ?? null}
        accentColor={branding?.accentColor ?? null}
        logoUrl={branding?.logoUrl ?? null}
        // Panel-Anbieter E2: server-seitig aufgebaute Complete-Return-URL. Nur für
        // Panel-Sessions gesetzt (sonst null → kein Redirect, byte-identisch).
        panelCompleteRedirect={session.panelCompleteRedirect}
        visualCaptureEnabled={visualCaptureEnabled}
      />
    </NextIntlClientProvider>
  );
}
