import type { Metadata } from "next";
import {
  LegalProse,
  LegalSection,
  Placeholder,
} from "@/components/marketing/LegalProse";
import { ogDefaultsFor, buildAlternates } from "@/lib/marketing/seo";
import {
  localizedContent,
  localizePath,
  resolveLocale,
} from "@/i18n/marketing-locale";

const PATH = "/agb";
const META = {
  title: { de: "AGB", en: "Terms" },
  ogTitle: { de: "AGB — Klymeo", en: "Terms — Klymeo" },
  description: {
    de: "Allgemeine Geschäftsbedingungen für die Nutzung von Klymeo.",
    en: "Terms and conditions for the use of Klymeo.",
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const locale = resolveLocale((await params).lang);
  return {
    title: localizedContent(locale, META.title),
    description: localizedContent(locale, META.description),
    alternates: buildAlternates(locale, PATH),
    openGraph: {
      ...ogDefaultsFor(locale),
      title: localizedContent(locale, META.ogTitle),
      url: localizePath(locale, PATH),
    },
  };
}

/* Gerüst der AGB: Standard-Abschnittsstruktur für ein B2B-SaaS, der
   verbindliche Rechtstext wird je Abschnitt durch die Rechtsberatung
   eingesetzt. Bis dahin bewusst KEINE erfundenen Vertragsbedingungen.

   Hinweis: Für zahlende B2B-Kunden ist zusätzlich ein
   Auftragsverarbeitungsvertrag (AVV) nötig — separat vom Website-AGB. */
export default async function AgbPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  return (
    <LegalProse
      title="Allgemeine Geschäftsbedingungen"
      intro="Bedingungen für die Nutzung von Klymeo und der zugehörigen Produkte."
      stand="Juni 2026"
      lang={resolveLocale(lang)}
    >
      <LegalSection heading="1. Geltungsbereich">
        <Placeholder>Rechtstext durch Anwalt einsetzen</Placeholder>
      </LegalSection>

      <LegalSection heading="2. Leistungsbeschreibung">
        <Placeholder>Rechtstext durch Anwalt einsetzen</Placeholder>
      </LegalSection>

      <LegalSection heading="3. Vertragsschluss">
        <Placeholder>Rechtstext durch Anwalt einsetzen</Placeholder>
      </LegalSection>

      <LegalSection heading="4. Preise und Zahlung">
        <Placeholder>Rechtstext durch Anwalt einsetzen</Placeholder>
      </LegalSection>

      <LegalSection heading="5. Laufzeit und Kündigung">
        <Placeholder>Rechtstext durch Anwalt einsetzen</Placeholder>
      </LegalSection>

      <LegalSection heading="6. Pflichten des Kunden">
        <Placeholder>Rechtstext durch Anwalt einsetzen</Placeholder>
      </LegalSection>

      <LegalSection heading="7. Verfügbarkeit">
        <Placeholder>Rechtstext durch Anwalt einsetzen</Placeholder>
      </LegalSection>

      <LegalSection heading="8. Haftung">
        <Placeholder>Rechtstext durch Anwalt einsetzen</Placeholder>
      </LegalSection>

      <LegalSection heading="9. Datenschutz und Auftragsverarbeitung">
        <Placeholder>Rechtstext durch Anwalt einsetzen</Placeholder>
      </LegalSection>

      <LegalSection heading="10. Schlussbestimmungen">
        <Placeholder>Rechtstext durch Anwalt einsetzen</Placeholder>
      </LegalSection>
    </LegalProse>
  );
}
