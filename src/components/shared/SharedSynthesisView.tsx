"use client";

import { useTranslations } from "next-intl";

import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import type {
  SharedSynthesis,
  SharedSynthesisTensionSide,
} from "@/lib/synthesis/share-service";

/**
 * Public, READ-ONLY render of a shared study synthesis (/shared/synthesis/
 * [token]). Client component — not for interactivity (there is none), but so the
 * chrome labels resolve through the page's NextIntlClientProvider, whose locale
 * is set EXPLICITLY from the share row (share.language), not a cookie. A server
 * component can't read that provider; a client one does, so an account-less
 * stakeholder sees exactly the language the researcher chose.
 *
 * Shows: overview, emergent themes (title / summary / frequency), tensions
 * (description + both sides' labels). Quotes appear ONLY when the share opted
 * into show_quotes — and even then the data layer (share-service.ts) has
 * already stripped sourceInsightIds, raw transcripts and account/deal data, so
 * there is nothing private to leak here.
 *
 * Deliberately does NOT reuse the dashboard's SynthesisThemeCard: that
 * component renders sourceInsightIds + an expand/collapse affordance. This view
 * is its own, simpler thing.
 *
 * i18n: chrome strings live in the `sharedSynthesis.*` catalog namespace. The
 * AI/DB content (overview, summaries, quotes, labels) stays in its source
 * language and is rendered verbatim — never translated.
 */

function QuoteList({ quotes }: { quotes: string[] }) {
  if (quotes.length === 0) return null;
  return (
    <ul className="mt-3 space-y-2">
      {quotes.map((q, i) => (
        <li
          key={i}
          className="border-l-2 border-neutral-200 pl-3 text-small italic text-neutral-600"
        >
          „{q}"
        </li>
      ))}
    </ul>
  );
}

function TensionSidePanel({
  side,
  sideName,
}: {
  side: SharedSynthesisTensionSide;
  sideName: string;
}) {
  return (
    <div className="rounded-md border border-neutral-200 bg-neutral-50/50 p-4">
      <div className="mb-1 text-caption font-medium uppercase tracking-wider text-neutral-500">
        {sideName}
      </div>
      <p className="text-body-strong text-neutral-900">{side.label}</p>
      <QuoteList quotes={side.quotes} />
    </div>
  );
}

export function SharedSynthesisView({ data }: { data: SharedSynthesis }) {
  const t = useTranslations("sharedSynthesis");

  return (
    <div className="min-h-screen bg-neutral-50 px-4 py-10 sm:px-6 lg:py-16">
      <div className="mx-auto max-w-3xl space-y-8">
        {/* Header */}
        <header>
          <div className="text-caption font-medium uppercase tracking-wider text-neutral-400">
            {t("eyebrow")}
          </div>
          <h1 className="mt-1 text-display text-neutral-900">
            {data.planTitle}
          </h1>
          <p className="mt-2 text-small text-neutral-500">
            {t("basedOn", { count: data.basedOnCount })}
          </p>
        </header>

        {/* Overview */}
        {data.overview && (
          <Card>
            <CardHeader>
              <h2 className="text-h3 text-neutral-900">{t("overview")}</h2>
            </CardHeader>
            <CardBody>
              <p className="whitespace-pre-wrap text-body leading-relaxed text-neutral-700">
                {data.overview}
              </p>
            </CardBody>
          </Card>
        )}

        {/* Emergent themes */}
        <section className="space-y-4">
          <div>
            <h2 className="text-h2 text-neutral-900">
              {t("themesHeading", { count: data.emergentThemes.length })}
            </h2>
            <p className="text-body text-neutral-500">{t("themesSub")}</p>
          </div>
          {data.emergentThemes.length === 0 ? (
            <Card>
              <CardBody>
                <p className="py-4 text-center text-body text-neutral-500">
                  {t("noThemes")}
                </p>
              </CardBody>
            </Card>
          ) : (
            <div className="space-y-3">
              {data.emergentThemes.map((theme, i) => (
                <Card key={`theme-${i}`}>
                  <CardBody>
                    <div className="text-h3 text-neutral-900">
                      {theme.title}
                    </div>
                    <p className="mt-1 text-body text-neutral-600">
                      {theme.summary}
                    </p>
                    <div className="mt-2 text-caption font-medium uppercase tracking-wider text-neutral-400">
                      {data.basedOnCount > 0
                        ? t("frequencyOfTotal", {
                            freq: theme.frequency,
                            total: data.basedOnCount,
                          })
                        : t("frequencyMentions", { freq: theme.frequency })}
                    </div>
                    <QuoteList quotes={theme.quotes} />
                  </CardBody>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* Tensions */}
        <section className="space-y-4">
          <div>
            <h2 className="text-h2 text-neutral-900">
              {t("tensionsHeading", { count: data.tensions.length })}
            </h2>
            <p className="text-body text-neutral-500">{t("tensionsSub")}</p>
          </div>
          {data.tensions.length === 0 ? (
            <Card>
              <CardBody>
                <p className="py-4 text-center text-body text-neutral-500">
                  {t("noTensions")}
                </p>
              </CardBody>
            </Card>
          ) : (
            <div className="space-y-4">
              {data.tensions.map((tension, i) => (
                <Card key={`tension-${i}`}>
                  <CardBody className="space-y-4">
                    <p className="text-body-strong text-neutral-900">
                      {tension.description}
                    </p>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <TensionSidePanel
                        side={tension.sideA}
                        sideName={t("sideA")}
                      />
                      <TensionSidePanel
                        side={tension.sideB}
                        sideName={t("sideB")}
                      />
                    </div>
                  </CardBody>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* Footer disclaimer */}
        <footer className="border-t border-neutral-200 pt-6">
          <p className="text-caption text-neutral-400">{t("disclaimer")}</p>
        </footer>
      </div>
    </div>
  );
}
