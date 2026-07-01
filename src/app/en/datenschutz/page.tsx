// Privacy Policy — full English translation of src/app/(site)/datenschutz/page.tsx.
// Faithful, complete translation (not a summary); German is the legally
// authoritative version (see LegalLanguageNotice, rendered via lang="en" on
// LegalProse below). Same two open items as the German original: the
// AVV/DPA contracts with the US-based processors should be finalized, and
// the text should get one attorney read-through (see project memory) — that
// applies equally to this translation once the German original is revised.
import type { Metadata } from "next";
import Link from "next/link";
import {
  LegalProse,
  LegalSection,
  LegalStand,
} from "@/components/site/LegalProse";
import { SiteShell } from "@/components/site/SiteShell";
import { buildAlternates, ogDefaultsFor } from "@/lib/marketing/seo";

const STAND = "June 2026";

export const metadata: Metadata = {
  title: { absolute: "Privacy Policy — Klymeo" },
  description:
    "Information on the processing of personal data at Klymeo pursuant to the GDPR.",
  alternates: buildAlternates("en", "/datenschutz"),
  openGraph: {
    ...ogDefaultsFor("en"),
    title: "Privacy Policy — Klymeo",
    description:
      "Information on the processing of personal data at Klymeo pursuant to the GDPR.",
    url: "/datenschutz",
  },
};

const CONTACT_LINK =
  "text-ink underline underline-offset-2 transition-colors hover:text-ink/70";

const PROCESSORS: {
  name: string;
  zweck: string;
  datenkategorien: string;
  rechtsgrundlage: string;
  standort: string;
  drittland: string;
}[] = [
  {
    name: "Supabase (PostgreSQL database)",
    zweck: "Database and storage of platform, account, and study data",
    datenkategorien:
      "Account, study, and interview data stored in the application (response texts, transcripts, contact and screening information)",
    rechtsgrundlage:
      "Art. 6(1)(b)/(f) GDPR; for study data, Art. 28 GDPR (data processing agreement)",
    standort: "Supabase — EU region (Frankfurt am Main, eu-central-1)",
    drittland: "no third country (EU)",
  },
  {
    name: "Hetzner (Authentication & Voice Agent)",
    zweck:
      "Server infrastructure for the self-hosted authentication service (Zitadel) and for the voice agent used in voice interviews",
    datenkategorien:
      "Login and authentication data of user accounts; connection and session data processed during voice interviews",
    rechtsgrundlage: "Art. 6(1)(b)/(f) GDPR; Art. 28 GDPR",
    standort: "Hetzner Online GmbH, Germany",
    drittland: "no third country (EU)",
  },
  {
    name: "Vercel (Hosting)",
    zweck: "Hosting and delivery of the web application",
    datenkategorien: "Connection data and server log files (including IP address)",
    rechtsgrundlage: "Art. 6(1)(f) GDPR (secure, error-free operation)",
    standort: "Vercel Inc., USA; delivery via EU region (Frankfurt am Main)",
    drittland: "Third country USA — EU Standard Contractual Clauses (Art. 46 GDPR)",
  },
  {
    name: "Anthropic (AI analysis)",
    zweck:
      "AI-assisted conduct of interview conversations as well as analysis and synthesis of responses by the Claude language model",
    datenkategorien:
      "Interview content (response texts, transcripts) for processing by the language model",
    rechtsgrundlage: "Art. 6(1)(b)/(f) GDPR; Art. 28 GDPR",
    standort: "Anthropic PBC, USA (direct connection to the Anthropic API)",
    drittland: "Third country USA — EU Standard Contractual Clauses (Art. 46 GDPR)",
  },
  {
    name: "Deepgram (speech processing)",
    zweck: "Speech-to-text and text-to-speech for voice interviews",
    datenkategorien:
      "Audio recordings of participants (for transcription) and the transcripts generated from them; question text read aloud (text-to-speech)",
    rechtsgrundlage: "Art. 6(1)(b)/(f) GDPR; Art. 28 GDPR",
    standort: "Deepgram Inc., USA; processing via the EU endpoint (api.eu.deepgram.com)",
    drittland: "Third country USA — EU Standard Contractual Clauses (Art. 46 GDPR)",
  },
  {
    name: "LiveKit (real-time audio)",
    zweck: "Real-time audio transmission during voice interviews",
    datenkategorien: "Audio stream and connection metadata",
    rechtsgrundlage: "Art. 6(1)(b)/(f) GDPR; Art. 28 GDPR",
    standort: "LiveKit Inc., USA; operated via EU region",
    drittland: "Third country USA — EU Standard Contractual Clauses (Art. 46 GDPR)",
  },
  {
    name: "Resend (email delivery)",
    zweck:
      "Sending transactional emails (interview invitations, reminders, account and service notifications)",
    datenkategorien:
      "Recipient email address, name or display name, and the content of the respective email (including invitation link)",
    rechtsgrundlage: "Art. 6(1)(b)/(f) GDPR; Art. 28 GDPR",
    standort: "Resend, Inc., USA",
    drittland: "Third country USA — EU Standard Contractual Clauses (Art. 46 GDPR)",
  },
];

