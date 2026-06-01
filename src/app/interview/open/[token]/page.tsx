import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import {
  OpenLinkEntry,
  type OpenLinkStep,
} from "@/components/interview/OpenLinkEntry";
import { OpenLinkUnavailable } from "@/components/interview/OpenLinkUnavailable";
import {
  findOpenLinkByAccessToken,
  resolvePublicOpenEntry,
} from "@/lib/research/open-links";
import { isOpenLinkExpired } from "@/lib/research/open-link-expiry";
import { getOrgBranding } from "@/lib/settings/org-settings";
import { DEFAULT_LOCALE, type Locale } from "@/i18n/locale";
import { MESSAGES, translate } from "@/i18n/messages";

/**
 * Open studien-wide link — participant entry page (Phase 4, Baustein 2 —
 * Etappe 3, RENDER ONLY).
 *
 * PHYSICALLY SEPARATE from the per-invite path /interview/[token]: this segment
 * resolves the token ONLY through the open-link resolver
 * (resolvePublicOpenEntry / findOpenLinkByAccessToken). findInviteByAccessToken
 * is NEVER called here, and the load-bearing !invite.org_id guard on the invite
 * path stays byte-identical — there is no shared branch that could fall back to
 * the sealed null-org path.
 *
 * E3 boundary — render + branding + consent only. NO session is created, NO
 * Opus turn is fired, the engine and the E1 resolver are untouched. The
 * cross-participant invariant holds structurally: this page never mints a
 * session, so the shared open-link token can never become a single-seat session
 * token (the qualified-create + fresh-token hand-off is E4).
 *
 * `cache` is from "react" (per-render dedup so generateMetadata + the page share
 * ONE resolution), NOT "next/cache".
 */
const getCachedEntry = cache(resolvePublicOpenEntry);
const getCachedLink = cache(findOpenLinkByAccessToken);

/** Derive the metadata-relevant bits from either entry mode (open links are
 *  always the research surface). */
function metaBits(
  entry: Awaited<ReturnType<typeof resolvePublicOpenEntry>>,
): { planTitle: string | null; language: Locale } | null {
  if (!entry) return null;
  if (entry.mode === "needs_screening") {
    return {
      planTitle: entry.screening.planTitle,
      language: entry.screening.language,
    };
  }
  return { planTitle: entry.ready.planTitle, language: entry.ready.language };
}

/**
 * Per-token metadata, localized to the link's resolved language. The plan title
 * is dynamic content interpolated as-is (never translated). Capability links are
 * never indexed. A disabled/unknown token resolves to null → the neutral default
 * title (the page itself notFound()s those — see below).
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

  if (!bits) {
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

/** Etappe-3 visual-QA override (?view=consent|screening|ready|rejected|
 *  unavailable): forces a single white-label screen so a Vercel preview can show
 *  each one without real fixtures (an expired link, a failed evaluation). Mirrors
 *  the screening-E3 ?screening= override. Unknown/absent → null (live flow).
 *  Removed in E4. */
const OPEN_LINK_VIEWS = [
  "consent",
  "screening",
  "ready",
  "rejected",
  "unavailable",
] as const;
type OpenLinkView = (typeof OPEN_LINK_VIEWS)[number];

function parseView(raw: string | string[] | undefined): OpenLinkView | null {
  const v = typeof raw === "string" ? raw : null;
  return v !== null && (OPEN_LINK_VIEWS as readonly string[]).includes(v)
    ? (v as OpenLinkView)
    : null;
}

export default async function OpenInterviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { token } = await params;

  // ① Token → exactly one ACTIVE open-link row (status='active' is fail-closed
  //    in the DB query). Disabled / unknown → null → notFound(). This is the
  //    open-link resolver ONLY; the invite resolver is never touched here.
  const link = await getCachedLink(token);
  if (!link) notFound();

  // ② Screening-aware entry resolution (E1 resolver, reused verbatim). null →
  //    a plan of another org or a denorm drift → fail-closed → notFound(). It
  //    NEVER mints a session (E1 skeleton stops at "ready"; create is E4).
  const entry = await getCachedEntry(token);
  if (!entry) notFound();

  // White-label branding via the link row's SERVER-BOUND org_id. The participant
  // is unauthenticated; org_id is used only to fetch branding and never reaches
  // the client (the gate receives brandName/accent/logo, not the org UUID).
  const branding = await getOrgBranding(link.org_id);

  const language =
    entry.mode === "needs_screening"
      ? entry.screening.language
      : entry.ready.language;
  const planTitle =
    entry.mode === "needs_screening"
      ? entry.screening.planTitle
      : entry.ready.planTitle;
  const questions =
    entry.mode === "needs_screening" ? entry.screening.questions : [];

  const messages = { interview: MESSAGES[language].interview };
  const sp = await searchParams;
  const view = parseView(sp.view);

  // Expired (valid_until in the past) → the calmer "study not available" screen
  // instead of a screening form for a dead study. RENDER ONLY — read straight
  // off the link row (the E1 resolver intentionally does not enforce expiry);
  // no session is created either way. The ?view=unavailable override also lands
  // here so the screen is previewable on a live link.
  const expired = isOpenLinkExpired(link.valid_until);

  if (view === "unavailable" || (view === null && expired)) {
    return (
      <NextIntlClientProvider locale={language} messages={messages}>
        <OpenLinkUnavailable
          brandName={branding.brandName}
          accentColor={branding.accentColor}
          logoUrl={branding.logoUrl}
        />
      </NextIntlClientProvider>
    );
  }

  // Live flow ALWAYS starts at the mandatory consent step; the QA override can
  // force any non-unavailable step (the "unavailable" case already returned
  // above, so the control-flow has narrowed it out of `view` here).
  const initialStep: OpenLinkStep = view ?? "consent";

  return (
    <NextIntlClientProvider locale={language} messages={messages}>
      <OpenLinkEntry
        mode={entry.mode}
        questions={questions}
        planTitle={planTitle}
        brandName={branding.brandName}
        accentColor={branding.accentColor}
        logoUrl={branding.logoUrl}
        initialStep={initialStep}
      />
    </NextIntlClientProvider>
  );
}
