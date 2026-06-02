import Link from "next/link";
import type { ComponentType, ReactNode, SVGProps } from "react";
import { Container, Section, SectionHeading, Accent, StatusTag } from "./primitives";
import { Reveal } from "./Reveal";
import { TrendingUpIcon, RadarIcon, NetworkIcon, TargetIcon } from "./icons";

type ModuleEntry = {
  idx: string;
  name: string;
  href: string;
  blurb: string;
  status: "Live" | "Bald";
  Icon: ComponentType<SVGProps<SVGSVGElement>>;
};

/**
 * The four products, given EQUAL weight (same card, same depth) — this is the
 * core rebalancing away from the old ~70%-Sales homepage. Blurbs are verbatim
 * from landing.html:1459/1466/1473/1480. Each card links to its module page.
 */
const MODULES: ModuleEntry[] = [
  {
    idx: "01",
    name: "Sales Intelligence",
    href: "/produkt/sales-intelligence",
    blurb:
      "Deal-Risiko aus echten Gesprächen: Echtzeit-Risiko-Score, automatische Verlustgrund-Erkennung und risiko-adjustierte Pipeline-Prognose.",
    status: "Live",
    Icon: TrendingUpIcon,
  },
  {
    idx: "02",
    name: "Customer Success Health",
    href: "/produkt/customer-health",
    blurb:
      "Churn-Früherkennung aus jedem Kunden-Call: Health-Score pro Account, Risiko-Signale und Expansions-Chancen, bevor es zu spät ist.",
    status: "Live",
    Icon: RadarIcon,
  },
  {
    idx: "03",
    name: "Product Discovery",
    href: "/produkt/product-discovery",
    blurb:
      "KI-geführte Nutzer-Interviews und automatische Studien-Synthese — was Kunden wirklich brauchen, verankert im Transkript statt im Bauchgefühl.",
    status: "Live",
    Icon: NetworkIcon,
  },
  {
    idx: "04",
    name: "Market Research",
    href: "/produkt/market-research",
    blurb:
      "Studienübergreifende Insights: frag über alle Interviews und Studien hinweg, exakt gezählt und je Studie belegt.",
    status: "Live",
    Icon: TargetIcon,
  },
];

export function PlatformModules({
  heading = true,
  eyebrow = "Die Plattform",
  title = (
    <>
      Ein KI-Gehirn. <Accent>Vier Produkte.</Accent>
    </>
  ),
  // Platform thesis, verbatim from landing.html:1452.
  lead = "Vier gleichwertige Produkte auf einer gemeinsamen Conversation-Intelligence-Engine. Die Module reden miteinander: Ein Churn-Signal wird zur Research-Frage, ein gewonnener Deal startet das CS-Onboarding, ein Research-Insight schärft das Risiko-Modell. Daten kumulieren statt in Silos zu verschwinden.",
  accent = false,
}: {
  /** Set false when a page provides its own section heading above the grid. */
  heading?: boolean;
  eyebrow?: ReactNode;
  title?: ReactNode;
  lead?: ReactNode;
  /**
   * Opt-in violet accent edge on each card. Off by default so every other
   * surface (/produkt) renders byte-identically; the homepage passes it to tie
   * the module grid into its accent motif.
   */
  accent?: boolean;
}) {
  return (
    <Section id="module">
      <Container>
        {heading ? (
          <Reveal>
            <SectionHeading eyebrow={eyebrow} title={title} lead={lead} />
          </Reveal>
        ) : null}

        {/* Staggered tile reveal: each card fades in on its own ~60ms delay.
            Pure opacity (y=0) so the gap-px hairline grid never exposes its
            neutral-200 backing mid-transform. Reduced motion → instant. */}
        <div className="mt-14 grid grid-cols-1 gap-px overflow-hidden rounded border border-neutral-200 bg-neutral-200 sm:grid-cols-2 lg:grid-cols-4">
          {MODULES.map((m, i) => (
            <Reveal key={m.href} y={0} delay={i * 0.06} className="flex">
              <Link
                href={m.href}
                className={`group flex h-full w-full flex-col gap-4 bg-white p-7 transition-colors hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500 ${
                  accent ? "border-l-2 border-primary-600" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium tracking-[0.08em] text-neutral-400">
                    — {m.idx}
                  </span>
                  <StatusTag status={m.status} />
                </div>
                <m.Icon className="h-7 w-7 text-primary-600" />
                <h3 className="font-marketing text-xl font-semibold leading-tight tracking-[-0.01em] text-neutral-900">
                  {m.name}
                </h3>
                <p className="text-sm leading-relaxed text-neutral-500">
                  {m.blurb}
                </p>
                <span className="mt-auto inline-flex items-center gap-1 pt-2 text-sm font-medium text-primary-600">
                  Mehr erfahren
                  <span aria-hidden className="transition-transform group-hover:translate-x-0.5">
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
