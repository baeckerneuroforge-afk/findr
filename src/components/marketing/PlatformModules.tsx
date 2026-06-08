import Link from "next/link";
import type { ReactNode } from "react";
import { Container, Section, SectionHeading, Accent, StatusTag } from "./primitives";
import { Reveal } from "./Reveal";
import { ICONS, type IconName } from "./icons";

export type ModuleEntry = {
  idx: string;
  name: string;
  href: string;
  blurb: string;
  status: "Live" | "Bald";
  /** Icon NAME (resolved via ICONS) so the entry stays serializable for the
   *  mega-menu, which consumes this same array as its single source. */
  icon: IconName;
};

/**
 * The four market-research METHODS, given EQUAL weight (same card, same depth) —
 * facets of ONE qualitative-research engine, not four separate products. The
 * first two run today (Live); Konzept- und Creative-Test sind in Vorbereitung
 * ("Bald").
 *
 * Exported as the single source for the four-method set: the homepage grid (this
 * file), the header's "Plattform" mega-menu panel (via nav-data) AND the footer
 * read it, so label + copy + icon can never drift between them.
 *
 * `href`: each method links to its dedicated /methoden/<slug> page. Because the
 * mega-menu and footer derive their links from this same array (via nav-data),
 * the route lives in exactly one place per method.
 */
export const MODULES: ModuleEntry[] = [
  {
    idx: "01",
    name: "Bedarf & Verhalten",
    href: "/methoden/bedarf-verhalten",
    blurb:
      "Konkrete Situationen, echte Workarounds und unerfüllte Bedürfnisse — belegt am Gespräch, statt aus Hypothesen abgeleitet.",
    status: "Live",
    icon: "RadarIcon",
  },
  {
    idx: "02",
    name: "Markenwahrnehmung",
    href: "/methoden/markenwahrnehmung",
    blurb:
      "Welche Assoziationen, Bilder und Gefühle deine Marke auslöst — in den eigenen Worten deiner Zielgruppe.",
    status: "Live",
    icon: "NetworkIcon",
  },
  {
    idx: "03",
    name: "Konzept-Test",
    href: "/methoden/konzept-test",
    blurb:
      "Erst Verständnis, dann Relevanz: ob ein Konzept trägt — und woran genau es das tut oder scheitert.",
    status: "Bald",
    icon: "FileCheckIcon",
  },
  {
    idx: "04",
    name: "Creative-Test",
    href: "/methoden/creative-test",
    blurb:
      "Erster Eindruck und emotionale Wirkung einer Kreation — bevor du Media-Budget dahinter legst.",
    status: "Bald",
    icon: "TargetIcon",
  },
];

export function PlatformModules({
  heading = true,
  eyebrow = "Die Plattform",
  title = (
    <>
      Vier Methoden. <Accent>Eine Engine.</Accent>
    </>
  ),
  // MR thesis: four research methods, one qualitative engine.
  lead = "Vier qualitative Marktforschungs-Methoden auf einer gemeinsamen KI-Engine. Dieselbe Tiefe, dasselbe Nachbohren und dieselbe Beleg-Disziplin in jeder Methode — egal ob es um Bedarf, Marke, Konzept oder Creative geht. Jedes Interview zahlt auf dasselbe Gehirn ein.",
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
          {MODULES.map((m, i) => {
            const Icon = ICONS[m.icon];
            return (
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
                <Icon className="h-7 w-7 text-primary-600" />
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
            );
          })}
        </div>
      </Container>
    </Section>
  );
}
