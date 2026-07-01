// Cookie Policy — full English translation of src/app/(site)/cookies/page.tsx.
// Faithful, complete translation; German is the legally authoritative version
// (see LegalLanguageNotice, rendered via lang="en" on LegalProse below).
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
  title: { absolute: "Cookie Policy — Klymeo" },
  description:
    "Which cookies and storage technologies Klymeo uses, for what purpose, and on what legal basis.",
  alternates: buildAlternates("en", "/cookies"),
  openGraph: {
    ...ogDefaultsFor("en"),
    title: "Cookie Policy — Klymeo",
    description:
      "Which cookies and storage technologies Klymeo uses, for what purpose, and on what legal basis.",
    url: "/cookies",
  },
};

const CONTACT_LINK =
  "text-ink underline underline-offset-2 transition-colors hover:text-ink/70";

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
    anbieter: "Klymeo (own authentication)",
    typ: "HTTP cookie (HttpOnly, Secure)",
    kategorie: "Technically necessary",
    zweck:
      "Carries the active login (signed session token) in the logged-in area. Without this cookie, using the logged-in dashboard is not possible.",
    dauer: "up to 30 days (renewed on a rolling basis)",
    herkunft: "First-party",
  },
  {
    name: "__Host-authjs.csrf-token",
    anbieter: "Klymeo (own authentication)",
    typ: "HTTP cookie (HttpOnly, Secure)",
    kategorie: "Technically necessary",
    zweck:
      "Protects the login and form submission process against cross-site request forgery (CSRF).",
    dauer: "Session",
    herkunft: "First-party",
  },
  {
    name: "__Secure-authjs.callback-url",
    anbieter: "Klymeo (own authentication)",
    typ: "HTTP cookie",
    kategorie: "Technically necessary",
    zweck:
      "Remembers, during login, the destination page to redirect to after successful sign-in.",
    dauer: "Session",
    herkunft: "First-party",
  },
  {
    name: "__Secure-authjs.pkce.code_verifier, __Secure-authjs.state, __Secure-authjs.nonce",
    anbieter: "Klymeo / Zitadel login",
    typ: "HTTP cookie (HttpOnly, transient)",
    kategorie: "Technically necessary",
    zweck:
      "Secure the OpenID Connect login handshake with the identity service Zitadel (PKCE, state, and nonce checks against attacks); deleted again immediately after login.",
    dauer: "a few minutes",
    herkunft: "First-party",
  },
  {
    name: "klymeo.locale",
    anbieter: "Klymeo",
    typ: "HTTP cookie",
    kategorie: "Functional",
    zweck: "Stores your chosen interface language (German/English).",
    dauer: "1 year",
    herkunft: "First-party",
  },
  {
    name: "klymeo-theme",
    anbieter: "Klymeo",
    typ: "Local Storage",
    kategorie: "Functional",
    zweck:
      "Stores the chosen appearance (light/dark/system default) so the interface doesn't flash on load. No personal data is stored.",
    dauer: "persistent, until you clear your browser storage",
    herkunft: "First-party",
  },
  {
    name: "LiveKit (session storage)",
    anbieter: "LiveKit (LiveKit Inc.)",
    typ: "Local Storage",
    kategorie: "Technically necessary (voice interview only)",
    zweck:
      "Used exclusively during a voice interview; the library used merely clears an earlier entry and does not itself store any persistent value.",
    dauer: "not persistent (cleanup only)",
    herkunft: "First-party",
  },
];

