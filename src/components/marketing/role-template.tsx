import Link from "next/link";
import type { ComponentType, ReactNode, SVGProps } from "react";
import { Container, Section, Eyebrow } from "./primitives";
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
import { RadarIcon, ShieldCheckIcon, CpuIcon } from "./icons";

type IconType = ComponentType<SVGProps<SVGSVGElement>>;

/**
 * Shared template for the B2B ROLE pages (/loesungen/<slug>).
 *
 * The B2B counterpart of the B2C industry pages (/branchen/<slug>): same block
 * order, same look, same honesty rules — but where every industry page shows the
 * ONE Market-Research module, each role page shows the ONE module that solves
 * THAT role's job:
 *
 *   Sales-Leader      → Sales Intelligence
 *   Customer Success  → Customer Success Health
 *   Product & Research → Product Discovery
 *
 *   ModuleHero → Pain (muted) → HowItWorks (white) → Solution (muted) →
 *   ProofPoints (white) → RoleGrid (muted) → CTASection (wash)
 *
 * → the homepage's W-M-W-M-W-M-Wash rhythm, single-ink headings, Reveal
 * staggers and reduced-motion-safe atmosphere, exactly like the module/industry
 * pages.
 *
 * GROUNDING: unlike the industry pages (one shared module → shared steps/proofs
 * in the template), each role maps to a DIFFERENT module, so the HowItWorks
 * steps and ProofPoints live PER ROLE in each page's `content`. They are lifted
 * faithfully from the matching /produkt/<module> page (real capabilities, honest
 * Live/Bald tags); only the hero, pain and solution copy is SHARPENED onto the
 * role. The pages invent NO new features and NO numbers/logos/customers — the
 * example cards reuse the same approved scenarios as the module pages.
 */

// ── Role registry (single source for hub cards + footer + cross-links + slugs) ─
export type RoleRef = {
  slug: string;
  /** Short role name, e.g. "Sales-Leader". */
  name: string;
  /** Eyebrow used on the hub card AND the page hero. */
  eyebrow: string;
  Icon: IconType;
  /** One-sentence pain for the hub card. */
  painTeaser: string;
  /** The single module this role maps to. */
  moduleSlug: string;
  moduleName: string;
};

export const ROLES: RoleRef[] = [
  {
    slug: "sales-leader",
    name: "Sales-Leader",
    eyebrow: "Für Sales-Leader · VP Sales & RevOps",
    Icon: RadarIcon,
    painTeaser:
      "Das CRM sagt „verloren wegen Preis“ — aber nicht, dass der Champion absprang. findr. liest das echte Gespräch.",
    moduleSlug: "sales-intelligence",
    moduleName: "Sales Intelligence",
  },
  {
    slug: "customer-success",
    name: "Customer Success",
    eyebrow: "Für Customer Success · CS-Leads & CSMs",
    Icon: ShieldCheckIcon,
    painTeaser:
      "Churn merkst du oft erst beim Kündigungs-Call. findr. erkennt die Signale Wochen vorher — aus den Gesprächen, die du ohnehin führst.",
    moduleSlug: "customer-health",
    moduleName: "Customer Success Health",
  },
  {
    slug: "product",
    name: "Product & Research",
    eyebrow: "Für Product & Research · PM & UX-Research",
    Icon: CpuIcon,
    painTeaser:
      "Roadmap-Prioritäten aus Tickets und Bauchgefühl? findr. führt KI-Interviews mit deinen eigenen Nutzer:innen und verdichtet belegt.",
    moduleSlug: "product-discovery",
    moduleName: "Product Discovery",
  },
];

// ── Per-role content contract ─────────────────────────────────────────────────
export type RoleContent = {
  slug: string;
  /** Hero + pages share the role eyebrow, e.g. "Für Sales-Leader · VP Sales & RevOps". */
  eyebrow: string;
  heroTitle: ReactNode;
  heroSubhead: ReactNode;
  /** "Passt zu:" line under the hero. */
  audience: string;
  /** The single module this role maps to (drives the hero's secondary CTA + RoleGrid). */
  moduleSlug: string;
  moduleName: string;
  pain: {
    eyebrow: string;
    title: ReactNode;
    /** The role's blind spot today, 1–2 sentences. */
    problem: ReactNode;
    /** The stakes — what staying blind costs (the bordered callout). */
    stakes: { strong: string; body: ReactNode };
    /** Red "blind spot" card — what the CRM/table/notes CANNOT show today. */
    blindCard: { badge: string; rows: ExampleRow[] };
  };
  how: {
    title: ReactNode;
    lead: ReactNode;
    /** The module's real flow, lifted faithfully from its /produkt page. */
    steps: HowStep[];
  };
  solution: {
    eyebrow: string;
    title: ReactNode;
    body: ReactNode;
    /** The payoff callout — what findr. now lets the role do. */
    payoff: { strong: string; body: ReactNode };
    /** Violet payoff card — the belegte answer, same scenario as the module page. */
    answerCard: { badge: string; rows: ExampleRow[] };
  };
  proof: {
    lead: ReactNode;
    /** The module's real capabilities, lifted faithfully (honest Live/Bald). */
    points: Proof[];
  };
  cta: { title: ReactNode; lead: ReactNode };
};

/**
 * Two-column "narrative + card" band — mirrors the /loesungen UseCase and the
 * industry-template band so the role pages read identically. Always muted so the
 * white card on the right pops and the page keeps the W-M-W-M rhythm.
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
 * Hub overview cards — the "wähl deine Rolle" grid on /loesungen. One card per
 * role from the ROLES registry: icon + role eyebrow + name + one-sentence pain +
 * "Mehr erfahren" link to the role page. The whole card is the link target.
 *
 * bg-white sits on the animated cell (the Reveal) so the gap-px neutral-200
 * hairline backing never shows through mid-transform; the Link fills the cell.
 */
