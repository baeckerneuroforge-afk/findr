import Link from "next/link";
import type { ReactNode } from "react";
import { Container, Section, Eyebrow } from "./primitives";
import { Reveal } from "./Reveal";
import {
  ModuleHero,
  HowItWorks,
  ProofPoints,
  type HowStep,
  type Proof,
} from "./module-template";
import { PlatformModules } from "./PlatformModules";
import { CTASection } from "./CTASection";
import { getLiveUseCases, getUseCaseHref } from "./use-cases-data";
import { DEMO_BOOKING_URL } from "@/lib/marketing/constants";
import {
  localizedContent,
  localizePath,
  MARKETING_DEFAULT_LOCALE,
  type Locale,
} from "@/i18n/marketing-locale";

/**
 * Geteiltes Template für die ANWENDUNGSFALL-Seiten (/loesungen/<slug>).
 *
 * Komponiert dieselben Bausteine wie die Methoden-/Branchen-Seiten in derselben
 * Reihenfolge, damit alle Use Cases gleich gewichtet lesen — nur die Copy
 * variiert:
 *
 *   ModuleHero → HowItWorks → [Methoden-Grid, nur Marktforschung] →
 *   ProofPoints → UseCaseGrid (Querverweis) → CTASection
 *
 * GROUNDING: Jede Aussage stammt aus der real gebauten Engine (KI-Tiefen-
 * interviews, Voice-Agent, Stimulus, Screening/Quoten, Synthese, Cross-Study-
 * Zählung, PDF/PowerPoint-Export, DSGVO-nativ in Frankfurt). Keine Statistiken,
 * keine erfundenen Kunden, kein Video/Emotion/Screen-Recording-Claim.
 */

export type UseCaseContent = {
  slug: string;
  eyebrow: string;
  heroTitle: ReactNode;
  heroSubhead: ReactNode;
  audience?: string;
  how: {
    eyebrow?: ReactNode;
    title: ReactNode;
    lead?: ReactNode;
    steps: HowStep[];
  };
  /** Nur Marktforschung: die vier Methoden als Unterpunkte (PlatformModules). */
  methods?: {
    eyebrow?: ReactNode;
    title?: ReactNode;
    lead?: ReactNode;
  };
  proof: {
    eyebrow?: ReactNode;
    title: ReactNode;
    lead?: ReactNode;
    points: Proof[];
  };
  cta: { title: ReactNode; lead: ReactNode };
};

/**
 * Querverweis-Grid: die anderen LIVE Use Cases (ohne `current`) plus ein Link
 * auf die Plattform-Engine (/produkt). Spiegelt das IndustryGrid-Muster, liest
 * aber aus der Use-Case-Registry. "prepared"-Use-Cases erscheinen hier NICHT.
 */
export function UseCaseGrid({
  locale = MARKETING_DEFAULT_LOCALE,
  current,
  eyebrow = localizedContent(locale, {
    de: "Weitere Anwendungsfälle",
    en: "More use cases",
  }),
  tone = "muted",
}: {
  locale?: Locale;
  current?: string;
  eyebrow?: string;
  tone?: "default" | "muted";
}) {
  const cases = getLiveUseCases(locale).filter((u) => u.slug !== current);
  return (
    <Section tone={tone}>
      <Container>
        <Reveal>
          <div className="flex flex-col gap-6">
            <Eyebrow>{eyebrow}</Eyebrow>
            <div className="grid grid-cols-1 gap-px overflow-hidden rounded border border-neutral-200 bg-neutral-200 sm:grid-cols-2 lg:grid-cols-3">
              {cases.map((u) => (
                <Link
                  key={u.slug}
                  href={localizePath(locale, getUseCaseHref(u.slug))}
                  className="group flex h-full flex-col gap-2 bg-neutral-0 p-6 transition-colors hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500"
                >
                  <div className="flex items-center justify-between gap-2 font-marketing text-base font-semibold text-neutral-900">
                    {u.name}
                    <span
                      aria-hidden
                      className="text-primary-600 transition-transform group-hover:translate-x-0.5"
                    >
                      →
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-neutral-500">
                    {u.tagline}
                  </p>
                </Link>
              ))}
              <Link
                href={localizePath(locale, "/produkt")}
                className="group flex h-full flex-col gap-2 bg-neutral-0 p-6 transition-colors hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500"
              >
                <div className="flex items-center justify-between gap-2 font-marketing text-base font-semibold text-primary-700">
                  {localizedContent(locale, {
                    de: "Die Plattform im Detail",
                    en: "The platform in detail",
                  })}
                  <span
                    aria-hidden
                    className="transition-transform group-hover:translate-x-0.5"
                  >
                    →
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-neutral-500">
                  {localizedContent(locale, {
                    de: "Die Engine hinter allen Anwendungsfällen: KI-Interviews, Voice-Agent, Stimulus, Screening, Synthese mit PDF- & PowerPoint-Export.",
                    en: "The engine behind every use case: AI interviews, Voice Agent, Stimulus, screening, synthesis with PDF & PowerPoint export.",
                  })}
                </p>
              </Link>
            </div>
          </div>
        </Reveal>
      </Container>
    </Section>
  );
}

/** Die komplette Anwendungsfall-Seite. */
export function UseCasePage({
  content,
  locale = MARKETING_DEFAULT_LOCALE,
}: {
  content: UseCaseContent;
  locale?: Locale;
}) {
  const demoLabel = localizedContent(locale, {
    de: "Demo buchen →",
    en: "Book a demo →",
  });
  const platformLabel = localizedContent(locale, {
    de: "Plattform ansehen",
    en: "See the platform",
  });
  const platformHref = localizePath(locale, "/produkt");
  return (
    <>
      <ModuleHero
        locale={locale}
        eyebrow={content.eyebrow}
        title={content.heroTitle}
        subhead={content.heroSubhead}
        audience={content.audience}
        primary={{ label: demoLabel, href: DEMO_BOOKING_URL }}
        secondary={{ label: platformLabel, href: platformHref }}
      />

      <HowItWorks
        locale={locale}
        eyebrow={content.how.eyebrow}
        title={content.how.title}
        lead={content.how.lead}
        steps={content.how.steps}
        tone="muted"
      />

      {content.methods ? (
        <PlatformModules
          locale={locale}
          eyebrow={content.methods.eyebrow}
          title={content.methods.title}
          lead={content.methods.lead}
        />
      ) : null}

      <ProofPoints
        locale={locale}
        eyebrow={content.proof.eyebrow}
        title={content.proof.title}
        lead={content.proof.lead}
        points={content.proof.points}
      />

      <UseCaseGrid locale={locale} current={content.slug} />

      <CTASection
        lang={locale}
        title={content.cta.title}
        lead={content.cta.lead}
        secondary={{ label: platformLabel, href: platformHref }}
      />
    </>
  );
}
