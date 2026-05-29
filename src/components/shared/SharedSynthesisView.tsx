import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import type { Locale } from "@/i18n/locale";
import type {
  SharedSynthesis,
  SharedSynthesisTensionSide,
} from "@/lib/synthesis/share-service";

/**
 * Public, READ-ONLY render of a shared study synthesis (/shared/synthesis/
 * [token]). Server component — no interactivity, no client JS, nothing
 * expandable: this is the stakeholder-facing artefact, not the internal
 * working surface.
 *
 * Shows: overview, emergent themes (title / summary / frequency), tensions
 * (description + both sides' labels). Quotes appear ONLY when the share opted
 * into show_quotes — and even then the data layer (share-service.ts) has
 * already stripped sourceInsightIds, raw transcripts and account/deal data, so
 * there is nothing private to leak here.
 *
 * Deliberately does NOT reuse the dashboard's SynthesisThemeCard: that
 * component renders sourceInsightIds + an expand/collapse affordance and is
 * being reworked by the i18n etappe. This view is its own, simpler thing.
 *
 * i18n: the labels below live in a local bilingual map because the synthesis-
 * display strings do not yet exist in messages/{de,en}.json. They are kept
 * minimal and flagged for migration to a `sharedSynthesis.*` namespace once the
 * i18n etappe that owns those catalogs has merged. The page picks the locale
 * from the share row (not a cookie), so an account-less stakeholder sees the
 * language the researcher chose.
 */

interface Labels {
  eyebrow: string;
  basedOn: (n: number) => string;
  overview: string;
  themesHeading: (n: number) => string;
  themesSub: string;
  tensionsHeading: (n: number) => string;
  tensionsSub: string;
  frequency: (freq: number, total: number) => string;
  noThemes: string;
  noTensions: string;
  sideA: string;
  sideB: string;
  disclaimer: string;
}

const LABELS: Record<Locale, Labels> = {
  de: {
    eyebrow: "Geteilte Synthese",
    basedOn: (n) => `Basiert auf ${n} ${n === 1 ? "Interview" : "Interviews"}`,
    overview: "Überblick",
    themesHeading: (n) => `Emergente Themen (${n})`,
    themesSub: "Themen, die in mehreren Interviews aufgetaucht sind.",
    tensionsHeading: (n) => `Spannungen (${n})`,
    tensionsSub: "Punkte, an denen sich Teilnehmer widersprechen.",
    frequency: (freq, total) =>
      total > 0
        ? `${freq} von ${total} ${total === 1 ? "Teilnehmer" : "Teilnehmern"}`
        : `${freq} ${freq === 1 ? "Erwähnung" : "Erwähnungen"}`,
    noThemes: "Keine übergreifenden Themen über die Interviews hinweg.",
    noTensions: "Keine widersprüchlichen Lager über die Interviews hinweg.",
    sideA: "Seite A",
    sideB: "Seite B",
    disclaimer:
      "Schreibgeschützte, anonymisierte Zusammenfassung. Geteilt über Findr.",
  },
  en: {
    eyebrow: "Shared synthesis",
    basedOn: (n) =>
      `Based on ${n} ${n === 1 ? "interview" : "interviews"}`,
    overview: "Overview",
    themesHeading: (n) => `Emergent themes (${n})`,
    themesSub: "Themes that surfaced across multiple interviews.",
    tensionsHeading: (n) => `Tensions (${n})`,
    tensionsSub: "Points where participants disagree.",
    frequency: (freq, total) =>
      total > 0
        ? `${freq} of ${total} ${total === 1 ? "participant" : "participants"}`
        : `${freq} ${freq === 1 ? "mention" : "mentions"}`,
    noThemes: "No cross-interview themes surfaced.",
    noTensions: "No conflicting camps surfaced across the interviews.",
    sideA: "Side A",
    sideB: "Side B",
    disclaimer: "Read-only, anonymized summary. Shared via Findr.",
  },
};

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

export function SharedSynthesisView({
  data,
  locale,
}: {
  data: SharedSynthesis;
  locale: Locale;
}) {
  const t = LABELS[locale];

  return (
    <div className="min-h-screen bg-neutral-50 px-4 py-10 sm:px-6 lg:py-16">
      <div className="mx-auto max-w-3xl space-y-8">
        {/* Header */}
        <header>
          <div className="text-caption font-medium uppercase tracking-wider text-neutral-400">
            {t.eyebrow}
          </div>
          <h1 className="mt-1 text-display text-neutral-900">
            {data.planTitle}
          </h1>
          <p className="mt-2 text-small text-neutral-500">
            {t.basedOn(data.basedOnCount)}
          </p>
        </header>

        {/* Overview */}
        {data.overview && (
          <Card>
            <CardHeader>
              <h2 className="text-h3 text-neutral-900">{t.overview}</h2>
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
              {t.themesHeading(data.emergentThemes.length)}
            </h2>
            <p className="text-body text-neutral-500">{t.themesSub}</p>
          </div>
          {data.emergentThemes.length === 0 ? (
            <Card>
              <CardBody>
                <p className="py-4 text-center text-body text-neutral-500">
                  {t.noThemes}
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
                      {t.frequency(theme.frequency, data.basedOnCount)}
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
              {t.tensionsHeading(data.tensions.length)}
            </h2>
            <p className="text-body text-neutral-500">{t.tensionsSub}</p>
          </div>
          {data.tensions.length === 0 ? (
            <Card>
              <CardBody>
                <p className="py-4 text-center text-body text-neutral-500">
                  {t.noTensions}
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
                        sideName={t.sideA}
                      />
                      <TensionSidePanel
                        side={tension.sideB}
                        sideName={t.sideB}
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
          <p className="text-caption text-neutral-400">{t.disclaimer}</p>
        </footer>
      </div>
    </div>
  );
}
