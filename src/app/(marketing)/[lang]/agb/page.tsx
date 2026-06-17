import type { Metadata } from "next";
import {
  LegalProse,
  LegalSection,
  Placeholder,
} from "@/components/marketing/LegalProse";
import { ogDefaults } from "@/lib/marketing/seo";

const PATH = "/agb";
const OG_TITLE = "AGB — Klymeo";
const DESCRIPTION =
  "Allgemeine Geschäftsbedingungen für die Nutzung von Klymeo.";

export const metadata: Metadata = {
  title: "AGB",
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: { ...ogDefaults, title: OG_TITLE, url: PATH },
};

/* Gerüst der AGB: Standard-Abschnittsstruktur für ein B2B-SaaS, der
   verbindliche Rechtstext wird je Abschnitt durch die Rechtsberatung
   eingesetzt. Bis dahin bewusst KEINE erfundenen Vertragsbedingungen.

   Hinweis: Für zahlende B2B-Kunden ist zusätzlich ein
   Auftragsverarbeitungsvertrag (AVV) nötig — separat vom Website-AGB. */
export default function AgbPage() {
  return (
    <LegalProse
      title="Allgemeine Geschäftsbedingungen"
      intro="Bedingungen für die Nutzung von Klymeo und der zugehörigen Produkte."
      stand="Juni 2026"
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
