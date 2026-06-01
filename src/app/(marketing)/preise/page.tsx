import type { Metadata } from "next";
import {
  Container,
  Section,
  SectionHeading,
  Accent,
} from "@/components/marketing/primitives";
import { Reveal } from "@/components/marketing/Reveal";
import {
  PricingTable,
  type PricingTier,
  type PricingEnterprise,
} from "@/components/marketing/PricingTable";
import { FAQ, type FaqItem } from "@/components/marketing/FAQ";
import { CTASection } from "@/components/marketing/CTASection";
import { JsonLd } from "@/components/marketing/JsonLd";
import { SITE_URL, SITE_NAME, ogDefaults } from "@/lib/marketing/seo";

const PATH = "/preise";
const OG_TITLE = "Preise — findr.";
const DESCRIPTION =
  "Eine Plattform, ehrliche Preise: Starter, Growth und Scale plus Enterprise — 14 Tage kostenlos testen, ohne Kreditkarte. In Frankfurt gehostet, DSGVO-konform.";

export const metadata: Metadata = {
  title: "Preise",
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: { ...ogDefaults, title: OG_TITLE, url: PATH },
};

// Product/Offer JSON-LD. Prices are plain numbers (no thousands separator) per
// schema.org; the DE "1.999 €" formatting lives only in the visible markup.
const PRICING_JSONLD = {
  "@context": "https://schema.org",
  "@type": "Product",
  name: `${SITE_NAME} — Conversation-Intelligence-Plattform`,
  description: DESCRIPTION,
  brand: { "@type": "Brand", name: SITE_NAME },
  offers: {
    "@type": "AggregateOffer",
    priceCurrency: "EUR",
    lowPrice: "499",
    highPrice: "1999",
    offerCount: 3,
    url: `${SITE_URL}${PATH}`,
    offers: [
      { "@type": "Offer", name: "Starter", price: "499", priceCurrency: "EUR", url: `${SITE_URL}${PATH}` },
      { "@type": "Offer", name: "Growth", price: "999", priceCurrency: "EUR", url: `${SITE_URL}${PATH}` },
      { "@type": "Offer", name: "Scale", price: "1999", priceCurrency: "EUR", url: `${SITE_URL}${PATH}` },
    ],
  },
};

