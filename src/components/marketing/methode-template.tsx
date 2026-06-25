import Link from "next/link";
import type { ReactNode } from "react";
import { Container, Section, Eyebrow, StatusTag } from "./primitives";
import { Reveal } from "./Reveal";
import {
  ModuleHero,
  HowItWorks,
  ProofPoints,
  ExampleCard,
  type HowStep,
  type Proof,
  type ExampleRow,
} from "./module-template";
import { CTASection } from "./CTASection";
import { getModules } from "./PlatformModules";
import { DEMO_BOOKING_URL } from "@/lib/marketing/constants";
import {
  localizedContent,
  localizePath,
  MARKETING_DEFAULT_LOCALE,
  type Locale,
} from "@/i18n/marketing-locale";
import {
  LayersIcon,
  RadarIcon,
  CpuIcon,
  NetworkIcon,
  FileCheckIcon,
  TargetIcon,
} from "./icons";

/**
 * Shared template for the four MARKET-RESEARCH METHOD pages (/methoden/<slug>).
 *
 * The third public axis next to /produkt/<modul> and /branchen/<branche>: where a
 * module page explains the engine and an industry page sharpens it onto a market,
 * a method page explains ONE way Klymeo fragt — the methodical core that makes
 * the answer trustworthy. Every page composes the same blocks in the same order
 * so the four methods read as equally weighted; only the `content` varies:
 *
 *   ModuleHero (canvas, the page's single H1) → MethodStatus (warm ribbon,
 *   honest Live/Bald) → Pain "Wofür" (cream) → HowItWorks "Wie Klymeo fragt"
 *   (canvas, the differentiator) → Result "Was rauskommt" (cream) →
 *   ProofPoints (canvas, the shared synthesis engine) → MethodGrid (cream,
 *   cross-links) → CTASection (canvas)
 *
 * → the homepage's warm canvas/cream rhythm, single-ink headings, Reveal
 * staggers and reduced-motion-safe atmosphere, exactly like the module/industry
 * pages (which this template mirrors verbatim, incl. the NarrativeBand + Callout
 * helpers).
 *
 * HONESTY: all four methods run today (status "Live") — Bedarf & Verhalten,
 * Markenwahrnehmung, Konzept-Test and Creative-Test. The template surfaces each
 * method's status plainly via MethodStatus, the status-tagged HowItWorks steps
 * and the CTA copy, never dressing a not-yet-live capability up as available. The
 * methodical essence is grounded in the real
 * in-product use-case notes; the example cards use Klymeo's REAL interview
 * questions and describe the output honestly — NO invented metrics, quotes or
 * customers. The synthesis ProofPoints reuse the vetted homepage claims (all
 * six capabilities are live, matching the homepage synthesis section).
 */

// ── The shared synthesis engine — "was rauskommt", identical per method ───────
// Faithful to the vetted homepage synthesis section. The method only changes
// WHAT is probed; the engine that condenses the conversations is the same one
// for every method. All six capabilities are live, incl. Highlight-Reels
// (highlights route) and PDF & PowerPoint export (synthesis/{pdf,pptx} routes).
type ProofData = {
  title: { de: string; en: string };
  body: { de: string; en: string };
  Icon: Proof["Icon"];
  tag: Proof["tag"];
};

const SYNTHESIS_PROOF_DATA: ProofData[] = [
  {
    title: { de: "Automatische Verdichtung", en: "Automatic distillation" },
    body: {
      de: "Themen, Lager und Originalzitate über alle Interviews hinweg, ohne manuelles Tagging.",
      en: "Themes, camps and verbatim quotes across all interviews, without manual tagging.",
    },
    Icon: LayersIcon,
    tag: "Live",
  },
  {
    title: { de: "Studienübergreifende Muster", en: "Cross-study patterns" },
    body: {
      de: "Erkenne, was sich über mehrere Studien hinweg wiederholt — deterministisch gezählt, jede Zahl je Studie mit Zitat belegt.",
      en: "Spot what recurs across multiple studies — deterministically counted, every number backed by a quote per study.",
    },
    Icon: RadarIcon,
    tag: "Live",
  },
  {
    title: { de: "Mit den Daten chatten", en: "Chat with your data" },
    body: {
      de: "Stell dem gesamten Studien-Korpus Rückfragen und bekomme belegte Antworten.",
      en: "Ask follow-up questions of the entire study corpus and get evidenced answers.",
    },
    Icon: CpuIcon,
    tag: "Live",
  },
  {
    title: { de: "Teilbare Ergebnis-Links", en: "Shareable result links" },
    body: {
      de: "Synthese per Link an Stakeholder, auch extern, im eigenen Branding.",
      en: "Share the synthesis with stakeholders by link, including externally, in your own branding.",
    },
    Icon: NetworkIcon,
    tag: "Live",
  },
  {
    title: { de: "Export als PDF & PowerPoint", en: "Export as PDF & PowerPoint" },
    body: {
      de: "Ein klarer Report und ein fertiges Folien-Deck — im eigenen Branding, bereit fürs nächste Meeting.",
      en: "A clear report and a ready-made slide deck — in your own branding, ready for the next meeting.",
    },
    Icon: FileCheckIcon,
    tag: "Live",
  },
  {
    title: { de: "Highlight-Reels", en: "Highlight reels" },
    body: {
      de: "Die aussagekräftigsten Momente als teilbarer Zusammenschnitt.",
      en: "The most telling moments as a shareable cut.",
    },
    Icon: TargetIcon,
    tag: "Live",
  },
];

