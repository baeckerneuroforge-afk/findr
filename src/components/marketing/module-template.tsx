import Link from "next/link";
import type { ComponentType, ReactNode, SVGProps } from "react";
import {
  Container,
  Section,
  SectionHeading,
  Eyebrow,
  CornerBrackets,
  StatusTag,
} from "./primitives";
import { CtaLink } from "./CtaLink";
import { Reveal } from "./Reveal";
import { HeroAtmosphere } from "./HeroAtmosphere";
import { HowItWorksTimeline, type HowStep } from "./HowItWorksTimeline";

export type { HowStep };

type Cta = { label: string; href: string };
type IconType = ComponentType<SVGProps<SVGSVGElement>>;

/**
 * Shared module-page template (§4.3). Every product page composes these in the
 * same order — ModuleHero → HowItWorks → (demo) → ExampleCard → ProofPoints →
 * (cross-links) → CTASection — so the four modules read as EQUALLY weighted
 * regardless of how much source copy each had. Etappe A proves the template on
 * /produkt/sales-intelligence; Etappe B reuses it for the other three.
 */

// ── ModuleHero ──────────────────────────────────────────────────────────────
export function ModuleHero({
  eyebrow,
  title,
  subhead,
  audience,
  primary,
  secondary,
}: {
  eyebrow: ReactNode;
  title: ReactNode;
  subhead: ReactNode;
  audience?: ReactNode;
  primary: Cta;
  secondary?: Cta;
}) {
  return (
    <Section className="relative overflow-hidden pt-14 sm:pt-20">
      <HeroAtmosphere />
      <Container>
        <Reveal>
          <div className="flex max-w-3xl flex-col items-start gap-6">
            <Eyebrow>{eyebrow}</Eyebrow>
            <h1 className="font-marketing text-[clamp(36px,5.8vw,66px)] font-bold leading-[1.02] tracking-[-0.03em] text-neutral-900">
              {title}
            </h1>
            <p className="max-w-xl text-[18px] leading-relaxed text-neutral-500">
              {subhead}
            </p>
            {audience ? (
              <p className="text-sm text-neutral-700">
                <span className="font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-500">
                  Passt zu:
                </span>{" "}
                {audience}
              </p>
            ) : null}
            <div className="flex flex-col gap-3 sm:flex-row">
              <CtaLink href={primary.href} variant="primary" size="lg">
                {primary.label}
              </CtaLink>
              {secondary ? (
                <CtaLink href={secondary.href} variant="secondary" size="lg">
                  {secondary.label}
                </CtaLink>
              ) : null}
            </div>
          </div>
        </Reveal>
      </Container>
    </Section>
  );
}

// ── HowItWorks ──────────────────────────────────────────────────────────────
// `HowStep` is defined in (and re-exported from) ./HowItWorksTimeline.

export function HowItWorks({
  eyebrow = "So funktioniert's",
  title,
  lead,
  steps,
  tone = "default",
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  lead?: ReactNode;
  steps: HowStep[];
  /** Section background — pages set "muted" to slot this as the first muted
   * "rest" band after the hero, matching the homepage's section rhythm. */
  tone?: "default" | "muted";
}) {
  return (
    <Section tone={tone}>
      <Container>
        <Reveal>
          <SectionHeading align="left" eyebrow={eyebrow} title={title} lead={lead} />
        </Reveal>
        {/* The vertical "durchgehender Faden": the violet thread DRAWS down
            through the numbered nodes on scroll-in and the rings light up in
            sequence (client component; reduced-motion → final state, no movement). */}
        <HowItWorksTimeline steps={steps} />
      </Container>
    </Section>
  );
}

// ── DemoPlaceholder ─────────────────────────────────────────────────────────
// Static product-preview slot for module pages without an interactive demo yet
// (the 3 Etappe-B modules). Sales-Intelligence replaces this slot with the
// interactive SalesLiveDemo. Real screenshot via next/image lands later.
export function DemoPlaceholder({
  eyebrow = "Produkt-Demo",
  title,
  lead,
  label = "Produkt-Vorschau",
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  lead?: ReactNode;
  label?: string;
}) {
  return (
    <Section>
      <Container>
        <Reveal>
          <SectionHeading eyebrow={eyebrow} title={title} lead={lead} />
        </Reveal>
        <Reveal>
          {/* A recessed neutral-50 panel on the white section — reads clearly as
              an intentional, framed preview slot (not a broken/empty element).
              Honest placeholder: a real screenshot / Remotion walk-through lands
              here later; we never fake a product window. */}
          <div className="relative mt-12 aspect-[16/9] w-full overflow-hidden rounded border border-neutral-200 bg-neutral-50">
            <CornerBrackets className="border-primary-200" />
            <div
              aria-hidden
              className="absolute inset-0 opacity-50"
              style={{
                backgroundImage:
                  "radial-gradient(#d4d4d8 0.5px, transparent 0.5px)",
                backgroundSize: "22px 22px",
              }}
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
              <span className="rounded border border-neutral-200 bg-white px-3 py-1 text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-500">
                Vorschau folgt
              </span>
              <span className="text-xs text-neutral-500">{label}</span>
            </div>
          </div>
        </Reveal>
      </Container>
    </Section>
  );
}