// TODO D7 (Produktentscheidung André — NICHT hier auflösen): Das Pricing ist
// heute mit Sales-Rep-Bändern (5/15/30) modelliert — also als Pricing für EIN
// Sales-Produkt —, während die Site vier gleichwertige Produkte bewirbt. Die drei
// Nicht-Sales-Module (Customer Success Health, Product Discovery, Market Research)
// erscheinen hier nur als „bald“-Upsell. Offene Optionen (Plan §4.6 / §9 D7):
//   (a) ehrlich als Sales-Pricing framen + Module als sichtbare Roadmap, oder
//   (b) Plattform-Fee + Module/Per-Modul.
// Bis zur Entscheidung bewusst mit dem BESTEHENDEN Rep-Band-Modell gebaut — kein
// neues Pricing-Modell erfunden.
const TIERS: PricingTier[] = [
  {
    name: "Starter",
    audience: "Für kleine Teams",
    desc: "Bis 5 Reps. Das echte Bild zu jedem Deal.",
    amount: "499",
    period: "/Monat",
    priceSub: "pro Monat, monatlich abgerechnet",
    cta: { label: "Kostenlos testen", href: "/sign-up" },
    features: [
      { label: "Bis 5 Sales-Reps" },
      { label: "Echtzeit-Deal-Risiko-Score" },
      { label: "8 Risiko-Signale mit Beleg" },
      { label: "Automatische Verlustgrund-Erkennung" },
      { label: "Risiko-adjustierte Pipeline-Prognose" },
      { label: "HubSpot-, Gong- & Slack-Integration" },
      { label: "Customer Success Health", soon: true },
      { label: "Closing-the-Loop Voice-Agent", soon: true },
    ],
  },
  {
    name: "Growth",
    audience: "Für wachsende Teams",
    desc: "Bis 15 Reps. Die komplette Conversation-Intelligence-Engine.",
    amount: "999",
    period: "/Monat",
    priceSub: "pro Monat, monatlich abgerechnet",
    featured: true,
    popularLabel: "Beliebteste Wahl",
    cta: { label: "Kostenlos testen", href: "/sign-up" },
    features: [
      { label: "Bis 15 Sales-Reps" },
      { label: "Alles aus Starter" },
      { label: "Risiko-Dashboards auf Team-Ebene" },
      { label: "Forecast: Best / wahrscheinlich / Worst Case" },
      { label: "Individuelle Risiko-Schwellen" },
      { label: "Slack-Alerts bei Deal-Änderungen" },
      { label: "Customer Success Health", soon: true },
      { label: "Closing-the-Loop Voice-Agent", soon: true },
      { label: "Product-Discovery-Modul", soon: true },
    ],
  },
  {
    name: "Scale",
    audience: "Für große Teams",
    desc: "Bis 30 Reps. Team-übergreifende Intelligence und Reporting.",
    amount: "1.999",
    period: "/Monat",
    priceSub: "pro Monat, monatlich abgerechnet",
    cta: { label: "Kostenlos testen", href: "/sign-up" },
    features: [
      { label: "Bis 30 Sales-Reps" },
      { label: "Alles aus Growth" },
      { label: "Team-übergreifendes Risiko-Reporting" },
      { label: "Win/Loss-Trend-Analysen" },
      { label: "Coaching-Ansichten für Manager:innen" },
      { label: "Priorisierter Support" },
      { label: "Alle vier Plattform-Module", soon: true },
      { label: "Individuell trainierte Modelle", soon: true },
    ],
  },
];

const ENTERPRISE: PricingEnterprise = {
  name: "Enterprise",
  title: "Individuell, für komplexe Organisationen",
  desc: "Für Teams jenseits von 30 Reps — mit eigenen Anforderungen an Deployment, Sicherheit und Modelle.",
  cta: { label: "Sprich mit uns", href: "/demo" },
  bullets: [
    { label: "Unbegrenzte Reps" },
    { label: "SSO + erweiterte Sicherheit" },
    { label: "Individuelle Integrationen" },
    { label: "Individuell trainierte Modelle", soon: true },
  ],
};

// Trial-Timeline („Der Discovery-Prozess“). Source bugs fixed: the marker column
// holds meaningful durations (was the "00:00" placeholder), and the lead matches
// the FOUR rendered steps (the source said "3 simple steps" but rendered 4).
const TIMELINE: { marker: string; title: string; body: string }[] = [
  {
    marker: "15 Min",
    title: "Discovery-Call buchen",
    body: "Buch einen 15-minütigen Call, in dem wir deinen Vertriebsprozess und deine konkreten Anforderungen besprechen. Kein Sales-Pitch — einfach ein Gespräch.",
  },
  {
    marker: "< 10 Min",
    title: "Onboarding & Einrichtung",
    body: "Wir verbinden findr. mit deinem Sales-Stack (Gong, HubSpot & Co.) in unter 10 Minuten. Kein technisches Know-how nötig.",
  },
  {
    marker: "< 24 h",
    title: "Erste Insights sehen",
    body: "Innerhalb von 24 Stunden siehst du echte Deal-Risiko-Scores und Insights auf deinen ersten verbundenen Calls. Keine Wartezeit.",
  },
  {
    marker: "14 Tage",
    title: "Dein 14-tägiger Test",
    body: "Nutze findr. 14 Tage lang mit deinem ganzen Team. Voller Funktionsumfang. Jederzeit kündbar, ohne Wenn und Aber.",
  },
];

