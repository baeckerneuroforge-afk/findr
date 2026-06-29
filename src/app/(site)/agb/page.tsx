// Allgemeine Geschäftsbedingungen (B2B-SaaS). Die kaufmännischen Eckwerte
// (Zahlungsziel, Kündigungsfrist, AGB-Änderungsfrist) sind als marktübliche
// Standardwerte gesetzt; konkrete Preise, Laufzeiten und ein etwaiges SLA
// ergeben sich aus der jeweiligen Bestellung. AGB-Klauseln unterliegen der
// Inhaltskontrolle nach §§ 305 ff. BGB und sollten einmal anwaltlich
// gegengelesen werden (insbesondere die Haftungsklausel in § 10). Für die
// weisungsgebundene Verarbeitung von Studiendaten ist zusätzlich ein
// Auftragsverarbeitungsvertrag (AVV) nach Art. 28 DSGVO nötig (siehe § 12).
import type { Metadata } from "next";
import Link from "next/link";
import {
  LegalProse,
  LegalSection,
  LegalStand,
} from "@/components/site/LegalProse";
import { SiteShell } from "@/components/site/SiteShell";
import { ogDefaults } from "@/lib/marketing/seo";

const STAND = "Juni 2026";

export const metadata: Metadata = {
  title: { absolute: "AGB — Klymeo" },
  description: "Allgemeine Geschäftsbedingungen für die Nutzung von Klymeo.",
  alternates: { canonical: "/agb" },
  openGraph: {
    ...ogDefaults,
    title: "AGB — Klymeo",
    description: "Allgemeine Geschäftsbedingungen für die Nutzung von Klymeo.",
    url: "/agb",
  },
};

const CONTACT_LINK =
  "text-ink underline underline-offset-2 transition-colors hover:text-ink/70";

/* AGB für ein B2B-SaaS in marktüblicher Standardform. Die kaufmännischen
   Eckwerte sind gesetzt (Zahlungsziel 14 Tage, Kündigungsfrist 30 Tage zum
   Laufzeitende, AGB-Änderungsankündigung 6 Wochen); konkrete Preise und
   Laufzeiten ergeben sich aus der jeweiligen Bestellung. Für die
   weisungsgebundene Verarbeitung von Studiendaten ist zusätzlich ein
   Auftragsverarbeitungsvertrag (AVV) nach Art. 28 DSGVO nötig — separat von
   diesen AGB (siehe § 12). */
