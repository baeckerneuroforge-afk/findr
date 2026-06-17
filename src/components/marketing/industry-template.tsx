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
import { DEMO_BOOKING_URL } from "@/lib/marketing/constants";
import {
  localizedContent,
  localizePath,
  MARKETING_DEFAULT_LOCALE,
  type Locale,
} from "@/i18n/marketing-locale";
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
 * segment), to validate instead of guess. Both land on Klymeo's one promise:
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
type StepData = {
  phase: { de: string; en: string };
  title: { de: string; en: string };
  body: { de: string; en: string };
  tag: HowStep["tag"];
};

const MR_STEP_DATA: StepData[] = [
  {
    phase: { de: "Aufsetzen", en: "Set up" },
    title: {
      de: "Studie, Screening & Quoten definieren",
      en: "Define the study, screening & quotas",
    },
    body: {
      de: "Leg pro Frage eine eigene Interview-Studie an, setz ein Screening-Gate und Quoten davor — nur die passende Zielgruppe kommt ins Interview, der Rest wird sauber und DSGVO-konform abgewiesen.",
      en: "Set up a separate interview study per question, with a screening gate and quotas in front — only the right audience enters the interview, the rest is turned away cleanly and GDPR-compliantly.",
    },
    tag: "Live",
  },
  {
    phase: { de: "Einsammeln", en: "Collect" },
    title: {
      de: "Offener Link, eigener Pool oder Panel",
      en: "Open link, your own pool or panel",
    },
    body: {
      de: "Teil einen offenen Studien-Link, lade deinen eigenen Teilnehmer-Pool ein oder rekrutiere über die Panel-Anbindung. Teilnehmer:innen starten selbst — das KI-Interview läuft auf Deutsch, auf Wunsch hörbar vom Voice-Agent geführt.",
      en: "Share an open study link, invite your own participant pool or recruit through the panel integration. Participants start on their own — the AI interview runs in German and English, optionally led audibly by the Voice Agent.",
    },
    tag: "Live",
  },
  {
    phase: { de: "Verstehen", en: "Understand" },
    title: { de: "Synthese je Studie", en: "Synthesis per study" },
    body: {
      de: "Aus jedem Interview wird belegte Evidenz — Themen, Kaufabsicht, Preis-Signale, Wettbewerb — mit der Markt-Linse extrahiert und im Transkript verankert statt im Bauchgefühl.",
      en: "Every interview becomes backed-by-evidence findings — themes, purchase intent, pricing signals, competition — extracted with the Market Lens and anchored in the transcript instead of a gut feeling.",
    },
    tag: "Live",
  },
  {
    phase: { de: "Vergleichen", en: "Compare" },
    title: { de: "Cross-Study, exakt gezählt", en: "Cross-study, exactly counted" },
    body: {
      de: "Frag über alle Studien hinweg. Klymeo zählt deterministisch — „in 3 von 7 Studien“ — und belegt jede Zahl mit einem Zitat aus der jeweiligen Studie. Keine erfundenen Trends.",
      en: "Ask across all studies. Klymeo counts deterministically — “in 3 of 7 studies” — and backs every number with a quote from the respective study. No invented trends.",
    },
    tag: "Live",
  },
];

/** The shared 4-step Market-Research flow, resolved per locale (DE verbatim). */
export function getMrSteps(locale: Locale): HowStep[] {
  return MR_STEP_DATA.map((s) => ({
    phase: localizedContent(locale, s.phase),
    title: localizedContent(locale, s.title),
    body: localizedContent(locale, s.body),
    tag: s.tag,
  }));
}

/** Back-compat DE export for existing importers. */
export const MR_STEPS: HowStep[] = getMrSteps(MARKETING_DEFAULT_LOCALE);

type ProofData = {
  title: { de: string; en: string };
  body: { de: string; en: string };
  Icon: Proof["Icon"];
  tag: Proof["tag"];
};

