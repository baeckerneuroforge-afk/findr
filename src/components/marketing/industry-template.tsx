import Link from "next/link";
import type { ReactNode } from "react";
import {
  Container,
  Section,
  Eyebrow,
} from "./primitives";
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
import {
  TargetIcon,
  NetworkIcon,
  CheckIcon,
  RadarIcon,
  HexagonIcon,
  CpuIcon,
} from "./icons";

/**
 * Shared template for the B2C Market-Research INDUSTRY pages (/branchen/<slug>).
 *
 * These pages target consumer-facing brands (Konsumgüter, Handel, Tech) and show
 * ONLY the Market-Research module — never Sales/CS/Discovery, which are
 * irrelevant to this audience. Every page composes the same blocks in the same
 * order so the three industries read as equally weighted; only the
 * industry-specific copy in the passed-in `content` varies:
 *
 *   ModuleHero → Pain (muted) → HowItWorks (white) → Solution (muted) →
 *   ProofPoints (white) → IndustryGrid (muted) → CTASection (wash)
 *
 * → the homepage's W-M-W-M-W-M-Wash rhythm, single-ink headings, Reveal
 * staggers and reduced-motion-safe atmosphere, exactly like the module pages.
 *
 * GROUNDING: the steps and proof points below are the REAL Market-Research
 * capabilities, lifted faithfully from /produkt/market-research (product truth,
 * brand-neutral wording). The pages SHARPEN the existing story onto each
 * industry — they invent NO new features. Honest Live/Bald tags are preserved.
 */

// ── The real Market-Research flow (faithful to the module page) ──────────────
// Shared by all three industry pages so there is one source of "what Market
// Research does"; only the section LEAD is tuned per industry.
const MR_STEPS: HowStep[] = [
  {
    phase: "Aufsetzen",
    title: "Studie & Screening definieren",
    body: "Leg pro Frage eine eigene Interview-Studie an und setz ein Screening-Gate davor — nur die passende Zielgruppe kommt ins Interview, der Rest wird sauber und DSGVO-konform abgewiesen.",
    tag: "Live",
  },
  {
    phase: "Einsammeln",
    title: "Offener Link & Walk-ins",
    body: "Teil einen offenen Studien-Link — echte Teilnehmer:innen starten selbst ein KI-Interview auf Deutsch. Kein Panel-Dienstleister, kein Kalender-Ping-Pong, kein Moderator.",
    tag: "Live",
  },
  {
    phase: "Verstehen",
    title: "Synthese je Studie",
    body: "Aus jedem Interview wird belegte Evidenz — Themen, Kaufabsicht, Preis-Signale, Wettbewerb — mit der Markt-Linse extrahiert und im Transkript verankert statt im Bauchgefühl.",
    tag: "Live",
  },
  {
    phase: "Vergleichen",
    title: "Cross-Study, exakt gezählt",
    body: "Frag über alle Studien hinweg. findr. zählt deterministisch — „in 3 von 7 Studien“ — und belegt jede Zahl mit einem Zitat aus der jeweiligen Studie. Keine erfundenen Trends.",
    tag: "Live",
  },
];

const MR_PROOFS: Proof[] = [
  {
    title: "KI-Interviews auf Deutsch",
    body: "Strukturierte Interviews in DACH-Gesprächssprache mit echten Teilnehmer:innen — dort, wo rein englischsprachige Tools an ihre Grenzen kommen.",
    Icon: TargetIcon,
    tag: "Live",
  },
  {
    title: "Offener Studien-Link & Walk-ins",
    body: "Teil einen Link; echte Teilnehmer:innen starten selbst ein Interview — mit Kontingent und Ablaufdatum gegen Missbrauch.",
    Icon: NetworkIcon,
    tag: "Live",
  },
  {
    title: "Screening-Gate",
    body: "Qualifizier Teilnehmer:innen vor dem Interview — die richtige Zielgruppe kommt rein, der Rest wird sauber und DSGVO-konform abgewiesen.",
    Icon: CheckIcon,
    tag: "Live",
  },
  {
    title: "Markt-Linse",
    body: "Extrahiert Preis-Signale, Kaufabsicht, Segment und Wettbewerb — getrennt von der Discovery-Linse, zugeschnitten auf Markt- und Verbraucherfragen.",
    Icon: HexagonIcon,
    tag: "Live",
  },
  {
    title: "Deterministische Cross-Study-Zählung",
    body: "„In 3 von 7 Studien“ — exakt gezählt, nicht geschätzt; jede Zahl mit Zitat je Studie belegt. Keine erfundenen Trends.",
    Icon: RadarIcon,
    tag: "Live",
  },
  {
    title: "Highlight-Reels",
    body: "Belegte Interview-Ausschnitte automatisch zu einem Themen-Reel zusammengeschnitten — für das nächste Stakeholder-Review.",
    Icon: CpuIcon,
    tag: "Bald",
  },
];