export default function AgbPage() {
  return (
    <SiteShell>
      <LegalProse
        title="Allgemeine Geschäftsbedingungen"
        intro="Bedingungen für die Nutzung von Klymeo und der zugehörigen Produkte."
        notice={false}
        closing={<LegalStand>{STAND}</LegalStand>}
      >
        <LegalSection heading="1. Geltungsbereich und Vertragsgegenstand">
          <div className="flex flex-col gap-3">
            <p>
              Diese Allgemeinen Geschäftsbedingungen (AGB) gelten für alle Verträge
              zwischen André Bäcker, Klymeo (Einzelunternehmen), Hopstener Straße
              25, 49479 Ibbenbüren („Anbieter“) und seinen Kunden über die
              Bereitstellung und Nutzung der Plattform Klymeo. Kunden im Sinne
              dieser AGB sind ausschließlich Unternehmer im Sinne des § 14 BGB,
              juristische Personen des öffentlichen Rechts oder
              öffentlich-rechtliche Sondervermögen.
            </p>
            <p>
              Vertragsgegenstand ist die Bereitstellung der Plattform als
              Software-as-a-Service über das Internet sowie der damit verbundenen,
              in der jeweiligen Bestellung beschriebenen Leistungen. Abweichenden
              oder entgegenstehenden Geschäftsbedingungen des Kunden wird
              widersprochen; sie werden nur Vertragsbestandteil, wenn der Anbieter
              ihnen ausdrücklich in Textform zustimmt.
            </p>
          </div>
        </LegalSection>

        <LegalSection heading="2. Vertragsschluss">
          <div className="flex flex-col gap-3">
            <p>
              Die Darstellung der Leistungen auf der Website stellt kein bindendes
              Angebot dar, sondern eine Aufforderung zur Abgabe eines Angebots. Der
              Vertrag kommt durch die Annahme der Bestellung bzw. die Freischaltung
              des Zugangs durch den Anbieter oder durch ein vom Kunden
              angenommenes Angebot des Anbieters zustande. Für die Registrierung und
              Nutzung ist die Anlage eines Nutzerkontos erforderlich; die dabei
              anzugebenden Daten müssen vollständig und richtig sein.
            </p>
          </div>
        </LegalSection>

        <LegalSection heading="3. Leistungsbeschreibung">
          <div className="flex flex-col gap-3">
            <p>
              Der Anbieter stellt dem Kunden die Plattform zur Planung,
              Durchführung und Auswertung KI-gestützter qualitativer Interviews
              bereit — einschließlich der text- und sprachbasierten
              Interviewführung (Voice-Agent), der Darstellung von Stimuli sowie der
              Auswertung und des Exports der Ergebnisse. Der konkrete
              Leistungsumfang ergibt sich aus der jeweiligen Leistungsbeschreibung
              bzw. Bestellung. Der Anbieter schuldet die Bereitstellung der
              Plattform (Dienstleistung), nicht einen bestimmten
              Forschungs- oder Verwertungserfolg.
            </p>
            <p>
              Der Anbieter ist berechtigt, die Leistungen weiterzuentwickeln und
              anzupassen, soweit dies dem Kunden zumutbar ist und der vertraglich
              geschuldete Leistungsumfang nicht wesentlich eingeschränkt wird.
            </p>
          </div>
        </LegalSection>

        <LegalSection heading="4. Pflichten des Kunden">
          <div className="flex flex-col gap-3">
            <p>Der Kunde verpflichtet sich insbesondere,</p>
            <ul className="flex list-disc flex-col gap-1.5 pl-5">
              <li>
                die Plattform nur im Rahmen der geltenden Gesetze und dieser AGB zu
                nutzen und keine rechtswidrigen Inhalte einzustellen;
              </li>
              <li>
                die für die Durchführung der Interviews erforderlichen datenschutz-
                rechtlichen Grundlagen (insbesondere Einwilligungen und
                Informationen der teilnehmenden Personen) eigenverantwortlich
                sicherzustellen, da er insoweit Verantwortlicher im Sinne der DSGVO
                ist;
              </li>
              <li>
                seine Zugangsdaten geheim zu halten, vor dem Zugriff Dritter zu
                schützen und einen Missbrauch unverzüglich anzuzeigen;
              </li>
              <li>
                erforderliche Rechte an den von ihm eingestellten Inhalten (z. B.
                Stimuli) zu besitzen.
              </li>
            </ul>
          </div>
        </LegalSection>

        <LegalSection heading="5. Preise und Zahlung (Pilot- und Lizenzmodell)">
          <div className="flex flex-col gap-3">
            <p>
              Die Vergütung richtet sich nach dem vereinbarten Modell — einem
              zeitlich begrenzten Pilotmodell oder einem laufenden Lizenzmodell —
              und ergibt sich aus der jeweiligen Bestellung bzw. dem Angebot. Alle
              Preise verstehen sich zuzüglich der gesetzlichen Umsatzsteuer, soweit
              diese anfällt. Die Abrechnung erfolgt per Rechnung.
            </p>
            <p>
              Rechnungen sind innerhalb von 14 Tagen ab Rechnungsdatum ohne Abzug
              fällig. Bei Zahlungsverzug gelten die gesetzlichen Regelungen
              (§§ 286, 288 BGB).
            </p>
          </div>
        </LegalSection>

        <LegalSection heading="6. Laufzeit und Kündigung">
          <div className="flex flex-col gap-3">
            <p>
              Die Vertragslaufzeit ergibt sich aus der jeweiligen Bestellung. Sofern
              nicht abweichend vereinbart, verlängert sich der Vertrag jeweils um
              den ursprünglichen Laufzeitzeitraum, wenn er nicht mit einer Frist von
              30 Tagen zum jeweiligen Laufzeitende in Textform gekündigt wird. Das
              Recht zur außerordentlichen Kündigung
              aus wichtigem Grund bleibt für beide Parteien unberührt. Kündigungen
              bedürfen der Textform.
            </p>
          </div>
        </LegalSection>

        <LegalSection heading="7. Nutzungsrechte">
          <div className="flex flex-col gap-3">
            <p>
              Der Anbieter räumt dem Kunden für die Dauer des Vertrags ein
              einfaches, nicht ausschließliches, nicht übertragbares Recht ein, die
              Plattform im vereinbarten Umfang vertragsgemäß zu nutzen. Eine
              darüber hinausgehende Nutzung, insbesondere die Vervielfältigung,
              Bearbeitung oder Zugänglichmachung der Software gegenüber Dritten, ist
              ohne Zustimmung des Anbieters nicht gestattet.
            </p>
            <p>
              Die Rechte an den vom Kunden eingestellten Inhalten sowie an den im
              Auftrag des Kunden erhobenen Studiendaten und Auswertungen verbleiben
              beim Kunden. Der Anbieter ist berechtigt, anonymisierte oder
              aggregierte Daten, die keinen Personen- oder Kundenbezug mehr
              zulassen, zur Verbesserung und zum Betrieb der Leistungen zu nutzen.
            </p>
          </div>
        </LegalSection>

        <LegalSection heading="8. Verfügbarkeit und Support">
          <div className="flex flex-col gap-3">
            <p>
              Der Anbieter ist um eine hohe Verfügbarkeit der Plattform bemüht.
              Hiervon ausgenommen sind Zeiten, in denen die Plattform aufgrund
              technischer oder sonstiger Probleme, die nicht im Einflussbereich des
              Anbieters liegen (z. B. höhere Gewalt, Störungen bei Dritten), nicht
              erreichbar ist, sowie angekündigte Wartungsfenster. Support wird per
              E-Mail an{" "}
              <a href="mailto:support@klymeo.com" className={CONTACT_LINK}>
                support@klymeo.com
              </a>{" "}
              angeboten.
            </p>
            <p>
              Eine bestimmte Verfügbarkeit (Service Level) oder eine bestimmte
              Support-Reaktionszeit wird nicht zugesichert, sofern sie nicht in der
              jeweiligen Bestellung ausdrücklich in Textform vereinbart wird.
            </p>
          </div>
        </LegalSection>

        <LegalSection heading="9. Gewährleistung">
          <div className="flex flex-col gap-3">
            <p>
              Es gelten die gesetzlichen Mängelhaftungsrechte mit den Maßgaben
              dieser AGB. Der Kunde hat erkennbare Mängel unverzüglich in Textform
              anzuzeigen. Eine Beschaffenheitsgarantie wird nur übernommen, wenn dies
              ausdrücklich in Textform vereinbart wurde.
            </p>
          </div>
        </LegalSection>

        <LegalSection heading="10. Haftung und Haftungsbegrenzung">
          <div className="flex flex-col gap-3">
            <p>
              Der Anbieter haftet unbeschränkt bei Vorsatz und grober
              Fahrlässigkeit, bei der Verletzung von Leben, Körper oder Gesundheit,
              nach den Vorschriften des Produkthaftungsgesetzes sowie im Umfang
              einer übernommenen Garantie.
            </p>
            <p>
              Bei der leicht fahrlässigen Verletzung einer wesentlichen
              Vertragspflicht (Pflicht, deren Erfüllung die ordnungsgemäße
              Durchführung des Vertrags überhaupt erst ermöglicht und auf deren
              Einhaltung der Kunde regelmäßig vertraut — Kardinalpflicht) ist die
              Haftung auf den vertragstypischen, vorhersehbaren Schaden begrenzt. Im
              Übrigen ist die Haftung für leichte Fahrlässigkeit ausgeschlossen. Die
              vorstehenden Beschränkungen gelten auch zugunsten der gesetzlichen
              Vertreter und Erfüllungsgehilfen des Anbieters.
            </p>
            <p>
              Für den Verlust von Daten haftet der Anbieter nur in dem Umfang, der
              auch bei einer ordnungsgemäßen und regelmäßigen Datensicherung durch
              den Kunden entstanden wäre. Der Kunde bleibt für die Sicherung der von
              ihm in die Plattform eingestellten Inhalte selbst verantwortlich,
              soweit nicht ausdrücklich etwas anderes vereinbart ist.
            </p>
          </div>
        </LegalSection>

        <LegalSection heading="11. Geheimhaltung">
          <div className="flex flex-col gap-3">
            <p>
              Die Parteien verpflichten sich, alle im Rahmen der Zusammenarbeit
              erlangten, als vertraulich gekennzeichneten oder ihrer Natur nach
              vertraulichen Informationen der anderen Partei geheim zu halten und
              nur für Zwecke der Vertragsdurchführung zu verwenden. Diese
              Verpflichtung besteht über das Vertragsende hinaus fort. Ausgenommen
              sind Informationen, die offenkundig sind oder aufgrund gesetzlicher
              Verpflichtung offengelegt werden müssen.
            </p>
          </div>
        </LegalSection>

        <LegalSection heading="12. Datenschutz und Auftragsverarbeitung">
          <div className="flex flex-col gap-3">
            <p>
              Informationen zur Verarbeitung personenbezogener Daten enthält unsere{" "}
              <Link href="/datenschutz" className={CONTACT_LINK}>
                Datenschutzerklärung
              </Link>
              . Soweit der Anbieter personenbezogene Daten weisungsgebunden im
              Auftrag des Kunden verarbeitet (z. B. Interview- und Teilnehmerdaten),
              gilt ergänzend ein gesonderter Auftragsverarbeitungsvertrag (AVV) nach
              Art. 28 DSGVO, der separat von diesen AGB geschlossen wird. Der Kunde
              ist für diese Daten Verantwortlicher im Sinne der DSGVO.
            </p>
          </div>
        </LegalSection>

        <LegalSection heading="13. Änderungen der AGB">
          <div className="flex flex-col gap-3">
            <p>
              Der Anbieter ist berechtigt, diese AGB mit Wirkung für die Zukunft zu
              ändern, soweit dies aus triftigem Grund (z. B. geänderte Rechtslage
              oder Rechtsprechung, Erweiterung des Leistungsangebots) erforderlich
              ist und der Kunde dadurch nicht unangemessen benachteiligt wird.
              Änderungen werden dem Kunden mindestens 6 Wochen vor ihrem
              Wirksamwerden in Textform mitgeteilt. Widerspricht der Kunde nicht
              innerhalb der in
              der Mitteilung genannten Frist, gelten die Änderungen als angenommen;
              auf diese Folge wird in der Mitteilung gesondert hingewiesen. Im Falle
              des Widerspruchs steht beiden Parteien ein Sonderkündigungsrecht zu.
            </p>
          </div>
        </LegalSection>

        <LegalSection heading="14. Schlussbestimmungen und Gerichtsstand">
          <div className="flex flex-col gap-3">
            <p>
              Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des
              UN-Kaufrechts (CISG). Ist der Kunde Kaufmann, juristische Person des
              öffentlichen Rechts oder öffentlich-rechtliches Sondervermögen, ist
              ausschließlicher Gerichtsstand für alle Streitigkeiten aus oder im
              Zusammenhang mit diesem Vertrag der Sitz des Anbieters (Ibbenbüren).
              Der Anbieter ist auch berechtigt, am allgemeinen Gerichtsstand des
              Kunden zu klagen.
            </p>
            <p>
              Änderungen und Ergänzungen des Vertrags bedürfen der Textform. Sollten
              einzelne Bestimmungen dieser AGB unwirksam sein oder werden, bleibt die
              Wirksamkeit der übrigen Bestimmungen unberührt.
            </p>
          </div>
        </LegalSection>
      </LegalProse>
    </SiteShell>
  );
}