const MR_PROOF_DATA: ProofData[] = [
  {
    title: {
      de: "KI-Interviews auf Deutsch — auch per Voice",
      en: "AI interviews in German and English — also by voice",
    },
    body: {
      de: "Strukturierte Tiefeninterviews in DACH-Gesprächssprache. Auf Wunsch führt der Voice-Agent das Gespräch hörbar — Teilnehmer:innen sprechen einfach, das Transkript bleibt die Quelle.",
      en: "Structured in-depth interviews in natural spoken language. On request the Voice Agent leads the conversation audibly — participants simply speak, the transcript stays the source.",
    },
    Icon: MicIcon,
    tag: "Live",
  },
  {
    title: { de: "Stimulus: Entwürfe live zeigen", en: "Stimulus: show drafts live" },
    body: {
      de: "Zeig Konzepte, Packshots, Anzeigen oder Landingpages direkt im Interview — die Zielgruppe nimmt Bezug auf genau das Material, das du testen willst.",
      en: "Show concepts, packshots, ads or landing pages right in the interview — your audience responds to exactly the material you want to test.",
    },
    Icon: ImageIcon,
    tag: "Live",
  },
  {
    title: { de: "Screening-Gate & Quoten", en: "Screening gate & quotas" },
    body: {
      de: "Qualifizier Teilnehmer:innen vor dem Interview und steuer die Stichprobe — die richtige Zielgruppe kommt rein, der Rest wird sauber und DSGVO-konform abgewiesen.",
      en: "Qualify participants before the interview and steer the sample — the right audience gets in, the rest is turned away cleanly and GDPR-compliantly.",
    },
    Icon: CheckIcon,
    tag: "Live",
  },
  {
    title: { de: "Markt-Linse", en: "Market Lens" },
    body: {
      de: "Extrahiert Preis-Signale, Kaufabsicht, Segment und Wettbewerb — zugeschnitten auf Markt- und Verbraucherfragen, im Transkript verankert.",
      en: "Extracts pricing signals, purchase intent, segment and competition — tailored to market and consumer questions, anchored in the transcript.",
    },
    Icon: HexagonIcon,
    tag: "Live",
  },
  {
    title: {
      de: "Deterministische Cross-Study-Zählung",
      en: "Deterministic cross-study counting",
    },
    body: {
      de: "„In 3 von 7 Studien“ — exakt gezählt, nicht geschätzt; jede Zahl mit Zitat je Studie belegt. Keine erfundenen Trends.",
      en: "“In 3 of 7 studies” — exactly counted, not estimated; every number backed by a quote per study. No invented trends.",
    },
    Icon: RadarIcon,
    tag: "Live",
  },
  {
    title: { de: "Export als PDF & PowerPoint", en: "Export as PDF & PowerPoint" },
    body: {
      de: "Die Synthese als klarer Report oder fertiges Folien-Deck im eigenen Branding — plus teilbare Ergebnis-Links für Stakeholder.",
      en: "The synthesis as a clear report or a ready-made slide deck in your own branding — plus shareable result links for stakeholders.",
    },
    Icon: DownloadIcon,
    tag: "Live",
  },
];

/** The six real Market-Research capabilities, resolved per locale (DE verbatim). */
export function getMrProofs(locale: Locale): Proof[] {
  return MR_PROOF_DATA.map((p) => ({
    title: localizedContent(locale, p.title),
    body: localizedContent(locale, p.body),
    Icon: p.Icon,
    tag: p.tag,
  }));
}

/** Back-compat DE export for existing importers. */
export const MR_PROOFS: Proof[] = getMrProofs(MARKETING_DEFAULT_LOCALE);

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

type IndustryData = Omit<IndustryRef, "name" | "tagline"> & {
  name: { de: string; en: string };
  tagline: { de: string; en: string };
};

