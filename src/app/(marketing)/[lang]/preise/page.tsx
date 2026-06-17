import type { Metadata } from "next";
import Link from "next/link";
import {
  Container,
  Section,
  SectionHeading,
} from "@/components/marketing/primitives";
import { Reveal } from "@/components/marketing/Reveal";
import { HeroAtmosphere } from "@/components/marketing/HeroAtmosphere";
import { CtaLink } from "@/components/marketing/CtaLink";
import { DEMO_BOOKING_URL } from "@/lib/marketing/constants";
import { PlatformModules } from "@/components/marketing/PlatformModules";
import { FAQ, type FaqItem } from "@/components/marketing/FAQ";
import { JsonLd } from "@/components/marketing/JsonLd";
import {
  LayersIcon,
  TrendingUpIcon,
  NetworkIcon,
  FileCheckIcon,
  MapPinIcon,
  ServerIcon,
  ShieldCheckIcon,
  CpuIcon,
  CheckIcon,
} from "@/components/marketing/icons";
import { ogDefaults } from "@/lib/marketing/seo";
import { localizedContent } from "@/i18n/marketing-locale";
import type { ComponentType, SVGProps } from "react";

const PATH = "/preise";
const OG_TITLE = "Preise — Klymeo";
const DESCRIPTION =
  "Custom-based Pricing für Klymeo: Du zahlst für die Methoden, den Umfang und die Begleitung, die zu deinem Team passen — den konkreten Preis legen wir gemeinsam im Demo-Call fest. In Frankfurt gehostet, DSGVO-konform.";

export const metadata: Metadata = {
  title: "Preise",
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: { ...ogDefaults, title: OG_TITLE, url: PATH },
};

type IconType = ComponentType<SVGProps<SVGSVGElement>>;

// ── Sektion 2: Was den Preis bestimmt ──────────────────────────────────────
// Transparenz statt Zahl: die vier Stellschrauben, aus denen sich der individuelle
// Preis ergibt. Bewusst Fließtext, kein Bullet-Stakkato.
const FACTORS_DE: { Icon: IconType; title: string; body: string }[] = [
  {
    Icon: LayersIcon,
    title: "Methoden",
    body: "Du startest mit der Methode, die heute den größten Hebel hat, und nimmst die anderen drei dazu, wenn dein Team so weit ist. Bezahlt wird, was du wirklich einsetzt — nicht das Voll-Paket auf Verdacht.",
  },
  {
    Icon: TrendingUpIcon,
    title: "Umfang",
    body: "Gesprächsvolumen, Interviews und Studien, Sitzplätze für dein Team — der Umfang skaliert mit dem, was zur Größe deiner Organisation und deiner tatsächlichen Nutzung passt.",
  },
  {
    Icon: NetworkIcon,
    title: "Begleitung",
    body: "Von Self-Serve bis zum eng begleiteten Rollout: Wie viel Onboarding, Schulung und laufende Betreuung du brauchst, fließt in den Umfang ein — manche Teams legen allein los, andere wollen uns an ihrer Seite.",
  },
  {
    Icon: FileCheckIcon,
    title: "Laufzeit",
    body: "Monatlich flexibel oder mit fester Laufzeit: Wie verbindlich du planen willst, ist Teil des Gesprächs und wirkt sich auf die Konditionen aus. Ohne Kleingedrucktes, ohne automatische Fallen.",
  },
];