// ── Industry registry (single source for footer + cross-links + slugs) ───────
export type IndustryRef = { slug: string; name: string; tagline: string };

export const INDUSTRIES: IndustryRef[] = [
  {
    slug: "konsumgueter",
    name: "Konsumgüter",
    tagline: "Rezeptur, Verpackung, Markenversprechen — belegt vor dem Launch.",
  },
  {
    slug: "handel",
    name: "Handel & E-Commerce",
    tagline: "Warenkorbabbruch, Sortiment, Preisgefühl — der Grund hinter dem Klick.",
  },
  {
    slug: "tech",
    name: "Tech & Consumer Apps",
    tagline: "Onboarding-Frust, Feature-Wunsch, Abwanderung — die Stimme hinter der Kurve.",
  },
];

// ── Per-industry content contract ────────────────────────────────────────────
export type IndustryContent = {
  slug: string;
  /** Hero eyebrow, e.g. "Branche · Konsumgüter". */
  eyebrow: string;
  heroTitle: ReactNode;
  heroSubhead: ReactNode;
  /** "Passt zu:" line under the hero. */
  audience: string;
  pain: {
    eyebrow: string;
    title: ReactNode;
    /** The industry pain, 1–2 sentences. */
    problem: ReactNode;
    /** The stakes — what getting it wrong costs (the bordered callout). */
    stakes: { strong: string; body: ReactNode };
    /** Red "blind spot" card — what click/sales data CANNOT show. */
    blindCard: { badge: string; rows: ExampleRow[] };
  };
  /** Industry-tuned lead for the shared 4-step Market-Research flow. */
  howLead: ReactNode;
  solution: {
    eyebrow: string;
    title: ReactNode;
    body: ReactNode;
    /** The payoff callout — the number you can defend. */
    payoff: { strong: string; body: ReactNode };
    /** Violet payoff card — the belegte "in X von Y Studien" answer. */
    answerCard: { badge: string; rows: ExampleRow[] };
  };
  /** Industry-tuned lead for the ProofPoints (capabilities stay the real ones). */
  proofLead: ReactNode;
  cta: { title: ReactNode; lead: ReactNode };
};

/**
 * Two-column "narrative + card" band (mirrors the /loesungen UseCase and the
 * Market-Research module's solution section). `tone` paints the band; the card
 * sits on the right and pops on the muted background.
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
    <div className="rounded border-l-2 border-primary-300 bg-primary-50/50 py-4 pl-4 pr-3 text-[15px] leading-relaxed text-neutral-700">
      <strong className="font-semibold text-neutral-900">{strong}</strong>
      <br />
      {body}
    </div>
  );
}

/**
 * Cross-promo grid: the three industries (excluding `current` if given) plus an
 * optional link back to the Market-Research module page. Reused on the module
 * page itself (no `current`, `showModuleLink={false}` → all three industries) and
 * on each industry page (`current` set → the two siblings + the module link).
 * `tone` lets the host page slot it into its own section rhythm.
 */