const FAQ_ITEMS: FaqItem[] = [
  {
    q: "Brauche ich eine Kreditkarte für den Test?",
    a: "Nein. Der 14-tägige Test läuft ohne Kreditkarte und ist jederzeit kündbar.",
  },
  {
    q: "Wie wird abgerechnet?",
    a: "Die Preise verstehen sich pro Monat, monatlich abgerechnet. Du wählst das Rep-Band, das zu deiner Team-Größe passt.",
  },
  {
    q: "Was passiert, wenn mein Team wächst?",
    a: "Du wechselst jederzeit das Band — von Starter über Growth bis Scale. Ab 30+ Reps bist du im Enterprise-Bereich, mit individuellem Angebot.",
  },
  {
    q: "Welche Module sind heute enthalten?",
    a: "Live ist heute Sales Intelligence. Customer Success Health, Product Discovery und Market Research sind als „bald“ gekennzeichnet — wir verkaufen nichts als Live, was noch nicht Live ist.",
  },
  {
    q: "Wo werden meine Daten gehostet?",
    a: "In Frankfurt, DSGVO-nativ und EU-AI-Act-konform — in Deutschland gebaut.",
  },
];

export default function PreisePage() {
  return (
    <>
      <JsonLd data={PRICING_JSONLD} />

      <Section className="pt-14 sm:pt-20">
        <Container>
          <Reveal>
            <SectionHeading
              as="h1"
              eyebrow="Preise"
              title={
                <>
                  Eine Plattform. <Accent>Ehrliche Preise.</Accent>
                </>
              }
            />
          </Reveal>
          <Reveal>
            <p className="mx-auto mt-6 text-center text-[15px] text-neutral-500">
              <strong className="font-medium text-neutral-900">
                14 Tage kostenlos testen
              </strong>{" "}
              · Keine Kreditkarte nötig · Jederzeit kündbar
            </p>
          </Reveal>
        </Container>
      </Section>

      <Section className="pt-0">
        <Container>
          <Reveal>
            <PricingTable tiers={TIERS} enterprise={ENTERPRISE} />
          </Reveal>
        </Container>
      </Section>

      <Section tone="muted">
        <Container>
          <Reveal>
            <SectionHeading
              eyebrow="Der Discovery-Prozess"
              title={
                <>
                  Was dich in deinem <Accent>kostenlosen Test</Accent> erwartet.
                </>
              }
              lead="So bringen wir dich mit findr. in vier Schritten an den Start."
            />
          </Reveal>
          <ol className="mx-auto mt-14 max-w-2xl">
            {TIMELINE.map((step, i) => (
              <Reveal key={step.title} delay={i * 0.05}>
                <li className="relative flex gap-6 pb-10 last:pb-0">
                  {i < TIMELINE.length - 1 ? (
                    <span
                      aria-hidden
                      className="absolute bottom-1 left-[15px] top-9 w-px bg-neutral-200"
                    />
                  ) : null}
                  <span
                    aria-hidden
                    className="relative z-10 mt-0.5 h-8 w-8 shrink-0 rounded-full border-2 border-primary-200 bg-primary-600"
                  />
                  <div className="flex flex-col gap-1 pt-0.5">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-primary-600">
                      {step.marker}
                    </div>
                    <h3 className="font-marketing text-lg font-semibold text-neutral-900">
                      {step.title}
                    </h3>
                    <p className="max-w-xl text-[14px] leading-relaxed text-neutral-500">
                      {step.body}
                    </p>
                  </div>
                </li>
              </Reveal>
            ))}
          </ol>
        </Container>
      </Section>

      <FAQ
        eyebrow="Häufige Fragen"
        title={
          <>
            Alles, was du <Accent>vor</Accent> dem Test wissen willst.
          </>
        }
        items={FAQ_ITEMS}
      />

      <CTASection
        eyebrow="Loslegen"
        title={
          <>
            Sieh, was dein CRM <Accent>übersieht.</Accent>
          </>
        }
        lead="14 Tage kostenlos testen. Keine Kreditkarte. Keine Haken."
        primary={{ label: "Kostenlos testen →", href: "/sign-up" }}
        secondary={{ label: "Demo buchen", href: "/demo" }}
      />
    </>
  );
}