/** The shared synthesis engine, resolved per locale. `de` returns the originals
 *  verbatim (R1: /de byte-identical). */
export function getSynthesisProofs(locale: Locale): Proof[] {
  return SYNTHESIS_PROOF_DATA.map((p) => ({
    title: localizedContent(locale, p.title),
    body: localizedContent(locale, p.body),
    Icon: p.Icon,
    tag: p.tag,
  }));
}

/** Back-compat DE export for existing importers. */
export const SYNTHESIS_PROOFS: Proof[] = getSynthesisProofs(MARKETING_DEFAULT_LOCALE);

// ── Per-method content contract ───────────────────────────────────────────────
export type MethodContent = {
  slug: string;
  /** Whole-method availability — drives MethodStatus + the honest framing. */
  status: "Live" | "Bald";
  /** Hero eyebrow, e.g. "Methode · Bedarf & Verhalten". */
  eyebrow: string;
  heroTitle: ReactNode;
  heroSubhead: ReactNode;
  /** "Passt zu:" line under the hero. */
  audience: string;
  /** Honest one-liner under the hero (verfügbar heute vs. in Vorbereitung). */
  statusNote: ReactNode;
  /** "Wofür" — the occasion + the blind spot a survey/dashboard leaves open. */
  pain: {
    eyebrow: string;
    title: ReactNode;
    problem: ReactNode;
    stakes: { strong: string; body: ReactNode };
    /** Red "blind spot" card — what staying with the old method cannot show. */
    blindCard: { badge: string; rows: ExampleRow[] };
  };
  /** "Wie Klymeo fragt" — THE differentiator: the method's questioning logic. */
  how: { title: ReactNode; lead: ReactNode; steps: HowStep[] };
  /** "Was rauskommt" — narrative + a violet card built from REAL example
   *  questions and an honest description of the output (no invented numbers). */
  result: {
    eyebrow: string;
    title: ReactNode;
    body: ReactNode;
    payoff: { strong: string; body: ReactNode };
    card: { badge: string; rows: ExampleRow[] };
  };
  /** Lead above the shared synthesis ProofPoints. */
  proofLead: ReactNode;
  cta: { title: ReactNode; lead: ReactNode };
};

/**
 * Honest status ribbon under the hero — a slim warm strip carrying the Live/Bald
 * pill + one plain sentence. Dezent by design: it states what runs today and
 * what is in Vorbereitung without dressing a "Bald" method up as available.
 */
function MethodStatus({
  status,
  children,
  lang = MARKETING_DEFAULT_LOCALE,
}: {
  status: "Live" | "Bald";
  children: ReactNode;
  lang?: Locale;
}) {
  return (
    <div className="border-y border-neutral-200 bg-warm">
      <Container>
        <Reveal y={0}>
          <div className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:gap-4">
            <StatusTag status={status} lang={lang} />
            <p className="text-sm leading-relaxed text-neutral-700">{children}</p>
          </div>
        </Reveal>
      </Container>
    </div>
  );
}

/**
 * Two-column "narrative + card" band — copied verbatim from the role/industry
 * templates so the method pages read identically. Always muted so the white card
 * on the right pops and the page keeps the W-M-W-M rhythm.
 */
function NarrativeBand({
  eyebrow,
  title,
  children,
  card,
}: {
  eyebrow: string;
  title: ReactNode;
  children: ReactNode;
  card: ReactNode;
}) {
  return (
    <Section tone="muted">
      <Container>
        <div className="grid items-start gap-12 lg:grid-cols-2">
          <Reveal>
            <div className="flex flex-col gap-5">
              <Eyebrow>{eyebrow}</Eyebrow>
              <h2 className="font-marketing text-[clamp(26px,3.5vw,40px)] [font-weight:var(--st-display-weight)] leading-[1.1] tracking-[-0.02em] text-neutral-900">
                {title}
              </h2>
              {children}
            </div>
          </Reveal>
          <Reveal delay={0.1}>{card}</Reveal>
        </div>
      </Container>
    </Section>
  );
}

/** Bordered accent callout used inside the narrative bands. */
function Callout({ strong, body }: { strong: string; body: ReactNode }) {
  return (
    <div className="rounded border-l-2 border-primary-300 bg-neutral-0 py-4 pl-4 pr-3 text-[15px] leading-relaxed text-neutral-700">
      <strong className="font-semibold text-neutral-900">{strong}</strong>
      <br />
      {body}
    </div>
  );
}

/**
 * Cross-promo grid on each method page: the three sibling methods (derived from
 * the single-source MODULES array, so labels/status/hrefs can never drift) plus
 * a link back to the Market-Research engine that powers the synthesis. The
 * sibling cards carry their honest Live/Bald pill. Mirrors IndustryGrid/RoleGrid.
 */