// ── ExampleCard ─────────────────────────────────────────────────────────────
export type ExampleRow = { label: string; value: ReactNode; quote?: boolean };

export function ExampleCard({
  badge,
  rows,
  tone = "risk",
  className = "",
}: {
  badge?: string;
  rows: ExampleRow[];
  /** Badge-Stempel: "risk" = REC-Rot (blinder Fleck / Verlust-Signale),
   * "neutral" = Tinte (belegte, positive Befunde). Gleiche API wie zuvor. */
  tone?: "risk" | "neutral";
  className?: string;
}) {
  const stampTone =
    tone === "neutral"
      ? "border-neutral-700 text-neutral-700"
      : "border-[var(--st-rec)] text-[var(--st-rec-deep)]";
  return (
    <div
      className={`relative rounded-[10px] bg-neutral-0 p-6 shadow-[0_1px_0_rgba(25,21,18,0.05),0_40px_90px_-45px_rgba(60,45,25,0.4),0_0_0_1px_rgba(25,21,18,0.08)] sm:p-7 ${className}`}
    >
      {badge ? (
        <span
          className={`inline-block -rotate-2 rounded border-2 px-2.5 py-1 font-mono text-[10px] font-medium uppercase tracking-[0.18em] ${stampTone}`}
        >
          {badge}
        </span>
      ) : null}
      <div className="mt-5 flex flex-col gap-5">
        {rows.map((r) => (
          <div key={r.label}>
            <div className="font-mono text-[10.5px] font-medium uppercase tracking-[0.18em] text-neutral-500">
              {r.label}
            </div>
            <div
              className={
                r.quote
                  ? "st-quote mt-1.5 border-l-2 border-[var(--st-rec)] pl-3 text-[16px] leading-relaxed text-neutral-700"
                  : "mt-1.5 text-[15px] leading-relaxed text-neutral-700"
              }
            >
              {r.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── ProofPoints ─────────────────────────────────────────────────────────────
export type Proof = {
  title: string;
  body: string;
  Icon: IconType;
  tag?: "Live" | "Bald";
};

export function ProofPoints({
  eyebrow = "Belegt, nicht geraten",
  title,
  lead,
  points,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  lead?: ReactNode;
  points: Proof[];
}) {
  return (
    <Section>
      <Container>
        <Reveal>
          <SectionHeading eyebrow={eyebrow} title={title} lead={lead} />
        </Reveal>
        {/* Staggered tile reveal — pure opacity (y=0) so the gap-px hairline
            grid never exposes its neutral-200 backing mid-transform (matches
            HomeFeatures / PlatformModules). Reduced motion → instant. */}
        <div className="mt-14 grid grid-cols-1 gap-px overflow-hidden rounded border border-neutral-200 bg-neutral-200 sm:grid-cols-2 lg:grid-cols-3">
          {points.map((p, i) => (
            <Reveal
              key={p.title}
              y={0}
              delay={i * 0.06}
              className="flex h-full flex-col gap-3 bg-white p-7"
            >
              <div className="flex items-center justify-between">
                <p.Icon className="h-6 w-6 text-primary-600" />
                {p.tag ? <StatusTag status={p.tag} /> : null}
              </div>
              <h3 className="font-marketing text-lg font-semibold leading-snug text-neutral-900">
                {p.title}
              </h3>
              <p className="text-sm leading-relaxed text-neutral-500">{p.body}</p>
            </Reveal>
          ))}
        </div>
      </Container>
    </Section>
  );
}

// ── ModuleCrossLinks ────────────────────────────────────────────────────────
const ALL_MODULES = [
  { slug: "sales-intelligence", name: "Sales Intelligence" },
  { slug: "customer-health", name: "Customer Success Health" },
  { slug: "product-discovery", name: "Product Discovery" },
  { slug: "market-research", name: "Market Research" },
];

export function ModuleCrossLinks({ current }: { current: string }) {
  const others = ALL_MODULES.filter((m) => m.slug !== current);
  return (
    <Section tone="muted">
      <Container>
        <Reveal>
          <div className="flex flex-col gap-6">
            <Eyebrow>Weiter im System</Eyebrow>
            <div className="grid grid-cols-1 gap-px overflow-hidden rounded border border-neutral-200 bg-neutral-200 sm:grid-cols-2 lg:grid-cols-4">
              {others.map((m) => (
                <Link
                  key={m.slug}
                  href={`/produkt/${m.slug}`}
                  className="group flex items-center justify-between gap-2 bg-white p-5 text-sm font-medium text-neutral-900 transition-colors hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500"
                >
                  {m.name}
                  <span
                    aria-hidden
                    className="text-primary-600 transition-transform group-hover:translate-x-0.5"
                  >
                    →
                  </span>
                </Link>
              ))}
              <Link
                href="/produkt"
                className="group flex items-center justify-between gap-2 bg-white p-5 text-sm font-medium text-primary-700 transition-colors hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500"
              >
                Alle Module ansehen
                <span
                  aria-hidden
                  className="transition-transform group-hover:translate-x-0.5"
                >
                  →
                </span>
              </Link>
            </div>
          </div>
        </Reveal>
      </Container>
    </Section>
  );
}
