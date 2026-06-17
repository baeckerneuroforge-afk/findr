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

const PATH = "/datenschutz";
const META = {
  title: { de: "Datenschutz", en: "Privacy" },
  ogTitle: { de: "Datenschutz — Klymeo", en: "Privacy — Klymeo" },
  description: {
    de: "Informationen zur Verarbeitung personenbezogener Daten bei Klymeo gemäß DSGVO.",
    en: "How Klymeo processes personal data in line with the GDPR.",
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
  "text-primary-700 underline underline-offset-2 transition-colors hover:text-primary-900";

/* Gerüst der Datenschutzerklärung: vollständige DSGVO-Abschnittsstruktur, der
   verbindliche Rechtstext wird je Abschnitt über einen Datenschutz-Generator
   bzw. die Rechtsberatung eingesetzt. Bis dahin bewusst KEIN halluzinierter
   Datenschutztext (nichts darf als echte Zusicherung lesbar sein). */
export default async function DatenschutzPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  return (
    <LegalProse
      title="Datenschutzerklärung"
      intro="Informationen zur Verarbeitung personenbezogener Daten gemäß Datenschutz-Grundverordnung (DSGVO) und Bundesdatenschutzgesetz (BDSG)."
      stand="Juni 2026"
      lang={resolveLocale(lang)}
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
          <Placeholder>
            Rechtstext über Datenschutz-Generator/Anwalt einsetzen
          </Placeholder>
        </div>
      </LegalSection>

      <LegalSection heading="2. Hosting">
        <Placeholder>
          Rechtstext über Datenschutz-Generator/Anwalt einsetzen
        </Placeholder>
      </LegalSection>

      <LegalSection heading="3. Datenerfassung beim Besuch der Website (Server-Logfiles)">
        <Placeholder>
          Rechtstext über Datenschutz-Generator/Anwalt einsetzen
        </Placeholder>
      </LegalSection>

      <LegalSection heading="4. Cookies und lokale Speicherung">
        <Placeholder>
          Rechtstext über Datenschutz-Generator/Anwalt einsetzen
        </Placeholder>
      </LegalSection>

      <LegalSection heading="5. Auftragsverarbeiter und eingesetzte Drittdienste">
        {/*
          Eingabe für den späteren Rechtstext — eingesetzte Dienste
          (Zweck / Anbieter / Ort):
          - Clerk — Authentifizierung/Login — Clerk Inc., USA (Standardvertragsklauseln)
          - Supabase — Datenbank, Speicherung der Nutzdaten — EU-Region
          - Vercel — Hosting der Website
          - Hetzner — Server für den Voice-Agent — Deutschland/EU
          - Deepgram — Speech-to-Text und Text-to-Speech — EU-Endpoint
          - Anthropic via AWS Bedrock — KI-Verarbeitung der Gespräche — EU-Region
          - LiveKit — Echtzeit-Audioübertragung
          - Stripe — Zahlungsabwicklung
        */}
        <Placeholder>
          Rechtstext über Datenschutz-Generator/Anwalt einsetzen
        </Placeholder>
      </LegalSection>

      <LegalSection heading="6. Verarbeitung von Interview- und Teilnehmerdaten">
        <Placeholder>
          Rechtstext über Datenschutz-Generator/Anwalt einsetzen
        </Placeholder>
      </LegalSection>

      <LegalSection heading="7. Rechtsgrundlagen der Verarbeitung (Art. 6 DSGVO)">
        <Placeholder>
          Rechtstext über Datenschutz-Generator/Anwalt einsetzen
        </Placeholder>
      </LegalSection>

      <LegalSection heading="8. Speicherdauer und Löschung">
        <Placeholder>
          Rechtstext über Datenschutz-Generator/Anwalt einsetzen
        </Placeholder>
      </LegalSection>

      <LegalSection heading="9. Rechte der betroffenen Personen">
        <Placeholder>
          Rechtstext über Datenschutz-Generator/Anwalt einsetzen
        </Placeholder>
      </LegalSection>

      <LegalSection heading="10. Beschwerderecht bei der Aufsichtsbehörde">
        <Placeholder>
          Rechtstext über Datenschutz-Generator/Anwalt einsetzen
        </Placeholder>
      </LegalSection>

      <LegalSection heading="11. SSL-/TLS-Verschlüsselung">
        <Placeholder>
          Rechtstext über Datenschutz-Generator/Anwalt einsetzen
        </Placeholder>
      </LegalSection>
    </LegalProse>
  );
}
