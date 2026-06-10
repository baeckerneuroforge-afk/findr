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
  MicIcon,
  ImageIcon,
  DownloadIcon,
  CheckIcon,
  RadarIcon,
  HexagonIcon,
  type IconName,
} from "./icons";

/**
 * Shared template for the Market-Research INDUSTRY pages (/branchen/<slug>).
 *
 * Five segments — Mittelstand, B2C & Konsumgüter, B2B, Design & Agenturen,
 * Industrie — one engine. Every page composes the same blocks in the same
 * order so the five segments read as equally weighted; only the
 * segment-specific copy in the passed-in `content` varies:
 *
 *   ModuleHero (canvas) → Pain (cream) → HowItWorks (canvas) →
 *   Solution (cream) → Proactive (canvas) → ProofPoints (canvas) →
 *   IndustryGrid (cream) → CTASection (canvas)
 *
 * → the homepage's canvas/cream rhythm, single-ink headings, Reveal staggers
 * and reduced-motion-safe atmosphere, exactly like the method pages.
 *
 * TWO ANGLES, ONE PROMISE: the page deliberately shows both sides of the same
 * Market-Research engine. The Pain → Solution pair is the REACTIVE angle —
 * the voice behind what already happened, the gap a dashboard leaves open
 * (sachlich, not fear-framed). The Proactive band is the FORWARD angle — the
 * same studies run BEFORE the decision (launch / roll-out / build, per
 * segment), to validate instead of guess. Both land on findr.'s one promise:
 * echte Gespräche mit echten Menschen, belegt statt geraten.
 *
 * GROUNDING: the steps and proof points below are the REAL platform
 * capabilities — KI-/Voice-Interviews (/api/interview/[token]/voice +
 * /api/voice/*), Stimulus (/api/research/plans/[id]/stimulus), Screening +
 * Quoten + Panel + Open-Link (research/plans/[id]/*), Markt-Linse,
 * deterministische Cross-Study-Zählung und der Synthese-Export als PDF &
 * PowerPoint (synthesis/{pdf,pptx}). The pages SHARPEN the existing story
 * onto each segment — they invent NO new features.
 */

// ── The real Market-Research flow ─────────────────────────────────────────────
// Shared by all five industry pages so there is one source of "what Market
// Research does"; only the section LEAD is tuned per segment.
const MR_STEPS: HowStep[] = [
  {
    phase: "Aufsetzen",
    title: "Studie, Screening & Quoten definieren",
    body: "Leg pro Frage eine eigene Interview-Studie an, setz ein Screening-Gate und Quoten davor — nur die passende Zielgruppe kommt ins Interview, der Rest wird sauber und DSGVO-konform abgewiesen.",
    tag: "Live",
  },
  {
    phase: "Einsammeln",
    title: "Offener Link, eigener Pool oder Panel",
    body: "Teil einen offenen Studien-Link, lade deinen eigenen Teilnehmer-Pool ein oder rekrutiere über die Panel-Anbindung. Teilnehmer:innen starten selbst — das KI-Interview läuft auf Deutsch, auf Wunsch hörbar vom Voice-Agent geführt.",
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
    title: "KI-Interviews auf Deutsch — auch per Voice",
    body: "Strukturierte Tiefeninterviews in DACH-Gesprächssprache. Auf Wunsch führt der Voice-Agent das Gespräch hörbar — Teilnehmer:innen sprechen einfach, das Transkript bleibt die Quelle.",
    Icon: MicIcon,
    tag: "Live",
  },
  {
    title: "Stimulus: Entwürfe live zeigen",
    body: "Zeig Konzepte, Packshots, Anzeigen oder Landingpages direkt im Interview — die Zielgruppe nimmt Bezug auf genau das Material, das du testen willst.",
    Icon: ImageIcon,
    tag: "Live",
  },
  {
    title: "Screening-Gate & Quoten",
    body: "Qualifizier Teilnehmer:innen vor dem Interview und steuer die Stichprobe — die richtige Zielgruppe kommt rein, der Rest wird sauber und DSGVO-konform abgewiesen.",
    Icon: CheckIcon,
    tag: "Live",
  },
  {
    title: "Markt-Linse",
    body: "Extrahiert Preis-Signale, Kaufabsicht, Segment und Wettbewerb — zugeschnitten auf Markt- und Verbraucherfragen, im Transkript verankert.",
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
    title: "Export als PDF & PowerPoint",
    body: "Die Synthese als klarer Report oder fertiges Folien-Deck im eigenen Branding — plus teilbare Ergebnis-Links für Stakeholder.",
    Icon: DownloadIcon,
    tag: "Live",
  },
];

