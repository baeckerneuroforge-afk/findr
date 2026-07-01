import type { Metadata } from "next";
import { SiteShell } from "@/components/site/SiteShell";
import { LegalProse, LegalSection } from "@/components/site/LegalProse";
import { buildAlternates, ogDefaultsFor } from "@/lib/marketing/seo";

const CONTACT_LINK =
  "text-ink underline underline-offset-2 transition-colors hover:text-ink/70";

export const metadata: Metadata = {
  title: { absolute: "Imprint — Klymeo" },
  description:
    "Provider identification and mandatory disclosures pursuant to § 5 DDG (German Digital Services Act) for Klymeo.",
  alternates: buildAlternates("en", "/impressum"),
  openGraph: {
    ...ogDefaultsFor("en"),
    title: "Imprint — Klymeo",
    description:
      "Provider identification and mandatory disclosures pursuant to § 5 DDG (German Digital Services Act) for Klymeo.",
    url: "/impressum",
  },
};

export default function ImprintPage() {
  return (
    <SiteShell lang="en">
      <LegalProse
        title="Imprint"
        intro="Provider identification pursuant to § 5 of the German Digital Services Act (Digitale-Dienste-Gesetz, DDG)."
        stand="June 2026"
        notice={false}
        lang="en"
      >
        <LegalSection heading="Information pursuant to § 5 DDG">
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
          </p>
        </LegalSection>

        <LegalSection heading="Contact">
          <div className="flex flex-col gap-1.5">
            <p>
              Email:{" "}
              <a href="mailto:support@klymeo.com" className={CONTACT_LINK}>
                support@klymeo.com
              </a>
            </p>
            <p>
              Phone:{" "}
              <a href="tel:+4917621878801" className={CONTACT_LINK}>
                +49 176 21878801
              </a>
            </p>
          </div>
        </LegalSection>

        <LegalSection heading="VAT Identification Number">
          <p>VAT ID pursuant to § 27a UStG (German VAT Act): DE459461407</p>
        </LegalSection>

        <LegalSection heading="Responsible for content pursuant to § 18(2) MStV (German Interstate Media Treaty)">
          <p>André Bäcker, address as above.</p>
        </LegalSection>

        <LegalSection heading="Consumer Dispute Resolution">
          <p>
            We are not willing or obligated to participate in dispute
            resolution proceedings before a consumer arbitration board.
          </p>
        </LegalSection>

        <LegalSection heading="Liability for Content">
          <p>
            As a service provider, we are responsible for our own content on
            these pages under general law pursuant to § 7(1) DDG. However,
            pursuant to §§ 8 to 10 DDG, we are not obligated as a service
            provider to monitor transmitted or stored third-party information
            or to investigate circumstances that indicate unlawful activity.
            Obligations to remove or block the use of information under
            general law remain unaffected by this. However, liability in this
            regard is only possible from the point in time at which we become
            aware of a specific legal violation. Upon becoming aware of any
            such violations, we will remove this content immediately.
          </p>
        </LegalSection>

        <LegalSection heading="Liability for Links">
          <p>
            Our offering may contain links to external third-party websites,
            over whose content we have no control. We therefore cannot accept
            any liability for this third-party content. The respective
            provider or operator of the linked pages is always responsible
            for their content. The linked pages were checked for possible
            legal violations at the time of linking. No unlawful content was
            identifiable at the time of linking. However, permanently
            monitoring the content of linked pages without concrete evidence
            of a legal violation is not reasonable. Upon becoming aware of any
            legal violations, we will remove such links immediately.
          </p>
        </LegalSection>

        <LegalSection heading="Copyright">
          <p>
            The content and works created by the site operators on these
            pages are subject to German copyright law. Reproduction, editing,
            distribution, and any kind of use beyond the scope of copyright
            law require the written consent of the respective author or
            creator. Downloads and copies of this page are permitted for
            private, non-commercial use only. Insofar as the content on this
            page was not created by the operator, the copyrights of third
            parties are respected. In particular, third-party content is
            marked as such. Should you nonetheless become aware of a
            copyright infringement, please notify us accordingly. Upon
            becoming aware of any legal violations, we will remove such
            content immediately.
          </p>
        </LegalSection>
      </LegalProse>
    </SiteShell>
  );
}
