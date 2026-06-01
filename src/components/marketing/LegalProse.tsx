import type { ReactNode } from "react";
import { Container, Section } from "./primitives";

/**
 * Legal-page primitives (Impressum / Datenschutz / AGB). A plain, readable
 * prose surface on the light marketing canvas: Fraunces headings (font-marketing),
 * Hanken body (inherited from the (marketing) layout), a narrow measure.
 *
 * ⚠ These three pages ship as SCAFFOLDING only. The binding texts come from
 * André / Legal (open decision D8). To make sure NOTHING here can be mistaken
 * for a real, relied-upon legal statement, every page leads with
 * <LegalPlaceholderNotice/> and every section body carries a bracketed
 * <Placeholder/> token instead of invented legal prose. The section headings
 * are factual structure (the clauses a German Impressum/Datenschutzerklärung/AGB
 * must contain) — a checklist, not a fabricated text.
 */

/** Page shell: H1 + optional intro + the mandatory placeholder banner + body. */
export function LegalProse({
  title,
  intro,
  children,
}: {
  title: ReactNode;
  intro?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Section className="pt-14 sm:pt-20">
      <Container>
        <article className="mx-auto flex max-w-[760px] flex-col">
          <h1 className="font-marketing text-[clamp(30px,4.5vw,46px)] font-semibold leading-[1.08] tracking-[-0.02em] text-neutral-900">
            {title}
          </h1>
          {intro ? (
            <p className="mt-4 text-[17px] leading-relaxed text-neutral-500">
              {intro}
            </p>
          ) : null}
          <LegalPlaceholderNotice />
          <div className="flex flex-col gap-9">{children}</div>
        </article>
      </Container>
    </Section>
  );
}

/**
 * Prominent, unmistakable "this is not real legal text yet" banner. Amber/
 * warning-tinted so it reads as caution, never as brand or as body copy.
 */
export function LegalPlaceholderNotice() {
  return (
    <div
      role="note"
      className="mt-10 mb-12 flex flex-col gap-2 rounded border border-warning-500/40 bg-warning-50 px-5 py-4"
    >
      <span className="inline-flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.1em] text-warning-700">
        <span aria-hidden>⚠</span> Platzhalter — noch kein rechtsgültiger Text
      </span>
      <p className="text-[15px] leading-relaxed text-neutral-700">
        Diese Seite ist ein <strong className="font-semibold">Gerüst</strong>.
        Der verbindliche Text wird vor dem Live-Gang von André bzw. der
        Rechtsberatung eingesetzt. Bis dahin stehen unten ausschließlich
        Platzhalter — bitte nicht als Rechtsauskunft lesen.
      </p>
    </div>
  );
}

/** A titled section: factual heading + placeholder body. */
export function LegalSection({
  heading,
  children,
}: {
  heading: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="font-marketing text-xl font-semibold leading-snug text-neutral-900">
        {heading}
      </h2>
      <div className="text-[15px] leading-relaxed text-neutral-600">
        {children}
      </div>
    </section>
  );
}

/**
 * A placeholder token. Dashed border + mono + muted colour so it can NEVER be
 * read as real legal prose — it visibly marks "content goes here, supplied later".
 */
export function Placeholder({ children }: { children: ReactNode }) {
  return (
    <span className="inline rounded border border-dashed border-neutral-300 bg-neutral-50 px-1.5 py-0.5 font-mono text-[13px] text-neutral-400">
      [Platzhalter: {children}]
    </span>
  );
}
