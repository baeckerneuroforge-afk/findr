import { cache } from "react";
import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";

import { SharedSynthesisView } from "@/components/shared/SharedSynthesisView";
import { DEFAULT_LOCALE } from "@/i18n/locale";
import { MESSAGES } from "@/i18n/messages";
import { getSharedSynthesis } from "@/lib/synthesis/share-service";

/**
 * Public, account-less, read-only share page for a study synthesis. Direct
 * sibling pattern of /interview/[token] — no auth(), no Clerk: access is the
 * unguessable token, resolved server-side through the service-role client
 * (share-service.ts). proxy.ts needs no publicRoutes entry — clerkMiddleware()
 * is called bare (no auth.protect()), so it attaches context without forcing a
 * session, exactly as it does for /interview/[token].
 *
 * Per-render memoization (React.cache) so generateMetadata and the page — which
 * the App Router runs in parallel for the same request — share ONE token
 * lookup instead of two. Same rationale as interview/[token]/page.tsx.
 */
const getCachedSharedSynthesis = cache(getSharedSynthesis);

/**
 * Capability links are never indexed (robots: noindex/nofollow). The title uses
 * the plan title (dynamic content, interpolated as-is, never translated);
 * everything else degrades to a generic, locale-aware label. Probes with no
 * matching/visible share fall back to the default UI locale.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const shared = await getCachedSharedSynthesis(token);
  const robots = { index: false, follow: false } as const;

  if (!shared) {
    return { title: "Klymeo", robots };
  }
  return {
    title: shared.planTitle ? shared.planTitle : "Klymeo",
    robots,
  };
}

/** Clean, neutral fallback for unknown / revoked / expired / not-yet-synthesised
 *  tokens. One generic message (no enumeration signal). With no share row there
 *  is no known locale, so the notice is shown in BOTH supported languages —
 *  each pulled from its own properly-localised catalog — so any visitor
 *  understands a dead or expired link. The default locale leads; the other
 *  follows, muted. */
function SharedUnavailable() {
  const primary = MESSAGES[DEFAULT_LOCALE].sharedSynthesis.unavailable;
  const secondaryLocale = DEFAULT_LOCALE === "de" ? "en" : "de";
  const secondary = MESSAGES[secondaryLocale].sharedSynthesis.unavailable;
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="max-w-md text-center">
        <h1 className="text-h2 text-neutral-900">{primary.title}</h1>
        <p className="mt-2 text-body text-neutral-500">{primary.body}</p>
        <p className="mt-1 text-small text-neutral-400">
          {secondary.title} {secondary.body}
        </p>
      </div>
    </div>
  );
}

export default async function SharedSynthesisPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const shared = await getCachedSharedSynthesis(token);
  if (!shared) return <SharedUnavailable />;

  // The share's locale lives behind the unguessable token, not in a cookie, so
  // we set this subtree's NextIntlClientProvider locale EXPLICITLY from the DB
  // row — exactly like interview/[token]/page.tsx. SharedSynthesisView is a
  // client component and reads its chrome strings (sharedSynthesis.*) from this
  // provider, so an account-less stakeholder sees the language the researcher
  // chose for the link.
  const locale = shared.language;

  return (
    <NextIntlClientProvider
      locale={locale}
      messages={{
        common: MESSAGES[locale].common,
        sharedSynthesis: MESSAGES[locale].sharedSynthesis,
      }}
    >
      <SharedSynthesisView data={shared} />
    </NextIntlClientProvider>
  );
}