const INDUSTRY_DATA: IndustryData[] = [
  {
    slug: "mittelstand",
    name: { de: "Mittelstand", en: "Mid-Market" },
    tagline: {
      de: "Entscheider-Wissen ohne Institutsbudget — direkt von deinen Zielgruppen.",
      en: "Decision-maker knowledge without an agency-scale budget — straight from your audiences.",
    },
    icon: "FactoryIcon",
  },
  {
    slug: "b2c",
    name: { de: "B2C & Konsumgüter", en: "B2C & Consumer Goods" },
    tagline: {
      de: "Käufer verstehen: Produkt, Marke, Preis — belegt vor dem Launch.",
      en: "Understand buyers: product, brand, price — evidenced before launch.",
    },
    icon: "ShoppingBagIcon",
  },
  {
    slug: "b2b",
    name: { de: "B2B", en: "B2B" },
    tagline: {
      de: "Buying-Center im O-Ton: Entscheider, Anwender, Einwände.",
      en: "The buying center verbatim: decision-makers, users, objections.",
    },
    icon: "NetworkIcon",
  },
  {
    slug: "design-agenturen",
    name: { de: "Design & Agenturen", en: "Design & Agencies" },
    tagline: {
      de: "Entwürfe vor dem Pitch testen — Creative-Feedback in Tagen, nicht Wochen.",
      en: "Test drafts before the pitch — creative feedback in days, not weeks.",
    },
    icon: "PenIcon",
  },
  {
    slug: "industrie",
    name: { de: "Industrie", en: "Manufacturing" },
    tagline: {
      de: "Anwender-Feedback von der Fläche — bevor investiert wird.",
      en: "User feedback from the shop floor — before you invest.",
    },
    icon: "CpuIcon",
  },
];

/** Resolve the five industries for a locale. `de` returns the originals verbatim. */
export function getIndustries(locale: Locale): IndustryRef[] {
  return INDUSTRY_DATA.map((i) => ({
    slug: i.slug,
    name: localizedContent(locale, i.name),
    tagline: localizedContent(locale, i.tagline),
    icon: i.icon,
  }));
}

/** Back-compat: existing importers (nav-data, etc.) get the DE set. */
export const INDUSTRIES: IndustryRef[] = getIndustries(MARKETING_DEFAULT_LOCALE);

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
    <div className="rounded border-l-2 border-primary-300 bg-neutral-0 py-4 pl-4 pr-3 text-[15px] leading-relaxed text-neutral-700">
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
  locale = MARKETING_DEFAULT_LOCALE,
  current,
  eyebrow = localizedContent(locale, { de: "Branchen", en: "Industries" }),
  tone = "muted",
  showModuleLink = true,
}: {
  locale?: Locale;
  current?: string;
  eyebrow?: string;
  tone?: "default" | "muted";
  showModuleLink?: boolean;
}) {
  const industries = getIndustries(locale);
  const shown = current
    ? industries.filter((i) => i.slug !== current)
    : industries;
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
                  href={localizePath(locale, `/branchen/${i.slug}`)}
                  className="group flex h-full flex-col gap-2 bg-neutral-0 p-6 transition-colors hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500"
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
                      de: "Die Engine hinter allen Branchen: Voice-Interviews, Stimulus, Screening, Synthese mit PDF- & PowerPoint-Export und die deterministische Cross-Study-Zählung.",
                      en: "The engine behind every industry: voice interviews, Stimulus, screening, synthesis with PDF & PowerPoint export and deterministic cross-study counting.",
                    })}
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
export function IndustryPage({
  content,
  locale = MARKETING_DEFAULT_LOCALE,
}: {
  content: IndustryContent;
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

      {/* How Klymeo's Market Research solves it — the four REAL steps, with an
          industry-tuned lead. */}
      <HowItWorks
        locale={locale}
        eyebrow={localizedContent(locale, {
          de: "So funktioniert Market Research",
          en: "How Market Research works",
        })}
        title={localizedContent(locale, {
          de: <>Von der Studie zur belegten Zahl.</>,
          en: <>From study to evidenced number.</>,
        })}
        lead={content.howLead}
        steps={getMrSteps(locale)}
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
        locale={locale}
        eyebrow={localizedContent(locale, {
          de: "Belegt, nicht geraten",
          en: "Evidenced, not guessed",
        })}
        title={localizedContent(locale, {
          de: <>Was Market Research konkret liefert.</>,
          en: <>What Market Research delivers, concretely.</>,
        })}
        lead={content.proofLead}
        points={getMrProofs(locale)}
      />

      <IndustryGrid
        locale={locale}
        current={content.slug}
        eyebrow={localizedContent(locale, {
          de: "Weitere Branchen",
          en: "More industries",
        })}
      />

      <CTASection
        lang={locale}
        title={content.cta.title}
        lead={content.cta.lead}
        secondary={{ label: platformLabel, href: platformHref }}
      />
    </>
  );
}