export function RoleCards({ tone = "default" }: { tone?: "default" | "muted" }) {
  return (
    <Section tone={tone}>
      <Container>
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded border border-neutral-200 bg-neutral-200 lg:grid-cols-3">
          {ROLES.map((r, i) => (
            <Reveal key={r.slug} y={0} delay={i * 0.06} className="bg-white">
              <Link
                href={`/loesungen/${r.slug}`}
                className="group flex h-full flex-col gap-4 p-7 transition-colors hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500"
              >
                <div className="flex items-center justify-between">
                  <r.Icon className="h-6 w-6 text-primary-600" />
                  <span
                    aria-hidden
                    className="text-primary-600 transition-transform group-hover:translate-x-0.5"
                  >
                    →
                  </span>
                </div>
                <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-500">
                  {r.eyebrow}
                </div>
                <h3 className="font-marketing text-xl font-semibold leading-snug text-neutral-900">
                  {r.name}
                </h3>
                <p className="text-sm leading-relaxed text-neutral-500">
                  {r.painTeaser}
                </p>
                <span className="mt-auto inline-flex items-center gap-1.5 pt-2 text-sm font-medium text-primary-700">
                  Mehr erfahren
                  <span
                    aria-hidden
                    className="transition-transform group-hover:translate-x-0.5"
                  >
                    →
                  </span>
                </span>
              </Link>
            </Reveal>
          ))}
        </div>
      </Container>
    </Section>
  );
}

/**
 * Cross-promo grid on each role page: the two sibling roles plus a link to THIS
 * role's module page. Mirrors the industry-template's IndustryGrid (siblings +
 * module link); `tone` slots it into the page's section rhythm.
 */
export function RoleGrid({
  current,
  eyebrow = "Weitere Rollen",
  tone = "muted",
}: {
  current: string;
  eyebrow?: string;
  tone?: "default" | "muted";
}) {
  const me = ROLES.find((r) => r.slug === current);
  const others = ROLES.filter((r) => r.slug !== current);
  return (
    <Section tone={tone}>
      <Container>
        <Reveal>
          <div className="flex flex-col gap-6">
            <Eyebrow>{eyebrow}</Eyebrow>
            <div className="grid grid-cols-1 gap-px overflow-hidden rounded border border-neutral-200 bg-neutral-200 sm:grid-cols-2 lg:grid-cols-3">
              {others.map((r) => (
                <Link
                  key={r.slug}
                  href={`/loesungen/${r.slug}`}
                  className="group flex h-full flex-col gap-2 bg-white p-6 transition-colors hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500"
                >
                  <div className="flex items-center justify-between gap-2 font-marketing text-base font-semibold text-neutral-900">
                    {r.name}
                    <span
                      aria-hidden
                      className="text-primary-600 transition-transform group-hover:translate-x-0.5"
                    >
                      →
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-neutral-500">
                    {r.painTeaser}
                  </p>
                </Link>
              ))}
              {me ? (
                <Link
                  href={`/produkt/${me.moduleSlug}`}
                  className="group flex h-full flex-col gap-2 bg-white p-6 transition-colors hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500"
                >
                  <div className="flex items-center justify-between gap-2 font-marketing text-base font-semibold text-primary-700">
                    {me.moduleName} im Detail
                    <span
                      aria-hidden
                      className="transition-transform group-hover:translate-x-0.5"
                    >
                      →
                    </span>
                  </div>
                  <p className="text-sm leading-relaxed text-neutral-500">
                    Das Modul hinter dieser Rolle: alle Funktionen, Schritte und
                    Belege im Detail.
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

// ── The full role page ────────────────────────────────────────────────────────
export function RolePage({ content }: { content: RoleContent }) {
  return (
    <>
      <ModuleHero
        eyebrow={content.eyebrow}
        title={content.heroTitle}
        subhead={content.heroSubhead}
        audience={content.audience}
        primary={{ label: "Demo buchen →", href: "/demo" }}
        secondary={{
          label: `${content.moduleName} ansehen`,
          href: `/produkt/${content.moduleSlug}`,
        }}
      />

      {/* The role's blind spot today. The red card makes the cost of CRM-/table-/
          notes-only visible. */}
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

      {/* How the matching module solves it — the module's REAL steps, with a
          role-tuned lead. */}
      <HowItWorks
        eyebrow={`So funktioniert ${content.moduleName}`}
        title={content.how.title}
        lead={content.how.lead}
        steps={content.how.steps}
      />

      {/* The belegte answer: violet payoff card, same approved scenario as the
          module page. */}
      <NarrativeBand
        eyebrow={content.solution.eyebrow}
        title={content.solution.title}
        card={
          <ExampleCard
            tone="neutral"
            badge={content.solution.answerCard.badge}
            rows={content.solution.answerCard.rows}
          />
        }
      >
        <p className="text-[16px] leading-relaxed text-neutral-700">
          {content.solution.body}
        </p>
        <Callout
          strong={content.solution.payoff.strong}
          body={content.solution.payoff.body}
        />
      </NarrativeBand>

      {/* The real capabilities — same as the module page, same Live/Bald. */}
      <ProofPoints
        eyebrow="Belegt, nicht geraten"
        title={<>Was {content.moduleName} konkret liefert.</>}
        lead={content.proof.lead}
        points={content.proof.points}
      />

      <RoleGrid current={content.slug} eyebrow="Weitere Rollen" />

      <CTASection
        title={content.cta.title}
        lead={content.cta.lead}
        secondary={{
          label: `${content.moduleName} ansehen`,
          href: `/produkt/${content.moduleSlug}`,
        }}
      />
    </>
  );
}
