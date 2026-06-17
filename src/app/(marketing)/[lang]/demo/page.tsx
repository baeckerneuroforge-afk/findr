import type { Metadata } from "next";
import type { ReactNode } from "react";
import {
  Container,
  Section,
  Eyebrow,
  CornerBrackets,
} from "@/components/marketing/primitives";
import { Hero } from "@/components/marketing/Hero";
import { CtaLink } from "@/components/marketing/CtaLink";
import { Reveal } from "@/components/marketing/Reveal";
import { DEMO_BOOKING_URL } from "@/lib/marketing/constants";
import { ogDefaultsFor, buildAlternates } from "@/lib/marketing/seo";
import {
  localizedContent,
  localizePath,
  resolveLocale,
} from "@/i18n/marketing-locale";

const PATH = "/demo";
const META = {
  title: { de: "Demo buchen", en: "Book a demo" },
  ogTitle: { de: "Demo buchen — Klymeo", en: "Book a demo — Klymeo" },
  description: {
    de: "Sieh in einer kurzen, persönlichen Demo, was Klymeo in echten Tiefeninterviews findet — vom Voice-Agent über Stimulus bis zum PowerPoint-Export. DSGVO-nativ, in der EU gehostet.",
    en: "See in a short, personal demo what Klymeo finds in real in-depth interviews — from the Voice Agent through Stimulus to the PowerPoint export. GDPR-native, hosted in the EU.",
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

/**
 * Per-locale page copy. German is the source of truth (byte-identical to the
 * original static page); English mirrors its structure exactly. Booking happens
 * via the external Cal.com scheduler (DEMO_BOOKING_URL), so no locale prefixing
 * applies to that href.
 */
type DemoContent = {
  heroEyebrow: string;
  heroTitle: ReactNode;
  heroSubhead: string;
  heroPrimaryLabel: string;
  heroTrust: string[];
  bookingEyebrow: string;
  bookingHeading: string;
  bookingBody: string;
  bookingCta: string;
  trustChips: string[];
};

const CONTENT_DE: DemoContent = {
  heroEyebrow: "Demo",
  heroTitle: (
    <>
      Sieh, was Klymeo in deinen{" "}
      Gesprächen findet.
    </>
  ),
  heroSubhead:
    "In einer kurzen, persönlichen Demo zeigen wir dir Klymeo an einem echten Studien-Beispiel — keine Folien, sondern deine Forschungsfrage: vom Voice-Interview über den Stimulus-Test bis zur exportierten Synthese.",
  heroPrimaryLabel: "Termin buchen →",
  // TODO D3: UWG-Claim — "DSGVO-nativ" ist eine werbliche Aussage, die vor
  // Live entweder belegt oder entschärft werden muss (Entscheidung André).
  heroTrust: ["DSGVO-nativ", "EU-gehostet · Frankfurt"],
  bookingEyebrow: "Termin wählen",
  bookingHeading: "15 Minuten, ein echtes Gespräch, deine Fragen.",
  bookingBody:
    "Such dir einen Termin aus, der dir passt. Wir bringen eine anonymisierte Beispiel-Studie mit oder setzen direkt eine Studie zu deiner eigenen Forschungsfrage auf — du entscheidest, was wir uns ansehen.",
  bookingCta: "Termin bei Klymeo buchen →",
  // TODO D3: UWG-Claims ("DSGVO-nativ", "EU-AI-Act-konform") vor Live
  // belegen oder entschärfen (Entscheidung André).
  trustChips: [
    "DSGVO-nativ",
    "In der EU gehostet · Frankfurt",
    "EU-AI-Act-konform",
  ],
};

const CONTENT_EN: DemoContent = {
  heroEyebrow: "Demo",
  heroTitle: (
    <>
      See what Klymeo finds in your{" "}
      conversations.
    </>
  ),
  heroSubhead:
    "In a short, personal demo we walk you through Klymeo on a real study example — no slides, just your research question: from the voice interview through the stimulus test to the exported synthesis.",
  heroPrimaryLabel: "Book a slot →",
  heroTrust: ["GDPR-native", "EU-hosted · Frankfurt"],
  bookingEyebrow: "Pick a time",
  bookingHeading: "15 minutes, a real conversation, your questions.",
  bookingBody:
    "Pick a time that works for you. We'll bring an anonymized example study or set up a study around your own research question right away — you decide what we look at.",
  bookingCta: "Book a slot with Klymeo →",
  trustChips: [
    "GDPR-native",
    "Hosted in the EU · Frankfurt",
    "EU AI Act-compliant",
  ],
};

export default async function DemoPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const c = localizedContent(lang, { de: CONTENT_DE, en: CONTENT_EN });

  return (
    <>
      <Hero
        eyebrow={c.heroEyebrow}
        title={c.heroTitle}
        subhead={c.heroSubhead}
        primary={{ label: c.heroPrimaryLabel, href: DEMO_BOOKING_URL }}
        trust={c.heroTrust}
      />

      {/* Buchungs-Bereich — handoff to the external Cal.com scheduler. We link
          out rather than iframe-embed the booking page; swap to a Cal embed
          here if an inline calendar is ever wanted. */}
      <Section tone="muted" className="pt-0 sm:pt-0">
        <Container>
          <Reveal>
            <div className="relative mx-auto flex max-w-2xl flex-col items-center gap-6 rounded border border-neutral-200 bg-neutral-0 px-6 py-14 text-center sm:px-12">
              <CornerBrackets className="border-primary-300" />
              <Eyebrow>{c.bookingEyebrow}</Eyebrow>
              <h2 className="font-marketing text-[clamp(24px,3vw,34px)] font-semibold leading-[1.12] tracking-[-0.02em] text-neutral-900">
                {c.bookingHeading}
              </h2>
              <p className="max-w-lg text-[16px] leading-relaxed text-neutral-500">
                {c.bookingBody}
              </p>
              <CtaLink href={DEMO_BOOKING_URL} variant="primary" size="lg">
                {c.bookingCta}
              </CtaLink>
            </div>
          </Reveal>
        </Container>
      </Section>

      {/* Trust-Zeile (DSGVO/EU). */}
      <Section className="pt-0 sm:pt-0">
        <Container>
          <Reveal>
            <ul className="mx-auto flex max-w-2xl flex-wrap items-center justify-center gap-x-6 gap-y-3 border-t border-neutral-200 pt-8 text-[13px] font-medium uppercase tracking-[0.04em] text-neutral-500">
              {c.trustChips.map((t) => (
                <li key={t} className="inline-flex items-center gap-2">
                  <span aria-hidden className="h-1 w-1 rounded-full bg-primary-400" />
                  {t}
                </li>
              ))}
            </ul>
          </Reveal>
        </Container>
      </Section>
    </>
  );
}
