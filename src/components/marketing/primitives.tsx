import type { ElementType, ReactNode } from "react";
import {
  localizedContent,
  MARKETING_DEFAULT_LOCALE,
  type Locale,
} from "@/i18n/marketing-locale";

/**
 * Marketing layout primitives — Studio-Session-Fassung. Warmes Papier,
 * Tinten-Hairlines, Mono-Etiketten (Kapitelmarken), Bricolage-Headlines mit
 * kursivem Instrument-Serif-Akzent in REC-Rot. Alle Farben laufen über die
 * in studio.css remappten Tokens (canvas/warm/neutral/primary), sodass jede
 * Seite, die diese Primitives nutzt, automatisch auf der Studio-Bühne steht.
 * All server components — no interactivity here.
 */

/** Centered, max-width content column with responsive gutters. */
export function Container({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`mx-auto w-full max-w-[1280px] px-[clamp(20px,4vw,56px)] ${className}`}>
      {children}
    </div>
  );
}

type SectionTone = "default" | "wash" | "muted";

// Studio-Rhythmus: `muted`/`wash` ist das warme „Rest“-Band eine Stufe unter
// dem Papier-Canvas; `default` erbt den Canvas vom Layout.
const TONE_BG: Record<SectionTone, string> = {
  default: "",
  wash: "bg-warm",
  muted: "bg-warm",
};

/** Vertical-rhythm section band. `tone` paints an optional light background. */
export function Section({
  children,
  id,
  className = "",
  tone = "default",
}: {
  children: ReactNode;
  id?: string;
  className?: string;
  tone?: SectionTone;
}) {
  return (
    <section
      id={id}
      className={`py-20 sm:py-28 ${TONE_BG[tone]} ${className}`}
    >
      {children}
    </section>
  );
}

/**
 * Kapitelmarke — das Mono-Tape-Label der Studio-Bühne: REC-rotes Mono-Etikett
 * mit auslaufender Hairline (ersetzt die alte violette Eyebrow, gleiche API).
 */
export function Eyebrow({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-3 font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-neutral-500 ${className}`}
    >
      {children}
      <span aria-hidden className="h-px w-10 bg-[var(--st-line)]" />
    </span>
  );
}

/**
 * Decorative L-shaped corner brackets. Drop inside a `relative` parent (e.g. a
 * card) for the editorial framed look. Purely presentational.
 */
export function CornerBrackets({
  className = "border-neutral-300",
}: {
  className?: string;
}) {
  const corner = `pointer-events-none absolute h-3 w-3 ${className}`;
  return (
    <span aria-hidden>
      <span className={`${corner} left-0 top-0 border-l border-t`} />
      <span className={`${corner} right-0 top-0 border-r border-t`} />
      <span className={`${corner} bottom-0 left-0 border-b border-l`} />
      <span className={`${corner} bottom-0 right-0 border-b border-r`} />
    </span>
  );
}

/**
 * Section heading block: eyebrow + H2 + optional lead paragraph, centered by
 * default. `as` lets a page promote the heading level where needed.
 */
export function SectionHeading({
  eyebrow,
  title,
  lead,
  align = "center",
  as: Heading = "h2",
  className = "",
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  lead?: ReactNode;
  align?: "center" | "left";
  as?: ElementType;
  className?: string;
}) {
  const alignment =
    align === "center" ? "mx-auto max-w-2xl text-center items-center" : "max-w-2xl";
  return (
    <div className={`flex flex-col gap-4 ${alignment} ${className}`}>
      {eyebrow ? <Eyebrow>{eyebrow}</Eyebrow> : null}
      <Heading className="font-marketing text-[clamp(28px,4vw,46px)] [font-weight:var(--st-display-weight)] leading-[1.04] tracking-[-0.02em] text-neutral-900">
        {title}
      </Heading>
      {lead ? (
        <p className="text-[17px] leading-relaxed text-neutral-500">{lead}</p>
      ) : null}
    </div>
  );
}

/**
 * Inline accent for headlines — der kursive Instrument-Serif-Akzent in
 * REC-Rot (st-serif), die Studio-Stimme für DAS Schlüsselwort der Headline.
 */
export function Accent({ children }: { children: ReactNode }) {
  return <span className="st-serif">{children}</span>;
}

/**
 * Live / Bald status — die Studio-Lampe: grün leuchtend = läuft heute,
 * gedimmt = Roadmap. Ehrliches Labelling, gleiche API wie zuvor.
 */
export function StatusTag({
  status,
  lang = MARKETING_DEFAULT_LOCALE,
}: {
  status: "Live" | "Bald";
  lang?: Locale;
}) {
  const live = status === "Live";
  // The DATA enum stays 'Live'|'Bald' (a discriminant); only the rendered LABEL
  // localizes — on /en 'Bald' reads "Soon", 'Live' stays "Live".
  const label = localizedContent(lang, {
    de: status,
    en: status === "Bald" ? "Soon" : "Live",
  });
  return (
    <span className={`st-lamp ${live ? "st-lamp--light" : "st-lamp--soon"}`}>
      <b aria-hidden />
      {label}
    </span>
  );
}
