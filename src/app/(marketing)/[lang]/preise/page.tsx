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
  HexagonIcon,
  TrendingUpIcon,
  NetworkIcon,
  FileCheckIcon,
  MapPinIcon,
  ServerIcon,
  ShieldCheckIcon,
  CpuIcon,
  CheckIcon,
} from "@/components/marketing/icons";
import { ogDefaultsFor, buildAlternates } from "@/lib/marketing/seo";
import {
  localizedContent,
  localizePath,
  resolveLocale,
  toBcp47,
  type Locale,
} from "@/i18n/marketing-locale";
import type { ComponentType, SVGProps } from "react";

const PATH = "/preise";
const META = {
  title: { de: "Preise", en: "Pricing" },
  ogTitle: { de: "Preise — Klymeo", en: "Pricing — Klymeo" },
  description: {
    de: "Custom-based Pricing für Klymeo: Eine Lizenz, alle Methoden inklusive — du zahlst für Zugang, Umfang und Begleitung, die zu deinem Team passen. Den konkreten Preis legen wir gemeinsam im Demo-Call fest. In Frankfurt gehostet, DSGVO-konform.",
    en: "Custom pricing for Klymeo: one license, all methods included — you pay for the access, scope and support that fit your team. We set the actual price together in the demo call. Hosted in Frankfurt, GDPR-compliant.",
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

type IconType = ComponentType<SVGProps<SVGSVGElement>>;

// ── Sektion 2: Was den Preis bestimmt ──────────────────────────────────────
// Transparenz statt Zahl: die vier Stellschrauben (Zugang, Umfang, Begleitung,
// Laufzeit), aus denen sich der individuelle Preis ergibt — alle Methoden sind
// inklusive. Bewusst Fließtext, kein Bullet-Stakkato.
const FACTORS_DE: { Icon: IconType; title: string; body: string }[] = [
  {
    Icon: HexagonIcon,
    title: "Zugang",
    body: "Eine Lizenz für dein Team — und alle vier Methoden sind von Tag eins dabei. Du zahlst eine Grundgebühr für den Zugang, nicht pro Methode. Sitzplätze kommen hinzu, wie dein Team wächst.",
  },
  {
    Icon: TrendingUpIcon,
    title: "Umfang",
    body: "Wie viel du erhebst: parallele Studien und Reichweite. Interviews führst du im vereinbarten Rahmen unbegrenzt — es gibt keine Abrechnung pro Gespräch. Der Umfang skaliert mit dem, was zur Größe deiner Organisation passt.",
  },
  {
    Icon: NetworkIcon,
    title: "Begleitung",
    body: "Von schlankem Start bis zum eng begleiteten Rollout: Wie viel Onboarding, Schulung und laufende Betreuung du brauchst, ist Teil deines Pakets — manche Teams legen allein los, andere wollen uns an ihrer Seite.",
  },
  {
    Icon: FileCheckIcon,
    title: "Laufzeit",
    body: "Monatlich flexibel oder mit fester Laufzeit: Wie verbindlich du planen willst, ist Teil des Gesprächs und wirkt sich auf die Konditionen aus. Ohne Kleingedrucktes, ohne automatische Fallen.",
  },
];

const FACTORS_EN: { Icon: IconType; title: string; body: string }[] = [
  {
    Icon: HexagonIcon,
    title: "Access",
    body: "One license for your team — and all four methods are there from day one. You pay a base fee for access, not per method. Seats are added as your team grows.",
  },
  {
    Icon: TrendingUpIcon,
    title: "Scope",
    body: "How much you collect: parallel studies and reach. Within the agreed scope you run unlimited interviews — there's no per-conversation billing. Scope scales with what fits the size of your organization.",
  },
  {
    Icon: NetworkIcon,
    title: "Support",
    body: "From a lean start to a closely guided roll-out: how much onboarding, training and ongoing support you need is part of your package — some teams launch on their own, others want us by their side.",
  },
  {
    Icon: FileCheckIcon,
    title: "Term",
    body: "Month-to-month or a fixed term: how firmly you want to plan is part of the conversation and shapes the terms. No fine print, no automatic traps.",
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

const ALWAYS_INCLUDED_EN: { Icon: IconType; label: string; sub: string }[] = [
  {
    Icon: MapPinIcon,
    label: "Built in Germany",
    sub: "Team & development based in Germany.",
  },
  {
    Icon: ServerIcon,
    label: "Hosted in the EU",
    sub: "Data center in Frankfurt am Main.",
  },
  {
    Icon: ShieldCheckIcon,
    label: "GDPR-compliant",
    sub: "Data protection as the foundation, not an afterthought.",
  },
  {
    Icon: FileCheckIcon,
    label: "EU AI Act",
    sub: "Aligned with the European AI framework.",
  },
  {
    Icon: CpuIcon,
    label: "AI interviews in German and English",
    sub: "In text or spoken via Voice Agent — in your participants' natural spoken language, where English-only tools reach their limits.",
  },
  {
    Icon: CheckIcon,
    label: "Evidenced, not guessed",
    sub: "Every statement is anchored to the exact moment in the transcript.",
  },
];

// FAQ — nimmt die typische Custom-Pricing-Reibung vorab (Outset-Stil). Antworten
// sind reiner Text, damit dieselbe Quelle die FAQPage-JSON-LD speist.
const FAQ_ITEMS_DE: { q: string; a: string }[] = [
  {
    q: "Warum nennt ihr keine festen Preise?",
    a: "Weil der passende Preis von Zugang, Umfang und Begleitung abhängt, die dein Team wirklich braucht — die Methoden sind ohnehin alle inklusive. Ein Schubladen-Tarif würde die meisten Teams entweder über- oder unterversorgen. Im Demo-Call schnüren wir stattdessen genau das, was zu deiner Situation passt — transparent und nachvollziehbar.",
  },
  {
    q: "Kann ich mit einer einzigen Methode starten?",
    a: "Ja — und du musst nichts extra buchen: Alle vier Methoden sind in deiner Lizenz enthalten. Du beginnst einfach mit der, die heute den größten Hebel hat, und nutzt die anderen, sobald dein Team so weit ist. Alle teilen dieselbe KI-Engine — bereits geführte Interviews zählen durchgängig weiter.",
  },
  {
    q: "Wonach richtet sich der Umfang, und wie wird abgerechnet?",
    a: "Der Umfang richtet sich nach dem Studien-Scope, den Sitzplätzen und dem Grad der Begleitung. Interviews führst du im vereinbarten Rahmen unbegrenzt — es gibt keine Abrechnung pro Gespräch. Welche Größen zu deinem Team passen, legen wir gemeinsam fest, ohne versteckte Posten und ohne Kleingedrucktes.",
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

const FAQ_ITEMS_EN: { q: string; a: string }[] = [
  {
    q: "Why don't you list fixed prices?",
    a: "Because the right price depends on the access, scope and support your team actually needs — the methods are all included anyway. A one-size-fits-all tier would either over- or under-serve most teams. In the demo call we instead put together exactly what fits your situation — transparent and easy to follow.",
  },
  {
    q: "Can I start with a single method?",
    a: "Yes — and you don't have to book anything extra: all four methods are included in your license. You simply start with the one that has the biggest leverage today, and use the others once your team is ready. They all share the same AI engine — interviews you've already run keep counting throughout.",
  },
  {
    q: "What does scope depend on, and how is it billed?",
    a: "Scope depends on the study scope, the seats and the level of support. Within the agreed scope you run unlimited interviews — there's no per-conversation billing. Which sizes fit your team we define together, with no hidden line items and no fine print.",
  },
  {
    q: "Do I get support with setup?",
    a: "Yes — though setup is deliberately small: studies run via shareable links, your own participant pool or the panel integration, with no technical project required. How closely we support you during roll-out, onboarding and ongoing operation we tailor to your team.",
  },
  {
    q: "Is this GDPR-compliant?",
    a: "Klymeo is built in Germany, hosted in Frankfurt and GDPR-native, aligned with the EU AI Act. Data protection is the foundation of the platform, not an afterthought — that holds for every method and every account.",
  },
  {
    q: "Is there a pilot or trial entry?",
    a: "A guided entry is possible. Together we define a clear scope in which you experience Klymeo with your real conversations before you commit. What that entry looks like in detail we discuss in the demo call.",
  },
];

// FAQPage JSON-LD — rebuilt per-locale INSIDE the component from the resolved
// FAQ items, so /en emits ENGLISH Q&A (not the German source) + inLanguage.
function buildFaqJsonLd(locale: Locale) {
  const items = localizedContent(locale, {
    de: FAQ_ITEMS_DE,
    en: FAQ_ITEMS_EN,
  });
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    inLanguage: toBcp47(locale),
    mainEntity: items.map((it) => ({
      "@type": "Question",
      name: it.q,
      acceptedAnswer: { "@type": "Answer", text: it.a },
    })),
  };
}

// ── Seiten-Copy (DE). EN noch nicht getextet → DE-Fallback (EN=DE).
// FAQ_ITEMS_DE bleibt die EINE deutsche Quelle und speist sowohl die
// FAQPage-JSON-LD oben als auch die <FAQ items>-Prop unten.
const CONTENT_DE = {
  // 1 ── Hero
  heroEyebrow: "Preise",
  heroTitle:
    "Eine Lizenz, alle Methoden — der Preis passt zu deinem Team, nicht zu einem Schubladen-Tarif.",
  heroLead:
    "Klymeo passt sich an dein Team und deinen Umfang an — alle vier Methoden sind dabei. Den konkreten Preis legen wir gemeinsam im Gespräch fest, transparent und ohne Schubladen-Tarif.",
  heroCtaPrimary: "Demo buchen →",
  heroCtaSecondary: "Plattform ansehen",

  // 2 ── Wie Custom-Pricing funktioniert
  factorsEyebrow: "So funktioniert unser Pricing",
  factorsTitle: "Vier Faktoren bestimmen deinen Preis.",
  factorsLead:
    "Alle vier Methoden sind immer inklusive. Was den Preis bestimmt, sind vier Stellschrauben — Zugang, Umfang, Begleitung und Laufzeit —, die wir im Demo-Call gemeinsam durchgehen.",
  factors: FACTORS_DE,

  // 3 ── Methoden-Block (PlatformModules)
  modulesEyebrow: "Vier Methoden, eine Engine",
  modulesTitle: "Alle vier Methoden inklusive — du startest mit der, die heute zählt.",
  modulesLead:
    "Vier Facetten einer gemeinsamen KI-Engine, alle ab Tag eins freigeschaltet. Du beginnst mit der Methode, die den größten Hebel hat — die anderen stehen bereit, sobald dein Team so weit ist. Geführte Interviews zählen durchgängig weiter.",

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
      In einem kurzen Gespräch klären wir, welcher Zugang, welcher Umfang und
      welche Begleitung zu deinem Team passen — alle Methoden sind dabei — und du
      siehst, was Klymeo an deinen echten Gesprächen leistet.
    </>
  ),
  ctaPrimary: "Demo buchen →",
  ctaSecondary: "Plattform ansehen",
};

// ── Page copy (EN). Mirrors CONTENT_DE field-for-field. FAQ_ITEMS_EN is the one
// English FAQ source; the FAQPage JSON-LD rebuild for /en is a later package (P4).
const CONTENT_EN = {
  // 1 ── Hero
  heroEyebrow: "Pricing",
  heroTitle:
    "One license, all methods — the price fits your team, not a one-size-fits-all tier.",
  heroLead:
    "Klymeo adapts to your team and your scope — all four methods are included. We set the actual price together in the conversation, transparent and without a one-size-fits-all tier.",
  heroCtaPrimary: "Book a demo →",
  heroCtaSecondary: "See the platform",

  // 2 ── Wie Custom-Pricing funktioniert
  factorsEyebrow: "How our pricing works",
  factorsTitle: "Four factors determine your price.",
  factorsLead:
    "All four methods are always included. What determines the price is four levers — access, scope, support and term — which we walk through together in the demo call.",
  factors: FACTORS_EN,

  // 3 ── Methoden-Block (PlatformModules)
  modulesEyebrow: "Four methods, one engine",
  modulesTitle: "All four methods included — you start with the one that counts today.",
  modulesLead:
    "Four facets of a shared AI engine, all unlocked from day one. You begin with the method that has the biggest leverage — the others stand ready as soon as your team is. Completed interviews keep counting throughout.",

  // 4 ── Was immer dabei ist
  includedEyebrow: "In every account",
  includedTitle: "What comes with every Klymeo account.",
  includedLead:
    "No matter which methods you choose: these fundamentals apply to every account — the European data sovereignty that matters here, and the evidence promise that runs through every method.",
  included: ALWAYS_INCLUDED_EN,
  includedFootnote: (
    <>
      Want to see Klymeo with your own conversations first? A guided entry is
      possible — we discuss the right scope in the demo call.
    </>
  ),

  // 6 ── FAQ
  faqEyebrow: "Common questions",
  faqTitle: "Everything you want to know about pricing.",
  faqLead:
    "The questions that come up most often before a custom quote — answered honestly.",
  faqItems: FAQ_ITEMS_EN as FaqItem[],

  // 6 ── Abschluss-CTA (Twilight)
  ctaEyebrow: "Get started",
  ctaTitle: "Talk to us about your scope.",
  ctaLead: (
    <>
      In a short conversation we clarify which access, which scope and which
      support fit your team — all methods are included — and you see what Klymeo
      delivers with your real conversations.
    </>
  ),
  ctaPrimary: "Book a demo →",
  ctaSecondary: "See the platform",
};

export default async function PreisePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const locale = resolveLocale(lang);
  const c = localizedContent(lang, { de: CONTENT_DE, en: CONTENT_EN });
  return (
    <>
      <JsonLd data={buildFaqJsonLd(locale)} />

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
                <f.Icon className="h-6 w-6 text-neutral-500" />
                <h3 className="font-marketing text-lg [font-weight:var(--st-display-weight)] leading-snug text-neutral-900">
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

      {/* 3 ── METHODEN-BLOCK (kanonische PlatformModules, einfarbige Headline) */}
      <PlatformModules
        locale={locale}
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
                <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded border border-primary-200 text-neutral-500">
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
              <span className="inline-flex items-center gap-2.5 text-[11px] font-medium uppercase tracking-[0.18em] text-anchor-foreground/65">
                <span aria-hidden className="h-px w-6 bg-primary-400" />
                {c.ctaEyebrow}
              </span>
              <h2 className="font-marketing text-[clamp(28px,4vw,46px)] [font-weight:var(--st-display-weight)] leading-[1.08] tracking-[-0.02em] text-white">
                {c.ctaTitle}
              </h2>
              <p className="max-w-xl text-[17px] leading-relaxed text-anchor-foreground/65">
                {c.ctaLead}
              </p>
              <div className="mt-2 flex flex-col items-center gap-3 sm:flex-row">
                <CtaLink href={DEMO_BOOKING_URL} variant="secondary" size="lg">
                  {c.ctaPrimary}
                </CtaLink>
                <Link
                  href="/produkt"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded border border-white/25 px-6 text-[15px] font-medium text-anchor-foreground/75 transition-colors hover:border-white/50 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-anchor"
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
