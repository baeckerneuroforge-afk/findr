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
    <Section className="pt-14 sm:pt-20">
      <Container>
        <Reveal>
          <div className="flex max-w-3xl flex-col items-start gap-6">
            <Eyebrow>{eyebrow}</Eyebrow>
            <h1 className="font-marketing text-[clamp(34px,5.5vw,58px)] font-semibold leading-[1.05] tracking-[-0.03em] text-neutral-900">
              {title}
            </h1>
            <p className="max-w-xl text-[18px] leading-relaxed text-neutral-500">
              {subhead}
            </p>
            {audience ? (
              <p className="text-sm text-neutral-700">
                <span className="font-medium text-neutral-900">Passt zu:</span>{" "}
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
export type HowStep = {
  phase?: string;
  title: string;
  body: string;
  tag?: "Live" | "Bald";
};

export function HowItWorks({
  eyebrow = "So funktioniert's",
  title,
  lead,
  steps,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  lead?: ReactNode;
  steps: HowStep[];
}) {
  return (
    <Section>
      <Container>
        <Reveal>
          <SectionHeading align="left" eyebrow={eyebrow} title={title} lead={lead} />
        </Reveal>
        <ol className="mt-14 flex flex-col gap-10">
          {steps.map((s, i) => (
            <Reveal key={s.title} delay={i * 0.05}>
              <li className="flex gap-5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-primary-200 bg-primary-50 text-sm font-semibold text-primary-700">
                  {i + 1}
                </span>
                <div className="flex flex-col gap-1.5">
                  {s.phase ? (
                    <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-400">
                      {s.phase}
                    </div>
                  ) : null}
                  <div className="flex flex-wrap items-center gap-2.5">
                    <h3 className="font-marketing text-xl font-semibold text-neutral-900">
                      {s.title}
                    </h3>
                    {s.tag ? <StatusTag status={s.tag} /> : null}
                  </div>
                  <p className="max-w-2xl text-[15px] leading-relaxed text-neutral-500">
                    {s.body}
                  </p>
                </div>
              </li>
            </Reveal>
          ))}
        </ol>
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
    <Section tone="muted">
      <Container>
        <Reveal>
          <SectionHeading eyebrow={eyebrow} title={title} lead={lead} />
        </Reveal>
        <Reveal>
          <div className="relative mt-12 aspect-[16/9] w-full overflow-hidden rounded border border-neutral-200 bg-white">
            <CornerBrackets className="border-primary-200" />
            <div
              aria-hidden
              className="absolute inset-0 opacity-50"
              style={{
                backgroundImage:
                  "radial-gradient(#e4e4e7 0.5px, transparent 0.5px)",
                backgroundSize: "22px 22px",
              }}
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="rounded border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs uppercase tracking-[0.14em] text-neutral-400">
                {label}
              </span>
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
  /** Badge colour: "risk" = red (loss/churn signals), "neutral" = violet
   * (positive findings). Default "risk" keeps the Etappe-A pages unchanged. */
  tone?: "risk" | "neutral";
  className?: string;
}) {
  const badgeTone =
    tone === "neutral"
      ? "bg-primary-50 text-primary-700"
      : "bg-danger-50 text-danger-700";
  return (
    <div
      className={`relative rounded border border-neutral-200 bg-white p-6 sm:p-7 ${className}`}
    >
      <CornerBrackets className="border-primary-200" />
      {badge ? (
        <span
          className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-[11px] font-medium uppercase tracking-[0.06em] ${badgeTone}`}
        >
          {badge}
        </span>
      ) : null}
      <div className="mt-5 flex flex-col gap-5">
        {rows.map((r) => (
          <div key={r.label}>
            <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-primary-600">
              {r.label}
            </div>
            <div
              className={
                r.quote
                  ? "mt-1.5 border-l-2 border-primary-300 pl-3 text-[15px] italic leading-relaxed text-neutral-700"
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
        <div className="mt-14 grid grid-cols-1 gap-px overflow-hidden rounded border border-neutral-200 bg-neutral-200 sm:grid-cols-2 lg:grid-cols-3">
          {points.map((p) => (
            <div key={p.title} className="flex flex-col gap-3 bg-white p-7">
              <div className="flex items-center justify-between">
                <p.Icon className="h-6 w-6 text-primary-600" />
                {p.tag ? <StatusTag status={p.tag} /> : null}
              </div>
              <h3 className="font-marketing text-lg font-semibold leading-snug text-neutral-900">
                {p.title}
              </h3>
              <p className="text-sm leading-relaxed text-neutral-500">{p.body}</p>
            </div>
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
