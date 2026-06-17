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
import { MODULES } from "./PlatformModules";
import { DEMO_BOOKING_URL } from "@/lib/marketing/constants";
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
 * customers. The synthesis ProofPoints reuse the vetted homepage claims (only
 * Highlight-Reels carries the conservative "Bald" tag, matching the module page).
 */

// ── The shared synthesis engine — "was rauskommt", identical per method ───────
// Faithful to the vetted homepage synthesis section. The method only changes
// WHAT is probed; the engine that condenses the conversations is the same one
// for every method. Highlight-Reels stays "Bald" (the conservative claim);
// PDF & PowerPoint export are both real (synthesis/{pdf,pptx} routes).
const SYNTHESIS_PROOFS: Proof[] = [
  {
    title: "Automatische Verdichtung",
    body: "Themen, Lager und Originalzitate über alle Interviews hinweg, ohne manuelles Tagging.",
    Icon: LayersIcon,
    tag: "Live",
  },
  {
    title: "Studienübergreifende Muster",
    body: "Erkenne, was sich über mehrere Studien hinweg wiederholt — deterministisch gezählt, jede Zahl je Studie mit Zitat belegt.",
    Icon: RadarIcon,
    tag: "Live",
  },
  {
    title: "Mit den Daten chatten",
    body: "Stell dem gesamten Studien-Korpus Rückfragen und bekomme belegte Antworten.",
    Icon: CpuIcon,
    tag: "Live",
  },
  {
    title: "Teilbare Ergebnis-Links",
    body: "Synthese per Link an Stakeholder, auch extern, im eigenen Branding.",
    Icon: NetworkIcon,
    tag: "Live",
  },
  {
    title: "Export als PDF & PowerPoint",
    body: "Ein klarer Report und ein fertiges Folien-Deck — im eigenen Branding, bereit fürs nächste Meeting.",
    Icon: FileCheckIcon,
    tag: "Live",
  },
  {
    title: "Highlight-Reels",
    body: "Die aussagekräftigsten Momente als teilbarer Zusammenschnitt.",
    Icon: TargetIcon,
    tag: "Bald",
  },
];

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
}: {
  status: "Live" | "Bald";
  children: ReactNode;
}) {
  return (
    <div className="border-y border-neutral-200 bg-warm">
      <Container>
        <Reveal y={0}>
          <div className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:gap-4">
            <StatusTag status={status} />
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
              <h2 className="font-marketing text-[clamp(26px,3.5vw,40px)] font-semibold leading-[1.1] tracking-[-0.02em] text-neutral-900">
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
function MethodGrid({ current }: { current: string }) {
  const currentHref = `/methoden/${current}`;
  const others = MODULES.filter((m) => m.href !== currentHref);
  return (
    <Section tone="muted">
      <Container>
        <Reveal>
          <div className="flex flex-col gap-6">
            <Eyebrow>Weitere Methoden</Eyebrow>
            <div className="grid grid-cols-1 gap-px overflow-hidden rounded border border-neutral-200 bg-neutral-200 sm:grid-cols-2 lg:grid-cols-4">
              {others.map((m) => (
                <Link
                  key={m.href}
                  href={m.href}
                  className="group flex h-full flex-col gap-3 bg-neutral-0 p-6 transition-colors hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500"
                >
                  <div className="flex items-center justify-between gap-2 font-marketing text-base font-semibold text-neutral-900">
                    {m.name}
                    <span
                      aria-hidden
                      className="text-primary-600 transition-transform group-hover:translate-x-0.5"
                    >
                      →
                    </span>
                  </div>
                  <StatusTag status={m.status} />
                  <p className="text-sm leading-relaxed text-neutral-500">
                    {m.blurb}
                  </p>
                </Link>
              ))}
              <Link
                href="/produkt"
                className="group flex h-full flex-col gap-3 bg-neutral-0 p-6 transition-colors hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500"
              >
                <div className="flex items-center justify-between gap-2 font-marketing text-base font-semibold text-primary-700">
                  Die Engine dahinter
                  <span
                    aria-hidden
                    className="transition-transform group-hover:translate-x-0.5"
                  >
                    →
                  </span>
                </div>
                <p className="text-sm leading-relaxed text-neutral-500">
                  Voice-Agent, Stimulus, Synthese mit PDF- & PowerPoint-Export
                  und die deterministische Cross-Study-Zählung — die Plattform
                  hinter allen Methoden.
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
export function MethodPage({ content }: { content: MethodContent }) {
  return (
    <>
      <ModuleHero
        eyebrow={content.eyebrow}
        title={content.heroTitle}
        subhead={content.heroSubhead}
        audience={content.audience}
        primary={{ label: "Demo buchen →", href: DEMO_BOOKING_URL }}
        secondary={{ label: "Plattform ansehen", href: "/produkt" }}
      />

      {/* Honest availability — stated immediately under the hero. */}
      <MethodStatus status={content.status}>{content.statusNote}</MethodStatus>

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
        eyebrow="Wie Klymeo fragt"
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
        eyebrow="Belegt, nicht geraten"
        title={<>Was aus den Gesprächen wird.</>}
        lead={content.proofLead}
        points={SYNTHESIS_PROOFS}
      />

      <MethodGrid current={content.slug} />

      <CTASection
        title={content.cta.title}
        lead={content.cta.lead}
        secondary={{ label: "Plattform ansehen", href: "/produkt" }}
      />
    </>
  );
}