export function IndustryGrid({
  current,
  eyebrow = "Branchen",
  tone = "muted",
  showModuleLink = true,
}: {
  current?: string;
  eyebrow?: string;
  tone?: "default" | "muted";
  showModuleLink?: boolean;
}) {
  const shown = current
    ? INDUSTRIES.filter((i) => i.slug !== current)
    : INDUSTRIES;
  return (
    <Section tone={tone}>
      <Container>
        <Reveal>
          <div className="flex flex-col gap-6">
            <Eyebrow>{eyebrow}</Eyebrow>
            <div className="grid grid-cols-1 gap-px overflow-hidden rounded border border-neutral-200 bg-neutral-200 sm:grid-cols-2 lg:grid-cols-3">
              {shown.map((i) => (
                <Link
                  key={i.slug}
                  href={`/branchen/${i.slug}`}
                  className="group flex h-full flex-col gap-2 bg-white p-6 transition-colors hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500"
                >
                  <div className="flex items-center justify-between gap-2 font-marketing text-base font-semibold text-neutral-900">
                    {i.name}
                    <span
                      aria-hidden
                      className="text-primary-600 transition-transform group-hover:translate-x-0.5"
                    >
                      →
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-neutral-500">
                    {i.tagline}
                  </p>
                </Link>
              ))}
              {showModuleLink ? (
                <Link
                  href="/produkt/market-research"
                  className="group flex h-full flex-col gap-2 bg-white p-6 transition-colors hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500"
                >
                  <div className="flex items-center justify-between gap-2 font-marketing text-base font-semibold text-primary-700">
                    Market Research im Detail
                    <span
                      aria-hidden
                      className="transition-transform group-hover:translate-x-0.5"
                    >
                      →
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-neutral-500">
                    Das Modul hinter allen Branchen: KI-Interviews, Screening,
                    Synthese und die deterministische Cross-Study-Zählung.
                  </p>
                </Link>
              ) : null}
            </div>
          </div>
        </Reveal>
      </Container>
    </Section>
  );
}

// ── The full industry page ────────────────────────────────────────────────────
export function IndustryPage({ content }: { content: IndustryContent }) {
  return (
    <>
      <ModuleHero
        eyebrow={content.eyebrow}
        title={content.heroTitle}
        subhead={content.heroSubhead}
        audience={content.audience}
        primary={{ label: "Demo buchen →", href: "/demo" }}
        secondary={{ label: "Market Research ansehen", href: "/produkt/market-research" }}
      />

      {/* The industry pain: why market research matters HERE. The red "blind
          spot" card makes the cost of click-/sales-data-only visible. */}
      <NarrativeBand
        eyebrow={content.pain.eyebrow}
        title={content.pain.title}
        card={<ExampleCard tone="risk" badge={content.pain.blindCard.badge} rows={content.pain.blindCard.rows} />}
      >
        <p className="text-[16px] leading-relaxed text-neutral-500">
          {content.pain.problem}
        </p>
        <Callout strong={content.pain.stakes.strong} body={content.pain.stakes.body} />
      </NarrativeBand>

      {/* How findr.'s Market Research solves it — the four REAL steps, with an
          industry-tuned lead. */}
      <HowItWorks
        eyebrow="So funktioniert Market Research"
        title={<>Von der Studie zur belegten Zahl.</>}
        lead={content.howLead}
        steps={MR_STEPS}
      />

      {/* The belegte answer: the violet payoff card shows a deterministic
          "in X von Y Studien" result anchored to a quote. */}
      <NarrativeBand
        eyebrow={content.solution.eyebrow}
        title={content.solution.title}
        card={<ExampleCard tone="neutral" badge={content.solution.answerCard.badge} rows={content.solution.answerCard.rows} />}
      >
        <p className="text-[16px] leading-relaxed text-neutral-700">
          {content.solution.body}
        </p>
        <Callout strong={content.solution.payoff.strong} body={content.solution.payoff.body} />
      </NarrativeBand>

      {/* The real capabilities — same six as the module page, same Live/Bald. */}
      <ProofPoints
        eyebrow="Belegt, nicht geraten"
        title={<>Was Market Research konkret liefert.</>}
        lead={content.proofLead}
        points={MR_PROOFS}
      />

      <IndustryGrid current={content.slug} eyebrow="Weitere Branchen" />

      <CTASection
        title={content.cta.title}
        lead={content.cta.lead}
        secondary={{ label: "Market Research ansehen", href: "/produkt/market-research" }}
      />
    </>
  );
}
