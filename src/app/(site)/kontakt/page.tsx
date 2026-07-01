import type { Metadata } from "next";
import { Konsoul } from "@/components/site/Konsoul";
import { SiteShell, PageHero, DEMO_URL, SUPPORT_EMAIL } from "@/components/site/SiteShell";
import { buildAlternates, jsonLdHtml, ogDefaultsFor, SITE_URL } from "@/lib/marketing/seo";

export const metadata: Metadata = {
  title: { absolute: "Kontakt & Demo buchen — Klymeo" },
  description:
    "Buch eine 30-Minuten-Demo mit Konsoul oder schreib uns direkt.",
  alternates: buildAlternates("de", "/kontakt"),
  openGraph: {
    ...ogDefaultsFor("de"),
    title: "Kontakt & Demo buchen — Klymeo",
    description:
      "30-Minuten-Demo mit echtem Use Case oder Mail an support@klymeo.com.",
    url: "/kontakt",
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
    <SiteShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(LOCAL_BUSINESS_JSONLD) }}
      />
      <PageHero
        eyebrow="Kontakt"
        title="Sag Konsoul,"
        italic="was du brauchst."
        lead="30-Minuten-Demo mit echtem Use Case — oder einfach ein Hallo per Mail."
        mood="wink"
      />

      <section className="py-20">
        <div className="mx-auto grid max-w-6xl gap-12 px-6 md:grid-cols-[1.2fr_1fr]">
          <div className="rounded-2xl border border-border bg-card p-3 sm:p-4">
            <div className="flex items-center justify-between px-3 pt-2 pb-3">
              <div>
                <p className="text-xs uppercase tracking-[0.22em] text-soul">Terminbuchung</p>
                <h2 className="mt-1 text-2xl">30-Minuten-Demo</h2>
              </div>
              <a
                href={DEMO_URL}
                target="_blank"
                rel="noreferrer"
                className="hidden sm:inline-flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-xs font-medium text-paper transition hover:opacity-90"
              >
                In neuem Tab öffnen ↗
              </a>
            </div>
            <div className="overflow-hidden rounded-xl border border-border">
              <iframe
                title="Klymeo Demo buchen"
                src={DEMO_URL}
                className="block h-[760px] w-full bg-paper"
                loading="lazy"
              />
            </div>
            <p className="mt-3 px-1 text-xs text-muted-foreground">
              Powered by cal.eu — du wählst direkt einen Slot, wir bereiten den Use Case vor.
            </p>
          </div>

          <aside className="space-y-6">
            <div className="rounded-2xl border border-border bg-card p-7">
              <div className="flex items-center gap-3">
                <Konsoul size={42} mood="smile" className="text-ink" />
                <div>
                  <p className="font-medium text-ink">Direkt schreiben</p>
                  <p className="text-sm text-muted-foreground">Antwort meist am gleichen Tag.</p>
                </div>
              </div>
              <a href={`mailto:${SUPPORT_EMAIL}`} className="mt-5 block rounded-xl bg-secondary/60 px-4 py-3 text-sm text-ink hover:bg-secondary">
                {SUPPORT_EMAIL}
              </a>
            </div>

            <div className="rounded-2xl border border-border bg-card p-7">
              <p className="text-xs uppercase tracking-[0.22em] text-soul">Büro</p>
              <p className="mt-3 text-sm text-ink">Klymeo · Inhaber André Bäcker</p>
              <p className="text-sm text-muted-foreground">Ibbenbüren, Deutschland</p>
              <p className="mt-4 text-xs text-muted-foreground">🇪🇺 EU-gehostet · DSGVO-first</p>
            </div>

            <div className="rounded-2xl border border-border bg-ink p-7 text-paper">
              <p className="text-xs uppercase tracking-[0.22em] text-soul">In der Demo siehst du</p>
              <ul className="mt-4 space-y-2 text-sm">
                <li>→ Konsoul orchestriert live eine Mini-Studie</li>
                <li>→ Voice-Interview mit echtem Transkript-Beleg</li>
                <li>→ Cross-Study-Agent über Demo-Daten</li>
                <li>→ Auto-Report in PDF & Slides</li>
              </ul>
            </div>
          </aside>
        </div>
      </section>
    </SiteShell>
  );
}