export default function PrivacyPolicyPage() {
  return (
    <SiteShell lang="en">
      <LegalProse
        title="Privacy Policy"
        intro="Information on the processing of personal data pursuant to the General Data Protection Regulation (GDPR) and the German Federal Data Protection Act (Bundesdatenschutzgesetz, BDSG)."
        notice={false}
        lang="en"
        closing={<LegalStand>{STAND}</LegalStand>}
      >
        <LegalSection heading="1. Data Controller">
          <div className="flex flex-col gap-3">
            <p>The controller within the meaning of Art. 4 No. 7 GDPR is:</p>
            <p>
              André Bäcker
              <br />
              Klymeo (sole proprietorship)
              <br />
              Hopstener Straße 25
              <br />
              49479 Ibbenbüren
              <br />
              Germany
              <br />
              Email:{" "}
              <a href="mailto:support@klymeo.com" className={CONTACT_LINK}>
                support@klymeo.com
              </a>
              <br />
              Phone:{" "}
              <a href="tel:+4917621878801" className={CONTACT_LINK}>
                +49 176 21878801
              </a>
            </p>
          </div>
        </LegalSection>

        <LegalSection heading="2. General Information and Legal Bases">
          <div className="flex flex-col gap-3">
            <p>
              The protection of your personal data is important to us. We process personal data
              exclusively in accordance with applicable data protection law, in particular the
              GDPR and the German Federal Data Protection Act (Bundesdatenschutzgesetz, BDSG).
              Personal data means any information relating to an identified or identifiable
              natural person.
            </p>
            <p>
              Insofar as we process personal data, we rely, depending on the processing activity,
              on one of the legal bases under Art. 6(1) GDPR — in particular consent (lit. a), the
              performance of a contract or pre-contractual measures (lit. b), a legal obligation
              (lit. c), or our legitimate interest (lit. f). The applicable legal basis is named
              for each individual processing activity below. We have not appointed a data
              protection officer, as there is no statutory obligation to do so.
            </p>
          </div>
        </LegalSection>

        <LegalSection heading="3. Hosting and Server Log Files">
          <div className="flex flex-col gap-3">
            <p>
              The web application is hosted by Vercel and delivered via their EU region
              (Frankfurt am Main); the infrastructure for the authentication service (self-hosted
              Zitadel) and the voice agent is operated by Hetzner in Germany. When you access our
              pages, the servers we use automatically collect information in so-called server log
              files, which your browser automatically transmits: browser type and version,
              operating system used, referrer URL, hostname of the accessing computer, time of the
              server request, and IP address. This data is not merged with other data sources.
            </p>
            <p>
              This collection is carried out on the basis of our legitimate interest in
              technically error-free and secure operation (Art. 6(1)(f) GDPR). For security
              reasons, the log files are stored for a limited period and then deleted; storage
              beyond 30 days occurs only insofar as this is necessary to investigate a specific
              security incident.
            </p>
          </div>
        </LegalSection>

        <LegalSection heading="4. SSL/TLS Encryption">
          <p>
            For security reasons and to protect the transmission of confidential content that you
            send to us as the site operator, this site uses SSL or TLS encryption. You can
            recognize an encrypted connection by the fact that the browser's address bar changes
            from "http://" to "https://" and by the lock icon in your browser bar. If SSL or TLS
            encryption is activated, the data you transmit to us cannot be read by third parties.
          </p>
        </LegalSection>

        <LegalSection heading="5. Cookies and Consent">
          <div className="flex flex-col gap-3">
            <p>
              We use exclusively technically necessary cookies as well as functional cookies you
              have actively chosen, and comparable storage technologies, which are required for
              operating the site, for logging in, and for chosen settings (e.g. language and
              display) (in particular, authentication session cookies). The legal basis for the
              technically necessary cookies is § 25(2) TDDDG (German
              Telecommunications-Digital-Services-Data-Protection Act) in conjunction with our
              legitimate interest in a functioning offering (Art. 6(1)(f) GDPR); no consent is
              required in this respect. The functional settings cookies (e.g. language and
              display) are first-party entries and do not serve advertising or analytics purposes.
              We currently do not use any analytics or marketing cookies or tracking services. A
              detailed overview of the cookies we use can be found in our{" "}
              <Link href="/en/cookies" className={CONTACT_LINK}>
                Cookie Policy
              </Link>
              .
            </p>
          </div>
        </LegalSection>

        <LegalSection heading="6. Contacting Us (Email, Contact Form, Demo Booking)">
          <div className="flex flex-col gap-3">
            <p>
              If you contact us by email, via a contact form, or by booking a demo appointment,
              we process the information you provide (e.g. name, email address, content of the
              inquiry, and any requested appointment time) in order to handle your request. The
              demo booking is processed via the scheduling service Cal.com (Cal.com, Inc.;
              operated via the EU instance cal.eu). The legal basis is Art. 6(1)(b) GDPR, insofar
              as the request is aimed at concluding or performing a contract, and otherwise our
              legitimate interest in responding to inquiries (Art. 6(1)(f) GDPR). The data will be
              deleted once your request has been conclusively processed and no statutory
              retention obligations preclude deletion (see Section 11).
            </p>
          </div>
        </LegalSection>

        <LegalSection heading="7. User Accounts and Authentication (Zitadel)">
          <div className="flex flex-col gap-3">
            <p>
              For registration, sign-in, and the management of user accounts, we use the identity
              and login service Zitadel. Zitadel is operated by us ourselves on server
              infrastructure provided by Hetzner Online GmbH in Germany; login data is not
              transmitted to any external identity service provider in a third country. When an
              account is created and used, the data required for this is processed — in
              particular name, email address, login and authentication data, and any identifiers
              from a single sign-on used. The legal basis is Art. 6(1)(b) GDPR (provision of the
              user account). The session cookies set for login are first-party cookies of our own
              domain; details are provided in the{" "}
              <Link href="/en/cookies" className={CONTACT_LINK}>
                Cookie Policy
              </Link>
              .
            </p>
          </div>
        </LegalSection>

        <LegalSection heading="8. Processing Within the Platform (Interview and Participant Data)">
          <div className="flex flex-col gap-3">
            <p>
              Our customers (researchers) conduct qualitative interviews via the platform. In
              doing so, information about the participating individuals is processed — depending
              on the type of study, in particular response texts, and for voice interviews,
              additionally audio recordings and their transcripts, as well as associated metadata
              (e.g. timestamps and technical session data) and, where applicable, screening or
              contact information collected by the customer.
            </p>
            <p>
              We do not process this data for our own purposes, but on the instructions of, and on
              behalf of, the respective customer, for the purpose of conducting and analyzing the
              study; in this respect, we act as a processor within the meaning of Art. 28 GDPR,
              while the customer is the controller of the study data. This is based on a data
              processing agreement (DPA) between the customer and us. The legal basis for the
              processing vis-à-vis the participating individuals lies with the responsible
              customer (typically consent pursuant to Art. 6(1)(a) GDPR or legitimate interest
              pursuant to lit. f). Participants are informed transparently in advance about the
              use of AI in the interview.
            </p>
            <p>
              The retention period is determined by the instructions of the responsible customer:
              the customer can set an automatic deletion deadline for interview and participant
              data on a per-study basis; if such a deadline is set, the relevant data is
              automatically and permanently deleted once it expires. In addition, the customer can
              delete individual participant data, an entire study, or their account at any time;
              deletion means the permanent removal of the data (including transcripts and
              analyses), not merely flagging it. Section 11 applies in all other respects.
            </p>
          </div>
        </LegalSection>

        <LegalSection heading="9. Processors and Services Used">
          <div className="flex flex-col gap-4">
            <p>
              To provide our offering, we use the following service providers. For each entry,
              the purpose, data categories, legal basis, server location, and any third country
              together with Standard Contractual Clauses (SCCs) are specified.
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
                    <strong className="font-medium text-ink">Purpose:</strong>{" "}
                    {p.zweck}
                  </span>
                  <span>
                    <strong className="font-medium text-ink">
                      Data categories:
                    </strong>{" "}
                    {p.datenkategorien}
                  </span>
                  <span>
                    <strong className="font-medium text-ink">
                      Legal basis:
                    </strong>{" "}
                    {p.rechtsgrundlage}
                  </span>
                  <span>
                    <strong className="font-medium text-ink">
                      Server location:
                    </strong>{" "}
                    {p.standort}
                  </span>
                  <span>
                    <strong className="font-medium text-ink">
                      Third country &amp; SCC:
                    </strong>{" "}
                    {p.drittland}
                  </span>
                </li>
              ))}
            </ul>
            <p>
              Insofar as the above service providers process personal data on our behalf, data
              processing agreements pursuant to Art. 28 GDPR are in place with them. For service
              providers based in a third country (USA), these are supplemented with the EU
              Standard Contractual Clauses pursuant to Art. 46 GDPR.
            </p>
          </div>
        </LegalSection>

        <LegalSection heading="10. Third-Country Transfers and Standard Contractual Clauses">
          <div className="flex flex-col gap-3">
            <p>
              Insofar as we transfer data to service providers in a third country (in particular
              the USA), this is done only if an adequate level of data protection is ensured — for
              example on the basis of an adequacy decision, the EU Standard Contractual Clauses
              (SCCs) pursuant to Art. 46 GDPR, or a certification of the recipient under the EU-US
              Data Privacy Framework (DPF). The basis applicable to each service is specified in
              the list in Section 9. Upon request, we will provide you with information on the
              safeguards in place.
            </p>
          </div>
        </LegalSection>

        <LegalSection heading="11. Retention Period and Deletion Concept">
          <div className="flex flex-col gap-3">
            <p>
              We process and store personal data only for as long as necessary for the respective
              purposes or as required by statutory retention periods. Once the purpose no longer
              applies or the periods have expired, the data is routinely deleted or anonymized.
              Specifically:
            </p>
            <ul className="flex list-disc flex-col gap-1.5 pl-5">
              <li>
                User accounts: until the account is deleted or the contract ends, then deleted
                subject to statutory retention obligations;
              </li>
              <li>
                Interview and participant data (including audio and transcripts): per the
                instructions of the responsible customer, at the latest upon termination of the
                respective processing engagement;
              </li>
              <li>
                Server log files: short-term, see Section 3;
              </li>
              <li>
                Billing and invoicing data: in accordance with statutory retention periods (§ 257
                HGB (German Commercial Code), § 147 AO (German Fiscal Code) — 6 or 10 years,
                respectively);
              </li>
              <li>
                Contact and appointment inquiries: until conclusively processed, provided no
                retention obligation applies.
              </li>
            </ul>
          </div>
        </LegalSection>

        <LegalSection heading="12. Rights of Data Subjects">
          <div className="flex flex-col gap-3">
            <p>
              Under the GDPR, you have the following rights, among others, against the
              controller:
            </p>
            <ul className="flex list-disc flex-col gap-1.5 pl-5">
              <li>Right of access (Art. 15 GDPR);</li>
              <li>Right to rectification (Art. 16 GDPR);</li>
              <li>Right to erasure (Art. 17 GDPR);</li>
              <li>Right to restriction of processing (Art. 18 GDPR);</li>
              <li>Right to data portability (Art. 20 GDPR);</li>
              <li>Right to object to processing (Art. 21 GDPR);</li>
              <li>
                Right to withdraw consent given, with effect for the future (Art. 7(3) GDPR).
              </li>
            </ul>
            <p>
              To exercise these rights, an informal message to{" "}
              <a href="mailto:support@klymeo.com" className={CONTACT_LINK}>
                support@klymeo.com
              </a>{" "}
              is sufficient. For data that we process on behalf of a customer (Section 8), we will
              forward your request to the responsible customer or support them in fulfilling it.
            </p>
          </div>
        </LegalSection>

        <LegalSection heading="13. Right to Lodge a Complaint with a Supervisory Authority">
          <div className="flex flex-col gap-3">
            <p>
              Without prejudice to any other administrative or judicial remedy, you have the
              right to lodge a complaint with a data protection supervisory authority, in
              particular in the member state of your habitual residence, place of work, or the
              place of the alleged infringement, if you consider that the processing of your
              personal data infringes the GDPR.
            </p>
            <p>
              The supervisory authority responsible for us is the North Rhine-Westphalia State
              Commissioner for Data Protection and Freedom of Information (Landesbeauftragte für
              Datenschutz und Informationsfreiheit Nordrhein-Westfalen, LDI NRW),
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
