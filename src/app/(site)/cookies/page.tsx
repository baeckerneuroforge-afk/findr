// Cookie-Richtlinie — die Cookie-/Storage-Liste ist aus dem tatsächlichen Code
// abgeleitet: First-Party-Anmelde-Cookies der selbst betriebenen
// Authentifizierung (NextAuth/Auth.js + Zitadel), zwei funktionale Einträge
// (Sprache, Darstellung) sowie ein nur während Voice-Interviews genutzter
// Eintrag. Keine Analyse-, Marketing- oder Tracking-Cookies. Die genauen
// Cookie-Namen tragen im Produktivbetrieb (HTTPS) die Präfixe __Secure-/__Host-.
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
  title: { absolute: "Cookie-Richtlinie — Klymeo" },
  description:
    "Welche Cookies und Speichertechnologien Klymeo einsetzt, zu welchem Zweck und auf welcher Rechtsgrundlage.",
  alternates: { canonical: "/cookies" },
  openGraph: {
    ...ogDefaults,
    title: "Cookie-Richtlinie — Klymeo",
    description:
      "Welche Cookies und Speichertechnologien Klymeo einsetzt, zu welchem Zweck und auf welcher Rechtsgrundlage.",
    url: "/cookies",
  },
};

const CONTACT_LINK =
  "text-ink underline underline-offset-2 transition-colors hover:text-ink/70";

/* Eingesetzte Cookies / Speichertechnologien (Abschnitt 5). Pro Eintrag die
   Pflichtfelder einer rechtssicheren Cookie-Tabelle: Anbieter / Typ / Kategorie /
   Zweck / Speicherdauer / Herkunft (First- oder Third-Party). Die Liste ist aus
   dem tatsächlichen Anwendungs-Code abgeleitet: technisch notwendige
   First-Party-Cookies der selbst betriebenen Authentifizierung (NextAuth/Auth.js
   mit Zitadel), zwei funktionale, vom Nutzer aktiv gewählte First-Party-Einträge
   (Sprache, Darstellung) sowie ein nur während eines Voice-Interviews genutzter
   Eintrag. KEINE Analyse-, Marketing- oder Tracking-Cookies. Im Produktivbetrieb
   (HTTPS) tragen die Auth.js-Cookies die Sicherheits-Präfixe __Secure-/__Host-. */
const COOKIES: {
  name: string;
  anbieter: string;
  typ: string;
  kategorie: string;
  zweck: string;
  dauer: string;
  herkunft: string;
}[] = [
  {
    name: "__Secure-authjs.session-token",
    anbieter: "Klymeo (eigene Authentifizierung)",
    typ: "HTTP-Cookie (HttpOnly, Secure)",
    kategorie: "Technisch notwendig",
    zweck:
      "Trägt die aktive Anmeldung (signiertes Session-Token) im eingeloggten Bereich. Ohne dieses Cookie ist die Nutzung des angemeldeten Dashboards nicht möglich.",
    dauer: "bis zu 30 Tage (rollierend erneuert)",
    herkunft: "First-Party",
  },
  {
    name: "__Host-authjs.csrf-token",
    anbieter: "Klymeo (eigene Authentifizierung)",
    typ: "HTTP-Cookie (HttpOnly, Secure)",
    kategorie: "Technisch notwendig",
    zweck:
      "Schützt den Anmelde- und Formularvorgang vor Cross-Site-Request-Forgery (CSRF).",
    dauer: "Sitzung",
    herkunft: "First-Party",
  },
  {
    name: "__Secure-authjs.callback-url",
    anbieter: "Klymeo (eigene Authentifizierung)",
    typ: "HTTP-Cookie",
    kategorie: "Technisch notwendig",
    zweck:
      "Merkt sich während der Anmeldung die Zielseite, auf die nach dem erfolgreichen Login zurückgeleitet wird.",
    dauer: "Sitzung",
    herkunft: "First-Party",
  },
  {
    name: "__Secure-authjs.pkce.code_verifier, __Secure-authjs.state, __Secure-authjs.nonce",
    anbieter: "Klymeo / Zitadel-Anmeldung",
    typ: "HTTP-Cookie (HttpOnly, transient)",
    kategorie: "Technisch notwendig",
    zweck:
      "Sichern den OpenID-Connect-Anmelde-Handshake mit dem Identitätsdienst Zitadel (PKCE, State- und Nonce-Prüfung gegen Angriffe); werden unmittelbar nach der Anmeldung wieder gelöscht.",
    dauer: "wenige Minuten",
    herkunft: "First-Party",
  },
  {
    name: "klymeo.locale",
    anbieter: "Klymeo",
    typ: "HTTP-Cookie",
    kategorie: "Funktional",
    zweck:
      "Speichert die von Ihnen gewählte Sprache der Oberfläche (Deutsch/Englisch).",
    dauer: "1 Jahr",
    herkunft: "First-Party",
  },
  {
    name: "klymeo-theme",
    anbieter: "Klymeo",
    typ: "Local Storage",
    kategorie: "Funktional",
    zweck:
      "Speichert die gewählte Darstellung (hell/dunkel/Systemvorgabe), damit die Oberfläche beim Laden nicht aufblitzt. Es werden keine personenbezogenen Daten gespeichert.",
    dauer: "dauerhaft, bis Sie den Browser-Speicher leeren",
    herkunft: "First-Party",
  },
  {
    name: "LiveKit (Sitzungsspeicher)",
    anbieter: "LiveKit (LiveKit Inc.)",
    typ: "Local Storage",
    kategorie: "Technisch notwendig (nur Voice-Interview)",
    zweck:
      "Wird ausschließlich während eines Voice-Interviews verwendet; die eingesetzte Bibliothek bereinigt lediglich einen früheren Eintrag und speichert selbst keinen dauerhaften Wert.",
    dauer: "nicht dauerhaft (nur Bereinigung)",
    herkunft: "First-Party",
  },
];

