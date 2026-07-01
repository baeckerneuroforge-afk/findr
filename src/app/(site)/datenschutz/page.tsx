// Datenschutzerklärung — inhaltlich aus dem tatsächlichen Anwendungs-Code
// abgeleitet (eingesetzte Dienste, Datenflüsse, Serverstandorte). Vor dem
// Live-Gang sollten die Auftragsverarbeitungsverträge (AVV/DPA) mit den
// US-Dienstleistern (Vercel, Anthropic, Deepgram, LiveKit, Resend) vorliegen
// und der Text einmal anwaltlich gegengelesen werden.
import type { Metadata } from "next";
import Link from "next/link";
import {
  LegalProse,
  LegalSection,
  LegalStand,
} from "@/components/site/LegalProse";
import { SiteShell } from "@/components/site/SiteShell";
import { buildAlternates, ogDefaultsFor } from "@/lib/marketing/seo";

const STAND = "Juni 2026";

export const metadata: Metadata = {
  title: { absolute: "Datenschutz — Klymeo" },
  description:
    "Informationen zur Verarbeitung personenbezogener Daten bei Klymeo gemäß DSGVO.",
  alternates: buildAlternates("de", "/datenschutz"),
  openGraph: {
    ...ogDefaultsFor("de"),
    title: "Datenschutz — Klymeo",
    description:
      "Informationen zur Verarbeitung personenbezogener Daten bei Klymeo gemäß DSGVO.",
    url: "/datenschutz",
  },
};

const CONTACT_LINK =
  "text-ink underline underline-offset-2 transition-colors hover:text-ink/70";

/* Eingesetzte Auftragsverarbeiter / Dienste (Abschnitt 9). Pro Eintrag die fünf
   Pflichtfelder Zweck / Datenkategorien / Rechtsgrundlage / Serverstandort /
   Drittland+SCC. Inhaltlich aus dem tatsächlichen Code abgeleitet: Auth läuft
   über selbst gehostetes Zitadel auf Hetzner (DE); die KI-Inferenz erfolgt
   direkt gegen die Anthropic-API (USA), nicht über AWS Bedrock; Speech-to-Text
   und Text-to-Speech über den EU-Endpoint von Deepgram. Reihenfolge: EU-Dienste
   zuerst, anschließend Dienste mit Drittlandbezug (USA, SCC). */