export default function CookiePolicyPage() {
  return (
    <SiteShell lang="en">
      <LegalProse
        title="Cookie Policy"
        intro="This Cookie Policy explains which cookies and comparable storage technologies Klymeo uses, for what purpose, and on what legal basis. It supplements our Privacy Policy."
        notice={false}
        lang="en"
        closing={<LegalStand>{STAND}</LegalStand>}
      >
        <LegalSection heading="1. What Are Cookies and Comparable Technologies?">
          <div className="flex flex-col gap-3">
            <p>
              Cookies are small text files that are stored on your device when you visit a
              website. Comparable technologies such as local storage, session storage, pixels, or
              browser fingerprinting serve similar purposes. German law (§ 25 TDDDG) is
              technology-neutral and covers any storage of information on your device and any
              access to information already stored there — regardless of the specific technique
              used. In this policy, we therefore use the term "cookies" as shorthand for all of
              these techniques.
            </p>
            <p>
              A distinction is made between first-party cookies, which are set by the website
              being visited itself, and third-party cookies, which originate from embedded
              third-party providers. Klymeo — as listed in the table in Section 5 — uses
              exclusively first-party entries.
            </p>
          </div>
        </LegalSection>

        <LegalSection heading="2. Data Controller">
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
            <p>
              General information on the processing of personal data can be found in our{" "}
              <Link href="/en/datenschutz" className={CONTACT_LINK}>
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        </LegalSection>

        <LegalSection heading="3. Legal Bases">
          <div className="flex flex-col gap-3">
            <p>
              The use of cookies is legally assessed on two levels. At the first level, § 25
              TDDDG (German Telecommunications-Digital-Services-Data-Protection Act) governs the
              storage of information on your device and access to it: for cookies that are not
              technically necessary, your consent is generally required (§ 25(1) TDDDG), while
              cookies that are strictly technically necessary are permitted without consent
              (§ 25(2) No. 2 TDDDG). At the second level, the subsequent processing of personal
              data requires a legal basis under Art. 6(1) GDPR — for technically necessary
              cookies, typically our legitimate interest in a functioning, secure offering or the
              performance of a contract (lit. f or lit. b, respectively); for cookies requiring
              consent, your consent (lit. a).
            </p>
            <p>
              Klymeo currently uses exclusively technically necessary cookies as well as
              functional first-party cookies you have actively chosen (see Section 5), and does
              not operate any analytics, marketing, or tracking services. Against this
              background, no consent-based cookie banner is currently required. The functional
              settings cookies (language, display) are set exclusively following your active
              selection and do not serve advertising or analytics purposes.
            </p>
          </div>
        </LegalSection>

        <LegalSection heading="4. Cookie Categories">
          <div className="flex flex-col gap-3">
            <p>
              Cookies can be divided into four categories based on their purpose. What matters
              for the consent requirement is not the label, but the function:
            </p>
            <ul className="flex list-disc flex-col gap-1.5 pl-5">
              <li>
                <strong className="font-medium text-ink">
                  Technically necessary cookies
                </strong>{" "}
                keep the service you want running (e.g. login, session, security). They are
                generally exempt from consent insofar as they are strictly necessary for providing
                the service you have expressly requested (§ 25(2) No. 2 TDDDG).
              </li>
              <li>
                <strong className="font-medium text-ink">
                  Functional cookies
                </strong>{" "}
                store settings you have chosen (e.g. language, display) and increase convenience.
              </li>
              <li>
                <strong className="font-medium text-ink">
                  Statistics/analytics cookies
                </strong>{" "}
                measure the use of the website. They require consent.
                <em> Not used by Klymeo.</em>
              </li>
              <li>
                <strong className="font-medium text-ink">
                  Marketing/tracking cookies
                </strong>{" "}
                serve advertising and cross-site recognition. They always require consent.
                <em> Not used by Klymeo.</em>
              </li>
            </ul>
            <p>
              Klymeo currently uses exclusively cookies from the first two categories.
            </p>
          </div>
        </LegalSection>

        <LegalSection heading="5. Cookies and Storage Technologies Used">
          <div className="flex flex-col gap-4">
            <p>
              The following overview lists the cookies and comparable storage technologies
              actually in use. For each entry, the provider, type, category, purpose, retention
              period, and origin (first- or third-party) are specified.
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
                      Provider:
                    </strong>{" "}
                    {c.anbieter}
                  </span>
                  <span>
                    <strong className="font-medium text-ink">Type:</strong>{" "}
                    {c.typ}
                  </span>
                  <span>
                    <strong className="font-medium text-ink">
                      Category:
                    </strong>{" "}
                    {c.kategorie}
                  </span>
                  <span>
                    <strong className="font-medium text-ink">
                      Purpose:
                    </strong>{" "}
                    {c.zweck}
                  </span>
                  <span>
                    <strong className="font-medium text-ink">
                      Retention period:
                    </strong>{" "}
                    {c.dauer}
                  </span>
                  <span>
                    <strong className="font-medium text-ink">
                      Origin:
                    </strong>{" "}
                    {c.herkunft}
                  </span>
                </li>
              ))}
            </ul>
            <p>
              Note: In encrypted production operation (HTTPS), the Auth.js cookies are set with
              the security prefixes <code>__Secure-</code> or <code>__Host-</code>. In a local
              development environment without HTTPS, these prefixes are omitted (e.g.{" "}
              <code>authjs.session-token</code>). The login cookies mentioned serve exclusively to
              authenticate the logged-in service you have expressly requested and are therefore
              technically necessary and exempt from consent (§ 25(2) No. 2 TDDDG).
            </p>
          </div>
        </LegalSection>

        <LegalSection heading="6. Third Parties and Recipients">
          <div className="flex flex-col gap-3">
            <p>
              No cookies from third-party providers are set in your browser. The login cookies
              come from our own, self-operated authentication (NextAuth/Auth.js with the identity
              service Zitadel, which we operate ourselves) and are first-party entries of our own
              domain.
            </p>
            <p>
              The other services we use (including database, AI analysis, email delivery, speech
              processing) operate exclusively server-side and do not set any cookies in your
              browser. A complete list of these processors with purpose, location, and legal
              basis can be found in our{" "}
              <Link href="/en/datenschutz" className={CONTACT_LINK}>
                Privacy Policy
              </Link>
              .
            </p>
            <p>
              Booking a demo appointment via Cal.com takes place via an external link; no
              third-party cookie is set on Klymeo's pages in doing so. Fonts used are delivered
              locally; there is no connection to a third-party font network (CDN).
            </p>
          </div>
        </LegalSection>

        <LegalSection heading="7. Transfers to Third Countries">
          <div className="flex flex-col gap-3">
            <p>
              The cookies and storage technologies referred to in this Cookie Policy do not
              result in any transfer of personal data to a third country: the login cookies are
              set by our own authentication, operated in Germany; the functional entries and the
              voice entry are likewise first-party. Insofar as we use server-side service
              providers based in a third country (e.g. the USA) as part of operating the
              platform, this is set out, together with the safeguards in place (in particular the
              EU Standard Contractual Clauses), in our{" "}
              <Link href="/en/datenschutz" className={CONTACT_LINK}>
                Privacy Policy
              </Link>
              .
            </p>
          </div>
        </LegalSection>

        <LegalSection heading="8. Withdrawal and Managing Your Settings">
          <div className="flex flex-col gap-3">
            <p>
              Since Klymeo currently only uses technically necessary and functional cookies,
              there is no consent to withdraw. You can view, restrict, or delete cookies that
              have been set and stored content at any time via your browser settings (e.g. by
              deleting website data). Please note that deleting the technically necessary login
              cookies will log you out of the logged-in area.
            </p>
            <p>
              Should cookies requiring consent (e.g. for analytics or marketing purposes) be
              added in the future, we will obtain your consent in advance via a consent banner
              and provide a permanently accessible way for you to change your selection
              granularly at any time and withdraw it with effect for the future — as easily as
              you gave it.
            </p>
          </div>
        </LegalSection>

        <LegalSection heading="9. Changes to This Cookie Policy">
          <div className="flex flex-col gap-3">
            <p>
              We will update this Cookie Policy if the technologies used or the legal framework
              changes. The version published here, marked with a date, applies in each case. You
              can find the current version date at the end of this page.
            </p>
          </div>
        </LegalSection>
      </LegalProse>
    </SiteShell>
  );
}