export default function CookiesPage() {
  return (
    <SiteShell>
      <LegalProse
        title="Cookie-Richtlinie"
        intro="Diese Cookie-Richtlinie erläutert, welche Cookies und vergleichbaren Speichertechnologien Klymeo einsetzt, zu welchem Zweck und auf welcher Rechtsgrundlage. Sie ergänzt unsere Datenschutzerklärung."
        notice={false}
        closing={<LegalStand>{STAND}</LegalStand>}
      >
        <LegalSection heading="1. Was sind Cookies und vergleichbare Technologien?">
          <div className="flex flex-col gap-3">
            <p>
              Cookies sind kleine Textdateien, die beim Besuch einer Website auf
              Ihrem Endgerät gespeichert werden. Vergleichbare Technologien wie der
              lokale Speicher (Local Storage), der Sitzungsspeicher (Session
              Storage), Pixel oder Browser-Fingerprinting erfüllen ähnliche Zwecke.
              Das deutsche Recht (§ 25 TDDDG) ist technologieneutral und erfasst
              jede Speicherung von Informationen auf Ihrem Endgerät und jeden
              Zugriff auf bereits dort gespeicherte Informationen — unabhängig von
              der konkreten Technik. Wir verwenden in dieser Richtlinie den Begriff
              „Cookies“ daher stellvertretend für alle diese Techniken.
            </p>
            <p>
              Man unterscheidet First-Party-Cookies, die von der besuchten Website
              selbst gesetzt werden, und Third-Party-Cookies, die von
              eingebundenen Drittanbietern stammen. Klymeo setzt — wie in der
              Tabelle in Abschnitt 5 aufgeführt — ausschließlich
              First-Party-Einträge.
            </p>
          </div>
        </LegalSection>

        <LegalSection heading="2. Verantwortlicher">
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
            <p>
              Allgemeine Informationen zur Verarbeitung personenbezogener Daten
              enthält unsere{" "}
              <Link href="/datenschutz" className={CONTACT_LINK}>
                Datenschutzerklärung
              </Link>
              .
            </p>
          </div>
        </LegalSection>

        <LegalSection heading="3. Rechtsgrundlagen">
          <div className="flex flex-col gap-3">
            <p>
              Der Einsatz von Cookies wird rechtlich auf zwei Ebenen beurteilt.
              Auf der ersten Ebene regelt § 25 TDDDG das Speichern von
              Informationen auf Ihrem Endgerät und den Zugriff darauf: Für
              technisch nicht notwendige Cookies ist grundsätzlich Ihre
              Einwilligung erforderlich (§ 25 Abs. 1 TDDDG), während technisch
              unbedingt erforderliche Cookies einwilligungsfrei zulässig sind
              (§ 25 Abs. 2 Nr. 2 TDDDG). Auf der zweiten Ebene benötigt die
              anschließende Verarbeitung personenbezogener Daten eine
              Rechtsgrundlage nach Art. 6 Abs. 1 DSGVO — bei technisch notwendigen
              Cookies regelmäßig unser berechtigtes Interesse an einem
              funktionsfähigen, sicheren Angebot bzw. die Vertragserfüllung (lit. f
              bzw. lit. b), bei einwilligungspflichtigen Cookies Ihre Einwilligung
              (lit. a).
            </p>
            <p>
              Klymeo setzt derzeit ausschließlich technisch notwendige sowie
              funktionale, von Ihnen aktiv gewählte First-Party-Cookies ein (siehe
              Abschnitt 5) und betreibt keine Analyse-, Marketing- oder
              Tracking-Dienste. Vor diesem Hintergrund ist derzeit kein
              einwilligungsbasiertes Cookie-Banner erforderlich. Die funktionalen
              Einstellungs-Cookies (Sprache, Darstellung) werden ausschließlich nach
              Ihrer aktiven Auswahl gesetzt und dienen nicht Werbe- oder
              Analysezwecken.
            </p>
          </div>
        </LegalSection>

        <LegalSection heading="4. Cookie-Kategorien">
          <div className="flex flex-col gap-3">
            <p>
              Cookies lassen sich nach ihrem Zweck in vier Kategorien einteilen.
              Maßgeblich für die Einwilligungspflicht ist nicht die Bezeichnung,
              sondern die Funktion:
            </p>
            <ul className="flex list-disc flex-col gap-1.5 pl-5">
              <li>
                <strong className="font-medium text-ink">
                  Technisch notwendige Cookies
                </strong>{" "}
                halten den von Ihnen gewünschten Dienst am Laufen (z. B. Anmeldung,
                Sitzung, Sicherheit). Sie sind regelmäßig einwilligungsfrei, soweit
                sie für die Erbringung des von Ihnen ausdrücklich gewünschten
                Dienstes unbedingt erforderlich sind (§ 25 Abs. 2 Nr. 2 TDDDG).
              </li>
              <li>
                <strong className="font-medium text-ink">
                  Funktionale Cookies
                </strong>{" "}
                speichern von Ihnen gewählte Einstellungen (z. B. Sprache,
                Darstellung) und erhöhen den Komfort.
              </li>
              <li>
                <strong className="font-medium text-ink">
                  Statistik-/Analyse-Cookies
                </strong>{" "}
                messen die Nutzung der Website. Sie sind einwilligungspflichtig.
                <em> Bei Klymeo nicht im Einsatz.</em>
              </li>
              <li>
                <strong className="font-medium text-ink">
                  Marketing-/Tracking-Cookies
                </strong>{" "}
                dienen Werbung und der seitenübergreifenden Wiedererkennung. Sie
                sind stets einwilligungspflichtig.
                <em> Bei Klymeo nicht im Einsatz.</em>
              </li>
            </ul>
            <p>
              Klymeo verwendet derzeit ausschließlich Cookies der ersten beiden
              Kategorien.
            </p>
          </div>
        </LegalSection>

        <LegalSection heading="5. Eingesetzte Cookies und Speichertechnologien">
          <div className="flex flex-col gap-4">
            <p>
              Die folgende Übersicht listet die tatsächlich eingesetzten Cookies
              und vergleichbaren Speichertechnologien. Je Eintrag sind Anbieter,
              Typ, Kategorie, Zweck, Speicherdauer und Herkunft (First- oder
              Third-Party) angegeben.
            </p>
            <ul className="flex flex-col gap-5">
              {COOKIES.map((c) => (
                <li
                  key={c.name}
                  className="flex flex-col gap-1.5 rounded border border-border bg-card/60 px-4 py-3.5"
                >
                  <span className="font-mono text-[14px] font-semibold text-ink">
                    {c.name}
                  </span>
                  <span>
                    <strong className="font-medium text-ink">
                      Anbieter:
                    </strong>{" "}
                    {c.anbieter}
                  </span>
                  <span>
                    <strong className="font-medium text-ink">Typ:</strong>{" "}
                    {c.typ}
                  </span>
                  <span>
                    <strong className="font-medium text-ink">
                      Kategorie:
                    </strong>{" "}
                    {c.kategorie}
                  </span>
                  <span>
                    <strong className="font-medium text-ink">
                      Zweck:
                    </strong>{" "}
                    {c.zweck}
                  </span>
                  <span>
                    <strong className="font-medium text-ink">
                      Speicherdauer:
                    </strong>{" "}
                    {c.dauer}
                  </span>
                  <span>
                    <strong className="font-medium text-ink">
                      Herkunft:
                    </strong>{" "}
                    {c.herkunft}
                  </span>
                </li>
              ))}
            </ul>
            <p>
              Hinweis: Im verschlüsselten Produktivbetrieb (HTTPS) werden die
              Auth.js-Cookies mit den Sicherheits-Präfixen <code>__Secure-</code>
              bzw. <code>__Host-</code> gesetzt. In einer lokalen
              Entwicklungsumgebung ohne HTTPS entfallen diese Präfixe (z. B.{" "}
              <code>authjs.session-token</code>). Die genannten Anmelde-Cookies
              dienen ausschließlich der Authentifizierung des von Ihnen ausdrücklich
              gewünschten, angemeldeten Dienstes und sind daher technisch notwendig
              und einwilligungsfrei (§ 25 Abs. 2 Nr. 2 TDDDG).
            </p>
          </div>
        </LegalSection>

        <LegalSection heading="6. Drittanbieter und Empfänger">
          <div className="flex flex-col gap-3">
            <p>
              Es werden keine Cookies von Drittanbietern in Ihrem Browser gesetzt.
              Die Anmelde-Cookies stammen aus unserer eigenen, selbst betriebenen
              Authentifizierung (NextAuth/Auth.js mit dem von uns betriebenen
              Identitätsdienst Zitadel) und sind First-Party-Einträge unserer
              eigenen Domain.
            </p>
            <p>
              Die übrigen von uns eingesetzten Dienste (u. a. Datenbank,
              KI-Auswertung, E-Mail-Versand, Sprachverarbeitung) arbeiten
              ausschließlich serverseitig und setzen keine Cookies in Ihrem
              Browser. Eine vollständige Aufstellung dieser Auftragsverarbeiter
              mit Zweck, Standort und Rechtsgrundlage finden Sie in unserer{" "}
              <Link href="/datenschutz" className={CONTACT_LINK}>
                Datenschutzerklärung
              </Link>
              .
            </p>
            <p>
              Die Buchung eines Demo-Termins über Cal.com erfolgt über einen
              externen Link; auf den Seiten von Klymeo wird dabei kein
              Drittanbieter-Cookie gesetzt. Eingesetzte Schriftarten werden lokal
              ausgeliefert; es besteht keine Verbindung zu einem Schriften-Netzwerk
              (CDN) eines Drittanbieters.
            </p>
          </div>
        </LegalSection>

        <LegalSection heading="7. Übermittlung in Drittländer">
          <div className="flex flex-col gap-3">
            <p>
              Durch die in dieser Cookie-Richtlinie genannten Cookies und
              Speichertechnologien findet keine Übermittlung personenbezogener Daten
              in ein Drittland statt: Die Anmelde-Cookies werden durch unsere eigene,
              in Deutschland betriebene Authentifizierung gesetzt; die funktionalen
              Einträge sowie der Voice-Eintrag sind ebenfalls First-Party. Soweit wir
              im Rahmen des Plattformbetriebs serverseitig Dienstleister mit Sitz in
              einem Drittland einsetzen (z. B. USA), ist dies samt der getroffenen
              Garantien (insbesondere EU-Standardvertragsklauseln) in unserer{" "}
              <Link href="/datenschutz" className={CONTACT_LINK}>
                Datenschutzerklärung
              </Link>{" "}
              dargestellt.
            </p>
          </div>
        </LegalSection>

        <LegalSection heading="8. Widerruf und Verwaltung Ihrer Einstellungen">
          <div className="flex flex-col gap-3">
            <p>
              Da Klymeo derzeit nur technisch notwendige und funktionale Cookies
              einsetzt, ist keine Einwilligung zu widerrufen. Sie können gesetzte
              Cookies und gespeicherte Inhalte jederzeit über die Einstellungen
              Ihres Browsers einsehen, einschränken oder löschen (z. B. durch
              Löschen der Website-Daten). Bitte beachten Sie, dass das Löschen der
              technisch notwendigen Anmelde-Cookies dazu führt, dass Sie aus dem
              angemeldeten Bereich abgemeldet werden.
            </p>
            <p>
              Sollten künftig einwilligungspflichtige Cookies (z. B. zu Analyse-
              oder Marketingzwecken) hinzukommen, holen wir Ihre Einwilligung
              vorab über ein Consent-Banner ein und stellen einen dauerhaft
              erreichbaren Weg bereit, mit dem Sie Ihre Auswahl jederzeit
              granular ändern und mit Wirkung für die Zukunft widerrufen können —
              so einfach, wie Sie sie erteilt haben.
            </p>
          </div>
        </LegalSection>

        <LegalSection heading="9. Änderungen dieser Cookie-Richtlinie">
          <div className="flex flex-col gap-3">
            <p>
              Wir passen diese Cookie-Richtlinie an, wenn sich die eingesetzten
              Technologien oder die rechtlichen Rahmenbedingungen ändern. Es gilt
              jeweils die hier veröffentlichte, mit einem Stand versehene Fassung.
              Den aktuellen Stand finden Sie am Ende dieser Seite.
            </p>
          </div>
        </LegalSection>
      </LegalProse>
    </SiteShell>
  );
}
