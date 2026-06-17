import type { Metadata } from "next";
import {
  LegalProse,
  LegalSection,
  Placeholder,
} from "@/components/marketing/LegalProse";
import { ogDefaults } from "@/lib/marketing/seo";

const PATH = "/impressum";
const OG_TITLE = "Impressum — Klymeo";
const DESCRIPTION =
  "Anbieterkennzeichnung und Pflichtangaben gemäß § 5 DDG für Klymeo.";

export const metadata: Metadata = {
  title: "Impressum",
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: { ...ogDefaults, title: OG_TITLE, url: PATH },
};

const CONTACT_LINK =
  "text-primary-700 underline underline-offset-2 transition-colors hover:text-primary-900";

export default function ImpressumPage() {
  return (
    <LegalProse
      title="Impressum"
      intro="Anbieterkennzeichnung gemäß § 5 Digitale-Dienste-Gesetz (DDG)."
      stand="Juni 2026"
      notice={false}
    >
      <LegalSection heading="Angaben gemäß § 5 DDG">
        <p>
          André Bäcker
          <br />
          Klymeo (Einzelunternehmen)
          <br />
          Hopstener Straße 25
          <br />
          49479 Ibbenbüren
          <br />
          Deutschland
        </p>
      </LegalSection>

      <LegalSection heading="Kontakt">
        <div className="flex flex-col gap-1.5">
          <p>
            E-Mail:{" "}
            <a href="mailto:support@klymeo.com" className={CONTACT_LINK}>
              support@klymeo.com
            </a>
          </p>
          <p>
            Telefon:{" "}
            <a href="tel:+4917621878801" className={CONTACT_LINK}>
              +49 176 21878801
            </a>
          </p>
        </div>
      </LegalSection>

      {/*
        Umsatzsteuer-Identifikationsnummer — nur aufnehmen, wenn eine GÜLTIGE
        USt-IdNr. vorhanden ist: den Platzhalter unten durch die echte USt-IdNr.
        ersetzen. Falls KEINE gültige USt-IdNr. vorhanden ist, diesen gesamten
        <LegalSection>-Block ersatzlos entfernen. Die Steuernummer gehört NICHT
        ins Impressum.
      */}
      <LegalSection heading="Umsatzsteuer-Identifikationsnummer">
        <p>
          USt-IdNr. gemäß § 27a UStG:{" "}
          <Placeholder>USt-IdNr. eintragen</Placeholder>
        </p>
      </LegalSection>

      <LegalSection heading="Verantwortlich für den Inhalt nach § 18 Abs. 2 MStV">
        <p>André Bäcker, Anschrift wie oben.</p>
      </LegalSection>

      <LegalSection heading="Verbraucherstreitbeilegung">
        {/*
          Bewusst KEIN Link zur EU-OS-/ODR-Plattform: Die Online-Streitbeilegungs-
          Plattform der EU-Kommission wurde 2025 eingestellt.
        */}
        <p>
          Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren
          vor einer Verbraucherschlichtungsstelle teilzunehmen.
        </p>
      </LegalSection>

      <LegalSection heading="Haftung für Inhalte">
        <p>
          Als Diensteanbieter sind wir gemäß § 7 Abs. 1 DDG für eigene Inhalte
          auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Nach
          §§ 8 bis 10 DDG sind wir als Diensteanbieter jedoch nicht
          verpflichtet, übermittelte oder gespeicherte fremde Informationen zu
          überwachen oder nach Umständen zu forschen, die auf eine rechtswidrige
          Tätigkeit hinweisen. Verpflichtungen zur Entfernung oder Sperrung der
          Nutzung von Informationen nach den allgemeinen Gesetzen bleiben hiervon
          unberührt. Eine diesbezügliche Haftung ist jedoch erst ab dem Zeitpunkt
          der Kenntnis einer konkreten Rechtsverletzung möglich. Bei
          Bekanntwerden von entsprechenden Rechtsverletzungen werden wir diese
          Inhalte umgehend entfernen.
        </p>
      </LegalSection>

      <LegalSection heading="Haftung für Links">
        <p>
          Unser Angebot enthält gegebenenfalls Links zu externen Websites
          Dritter, auf deren Inhalte wir keinen Einfluss haben. Deshalb können
          wir für diese fremden Inhalte auch keine Gewähr übernehmen. Für die
          Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder
          Betreiber der Seiten verantwortlich. Die verlinkten Seiten wurden zum
          Zeitpunkt der Verlinkung auf mögliche Rechtsverstöße überprüft.
          Rechtswidrige Inhalte waren zum Zeitpunkt der Verlinkung nicht
          erkennbar. Eine permanente inhaltliche Kontrolle der verlinkten Seiten
          ist jedoch ohne konkrete Anhaltspunkte einer Rechtsverletzung nicht
          zumutbar. Bei Bekanntwerden von Rechtsverletzungen werden wir derartige
          Links umgehend entfernen.
        </p>
      </LegalSection>

      <LegalSection heading="Urheberrecht">
        <p>
          Die durch die Seitenbetreiber erstellten Inhalte und Werke auf diesen
          Seiten unterliegen dem deutschen Urheberrecht. Die Vervielfältigung,
          Bearbeitung, Verbreitung und jede Art der Verwertung außerhalb der
          Grenzen des Urheberrechtes bedürfen der schriftlichen Zustimmung des
          jeweiligen Autors bzw. Erstellers. Downloads und Kopien dieser Seite
          sind nur für den privaten, nicht kommerziellen Gebrauch gestattet.
          Soweit die Inhalte auf dieser Seite nicht vom Betreiber erstellt
          wurden, werden die Urheberrechte Dritter beachtet. Insbesondere werden
          Inhalte Dritter als solche gekennzeichnet. Sollten Sie trotzdem auf
          eine Urheberrechtsverletzung aufmerksam werden, bitten wir um einen
          entsprechenden Hinweis. Bei Bekanntwerden von Rechtsverletzungen werden
          wir derartige Inhalte umgehend entfernen.
        </p>
      </LegalSection>
    </LegalProse>
  );
}