function MethodGrid({
  current,
  locale = MARKETING_DEFAULT_LOCALE,
}: {
  current: string;
  locale?: Locale;
}) {
  // The href in MODULE data is locale-INVARIANT (/methoden/<slug>); filter on
  // that bare href, then localize only the RENDERED href via localizePath.
  const currentHref = `/methoden/${current}`;
  const others = getModules(locale).filter((m) => m.href !== currentHref);
  return (
    <Section tone="muted">
      <Container>
        <Reveal>
          <div className="flex flex-col gap-6">
            <Eyebrow>
              {localizedContent(locale, {
                de: "Weitere Methoden",
                en: "More methods",
              })}
            </Eyebrow>
            <div className="grid grid-cols-1 gap-px overflow-hidden rounded border border-neutral-200 bg-neutral-200 sm:grid-cols-2 lg:grid-cols-4">
              {others.map((m) => (
                <Link
                  key={m.href}
                  href={localizePath(locale, m.href)}
                  className="group flex h-full flex-col gap-3 bg-neutral-0 p-6 transition-colors hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500"
                >
                  <div className="flex items-center justify-between gap-2 font-marketing text-base [font-weight:var(--st-display-weight)] text-neutral-900">
                    {m.name}
                    <span
                      aria-hidden
                      className="text-neutral-500 transition-transform group-hover:translate-x-0.5"
                    >
                      →
                    </span>
                  </div>
                  <StatusTag status={m.status} lang={locale} />
                  <p className="text-sm leading-relaxed text-neutral-500">
                    {m.blurb}
                  </p>
                </Link>
              ))}
              <Link
                href={localizePath(locale, "/produkt")}
                className="group flex h-full flex-col gap-3 bg-neutral-0 p-6 transition-colors hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500"
              >
                <div className="flex items-center justify-between gap-2 font-marketing text-base [font-weight:var(--st-display-weight)] text-neutral-900">
                  {localizedContent(locale, {
                    de: "Die Engine dahinter",
                    en: "The engine behind it",
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
                    de: "Voice-Agent, Stimulus, Synthese mit PDF- & PowerPoint-Export und die deterministische Cross-Study-Zählung — die Plattform hinter allen Methoden.",
                    en: "Voice Agent, Stimulus, synthesis with PDF & PowerPoint export and deterministic cross-study counting — the platform behind every method.",
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

// ── The full method page ──────────────────────────────────────────────────────
export function MethodPage({
  content,
  locale = MARKETING_DEFAULT_LOCALE,
}: {
  content: MethodContent;
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

      {/* Honest availability — stated immediately under the hero. */}
      <MethodStatus status={content.status} lang={locale}>
        {content.statusNote}
      </MethodStatus>

      {/* "Wofür" — der Anlass. The red card makes the cost of survey-/dashboard-
          only visible (sachlich, not fear-framed). */}
      <NarrativeBand
        eyebrow={content.pain.eyebrow}
        title={content.pain.title}
        card={
          <ExampleCard
            tone="risk"
            badge={content.pain.blindCard.badge}
            rows={content.pain.blindCard.rows}
          />
        }
      >
        <p className="text-[16px] leading-relaxed text-neutral-500">
          {content.pain.problem}
        </p>
        <Callout strong={content.pain.stakes.strong} body={content.pain.stakes.body} />
      </NarrativeBand>

      {/* "Wie Klymeo fragt" — the methodical core, the page's reason to exist. */}
      <HowItWorks
        locale={locale}
        eyebrow={localizedContent(locale, {
          de: "Wie Klymeo fragt",
          en: "How Klymeo asks",
        })}
        title={content.how.title}
        lead={content.how.lead}
        steps={content.how.steps}
      />

      {/* "Was rauskommt" — narrative + a violet card built from Klymeo's REAL
          example questions and an honest description of the output. */}
      <NarrativeBand
        eyebrow={content.result.eyebrow}
        title={content.result.title}
        card={
          <ExampleCard
            tone="neutral"
            badge={content.result.card.badge}
            rows={content.result.card.rows}
          />
        }
      >
        <p className="text-[16px] leading-relaxed text-neutral-700">
          {content.result.body}
        </p>
        <Callout
          strong={content.result.payoff.strong}
          body={content.result.payoff.body}
        />
      </NarrativeBand>

      {/* "Was rauskommt", konkret — the shared synthesis engine, same Live/Bald. */}
      <ProofPoints
        locale={locale}
        eyebrow={localizedContent(locale, {
          de: "Belegt, nicht geraten",
          en: "Evidenced, not guessed",
        })}
        title={localizedContent(locale, {
          de: <>Was aus den Gesprächen wird.</>,
          en: <>What the conversations become.</>,
        })}
        lead={content.proofLead}
        points={getSynthesisProofs(locale)}
      />

      <MethodGrid current={content.slug} locale={locale} />

      <CTASection
        lang={locale}
        title={content.cta.title}
        lead={content.cta.lead}
        secondary={{ label: platformLabel, href: platformHref }}
      />
    </>
  );
}