// ── Industry registry (single source for footer + cross-links + slugs) ───────
// `icon` is additive: the industry PAGES never render a per-industry icon, but
// the "Branchen" mega-menu panel does, so the icon NAME lives here (single
// source, serializable) alongside the slug/name/tagline it already owned.
export type IndustryRef = {
  slug: string;
  name: string;
  tagline: string;
  icon: IconName;
};

export const INDUSTRIES: IndustryRef[] = [
  {
    slug: "mittelstand",
    name: "Mittelstand",
    tagline: "Entscheider-Wissen ohne Institutsbudget — direkt von deinen Zielgruppen.",
    icon: "FactoryIcon",
  },
  {
    slug: "b2c",
    name: "B2C & Konsumgüter",
    tagline: "Käufer verstehen: Produkt, Marke, Preis — belegt vor dem Launch.",
    icon: "ShoppingBagIcon",
  },
  {
    slug: "b2b",
    name: "B2B",
    tagline: "Buying-Center im O-Ton: Entscheider, Anwender, Einwände.",
    icon: "NetworkIcon",
  },
  {
    slug: "design-agenturen",
    name: "Design & Agenturen",
    tagline: "Entwürfe vor dem Pitch testen — Creative-Feedback in Tagen, nicht Wochen.",
    icon: "PenIcon",
  },
  {
    slug: "industrie",
    name: "Industrie",
    tagline: "Anwender-Feedback von der Fläche — bevor investiert wird.",
    icon: "CpuIcon",
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
  /**
   * The PROACTIVE angle — validate BEFORE the decision, per-industry axis
   * (Konsumgüter = Launch-Validierung, Handel = Sortiment/Konzept vor dem
   * Roll-out, Tech = Feature-Wunsch vor dem Build). The forward-looking
   * counterpart to the reactive pain/solution: the SAME engine run earlier.
   * Mirrors the `solution` shape so the template stays one code path; rendered
   * on the canvas surface with the violet (neutral-tone) "validation" card.
   */
  proactive: {
    eyebrow: string;
    title: ReactNode;
    body: ReactNode;
    /** The forward payoff — the belegte basis you have before you commit. */
    payoff: { strong: string; body: ReactNode };
    /** Violet card — a "vor der Entscheidung" validation example. */
    card: { badge: string; rows: ExampleRow[] };
  };
  /** Industry-tuned lead for the ProofPoints (capabilities stay the real ones). */
  proofLead: ReactNode;
  cta: { title: ReactNode; lead: ReactNode };
};

/**
 * Two-column "narrative + card" band (same mould as the method pages'
 * solution section). `tone` paints the band; the card sits on the right and
 * pops on the muted background.
 */
function NarrativeBand({
  eyebrow,
  title,
  children,
  card,
  tone = "muted",
}: {
  eyebrow: string;
  title: ReactNode;
  children: ReactNode;
  card: ReactNode;
  /** Band surface. Pain/Solution keep the cream "rest" band (default); the
   * Proactive band passes "default" to sit on the canvas and read as its own
   * forward beat. */
  tone?: "default" | "muted";
}) {
  return (
    <Section tone={tone}>
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
    <div className="rounded border-l-2 border-primary-300 bg-white py-4 pl-4 pr-3 text-[15px] leading-relaxed text-neutral-700">
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
                  href="/produkt"
                  className="group flex h-full flex-col gap-2 bg-white p-6 transition-colors hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500"
                >
                  <div className="flex items-center justify-between gap-2 font-marketing text-base font-semibold text-primary-700">
                    Die Plattform im Detail
                    <span
                      aria-hidden
                      className="transition-transform group-hover:translate-x-0.5"
                    >
                      →
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-neutral-500">
                    Die Engine hinter allen Branchen: Voice-Interviews,
                    Stimulus, Screening, Synthese mit PDF- & PowerPoint-Export
                    und die deterministische Cross-Study-Zählung.
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
        secondary={{ label: "Plattform ansehen", href: "/produkt" }}
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

      {/* The PROACTIVE angle: the same Market-Research engine run BEFORE the
          decision (launch / roll-out / build, per industry). A forward, positive
          counterpart to the reactive gap above — validate instead of guess. The
          canvas tone sets it apart from the two cream payoff bands; the violet
          (neutral) card shows a "vor der Entscheidung" validation result. */}
      <NarrativeBand
        tone="default"
        eyebrow={content.proactive.eyebrow}
        title={content.proactive.title}
        card={<ExampleCard tone="neutral" badge={content.proactive.card.badge} rows={content.proactive.card.rows} />}
      >
        <p className="text-[16px] leading-relaxed text-neutral-700">
          {content.proactive.body}
        </p>
        <Callout strong={content.proactive.payoff.strong} body={content.proactive.payoff.body} />
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
        secondary={{ label: "Plattform ansehen", href: "/produkt" }}
      />
    </>
  );
}
