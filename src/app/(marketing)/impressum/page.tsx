import type { Metadata } from "next";
import {
  LegalProse,
  LegalSection,
  Placeholder,
} from "@/components/marketing/LegalProse";
import { ogDefaults } from "@/lib/marketing/seo";

const PATH = "/impressum";
const OG_TITLE = "Impressum — findr.";
const DESCRIPTION =
  "Anbieterkennzeichnung und Pflichtangaben gemäß § 5 DDG für findr.";

export const metadata: Metadata = {
  title: "Impressum",
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: { ...ogDefaults, title: OG_TITLE, url: PATH },
  // Placeholder-time only: keep the scaffold out of the index until the real
  // text lands (then drop this `robots` block). Plan §4.9 wants Impressum
  // indexable once it carries the binding content.
  robots: { index: false, follow: true },
};

/* TODO: Rechtstext von André/Anwalt einsetzen — alle Platzhalter unten durch die
   verbindlichen Pflichtangaben ersetzen. Bis dahin bewusst KEINE erfundenen
   Firmen-/Kontaktdaten. */
export default function ImpressumPage() {
  return (
    <LegalProse
      title="Impressum"
      intro="Anbieterkennzeichnung gemäß § 5 Digitale-Dienste-Gesetz (DDG)."
    >
      <LegalSection heading="Angaben gemäß § 5 DDG">
        <Placeholder>
          Firmenname, Rechtsform und ladungsfähige Anschrift des Anbieters
        </Placeholder>
      </LegalSection>

      <LegalSection heading="Vertreten durch">
        <Placeholder>
          Name(n) der vertretungsberechtigten Person(en) / Geschäftsführung
        </Placeholder>
      </LegalSection>

      <LegalSection heading="Kontakt">
        <Placeholder>Telefonnummer und E-Mail-Adresse</Placeholder>
      </LegalSection>

      <LegalSection heading="Registereintrag">
        <Placeholder>
          Registergericht und Registernummer (falls einschlägig)
        </Placeholder>
      </LegalSection>

      <LegalSection heading="Umsatzsteuer-Identifikationsnummer">
        <Placeholder>USt-IdNr. gemäß § 27a UStG (falls vorhanden)</Placeholder>
      </LegalSection>

      <LegalSection heading="Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV">
        <Placeholder>Name und Anschrift der verantwortlichen Person</Placeholder>
      </LegalSection>

      <LegalSection heading="EU-Streitschlichtung">
        <Placeholder>
          Hinweis zur OS-Plattform der EU-Kommission und Angabe, ob zur
          Teilnahme an einem Streitbeilegungsverfahren bereit/verpflichtet
        </Placeholder>
      </LegalSection>
    </LegalProse>
  );
}