// ── Sektion 5: Was bei jedem Konto dabei ist ───────────────────────────────
// Vertrauens-/Plattform-Anker, modul-unabhängig. Die vier DACH-Souveränitäts-
// Anker übernehmen die echten Anker der Startseiten-TrustBar/des Footers: gleiche
// Labels und Aussagen, die Sub-Zeilen hier nur als ganze Sätze ausformuliert
// (konsistent, nicht neu erfunden). Dazu zwei plattform-weite Produkt-Stärken,
// die jede Modul-Seite real nennt (deutschsprachige KI-Interviews; Beleg am
// Transkript).
//
// TODO D3 (André, vor Go-live): „DSGVO-konform“ / „EU AI Act“ sind werbliche
// Aussagen (UWG) — belegen oder entschärfen. Verbatim aus TrustBar/Footer, keine
// erfundenen Zertifikate oder Siegel.
const ALWAYS_INCLUDED_DE: { Icon: IconType; label: string; sub: string }[] = [
  {
    Icon: MapPinIcon,
    label: "In Deutschland gebaut",
    sub: "Team & Entwicklung in der DACH-Region.",
  },
  {
    Icon: ServerIcon,
    label: "In der EU gehostet",
    sub: "Rechenzentrum Frankfurt am Main.",
  },
  {
    Icon: ShieldCheckIcon,
    label: "DSGVO-konform",
    sub: "Datenschutz als Grundlage, nicht als Nachgedanke.",
  },
  {
    Icon: FileCheckIcon,
    label: "EU AI Act",
    sub: "Auf den europäischen KI-Rahmen ausgerichtet.",
  },
  {
    Icon: CpuIcon,
    label: "KI-Interviews auf Deutsch",
    sub: "Text oder hörbar per Voice-Agent — DACH-Gesprächssprache, wo rein englische Tools an ihre Grenzen kommen.",
  },
  {
    Icon: CheckIcon,
    label: "Belegt, nicht geraten",
    sub: "Jede Aussage ist am exakten Transkript-Moment verankert.",
  },
];

// FAQ — nimmt die typische Custom-Pricing-Reibung vorab (Outset-Stil). Antworten
// sind reiner Text, damit dieselbe Quelle die FAQPage-JSON-LD speist.
const FAQ_ITEMS_DE: { q: string; a: string }[] = [
  {
    q: "Warum nennt ihr keine festen Preise?",
    a: "Weil der passende Preis von den Methoden, dem Umfang und der Begleitung abhängt, die dein Team wirklich braucht. Ein Schubladen-Tarif würde die meisten Teams entweder über- oder unterversorgen. Im Demo-Call schnüren wir stattdessen genau das, was zu deiner Situation passt — transparent und nachvollziehbar.",
  },
  {
    q: "Kann ich mit einer einzigen Methode starten?",
    a: "Ja. Du beginnst mit der Methode, die heute den größten Hebel hat, und nimmst die anderen dazu, sobald dein Team so weit ist. Alle vier Methoden teilen sich dieselbe KI-Engine — bereits geführte Interviews zählen weiter, nichts geht beim Erweitern verloren.",
  },
  {
    q: "Wonach richtet sich der Umfang, und wie wird abgerechnet?",
    a: "Der Umfang richtet sich nach dem, was du nutzt: Gesprächsvolumen, Interviews oder Studien, Sitzplätze und der Grad der Begleitung. Welche dieser Größen zu deinem Team passen, legen wir gemeinsam fest — ohne versteckte Posten und ohne Kleingedrucktes.",
  },
  {
    q: "Bekomme ich Unterstützung beim Setup?",
    a: "Ja — wobei das Setup bewusst klein ist: Studien laufen über teilbare Links, deinen eigenen Teilnehmer-Pool oder die Panel-Anbindung, ganz ohne technisches Projekt. Wie eng wir dich beim Rollout, beim Onboarding und im laufenden Betrieb begleiten, stimmen wir auf dein Team ab.",
  },
  {
    q: "Ist das DSGVO-konform?",
    a: "Klymeo ist in Deutschland gebaut, in Frankfurt gehostet und DSGVO-nativ, ausgerichtet auf den EU AI Act. Datenschutz ist die Grundlage der Plattform, nicht der Nachgedanke — das gilt für jede Methode und jeden Account.",
  },
  {
    q: "Gibt es einen Piloten oder Einstieg?",
    a: "Ein begleiteter Einstieg ist möglich. Wir definieren gemeinsam einen klaren Rahmen, in dem du Klymeo an deinen echten Gesprächen erlebst, bevor du dich festlegst. Wie dieser Einstieg konkret aussieht, besprechen wir im Demo-Call.",
  },
];

const FAQPAGE_JSONLD = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: FAQ_ITEMS_DE.map((it) => ({
    "@type": "Question",
    name: it.q,
    acceptedAnswer: { "@type": "Answer", text: it.a },
  })),
};

