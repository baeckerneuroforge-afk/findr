import type { Metadata } from "next";
import {
  LegalProse,
  LegalSection,
  Placeholder,
} from "@/components/marketing/LegalProse";
import { ogDefaults } from "@/lib/marketing/seo";

const PATH = "/agb";
const OG_TITLE = "AGB — findr.";
const DESCRIPTION =
  "Allgemeine Geschäftsbedingungen für die Nutzung von findr.";

export const metadata: Metadata = {
  title: "AGB",
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: { ...ogDefaults, title: OG_TITLE, url: PATH },
  // /agb is intentionally noindex (plan §4.9 — boilerplate terms carry no SEO
  // value). It stays noindex even after the real text lands; this is by choice,
  // not just the placeholder state.
  robots: { index: false, follow: true },
};

/* TODO: Rechtstext von André/Anwalt einsetzen — alle Platzhalter unten durch die
   verbindlichen AGB ersetzen. Bis dahin bewusst KEINE erfundenen
   Vertragsbedingungen. */
export default function AgbPage() {
  return (
    <LegalProse
      title="Allgemeine Geschäftsbedingungen"
      intro="Bedingungen für die Nutzung von findr. und der zugehörigen Produkte."
    >
      <LegalSection heading="1. Geltungsbereich">
        <Placeholder>
          Für welche Leistungen und gegenüber welchen Vertragspartnern diese AGB
          gelten
        </Placeholder>
      </LegalSection>

      <LegalSection heading="2. Vertragsgegenstand und Leistungsbeschreibung">
        <Placeholder>
          Umfang der bereitgestellten Software und Leistungen
        </Placeholder>
      </LegalSection>

      <LegalSection heading="3. Vertragsschluss">
        <Placeholder>
          Wie der Vertrag zustande kommt (Registrierung, Bestellung, Annahme)
        </Placeholder>
      </LegalSection>

      <LegalSection heading="4. Preise und Zahlungsbedingungen">
        <Placeholder>
          Vergütung, Abrechnungszeitraum, Fälligkeit und Zahlungsweise
        </Placeholder>
      </LegalSection>

      <LegalSection heading="5. Laufzeit und Kündigung">
        <Placeholder>
          Vertragslaufzeit, Verlängerung und Kündigungsfristen
        </Placeholder>
      </LegalSection>

      <LegalSection heading="6. Pflichten der Nutzer:innen">
        <Placeholder>
          Zulässige Nutzung, Mitwirkungspflichten und Nutzungsbeschränkungen —
          einschließlich Acceptable-Use-Klausel zum KI-Interviewer: kein Einsatz
          zur Bewertung von Beschäftigten oder Bewerber:innen
          (Arbeitsplatz-Kontext, Art. 5(1)(f) KI-VO), keine Koppelung von
          Signal-Auswertungen an Vergütungs- oder Ablehnungsentscheidungen.
          Ausformulierter Entwurf: docs/findr-e0-aup-klausel-entwurf.md
        </Placeholder>
      </LegalSection>

      <LegalSection heading="7. Haftung">
        <Placeholder>Haftungsumfang und -beschränkungen</Placeholder>
      </LegalSection>

      <LegalSection heading="8. Datenschutz">
        <Placeholder>
          Verweis auf die Datenschutzerklärung und Auftragsverarbeitung
        </Placeholder>
      </LegalSection>

      <LegalSection heading="9. Schlussbestimmungen">
        <Placeholder>
          Anwendbares Recht, Gerichtsstand und salvatorische Klausel
        </Placeholder>
      </LegalSection>
    </LegalProse>
  );
}