const PROCESSORS: {
  name: string;
  zweck: string;
  datenkategorien: string;
  rechtsgrundlage: string;
  standort: string;
  drittland: string;
}[] = [
  {
    name: "Supabase (PostgreSQL-Datenbank)",
    zweck: "Datenbank und Speicherung der Plattform-, Konto- und Studiendaten",
    datenkategorien:
      "in der Anwendung gespeicherte Konto-, Studien- und Interviewdaten (Antworttexte, Transkripte, Kontakt- und Screening-Angaben)",
    rechtsgrundlage:
      "Art. 6 Abs. 1 lit. b/f DSGVO; für Studiendaten Art. 28 DSGVO (Auftragsverarbeitung)",
    standort: "Supabase — EU-Region (Frankfurt am Main, eu-central-1)",
    drittland: "kein Drittland (EU)",
  },
  {
    name: "Hetzner (Authentifizierung & Voice-Agent)",
    zweck:
      "Server-Infrastruktur für den selbst betriebenen Authentifizierungsdienst (Zitadel) sowie für den Voice-Agent der Sprach-Interviews",
    datenkategorien:
      "Anmelde- und Authentifizierungsdaten der Nutzerkonten; im Rahmen der Voice-Interviews verarbeitete Verbindungs- und Sitzungsdaten",
    rechtsgrundlage: "Art. 6 Abs. 1 lit. b/f DSGVO; Art. 28 DSGVO",
    standort: "Hetzner Online GmbH, Deutschland",
    drittland: "kein Drittland (EU)",
  },
  {
    name: "Vercel (Hosting)",
    zweck: "Hosting und Auslieferung der Web-Anwendung",
    datenkategorien: "Verbindungsdaten und Server-Logfiles (u. a. IP-Adresse)",
    rechtsgrundlage: "Art. 6 Abs. 1 lit. f DSGVO (sicherer, fehlerfreier Betrieb)",
    standort: "Vercel Inc., USA; Auslieferung über EU-Region (Frankfurt am Main)",
    drittland: "Drittland USA — EU-Standardvertragsklauseln (Art. 46 DSGVO)",
  },
  {
    name: "Anthropic (KI-Auswertung)",
    zweck:
      "KI-gestützte Gesprächsführung der Interviews sowie Auswertung und Synthese der Antworten durch das Sprachmodell Claude",
    datenkategorien:
      "Interviewinhalte (Antworttexte, Transkripte) zur Verarbeitung durch das Sprachmodell",
    rechtsgrundlage: "Art. 6 Abs. 1 lit. b/f DSGVO; Art. 28 DSGVO",
    standort: "Anthropic PBC, USA (direkte Anbindung an die Anthropic-API)",
    drittland: "Drittland USA — EU-Standardvertragsklauseln (Art. 46 DSGVO)",
  },
  {
    name: "Deepgram (Sprachverarbeitung)",
    zweck: "Sprache-zu-Text und Text-zu-Sprache für die Voice-Interviews",
    datenkategorien:
      "Audioaufnahmen der Teilnehmenden (zur Transkription) und die daraus erzeugten Transkripte; vorgelesener Fragetext (Text-zu-Sprache)",
    rechtsgrundlage: "Art. 6 Abs. 1 lit. b/f DSGVO; Art. 28 DSGVO",
    standort: "Deepgram Inc., USA; Verarbeitung über den EU-Endpoint (api.eu.deepgram.com)",
    drittland: "Drittland USA — EU-Standardvertragsklauseln (Art. 46 DSGVO)",
  },
  {
    name: "LiveKit (Echtzeit-Audio)",
    zweck: "Echtzeit-Audioübertragung während der Voice-Interviews",
    datenkategorien: "Audiostream und Verbindungsmetadaten",
    rechtsgrundlage: "Art. 6 Abs. 1 lit. b/f DSGVO; Art. 28 DSGVO",
    standort: "LiveKit Inc., USA; Betrieb über EU-Region",
    drittland: "Drittland USA — EU-Standardvertragsklauseln (Art. 46 DSGVO)",
  },
  {
    name: "Resend (E-Mail-Versand)",
    zweck:
      "Versand transaktionaler E-Mails (Interview-Einladungen, Erinnerungen, Konto- und Service-Benachrichtigungen)",
    datenkategorien:
      "Empfänger-E-Mail-Adresse, Name bzw. Anzeigename und Inhalt der jeweiligen E-Mail (u. a. Einladungslink)",
    rechtsgrundlage: "Art. 6 Abs. 1 lit. b/f DSGVO; Art. 28 DSGVO",
    standort: "Resend, Inc., USA",
    drittland: "Drittland USA — EU-Standardvertragsklauseln (Art. 46 DSGVO)",
  },
];

