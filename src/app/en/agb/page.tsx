// General Terms and Conditions — full English translation of
// src/app/(site)/agb/page.tsx. Faithful, complete translation; German is the
// legally authoritative version (see LegalLanguageNotice, rendered via
// lang="en" on LegalProse below). § 10 (liability) is the clause the German
// original itself flags as pending one attorney read-through — this
// translation mirrors it as-is and will need the same fast-follow once that
// review lands (see project memory).
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
  title: { absolute: "Terms and Conditions — Klymeo" },
  description: "General Terms and Conditions for the use of Klymeo.",
  alternates: buildAlternates("en", "/agb"),
  openGraph: {
    ...ogDefaultsFor("en"),
    title: "Terms and Conditions — Klymeo",
    description: "General Terms and Conditions for the use of Klymeo.",
    url: "/agb",
  },
};

const CONTACT_LINK =
  "text-ink underline underline-offset-2 transition-colors hover:text-ink/70";

export default function TermsPage() {
  return (
    <SiteShell lang="en">
      <LegalProse
        title="General Terms and Conditions"
        intro="Terms for the use of Klymeo and its associated products."
        notice={false}
        lang="en"
        closing={<LegalStand>{STAND}</LegalStand>}
      >
        <LegalSection heading="1. Scope of Application and Subject Matter">
          <div className="flex flex-col gap-3">
            <p>
              These General Terms and Conditions ("Terms") apply to all agreements between André
              Bäcker, Klymeo (sole proprietorship), Hopstener Straße 25, 49479 Ibbenbüren, Germany
              ("Provider") and its customers regarding the provision and use of the Klymeo
              platform. Customers within the meaning of these Terms are exclusively businesses
              within the meaning of § 14 BGB (German Civil Code), legal entities under public law,
              or special funds under public law.
            </p>
            <p>
              The subject matter of the agreement is the provision of the platform as
              Software-as-a-Service over the internet, together with the related services
              described in the respective order. Any deviating or conflicting terms and
              conditions of the customer are objected to; they only become part of the agreement
              if the Provider expressly agrees to them in text form.
            </p>
          </div>
        </LegalSection>

        <LegalSection heading="2. Formation of the Agreement">
          <div className="flex flex-col gap-3">
            <p>
              The presentation of services on the website does not constitute a binding offer,
              but an invitation to submit an offer. The agreement is formed either by the
              Provider's acceptance of the order or activation of access, or by the customer's
              acceptance of an offer made by the Provider. Registration and use require the
              creation of a user account; the information provided in doing so must be complete
              and accurate.
            </p>
          </div>
        </LegalSection>

        <LegalSection heading="3. Description of Services">
          <div className="flex flex-col gap-3">
            <p>
              The Provider makes available to the customer the platform for planning, conducting,
              and analyzing AI-supported qualitative interviews — including text- and voice-based
              interview delivery (voice agent), the presentation of stimuli, and the analysis and
              export of results. The specific scope of services results from the respective
              service description or order. The Provider owes the provision of the platform (a
              service), not a particular research or exploitation outcome.
            </p>
            <p>
              The Provider is entitled to further develop and adapt the services, provided this is
              reasonable for the customer and the contractually owed scope of services is not
              materially reduced.
            </p>
          </div>
        </LegalSection>

        <LegalSection heading="4. Customer Obligations">
          <div className="flex flex-col gap-3">
            <p>The customer undertakes, in particular, to:</p>
            <ul className="flex list-disc flex-col gap-1.5 pl-5">
              <li>
                use the platform only within the scope of applicable law and these Terms, and not
                to post any unlawful content;
              </li>
              <li>
                independently ensure the data protection bases required for conducting the
                interviews (in particular consents and information provided to participating
                individuals), as the customer is the controller within the meaning of the GDPR in
                this respect;
              </li>
              <li>
                keep their access credentials secret, protect them from access by third parties,
                and report any misuse without delay;
              </li>
              <li>
                hold the necessary rights to the content they post (e.g. stimuli).
              </li>
            </ul>
          </div>
        </LegalSection>

        <LegalSection heading="5. Pricing and Payment (Pilot and License Model)">
          <div className="flex flex-col gap-3">
            <p>
              Remuneration is based on the agreed model — a time-limited pilot model or an ongoing
              license model — and results from the respective order or offer. All prices are
              exclusive of statutory value-added tax, insofar as it applies. Billing is by
              invoice.
            </p>
            <p>
              Invoices are due within 14 days of the invoice date, without deduction. In the event
              of late payment, the statutory provisions apply (§§ 286, 288 BGB).
            </p>
          </div>
        </LegalSection>

        <LegalSection heading="6. Term and Termination">
          <div className="flex flex-col gap-3">
            <p>
              The term of the agreement results from the respective order. Unless otherwise
              agreed, the agreement is automatically renewed for the original term period each
              time, unless terminated in text form with 30 days' notice to the end of the
              respective term. The right of both parties to terminate for good cause remains
              unaffected. Terminations require text form.
            </p>
          </div>
        </LegalSection>

        <LegalSection heading="7. Rights of Use">
          <div className="flex flex-col gap-3">
            <p>
              For the duration of the agreement, the Provider grants the customer a simple,
              non-exclusive, non-transferable right to use the platform in accordance with the
              agreement, within the agreed scope. Any use beyond this, in particular the
              reproduction, modification, or making available of the software to third parties,
              is not permitted without the Provider's consent.
            </p>
            <p>
              Rights to the content posted by the customer, as well as to the study data and
              analyses collected on the customer's behalf, remain with the customer. The Provider
              is entitled to use anonymized or aggregated data that no longer permits any
              reference to individuals or the customer to improve and operate the services.
            </p>
          </div>
        </LegalSection>

        <LegalSection heading="8. Availability and Support">
          <div className="flex flex-col gap-3">
            <p>
              The Provider endeavors to ensure high availability of the platform. Excluded from
              this are periods during which the platform is unavailable due to technical or other
              problems outside the Provider's control (e.g. force majeure, disruptions at third
              parties), as well as announced maintenance windows. Support is offered by email at{" "}
              <a href="mailto:support@klymeo.com" className={CONTACT_LINK}>
                support@klymeo.com
              </a>
              .
            </p>
            <p>
              No specific availability (service level) or specific support response time is
              guaranteed unless expressly agreed in text form in the respective order.
            </p>
          </div>
        </LegalSection>

        <LegalSection heading="9. Warranty">
          <div className="flex flex-col gap-3">
            <p>
              The statutory warranty rights apply, subject to the provisions of these Terms. The
              customer must report identifiable defects without delay, in text form. A guarantee
              as to quality is only assumed if expressly agreed in text form.
            </p>
          </div>
        </LegalSection>

        <LegalSection heading="10. Liability and Limitation of Liability">
          <div className="flex flex-col gap-3">
            <p>
              The Provider is liable without limitation for intent and gross negligence, for
              injury to life, body, or health, under the provisions of the Product Liability Act,
              and to the extent of any guarantee assumed.
            </p>
            <p>
              In the case of a slightly negligent breach of a material contractual obligation (an
              obligation whose fulfillment enables the proper performance of the agreement in the
              first place and on whose observance the customer regularly relies — a cardinal
              obligation), liability is limited to the typical, foreseeable damage. Otherwise,
              liability for slight negligence is excluded. The above limitations also apply for
              the benefit of the Provider's legal representatives and vicarious agents.
            </p>
            <p>
              For the loss of data, the Provider is only liable to the extent that would also have
              occurred with proper and regular data backup by the customer. The customer remains
              responsible for backing up the content they upload to the platform themselves,
              unless expressly agreed otherwise.
            </p>
          </div>
        </LegalSection>

        <LegalSection heading="11. Confidentiality">
          <div className="flex flex-col gap-3">
            <p>
              The parties undertake to keep confidential all information of the other party
              obtained in the course of the cooperation that is marked as confidential or that is
              confidential by its nature, and to use it only for the purposes of performing the
              agreement. This obligation continues beyond the end of the agreement. Excluded is
              information that is publicly known or that must be disclosed due to a legal
              obligation.
            </p>
          </div>
        </LegalSection>

        <LegalSection heading="12. Data Protection and Data Processing">
          <div className="flex flex-col gap-3">
            <p>
              Information on the processing of personal data can be found in our{" "}
              <Link href="/en/datenschutz" className={CONTACT_LINK}>
                Privacy Policy
              </Link>
              . Insofar as the Provider processes personal data on the instructions of, and on
              behalf of, the customer (e.g. interview and participant data), a separate data
              processing agreement (DPA) pursuant to Art. 28 GDPR applies in addition, concluded
              separately from these Terms. The customer is the controller within the meaning of
              the GDPR for this data.
            </p>
          </div>
        </LegalSection>

        <LegalSection heading="13. Changes to These Terms">
          <div className="flex flex-col gap-3">
            <p>
              The Provider is entitled to amend these Terms with effect for the future, insofar as
              this is necessary for good cause (e.g. changes in the legal situation or case law,
              expansion of the service offering) and the customer is not unreasonably
              disadvantaged as a result. Changes will be communicated to the customer in text form
              at least 6 weeks before they take effect. If the customer does not object within the
              period specified in the notice, the changes are deemed accepted; this consequence
              will be specifically pointed out in the notice. In the event of an objection, both
              parties have a special right of termination.
            </p>
          </div>
        </LegalSection>

        <LegalSection heading="14. Final Provisions and Jurisdiction">
          <div className="flex flex-col gap-3">
            <p>
              The law of the Federal Republic of Germany applies, excluding the UN Convention on
              Contracts for the International Sale of Goods (CISG). If the customer is a merchant,
              a legal entity under public law, or a special fund under public law, the exclusive
              place of jurisdiction for all disputes arising from or in connection with this
              agreement is the Provider's place of business (Ibbenbüren). The Provider is also
              entitled to bring an action at the customer's general place of jurisdiction.
            </p>
            <p>
              Amendments and supplements to the agreement require text form. Should individual
              provisions of these Terms be or become invalid, the validity of the remaining
              provisions remains unaffected.
            </p>
          </div>
        </LegalSection>
      </LegalProse>
    </SiteShell>
  );
}
