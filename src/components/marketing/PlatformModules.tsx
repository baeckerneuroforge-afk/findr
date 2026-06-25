import Link from "next/link";
import type { ReactNode } from "react";
import { Container, Section, SectionHeading, Accent, StatusTag } from "./primitives";
import { Reveal } from "./Reveal";
import { ICONS, type IconName } from "./icons";
import {
  localizedContent,
  MARKETING_DEFAULT_LOCALE,
  type Locale,
} from "@/i18n/marketing-locale";

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
 * facets of ONE qualitative-research engine, not four separate products. All
 * four run today (Live).
 *
 * Single source for the four-method set: the homepage grid (this file), the
 * header's "Plattform" mega-menu panel (via nav-data) AND the footer read it, so
 * label + copy + icon can never drift between them.
 *
 * `href`/`status`/`icon`/`idx` are locale-INVARIANT; only `name` + `blurb` carry
 * a bilingual `{ de, en }` pair. `getModules(locale)` resolves them to a flat
 * `ModuleEntry[]` — the `de` branch yields the exact original values verbatim.
 *
 * `href`: each method links to its dedicated /methoden/<slug> page. Because the
 * mega-menu and footer derive their links from this same array (via nav-data),
 * the route lives in exactly one place per method.
 */
type ModuleData = Omit<ModuleEntry, "name" | "blurb"> & {
  name: { de: string; en: string };
  blurb: { de: string; en: string };
};

const MODULE_DATA: ModuleData[] = [
  {
    idx: "01",
    name: { de: "Bedarf & Verhalten", en: "Needs & Behavior" },
    href: "/methoden/bedarf-verhalten",
    blurb: {
      de: "Konkrete Situationen, echte Workarounds und unerfüllte Bedürfnisse — belegt am Gespräch, statt aus Hypothesen abgeleitet.",
      en: "Concrete situations, real workarounds and unmet needs — evidenced in the conversation, not derived from hypotheses.",
    },
    status: "Live",
    icon: "RadarIcon",
  },
  {
    idx: "02",
    name: { de: "Markenwahrnehmung", en: "Brand Perception" },
    href: "/methoden/markenwahrnehmung",
    blurb: {
      de: "Welche Assoziationen, Bilder und Gefühle deine Marke auslöst — in den eigenen Worten deiner Zielgruppe.",
      en: "The associations, images and feelings your brand triggers — in your audience's own words.",
    },
    status: "Live",
    icon: "NetworkIcon",
  },
  {
    idx: "03",
    name: { de: "Konzept-Test", en: "Concept Test" },
    href: "/methoden/konzept-test",
    blurb: {
      de: "Erst Verständnis, dann Relevanz: ob ein Konzept trägt — und woran genau es das tut oder scheitert.",
      en: "First comprehension, then relevance: whether a concept holds up — and exactly where it does or fails.",
    },
    status: "Live",
    icon: "FileCheckIcon",
  },
  {
    idx: "04",
    name: { de: "Creative-Test", en: "Creative Test" },
    href: "/methoden/creative-test",
    blurb: {
      de: "Erster Eindruck und emotionale Wirkung einer Kreation — bevor du Media-Budget dahinter legst.",
      en: "The first impression and emotional impact of a creative — before you put media budget behind it.",
    },
    status: "Live",
    icon: "TargetIcon",
  },
];

/** Resolve the four methods for a locale. The `de` branch returns the exact
 *  original strings verbatim (R1: /de byte-identical by construction). */
export function getModules(locale: Locale): ModuleEntry[] {
  return MODULE_DATA.map((m) => ({
    idx: m.idx,
    name: localizedContent(locale, m.name),
    href: m.href,
    blurb: localizedContent(locale, m.blurb),
    status: m.status,
    icon: m.icon,
  }));
}

/** Back-compat: existing importers (P2 studio components, etc.) get the DE set. */
export const MODULES: ModuleEntry[] = getModules(MARKETING_DEFAULT_LOCALE);

export function PlatformModules({
  locale = MARKETING_DEFAULT_LOCALE,
  heading = true,
  eyebrow = localizedContent(locale, { de: "Die Plattform", en: "The platform" }),
  title = localizedContent(locale, {
    de: (
      <>
        Vier Methoden. <Accent>Eine Engine.</Accent>
      </>
    ),
    en: (
      <>
        Four methods. <Accent>One engine.</Accent>
      </>
    ),
  }),
  // MR thesis: four research methods, one qualitative engine.
  lead = localizedContent(locale, {
    de: "Vier qualitative Marktforschungs-Methoden auf einer gemeinsamen KI-Engine. Dieselbe Tiefe, dasselbe Nachbohren und dieselbe Beleg-Disziplin in jeder Methode — egal ob es um Bedarf, Marke, Konzept oder Creative geht. Jedes Interview zahlt auf dasselbe Gehirn ein.",
    en: "Four qualitative market research methods on one shared AI engine. The same depth, the same probing and the same evidence discipline in every method — whether it's about needs, brand, concept or creative. Every interview feeds the same brain.",
  }),
}: {
  /** Locale to render in. Optional; defaults to the marketing default (DE). */
  locale?: Locale;
  /** Set false when a page provides its own section heading above the grid. */
  heading?: boolean;
  eyebrow?: ReactNode;
  title?: ReactNode;
  lead?: ReactNode;
}) {
  const modules = getModules(locale);
  const trackLabel = localizedContent(locale, { de: "Spur", en: "Track" });
  const moreLabel = localizedContent(locale, { de: "Mehr erfahren", en: "Learn more" });
  return (
    <Section id="module">
      <Container>
        {heading ? (
          <Reveal>
            <SectionHeading eyebrow={eyebrow} title={title} lead={lead} />
          </Reveal>
        ) : null}

        {/* Mini-Tonband-Karten: die vier Methoden als dunkle Studio-Spuren auf
            dem Papier-Canvas (st-minitape, studio.css). Staggered Reveal je
            ~60ms; reduced motion → instant. */}
        <div className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {modules.map((m, i) => {
            const Icon = ICONS[m.icon];
            return (
            <Reveal key={m.href} y={0} delay={i * 0.06} className="flex">
              <Link
                href={m.href}
                className="st-minitape group h-full w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
              >
                <div className="flex items-center justify-between">
                  <span className="st-idx">
                    {trackLabel} {m.idx}
                  </span>
                  <StatusTag status={m.status} lang={locale} />
                </div>
                <Icon className="h-6 w-6 text-[var(--st-ink-60)]" />
                <h3>{m.name}</h3>
                <p>{m.blurb}</p>
                <span className="st-more">
                  {moreLabel}
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