export default function DatenschutzPage() {
  return (
    <SiteShell>
      <LegalProse
        title="Datenschutzerklärung"
        intro="Informationen zur Verarbeitung personenbezogener Daten gemäß Datenschutz-Grundverordnung (DSGVO) und Bundesdatenschutzgesetz (BDSG)."
        notice={false}
        closing={<LegalStand>{STAND}</LegalStand>}
      >
        <LegalSection heading="1. Verantwortlicher">
          <div className="flex flex-col gap-3">
            <p>Verantwortlicher im Sinne des Art. 4 Nr. 7 DSGVO ist:</p>
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
              <br />
              E-Mail:{" "}
              <a href="mailto:support@klymeo.com" className={CONTACT_LINK}>
                support@klymeo.com
              </a>
              <br />
              Telefon:{" "}
              <a href="tel:+4917621878801" className={CONTACT_LINK}>
                +49 176 21878801
              </a>
            </p>
          </div>
        </LegalSection>

        <LegalSection heading="2. Allgemeine Hinweise und Rechtsgrundlagen">
          <div className="flex flex-col gap-3">
            <p>
              Der Schutz Ihrer personenbezogenen Daten ist uns wichtig. Wir
              verarbeiten personenbezogene Daten ausschließlich im Einklang mit den
              geltenden Datenschutzvorschriften, insbesondere der DSGVO und dem
              BDSG. Personenbezogene Daten sind alle Informationen, die sich auf
              eine identifizierte oder identifizierbare natürliche Person beziehen.
            </p>
            <p>
              Soweit wir personenbezogene Daten verarbeiten, stützen wir uns je
              nach Verarbeitung auf eine der Rechtsgrundlagen des Art. 6 Abs. 1
              DSGVO — insbesondere eine Einwilligung (lit. a), die Erfüllung eines
              Vertrags oder vorvertraglicher Maßnahmen (lit. b), eine rechtliche
              Verpflichtung (lit. c) oder unser berechtigtes Interesse (lit. f). Die
              jeweils einschlägige Rechtsgrundlage wird bei den einzelnen
              Verarbeitungen unten benannt. Wir haben keinen Datenschutzbeauftragten
              bestellt, da keine gesetzliche Pflicht hierzu besteht.
            </p>
          </div>
        </LegalSection>

        <LegalSection heading="3. Hosting und Server-Logfiles">
          <div className="flex flex-col gap-3">
            <p>
              Die Web-Anwendung wird bei Vercel gehostet und über deren EU-Region
              (Frankfurt am Main) ausgeliefert; die Infrastruktur für den
              Authentifizierungsdienst (selbst betriebenes Zitadel) und den
              Voice-Agent wird bei Hetzner in Deutschland betrieben. Beim Aufruf
              unserer Seiten erheben die eingesetzten Server automatisch
              Informationen in sogenannten Server-Logfiles, die Ihr Browser
              automatisch übermittelt: Browsertyp und -version, verwendetes
              Betriebssystem, Referrer-URL, Hostname des zugreifenden Rechners,
              Uhrzeit der Serveranfrage und IP-Adresse. Eine Zusammenführung dieser
              Daten mit anderen Datenquellen wird nicht vorgenommen.
            </p>
            <p>
              Die Erfassung erfolgt auf Grundlage unseres berechtigten Interesses an
              einem technisch fehlerfreien und sicheren Betrieb (Art. 6 Abs. 1 lit.
              f DSGVO). Die Logfiles werden aus Sicherheitsgründen für eine
              begrenzte Zeit gespeichert und anschließend gelöscht; eine Speicherung
              über 30 Tage hinaus erfolgt nur, soweit dies zur Aufklärung eines
              konkreten Sicherheitsvorfalls erforderlich ist.
            </p>
          </div>
        </LegalSection>

        <LegalSection heading="4. SSL-/TLS-Verschlüsselung">
          <p>
            Diese Seite nutzt aus Sicherheitsgründen und zum Schutz der Übertragung
            vertraulicher Inhalte, die Sie an uns als Seitenbetreiber senden, eine
            SSL- bzw. TLS-Verschlüsselung. Eine verschlüsselte Verbindung erkennen
            Sie daran, dass die Adresszeile des Browsers von „http://“ auf
            „https://“ wechselt und an dem Schloss-Symbol in Ihrer Browserzeile.
            Wenn die SSL- bzw. TLS-Verschlüsselung aktiviert ist, können die Daten,
            die Sie an uns übermitteln, nicht von Dritten mitgelesen werden.
          </p>
        </LegalSection>

        <LegalSection heading="5. Cookies und Consent">
          <div className="flex flex-col gap-3">
            <p>
              Wir setzen ausschließlich technisch notwendige sowie funktionale,
              von Ihnen aktiv gewählte Cookies und vergleichbare
              Speichertechnologien ein, die für den Betrieb der Seite, für die
              Anmeldung und für gewählte Einstellungen (z. B. Sprache und
              Darstellung) erforderlich sind (insbesondere Session-Cookies der
              Authentifizierung). Rechtsgrundlage für die technisch notwendigen
              Cookies ist § 25 Abs. 2 TDDDG in Verbindung mit unserem berechtigten
              Interesse an einem funktionsfähigen Angebot (Art. 6 Abs. 1 lit. f
              DSGVO); insoweit ist keine Einwilligung erforderlich. Die funktionalen
              Einstellungs-Cookies (z. B. Sprache und Darstellung) sind
              First-Party-Einträge und dienen nicht Werbe- oder Analysezwecken.
              Einen Einsatz von Analyse- oder Marketing-Cookies bzw.
              Tracking-Diensten nehmen wir derzeit nicht vor. Eine detaillierte
              Übersicht der
              eingesetzten Cookies finden Sie in unserer{" "}
              <Link href="/cookies" className={CONTACT_LINK}>
                Cookie-Richtlinie
              </Link>
              .
            </p>
          </div>
        </LegalSection>

        <LegalSection heading="6. Kontaktaufnahme (E-Mail, Kontaktformular, Demo-Buchung)">
          <div className="flex flex-col gap-3">
            <p>
              Wenn Sie uns per E-Mail, über ein Kontaktformular oder über die
              Buchung eines Demo-Termins kontaktieren, verarbeiten wir die von Ihnen
              mitgeteilten Angaben (z. B. Name, E-Mail-Adresse, Inhalt der Anfrage,
              ggf. Terminwunsch) zur Bearbeitung Ihres Anliegens. Die Demo-Buchung
              wird über den Terminplanungsdienst Cal.com (Cal.com, Inc.; betrieben
              über die EU-Instanz cal.eu) abgewickelt. Rechtsgrundlage ist Art. 6
              Abs. 1 lit. b DSGVO, sofern die Anfrage auf den Abschluss oder die
              Durchführung eines Vertrags gerichtet ist, im Übrigen unser
              berechtigtes Interesse an der Beantwortung von Anfragen (Art. 6 Abs. 1
              lit. f DSGVO). Die Daten werden gelöscht, sobald Ihr Anliegen
              abschließend bearbeitet ist und keine gesetzlichen Aufbewahrungspflichten
              entgegenstehen (siehe Abschnitt 11).
            </p>
          </div>
        </LegalSection>

        <LegalSection heading="7. Nutzerkonten und Authentifizierung (Zitadel)">
          <div className="flex flex-col gap-3">
            <p>
              Für die Registrierung, die Anmeldung und die Verwaltung von
              Nutzerkonten setzen wir den Identitäts- und Anmeldedienst Zitadel ein.
              Zitadel wird von uns selbst auf Server-Infrastruktur der Hetzner Online
              GmbH in Deutschland betrieben; eine Übermittlung der Anmeldedaten an
              einen externen Identitätsdienstleister in einem Drittland findet dabei
              nicht statt. Bei der Anlage und Nutzung eines Kontos werden die hierfür
              erforderlichen Daten verarbeitet — insbesondere Name, E-Mail-Adresse,
              Anmelde- und Authentifizierungsdaten sowie ggf. Kennungen aus einem
              genutzten Single-Sign-on. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO
              (Bereitstellung des Nutzerkontos). Die zur Anmeldung gesetzten
              Sitzungs-Cookies sind First-Party-Cookies unserer eigenen Domain;
              Einzelheiten enthält die{" "}
              <Link href="/cookies" className={CONTACT_LINK}>
                Cookie-Richtlinie
              </Link>
              .
            </p>
          </div>
        </LegalSection>

        <LegalSection heading="8. Verarbeitung im Rahmen der Plattform (Interview- und Teilnehmerdaten)">
          <div className="flex flex-col gap-3">
            <p>
              Über die Plattform führen unsere Kunden (Forscherinnen und Forscher)
              qualitative Interviews durch. Dabei werden Angaben der teilnehmenden
              Personen verarbeitet — je nach Studienart insbesondere Antworttexte,
              bei Voice-Interviews zusätzlich Audioaufnahmen und deren Transkripte
              sowie zugehörige Metadaten (z. B. Zeitstempel und technische
              Sitzungsdaten) und ggf. vom Kunden erhobene Screening- oder
              Kontaktangaben.
            </p>
            <p>
              Diese Daten verarbeiten wir nicht zu eigenen Zwecken, sondern
              weisungsgebunden im Auftrag des jeweiligen Kunden zur Durchführung und
              Auswertung der Studie; insoweit handeln wir als Auftragsverarbeiter im
              Sinne des Art. 28 DSGVO, während der Kunde Verantwortlicher der
              Studiendaten ist. Grundlage ist ein Auftragsverarbeitungsvertrag (AVV)
              zwischen dem Kunden und uns. Die Rechtsgrundlage für die Verarbeitung
              gegenüber den teilnehmenden Personen liegt beim verantwortlichen
              Kunden (regelmäßig Einwilligung nach Art. 6 Abs. 1 lit. a DSGVO bzw.
              berechtigtes Interesse nach lit. f). Über den Einsatz von KI im
              Interview wird vorab transparent aufgeklärt.
            </p>
            <p>
              Die Speicherdauer richtet sich nach der Weisung des verantwortlichen
              Kunden: Der Kunde kann je Studie eine automatische Löschfrist für
              Interview- und Teilnehmerdaten festlegen; ist eine solche Frist
              gesetzt, werden die betreffenden Daten nach ihrem Ablauf automatisiert
              und endgültig gelöscht. Darüber hinaus kann der Kunde einzelne
              Teilnehmerdaten, eine gesamte Studie oder sein Konto jederzeit löschen;
              die Löschung erfolgt als endgültige Entfernung der Daten (einschließlich
              Transkripten und Auswertungen), nicht als bloße Markierung. Im Übrigen
              gilt Abschnitt 11.
            </p>
          </div>
        </LegalSection>

        <LegalSection heading="9. Eingesetzte Auftragsverarbeiter und Dienste">
          <div className="flex flex-col gap-4">
            <p>
              Zur Bereitstellung unseres Angebots setzen wir die folgenden
              Dienstleister ein. Je Eintrag sind Zweck, Datenkategorien,
              Rechtsgrundlage, Serverstandort sowie ein etwaiges Drittland mit
              Standardvertragsklauseln (SCC) angegeben.
            </p>
            <ul className="flex flex-col gap-5">
              {PROCESSORS.map((p) => (
                <li
                  key={p.name}
                  className="flex flex-col gap-1.5 rounded border border-border bg-card/60 px-4 py-3.5"
                >
                  <span className="font-display text-[16px] text-ink">
                    {p.name}
                  </span>
                  <span>
                    <strong className="font-medium text-ink">Zweck:</strong>{" "}
                    {p.zweck}
                  </span>
                  <span>
                    <strong className="font-medium text-ink">
                      Datenkategorien:
                    </strong>{" "}
                    {p.datenkategorien}
                  </span>
                  <span>
                    <strong className="font-medium text-ink">
                      Rechtsgrundlage:
                    </strong>{" "}
                    {p.rechtsgrundlage}
                  </span>
                  <span>
                    <strong className="font-medium text-ink">
                      Serverstandort:
                    </strong>{" "}
                    {p.standort}
                  </span>
                  <span>
                    <strong className="font-medium text-ink">
                      Drittland &amp; SCC:
                    </strong>{" "}
                    {p.drittland}
                  </span>
                </li>
              ))}
            </ul>
            <p>
              Mit den vorstehenden Dienstleistern bestehen, soweit sie
              personenbezogene Daten in unserem Auftrag verarbeiten, Verträge zur
              Auftragsverarbeitung nach Art. 28 DSGVO. Bei Dienstleistern mit Sitz in
              einem Drittland (USA) sind diese um die EU-Standardvertragsklauseln nach
              Art. 46 DSGVO ergänzt.
            </p>
          </div>
        </LegalSection>

        <LegalSection heading="10. Drittlandübermittlung und Standardvertragsklauseln">
          <div className="flex flex-col gap-3">
            <p>
              Soweit wir Daten an Dienstleister in einem Drittland (insbesondere die
              USA) übermitteln, erfolgt dies nur, wenn ein angemessenes
              Datenschutzniveau gewährleistet ist — etwa auf Grundlage eines
              Angemessenheitsbeschlusses, der EU-Standardvertragsklauseln (SCC) nach
              Art. 46 DSGVO oder einer Zertifizierung des Empfängers nach dem EU-US
              Data Privacy Framework (DPF). Die je Dienst einschlägige Grundlage ist
              in der Liste in Abschnitt 9 angegeben. Auf Anfrage stellen wir Ihnen
              Informationen zu den getroffenen Garantien zur Verfügung.
            </p>
          </div>
        </LegalSection>

        <LegalSection heading="11. Speicherdauer und Löschkonzept">
          <div className="flex flex-col gap-3">
            <p>
              Wir verarbeiten und speichern personenbezogene Daten nur so lange, wie
              es für die jeweiligen Zwecke erforderlich ist oder gesetzliche
              Aufbewahrungsfristen es vorsehen. Nach Wegfall des Zwecks bzw. nach
              Ablauf der Fristen werden die Daten routinemäßig gelöscht oder
              anonymisiert. Im Einzelnen:
            </p>
            <ul className="flex list-disc flex-col gap-1.5 pl-5">
              <li>
                Nutzerkonten: bis zur Löschung des Kontos bzw. bis zum Vertragsende,
                danach Löschung vorbehaltlich gesetzlicher Aufbewahrungspflichten;
              </li>
              <li>
                Interview- und Teilnehmerdaten (inkl. Audio und Transkripte): nach
                Weisung des verantwortlichen Kunden, spätestens mit Beendigung des
                jeweiligen Auftragsverhältnisses;
              </li>
              <li>
                Server-Logfiles: kurzfristig, siehe Abschnitt 3;
              </li>
              <li>
                Abrechnungs- und Rechnungsdaten: entsprechend den gesetzlichen
                Aufbewahrungsfristen (§ 257 HGB, § 147 AO — 6 bzw. 10 Jahre);
              </li>
              <li>
                Kontakt- und Terminanfragen: bis zur abschließenden Bearbeitung,
                sofern keine Aufbewahrungspflicht besteht.
              </li>
            </ul>
          </div>
        </LegalSection>

        <LegalSection heading="12. Rechte der betroffenen Personen">
          <div className="flex flex-col gap-3">
            <p>
              Ihnen stehen nach der DSGVO gegenüber dem Verantwortlichen
              insbesondere die folgenden Rechte zu:
            </p>
            <ul className="flex list-disc flex-col gap-1.5 pl-5">
              <li>Recht auf Auskunft (Art. 15 DSGVO);</li>
              <li>Recht auf Berichtigung (Art. 16 DSGVO);</li>
              <li>Recht auf Löschung (Art. 17 DSGVO);</li>
              <li>Recht auf Einschränkung der Verarbeitung (Art. 18 DSGVO);</li>
              <li>Recht auf Datenübertragbarkeit (Art. 20 DSGVO);</li>
              <li>Recht auf Widerspruch gegen die Verarbeitung (Art. 21 DSGVO);</li>
              <li>
                Recht auf Widerruf einer erteilten Einwilligung mit Wirkung für die
                Zukunft (Art. 7 Abs. 3 DSGVO).
              </li>
            </ul>
            <p>
              Zur Ausübung dieser Rechte genügt eine formlose Mitteilung an{" "}
              <a href="mailto:support@klymeo.com" className={CONTACT_LINK}>
                support@klymeo.com
              </a>
              . Bei Daten, die wir im Auftrag eines Kunden verarbeiten (Abschnitt
              8), leiten wir Ihr Anliegen an den verantwortlichen Kunden weiter bzw.
              unterstützen diesen bei der Erfüllung.
            </p>
          </div>
        </LegalSection>

        <LegalSection heading="13. Beschwerderecht bei einer Aufsichtsbehörde">
          <div className="flex flex-col gap-3">
            <p>
              Unbeschadet eines anderweitigen verwaltungsrechtlichen oder
              gerichtlichen Rechtsbehelfs steht Ihnen das Recht zu, sich bei einer
              Datenschutz-Aufsichtsbehörde zu beschweren, insbesondere in dem
              Mitgliedstaat Ihres Aufenthaltsorts, Ihres Arbeitsplatzes oder des
              Orts des mutmaßlichen Verstoßes, wenn Sie der Ansicht sind, dass die
              Verarbeitung Ihrer personenbezogenen Daten gegen die DSGVO verstößt.
            </p>
            <p>
              Die für uns zuständige Aufsichtsbehörde ist die Landesbeauftragte für
              Datenschutz und Informationsfreiheit Nordrhein-Westfalen (LDI NRW),
              Kavalleriestraße 2–4, 40213 Düsseldorf (
              <a
                href="https://www.ldi.nrw.de"
                target="_blank"
                rel="noopener noreferrer"
                className={CONTACT_LINK}
              >
                www.ldi.nrw.de
              </a>
              ).
            </p>
          </div>
        </LegalSection>
      </LegalProse>
    </SiteShell>
  );
}
