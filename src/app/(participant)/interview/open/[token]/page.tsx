import { cache } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { OpenLinkEntry } from "@/components/interview/OpenLinkEntry";
import { OpenLinkUnavailable } from "@/components/interview/OpenLinkUnavailable";
import {
  findOpenLinkByAccessToken,
  resolvePublicOpenEntry,
  countOpenLinkSessions,
} from "@/lib/research/open-links";
import { isOpenLinkExpired } from "@/lib/research/open-link-expiry";
import { effectiveOpenLinkCap } from "@/lib/research/open-link-capacity";
import { parsePanelParams, buildPanelRedirectUrl } from "@/lib/research/panel";
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

export default async function OpenInterviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  // Panel-Anbieter E1: die Eintritts-URL kann ?PROLIFIC_PID=… (+ STUDY_ID /
  // SESSION_ID) tragen. searchParams ist in Next 16 ein Promise. Fehlt der
  // Param, ist `panel` unten null → der GANZE Pfad bleibt byte-identisch.
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
  //    NEVER mints a session — the qualified-create + fresh-token hand-off lives
  //    server-side in POST /api/interview/open/[token]/screen.
  const entry = await getCachedEntry(token);
  if (!entry) notFound();

  // White-label branding via the link row's SERVER-BOUND org_id. The participant
  // is unauthenticated; org_id is used only to fetch branding and never reaches
  // the client (the gate receives brandName/accent/logo, not the org UUID).
  const branding = await getOrgBranding(link.org_id);

  // Panel-Anbieter E1/E2 — die Inbound-ID aus der Eintritts-URL validieren und
  // (E2) die outcome-verzweigten Return-URLs server-seitig FERTIG aufbauen
  // (Template aus link.panel_completion + validierte ID-Substitution). `panel`
  // null ⇒ kein Panel-Eintritt ⇒ alle drei Werte null ⇒ kein Redirect, der
  // bestehende Flow ist byte-identisch. Die Screenout-/QuotaFull-Redirects greifen
  // auf den NICHT-Session-Pfaden (Abweisung / „Studie voll"), wo es keine Session
  // gibt, die die Complete-URL tragen könnte — daher hier am Link aufgelöst.
  const panel = parsePanelParams(await searchParams);
  const panelScreenoutUrl = panel
    ? buildPanelRedirectUrl(
        link.panel_completion?.screenout_url,
        panel.participantId,
      )
    : null;
  const panelQuotafullUrl = panel
    ? buildPanelRedirectUrl(
        link.panel_completion?.quotafull_url,
        panel.participantId,
      )
    : null;

  const language =
    entry.mode === "needs_screening"
      ? entry.screening.language
      : entry.ready.language;
  const messages = { interview: MESSAGES[language].interview };

  // The "not available" screen is shown when entry is impossible:
  //  • valid_until in the past (expiry — the route enforces it too at submit), OR
  //  • the plan has NO screening questions: open links PRESUPPOSE screening
  //    (the E2 guardrail, enforced server-side in the screen route). A
  //    no-screening open link can never mint a session, so we never present a
  //    start affordance for it.
  // Render-only here; the authoritative denial is server-side. No session is
  // created either way.
  const expired = isOpenLinkExpired(link.valid_until);
  if (expired || entry.mode === "ready") {
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

  // Anti-Abuse cap (E5), RENDER-ONLY: if the link's effective cap is reached,
  // show the calm "study is full" screen instead of the screening form. We only
  // reach here for a LIVE, screened link (the guards above returned otherwise),
  // so this COUNT runs solely on the path that could actually mint a session.
  // The AUTHORITATIVE denial is server-side in POST /api/interview/open/[token]/
  // screen, which counts BEFORE the Opus turn — this page never creates a
  // session. Fail-OPEN on a count error (used === null): never hide a live study
  // behind a transient DB hiccup; the route still hard-enforces. There is no
  // unlimited mode — an unset cap is clamped to the hard ceiling — so even
  // open-ended links are counted here.
  const used = await countOpenLinkSessions(link.org_id, link.id);
  const full = used !== null && used >= effectiveOpenLinkCap(link.max_sessions);
  if (full) {
    return (
      <NextIntlClientProvider locale={language} messages={messages}>
        <OpenLinkUnavailable
          variant="full"
          brandName={branding.brandName}
          accentColor={branding.accentColor}
          logoUrl={branding.logoUrl}
          // Panel E2: ein Panel-Teilnehmer auf einem vollen Link wird zur
          // QuotaFull-Return-URL des Anbieters geleitet (damit Prolific das
          // korrekte Disposition setzt), statt nur „Studie voll" zu sehen. Null
          // für Nicht-Panel → reiner Screen, byte-identisch.
          redirectUrl={panelQuotafullUrl}
        />
      </NextIntlClientProvider>
    );
  }

  // needs_screening only past this point (narrowed by the guard above): the
  // mandatory consent step, then the screening form whose submit POSTs to the
  // open-link screen route.
  const { screening } = entry;
  return (
    <NextIntlClientProvider locale={language} messages={messages}>
      <OpenLinkEntry
        token={token}
        questions={screening.questions}
        planTitle={screening.planTitle}
        brandName={branding.brandName}
        accentColor={branding.accentColor}
        logoUrl={branding.logoUrl}
        // Panel E1/E2: die validierte Inbound-ID (für den POST-Body → panel_context)
        // + die fertig aufgebauten Screenout-/QuotaFull-Return-URLs (für die
        // Redirects bei Abweisung / „voll" am Submit). Alle null für Nicht-Panel.
        panel={panel}
        panelScreenoutUrl={panelScreenoutUrl}
        panelQuotafullUrl={panelQuotafullUrl}
      />
    </NextIntlClientProvider>
  );
}
