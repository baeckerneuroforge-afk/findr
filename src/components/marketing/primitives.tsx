import type { ElementType, ReactNode } from "react";

/**
 * Marketing layout primitives. Editorial restraint: generous whitespace,
 * hairline rules, 4px radius, corner-bracket accents. Light surface only
 * (bg-white / neutral-50). All server components — no interactivity here.
 *
 * Palette note: the app's custom neutral ramp defines 0/50/100/200/300/400/500/
 * 700/900 (zinc values) but NOT 600/800 — those are intentionally avoided so the
 * scale stays internally consistent. Ink = neutral-900, muted = neutral-500,
 * strong-secondary = neutral-700, hairlines = neutral-200, accent = primary-600.
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
    <div className={`mx-auto w-full max-w-[1180px] px-6 sm:px-8 ${className}`}>
      {children}
    </div>
  );
}

type SectionTone = "default" | "wash" | "muted";

// Farbsystem: the section rhythm is now warm + calm. `muted` is the warm-cream
// "rest" band (was cool neutral-50); `wash` is de-violetted to the same warm
// cream (the old violet glass wash is gone — violet stays an accent, never a
// flat surface). `default` inherits the warm off-white canvas from the layout.
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

/** Small uppercase label with a leading hairline — the section "eyebrow". */
export function Eyebrow({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-2.5 text-[11px] font-medium uppercase tracking-[0.18em] text-primary-600 ${className}`}
    >
      <span aria-hidden className="h-px w-6 bg-primary-300" />
      {children}
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
      <Heading className="font-marketing text-[clamp(28px,4vw,46px)] font-semibold leading-[1.08] tracking-[-0.02em] text-neutral-900">
        {title}
      </Heading>
      {lead ? (
        <p className="text-[17px] leading-relaxed text-neutral-500">{lead}</p>
      ) : null}
    </div>
  );
}

/**
 * Inline accent for headlines (the violet emphasis the source copy uses for the
 * key phrase in each H1/H2).
 */
export function Accent({ children }: { children: ReactNode }) {
  return <span className="text-primary-600">{children}</span>;
}

/**
 * Live / Bald status pill — the honest "Live vs. soon" labelling that runs
 * through the copy. Green = shipped, neutral = roadmap.
 */
export function StatusTag({ status }: { status: "Live" | "Bald" }) {
  const live = status === "Live";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.06em] ${
        live ? "bg-success-50 text-success-700" : "bg-neutral-100 text-neutral-500"
      }`}
    >
      <span
        aria-hidden
        className={`h-1.5 w-1.5 rounded-full ${live ? "bg-success-500" : "bg-neutral-400"}`}
      />
      {status}
    </span>
  );
}