// ── Seiten-Copy (DE). EN noch nicht getextet → DE-Fallback (EN=DE).
// FAQ_ITEMS_DE bleibt die EINE deutsche Quelle und speist sowohl die
// FAQPage-JSON-LD oben als auch die <FAQ items>-Prop unten.
const CONTENT_DE = {
  // 1 ── Hero
  heroEyebrow: "Preise",
  heroTitle:
    "Du zahlst für das, was du nutzt — nicht für ein Paket, das nicht passt.",
  heroLead:
    "Klymeo passt sich an dein Team, die Methoden und den Umfang an. Den konkreten Preis legen wir gemeinsam im Gespräch fest — transparent, ohne Schubladen-Tarif.",
  heroCtaPrimary: "Demo buchen →",
  heroCtaSecondary: "Plattform ansehen",

  // 2 ── Wie Custom-Pricing funktioniert
  factorsEyebrow: "So funktioniert unser Pricing",
  factorsTitle: "Vier Faktoren bestimmen deinen Preis.",
  factorsLead:
    "Custom heißt nicht intransparent. Der Preis ergibt sich aus dem, was du tatsächlich nutzt — und genau diese vier Stellschrauben gehen wir im Demo-Call gemeinsam durch.",
  factors: FACTORS_DE,

  // 3 ── Methoden-Baukasten (PlatformModules)
  modulesEyebrow: "Der Baukasten",
  modulesTitle: "Starte mit einer Methode. Nimm die anderen dazu.",
  modulesLead:
    "Vier Methoden auf einer gemeinsamen KI-Engine. Du musst nicht alles auf einmal nehmen — wähl, was heute zählt, und erweitere, wenn dein Team so weit ist.",

  // 4 ── Was immer dabei ist
  includedEyebrow: "In jedem Konto",
  includedTitle: "Was bei jedem Klymeo-Konto dabei ist.",
  includedLead:
    "Unabhängig davon, welche Methoden du wählst: Diese Grundlagen gelten für jeden Account — die DACH-Souveränität, auf die es in Europa ankommt, und das Beleg-Versprechen, das durch jede Methode läuft.",
  included: ALWAYS_INCLUDED_DE,
  includedFootnote: (
    <>
      Du willst Klymeo erst an deinen eigenen Gesprächen sehen? Ein begleiteter
      Einstieg ist möglich — den passenden Rahmen besprechen wir im Demo-Call.
    </>
  ),

  // 6 ── FAQ
  faqEyebrow: "Häufige Fragen",
  faqTitle: "Alles, was du zum Pricing wissen willst.",
  faqLead:
    "Die Fragen, die vor einem Custom-Angebot am häufigsten kommen — ehrlich beantwortet.",
  faqItems: FAQ_ITEMS_DE as FaqItem[],

  // 6 ── Abschluss-CTA (Twilight)
  ctaEyebrow: "Loslegen",
  ctaTitle: "Sprich mit uns über deinen Umfang.",
  ctaLead: (
    <>
      In einem kurzen Gespräch klären wir, welche Methoden, welcher Umfang und
      welche Begleitung zu deinem Team passen — und du siehst, was Klymeo an
      deinen echten Gesprächen leistet.
    </>
  ),
  ctaPrimary: "Demo buchen →",
  ctaSecondary: "Plattform ansehen",
};

