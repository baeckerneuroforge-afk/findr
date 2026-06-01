import type { Metadata } from "next";
import {
  LegalProse,
  LegalSection,
  Placeholder,
} from "@/components/marketing/LegalProse";
import { ogDefaults } from "@/lib/marketing/seo";

const PATH = "/datenschutz";
const OG_TITLE = "Datenschutz — findr.";
const DESCRIPTION =
  "Informationen zur Verarbeitung personenbezogener Daten bei findr. gemäß DSGVO.";

export const metadata: Metadata = {
  title: "Datenschutz",
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: { ...ogDefaults, title: OG_TITLE, url: PATH },
  // Placeholder-time only: keep the scaffold out of the index until the real
  // text lands (then drop this `robots` block). Plan §4.9 wants Datenschutz
  // indexable once it carries the binding content.
  robots: { index: false, follow: true },
};

/* TODO: Rechtstext von André/Anwalt einsetzen — alle Platzhalter unten durch die
   verbindliche Datenschutzerklärung ersetzen. Bis dahin bewusst KEIN
   halluzinierter Datenschutztext (nichts darf als echte Zusicherung lesbar sein). */
export default function DatenschutzPage() {
  return (
    <LegalProse
      title="Datenschutzerklärung"
      intro="Informationen zur Verarbeitung personenbezogener Daten gemäß Datenschutz-Grundverordnung (DSGVO) und Bundesdatenschutzgesetz (BDSG)."
    >
      <LegalSection heading="Verantwortlicher im Sinne des Art. 4 Nr. 7 DSGVO">
        <Placeholder>
          Name und Kontaktdaten des/der Verantwortlichen
        </Placeholder>
      </LegalSection>

      <LegalSection heading="Datenschutzbeauftragte:r">
        <Placeholder>
          Kontaktdaten des/der Datenschutzbeauftragten, sofern benannt
        </Placeholder>
      </LegalSection>

      <LegalSection heading="Erhebung und Verarbeitung personenbezogener Daten">
        <Placeholder>
          Welche Daten zu welchem Zweck erhoben und verarbeitet werden (Website,
          Konto, Produktnutzung, Gesprächsdaten)
        </Placeholder>
      </LegalSection>

      <LegalSection heading="Rechtsgrundlagen der Verarbeitung">
        <Placeholder>
          Einschlägige Rechtsgrundlagen nach Art. 6 DSGVO je Verarbeitungszweck
        </Placeholder>
      </LegalSection>

      <LegalSection heading="Hosting und Auftragsverarbeitung">
        <Placeholder>
          Eingesetzte Dienstleister, Hosting-Standort (EU/Frankfurt),
          Auftragsverarbeitungsverträge gemäß Art. 28 DSGVO
        </Placeholder>
      </LegalSection>

      <LegalSection heading="Cookies und Reichweitenmessung">
        <Placeholder>
          Eingesetzte Cookies/Tracking, Einwilligungsmechanismus und Widerruf
        </Placeholder>
      </LegalSection>

      <LegalSection heading="Speicherdauer">
        <Placeholder>
          Kriterien und Fristen für die Löschung der jeweiligen Datenkategorien
        </Placeholder>
      </LegalSection>

      <LegalSection heading="Rechte der betroffenen Personen">
        <Placeholder>
          Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit
          und Widerspruch (Art. 15–22 DSGVO)
        </Placeholder>
      </LegalSection>

      <LegalSection heading="Beschwerderecht bei einer Aufsichtsbehörde">
        <Placeholder>
          Hinweis auf das Beschwerderecht und die zuständige Aufsichtsbehörde
        </Placeholder>
      </LegalSection>
    </LegalProse>
  );
}
