import type { Metadata } from "next";
import { Konsoul } from "@/components/site/Konsoul";
import { SiteShell, PageHero, DEMO_URL, SUPPORT_EMAIL } from "@/components/site/SiteShell";
import { buildAlternates, jsonLdHtml, ogDefaultsFor, SITE_URL } from "@/lib/marketing/seo";

export const metadata: Metadata = {
  title: { absolute: "Contact & Book a Demo — Klymeo" },
  description: "Book a 30-minute demo with Konsoul or write to us directly.",
  alternates: buildAlternates("en", "/kontakt"),
  openGraph: {
    ...ogDefaultsFor("en"),
    title: "Contact & Book a Demo — Klymeo",
    description: "30-minute demo with a real use case, or email support@klymeo.com.",
    url: "/en/kontakt",
  },
};

const LOCAL_BUSINESS_JSONLD = {
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  name: "Klymeo",
  email: "support@klymeo.com",
  url: SITE_URL,
  address: {
    "@type": "PostalAddress",
    streetAddress: "Hopstener Straße 25",
    postalCode: "49479",
    addressLocality: "Ibbenbüren",
    addressCountry: "DE",
  },
};

export default function ContactPage() {
  return (
    <SiteShell lang="en">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(LOCAL_BUSINESS_JSONLD) }}
      />
      <PageHero
        eyebrow="Contact"
        title="Tell Konsoul,"
        italic="what you need."
        lead="30-minute demo with a real use case — or just say hello by email."
        mood="wink"
      />

      <section className="py-20">
        <div className="mx-auto grid max-w-6xl gap-12 px-6 md:grid-cols-[1.2fr_1fr]">
          <div className="rounded-2xl border border-border bg-card p-3 sm:p-4">
            <div className="flex items-center justify-between px-3 pt-2 pb-3">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-soul">Book a slot</p>
                <h2 className="mt-1 text-2xl">30-minute demo</h2>
              </div>
              <a
                href={DEMO_URL}
                target="_blank"
                rel="noreferrer"
                className="hidden sm:inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-xs font-medium text-paper transition hover:opacity-90"
              >
                Open in new tab ↗
              </a>
            </div>
            <div className="overflow-hidden rounded-xl border border-border">
              <iframe
                title="Book a demo with Klymeo"
                src={DEMO_URL}
                className="block h-[760px] w-full bg-paper"
                loading="lazy"
              />
            </div>
            <p className="mt-3 px-1 text-xs text-muted-foreground">
              Powered by cal.eu — you pick a slot directly, we'll prepare the use case.
            </p>
          </div>

          <aside className="space-y-6">
            <div className="rounded-2xl border border-border bg-card p-7">
              <div className="flex items-center gap-3">
                <Konsoul size={42} mood="smile" className="text-ink" />
                <div>
                  <p className="font-medium text-ink">Write to us directly</p>
                  <p className="text-sm text-muted-foreground">We usually reply the same day.</p>
                </div>
              </div>
              <a href={`mailto:${SUPPORT_EMAIL}`} className="mt-5 block rounded-xl bg-secondary/60 px-4 py-3 text-sm text-ink hover:bg-secondary">
                {SUPPORT_EMAIL}
              </a>
            </div>

            <div className="rounded-2xl border border-border bg-card p-7">
              <p className="text-xs uppercase tracking-[0.22em] text-soul">Office</p>
              <p className="mt-3 text-sm text-ink">Klymeo · Owner André Bäcker</p>
              <p className="text-sm text-muted-foreground">Ibbenbüren, Germany</p>
              <p className="mt-4 text-xs text-muted-foreground">🇪🇺 EU-hosted · GDPR-first</p>
            </div>

            <div className="rounded-2xl border border-border bg-ink p-7 text-paper">
              <p className="text-xs uppercase tracking-[0.22em] text-soul">In the demo, you'll see</p>
              <ul className="mt-4 space-y-2 text-sm">
                <li>→ Konsoul orchestrating a live mini-study</li>
                <li>→ A voice interview with real transcript evidence</li>
                <li>→ The cross-study agent over demo data</li>
                <li>→ Auto-report in PDF & Slides</li>
              </ul>
            </div>
          </aside>
        </div>
      </section>
    </SiteShell>
  );
}
