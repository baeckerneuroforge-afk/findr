// ENTWURF, KEINE RECHTSBERATUNG. Vor dem Launch über den eRecht24-
// Datenschutz-Generator bzw. einen Anwalt finalisieren. Alle mit {{ }}
// markierten Platzhalter müssen ersetzt und juristisch geprüft werden.
import type { Metadata } from "next";
import Link from "next/link";
import {
  LegalProse,
  LegalSection,
  LegalStand,
  LegalTodo,
} from "@/components/marketing/LegalProse";
import { ogDefaultsFor, buildAlternates } from "@/lib/marketing/seo";
import {
  localizedContent,
  localizePath,
  resolveLocale,
} from "@/i18n/marketing-locale";

const PATH = "/cookies";
const STAND = "Juni 2026 (Entwurf)";
const META = {
  title: { de: "Cookie-Richtlinie", en: "Cookie Policy" },
  ogTitle: { de: "Cookie-Richtlinie — Klymeo", en: "Cookie Policy — Klymeo" },
  description: {
    de: "Welche Cookies und Speichertechnologien Klymeo einsetzt, zu welchem Zweck und auf welcher Rechtsgrundlage.",
    en: "Which cookies and storage technologies Klymeo uses, for what purpose and on what legal basis.",
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

const CONTACT_LINK =
  "text-neutral-900 underline underline-offset-2 transition-colors hover:text-neutral-700";

/* Eingesetzte Cookies / Speichertechnologien (Abschnitt 5). Pro Eintrag die
   Pflichtfelder einer rechtssicheren Cookie-Tabelle: Anbieter / Typ / Kategorie /
   Zweck / Speicherdauer / Herkunft (First- oder Third-Party). Die Liste ist als
   belastbarer Entwurf aus dem tatsächlichen Anwendungs-Code abgeleitet:
   ausschließlich technisch notwendige (Authentifizierung/Clerk, Voice/LiveKit)
   sowie zwei funktionale, vom Nutzer aktiv gewählte First-Party-Einträge
   (Sprache, Darstellung). KEINE Analyse-, Marketing- oder Tracking-Cookies. Die
   konkreten Cookie-Namen, Flags und Laufzeiten von Clerk werden zur Laufzeit von
   der jeweiligen Clerk-Instanz bestimmt und sind an der Live-Instanz final zu
   bestätigen (siehe Hinweis unter der Tabelle). */
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
    name: "__session",
    anbieter: "Clerk (Clerk Inc.)",
    typ: "HTTP-Cookie (HttpOnly)",
    kategorie: "Technisch notwendig",
    zweck:
      "Trägt die aktive Anmeldung (Session-Token) im eingeloggten Bereich. Ohne dieses Cookie ist die Nutzung des angemeldeten Dashboards nicht möglich.",
    dauer: "Sitzung / kurzlebig (laufend erneuert)",
    herkunft: "First-Party",
  },
  {
    name: "__client, __client_uat",
    anbieter: "Clerk (Clerk Inc.)",
    typ: "HTTP-Cookie",
    kategorie: "Technisch notwendig",
    zweck:
      "Langlebige Client-/Gerätekennung und Hinweis auf den Anmeldestatus; stützt die Erneuerung des Session-Tokens und vermeidet fehlerhafte Weiterleitungen.",
    dauer: "__client langlebig; __client_uat bis zu 1 Jahr",
    herkunft: "First-Party",
  },
  {
    name: "__clerk_db_jwt",
    anbieter: "Clerk (Clerk Inc.)",
    typ: "HTTP-Cookie",
    kategorie: "Technisch notwendig",
    zweck:
      "Geräte-/Client-Identität, die das Session-Handling ohne Drittanbieter-Cookies ermöglicht.",
    dauer: "rund eine Woche (rotierend)",
    herkunft: "First-Party",
  },
  {
    name: "__refresh",
    anbieter: "Clerk (Clerk Inc.)",
    typ: "HTTP-Cookie (HttpOnly)",
    kategorie: "Technisch notwendig",
    zweck:
      "Erneuert das kurzlebige Session-Token, ohne dass eine erneute Anmeldung erforderlich ist.",
    dauer: "langlebig (Dauer der Sitzung)",
    herkunft: "First-Party",
  },
  {
    name: "__clerk_handshake, __clerk_redirect_count",
    anbieter: "Clerk (Clerk Inc.)",
    typ: "HTTP-Cookie (transient)",
    kategorie: "Technisch notwendig",
    zweck:
      "Steuern den Anmelde- und Token-Handshake und schützen vor Weiterleitungsschleifen; werden unmittelbar nach dem Vorgang wieder gelöscht.",
    dauer: "wenige Sekunden",
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

export default async function CookiesPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const locale = resolveLocale(lang);
  return (
    <LegalProse
      title="Cookie-Richtlinie"
      intro="Diese Cookie-Richtlinie erläutert, welche Cookies und vergleichbaren Speichertechnologien Klymeo einsetzt, zu welchem Zweck und auf welcher Rechtsgrundlage. Sie ergänzt unsere Datenschutzerklärung."
      lang={locale}
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
            <Link
              href={localizePath(locale, "/datenschutz")}
              className={CONTACT_LINK}
            >
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
            Tracking-Dienste. Vor diesem Hintergrund gehen wir davon aus, dass
            derzeit kein einwilligungsbasiertes Cookie-Banner erforderlich ist;
            dies bestätigen wir vor dem Live-Gang.{" "}
            <LegalTodo>
              vor dem Live-Gang bestätigen, dass ausschließlich technisch
              notwendige bzw. einwilligungsfreie Cookies eingesetzt werden, und
              die Einordnung der funktionalen Cookies (Sprache, Darstellung) als
              einwilligungsfrei prüfen — andernfalls ist ein
              einwilligungsbasiertes Consent-Banner (§ 25 Abs. 1 TDDDG)
              erforderlich
            </LegalTodo>
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
              <strong className="font-medium text-neutral-700">
                Technisch notwendige Cookies
              </strong>{" "}
              halten den von Ihnen gewünschten Dienst am Laufen (z. B. Anmeldung,
              Sitzung, Sicherheit). Sie sind regelmäßig einwilligungsfrei, soweit
              sie für die Erbringung des von Ihnen ausdrücklich gewünschten
              Dienstes unbedingt erforderlich sind (§ 25 Abs. 2 Nr. 2 TDDDG).
            </li>
            <li>
              <strong className="font-medium text-neutral-700">
                Funktionale Cookies
              </strong>{" "}
              speichern von Ihnen gewählte Einstellungen (z. B. Sprache,
              Darstellung) und erhöhen den Komfort.
            </li>
            <li>
              <strong className="font-medium text-neutral-700">
                Statistik-/Analyse-Cookies
              </strong>{" "}
              messen die Nutzung der Website. Sie sind einwilligungspflichtig.
              <em> Bei Klymeo nicht im Einsatz.</em>
            </li>
            <li>
              <strong className="font-medium text-neutral-700">
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
                className="flex flex-col gap-1.5 rounded border border-neutral-200 bg-neutral-50/60 px-4 py-3.5"
              >
                <span className="font-mono text-[14px] font-semibold text-neutral-900">
                  {c.name}
                </span>
                <span>
                  <strong className="font-medium text-neutral-700">
                    Anbieter:
                  </strong>{" "}
                  {c.anbieter}
                </span>
                <span>
                  <strong className="font-medium text-neutral-700">Typ:</strong>{" "}
                  {c.typ}
                </span>
                <span>
                  <strong className="font-medium text-neutral-700">
                    Kategorie:
                  </strong>{" "}
                  {c.kategorie}
                </span>
                <span>
                  <strong className="font-medium text-neutral-700">
                    Zweck:
                  </strong>{" "}
                  {c.zweck}
                </span>
                <span>
                  <strong className="font-medium text-neutral-700">
                    Speicherdauer:
                  </strong>{" "}
                  {c.dauer}
                </span>
                <span>
                  <strong className="font-medium text-neutral-700">
                    Herkunft:
                  </strong>{" "}
                  {c.herkunft}
                </span>
              </li>
            ))}
          </ul>
          <p>
            <LegalTodo>
              die konkreten Cookie-Namen, Flags und Speicherdauern von Clerk an
              der Live-Instanz (Browser-Entwicklertools) verifizieren; bei einem
              Wechsel auf eine Clerk-Produktivinstanz ändert sich der
              Cookie-Satz (z. B. entfällt __clerk_db_jwt) und die Tabelle ist
              nachzuziehen
            </LegalTodo>
          </p>
          <p>
            <LegalTodo>
              die Einordnung der langlebigen Authentifizierungs- und
              Client-Cookies (insbesondere __client / __client_uat mit Laufzeit
              bis zu einem Jahr sowie __refresh) als „technisch notwendig“ und
              damit einwilligungsfrei anwaltlich bestätigen — maßgeblich ist, ob
              sie ausschließlich der Authentifizierung des ausdrücklich
              gewünschten Dienstes dienen und in der Laufzeit angemessen begrenzt
              sind
            </LegalTodo>
          </p>
        </div>
      </LegalSection>

      <LegalSection heading="6. Drittanbieter und Empfänger">
        <div className="flex flex-col gap-3">
          <p>
            Browserseitig relevant ist allein der Authentifizierungsdienst Clerk
            (Clerk Inc., USA), der die in Abschnitt 5 genannten Anmelde-Cookies
            im eingeloggten Bereich setzt. Hinweise zum Umgang mit Daten finden
            Sie in der{" "}
            <a
              href="https://clerk.com/legal/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className={CONTACT_LINK}
            >
              Datenschutzerklärung von Clerk
            </a>
            .
          </p>
          <p>
            Die übrigen von uns eingesetzten Dienste (u. a. Datenbank,
            KI-Auswertung, E-Mail-Versand, Sprachverarbeitung) arbeiten
            ausschließlich serverseitig und setzen keine Cookies in Ihrem
            Browser. Eine vollständige Aufstellung dieser Auftragsverarbeiter
            mit Zweck, Standort und Rechtsgrundlage finden Sie in unserer{" "}
            <Link
              href={localizePath(locale, "/datenschutz")}
              className={CONTACT_LINK}
            >
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
            Der Anbieter der Anmelde-Cookies, Clerk Inc., hat seinen Sitz in den
            USA. Soweit hierbei personenbezogene Daten in die USA übermittelt
            werden, erfolgt dies auf Grundlage geeigneter Garantien — etwa der
            EU-Standardvertragsklauseln (Art. 46 DSGVO) oder einer Zertifizierung
            nach dem EU-US Data Privacy Framework (DPF). Einzelheiten zu den
            eingesetzten Diensten und ihren Garantien enthält die{" "}
            <Link
              href={localizePath(locale, "/datenschutz")}
              className={CONTACT_LINK}
            >
              Datenschutzerklärung
            </Link>
            .{" "}
            <LegalTodo>
              den konkreten Drittland-/SCC-/DPF-Status von Clerk anhand des
              Auftragsverarbeitungsvertrags bestätigen
            </LegalTodo>
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
            so einfach, wie Sie sie erteilt haben.{" "}
            <LegalTodo>
              sobald einwilligungspflichtige Cookies eingeführt werden: ein
              Consent-Management-Tool mit gleichwertigen „Akzeptieren“-/
              „Ablehnen“-Optionen, granularer Auswahl, vorheriger Blockierung
              und einem dauerhaft sichtbaren Widerrufs-/Einstellungslink
              einbinden
            </LegalTodo>
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
  );
}