export default async function PreisePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const c = localizedContent(lang, { de: CONTENT_DE });
  return (
    <>
      <JsonLd data={FAQPAGE_JSONLD} />

      {/* 1 ── HERO ─────────────────────────────────────────────────────────── */}
      <Section className="relative overflow-hidden pt-14 sm:pt-20">
        <HeroAtmosphere />
        <Container>
          <Reveal>
            <SectionHeading
              as="h1"
              eyebrow={c.heroEyebrow}
              title={c.heroTitle}
              lead={c.heroLead}
            />
          </Reveal>
          <Reveal>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <CtaLink href={DEMO_BOOKING_URL} variant="primary" size="lg">
                {c.heroCtaPrimary}
              </CtaLink>
              <CtaLink href="/produkt" variant="secondary" size="lg">
                {c.heroCtaSecondary}
              </CtaLink>
            </div>
          </Reveal>
        </Container>
      </Section>

      {/* 2 ── WIE CUSTOM-PRICING FUNKTIONIERT ──────────────────────────────── */}
      <Section tone="muted">
        <Container>
          <Reveal>
            <SectionHeading
              eyebrow={c.factorsEyebrow}
              title={c.factorsTitle}
              lead={c.factorsLead}
            />
          </Reveal>
          <div className="mt-14 grid grid-cols-1 gap-px overflow-hidden rounded border border-neutral-200 bg-neutral-200 sm:grid-cols-2 lg:grid-cols-4">
            {c.factors.map((f, i) => (
              <Reveal
                key={f.title}
                y={0}
                delay={i * 0.06}
                className="flex h-full flex-col gap-3 bg-neutral-0 p-7"
              >
                <f.Icon className="h-6 w-6 text-primary-600" />
                <h3 className="font-marketing text-lg font-semibold leading-snug text-neutral-900">
                  {f.title}
                </h3>
                <p className="text-sm leading-relaxed text-neutral-500">
                  {f.body}
                </p>
              </Reveal>
            ))}
          </div>
        </Container>
      </Section>

      {/* 3 ── METHODEN-BAUKASTEN (kanonische PlatformModules, einfarbige Headline) */}
      <PlatformModules
        eyebrow={c.modulesEyebrow}
        title={c.modulesTitle}
        lead={c.modulesLead}
      />

      {/* 4 ── WAS IMMER DABEI IST ───────────────────────────────────────────── */}
      <Section>
        <Container>
          <Reveal>
            <SectionHeading
              eyebrow={c.includedEyebrow}
              title={c.includedTitle}
              lead={c.includedLead}
            />
          </Reveal>
          <div className="mt-14 grid grid-cols-1 gap-px overflow-hidden rounded border border-neutral-200 bg-neutral-200 sm:grid-cols-2 lg:grid-cols-3">
            {c.included.map((a, i) => (
              <Reveal
                key={a.label}
                y={0}
                delay={i * 0.05}
                className="flex h-full items-start gap-3.5 bg-neutral-0 p-7"
              >
                <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded border border-primary-200 text-primary-600">
                  <a.Icon className="h-[18px] w-[18px]" />
                </span>
                <div>
                  <div className="text-[14px] font-semibold text-neutral-900">
                    {a.label}
                  </div>
                  <div className="mt-1 text-[13px] leading-relaxed text-neutral-500">
                    {a.sub}
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
          <Reveal>
            <p className="mx-auto mt-10 max-w-2xl text-center text-[14px] leading-relaxed text-neutral-500">
              {c.includedFootnote}
            </p>
          </Reveal>
        </Container>
      </Section>

      {/* 6 ── FAQ ──────────────────────────────────────────────────────────── */}
      <FAQ
        eyebrow={c.faqEyebrow}
        title={c.faqTitle}
        lead={c.faqLead}
        items={c.faqItems}
        tone="muted"
      />

      {/* 6 ── ABSCHLUSS-CTA (Twilight-Anker mit Sternen) ───────────────────── */}
      <section className="st-on-dark st-dusk st-stars relative overflow-hidden">
        <Container className="relative z-10 py-20 sm:py-28">
          <Reveal>
            <div className="mx-auto flex max-w-2xl flex-col items-center gap-5 text-center">
              <span className="inline-flex items-center gap-2.5 text-[11px] font-medium uppercase tracking-[0.18em] text-primary-300">
                <span aria-hidden className="h-px w-6 bg-primary-400" />
                {c.ctaEyebrow}
              </span>
              <h2 className="font-marketing text-[clamp(28px,4vw,46px)] font-semibold leading-[1.08] tracking-[-0.02em] text-white">
                {c.ctaTitle}
              </h2>
              <p className="max-w-xl text-[17px] leading-relaxed text-neutral-300">
                {c.ctaLead}
              </p>
              <div className="mt-2 flex flex-col items-center gap-3 sm:flex-row">
                <CtaLink href={DEMO_BOOKING_URL} variant="secondary" size="lg">
                  {c.ctaPrimary}
                </CtaLink>
                <Link
                  href="/produkt"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded border border-white/25 px-6 text-[15px] font-medium text-neutral-300 transition-colors hover:border-white/50 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-anchor"
                >
                  {c.ctaSecondary}
                </Link>
              </div>
            </div>
          </Reveal>
        </Container>
      </section>
    </>
  );
}
