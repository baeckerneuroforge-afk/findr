import type { ReactNode } from "react";
import { Container, Section } from "./primitives";
import { MARKETING_DEFAULT_LOCALE, type Locale } from "@/i18n/marketing-locale";

/**
 * Legal-page primitives (Impressum / Datenschutz / AGB). A plain, readable
 * prose surface on the light marketing canvas: Fraunces headings (font-marketing),
 * Hanken body (inherited from the (marketing) layout), a narrow measure.
 *
 * Pages that are still a DRAFT (Datenschutz / AGB until the binding text from
 * André/Legal lands) lead with <LegalPlaceholderNotice/> (the default `notice`).
 * Such pages may carry vorausgefüllten Standardtext for the uncritical clauses,
 * but every firmenspezifische / rechtssensible Stelle is marked with an
 * unmissable <LegalTodo>{{ … }}</LegalTodo> token instead of invented prose. The
 * section headings are factual structure (the clauses a German Impressum/
 * Datenschutzerklärung/AGB must contain) — a checklist, not a fabricated text.
 *
 * Pages whose text is real and binding (e.g. the Impressum) pass
 * `notice={false}` to drop the draft banner and render the actual copy.
 */

/**
 * Page shell: H1 + optional intro + optional "Stand"-line + (optional)
 * placeholder banner + body.
 *
 * @param notice  Render the amber "noch kein rechtsgültiger Text" banner.
 *                Defaults to `true` (placeholder pages). Pass `false` once a
 *                page carries real, binding text.
 * @param stand   Optional "Stand"-marker (e.g. "Juni 2026") — rendered as a
 *                muted console label under the intro.
 */
export function LegalProse({
  title,
  intro,
  stand,
  notice = true,
  lang = MARKETING_DEFAULT_LOCALE,
  closing,
  children,
}: {
  title: ReactNode;
  intro?: ReactNode;
  stand?: ReactNode;
  notice?: boolean;
  /** Render locale. On "en" an English courtesy banner is shown above the
   *  (German, legally-binding) body — the German wording stays authoritative. */
  lang?: Locale;
  /** Optional closing band rendered below the body (e.g. a "Stand"-line at the
   *  foot of the page). Separated by a hairline. */
  closing?: ReactNode;
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
          {stand ? (
            <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.16em] text-neutral-400">
              Stand: {stand}
            </p>
          ) : null}
          {lang === "en" ? <LegalLanguageNotice /> : null}
          {notice ? <LegalPlaceholderNotice /> : null}
          <div
            className={`flex flex-col gap-9 ${
              notice || lang === "en" ? "" : "mt-10"
            }`}
          >
            {children}
          </div>
          {closing ? (
            <div className="mt-12 border-t border-neutral-200 pt-6">
              {closing}
            </div>
          ) : null}
        </article>
      </Container>
    </Section>
  );
}

/**
 * Prominent, unmistakable "this is a draft, not legal advice yet" banner. Amber/
 * warning-tinted so it reads as caution, never as brand or as body copy.
 */
export function LegalPlaceholderNotice() {
  return (
    <div
      role="note"
      className="mt-10 mb-12 flex flex-col gap-2 rounded border border-warning-500/40 bg-warning-50 px-5 py-4"
    >
      <span className="inline-flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.1em] text-warning-700">
        <span aria-hidden>⚠</span> Entwurf — keine Rechtsberatung
      </span>
      <p className="text-[15px] leading-relaxed text-neutral-700">
        Diese Seite ist ein <strong className="font-semibold">Entwurf</strong>.
        Unkritische Abschnitte sind als Standardtext vorausgefüllt; alle mit{" "}
        <code className="rounded bg-warning-100 px-1 font-mono text-[13px] text-warning-700">
          {"{{ … }}"}
        </code>{" "}
        markierten Stellen sind Platzhalter, die vor dem Live-Gang über den
        eRecht24-Datenschutz-Generator bzw. einen Anwalt ersetzt und juristisch
        geprüft werden müssen. Bitte bis dahin nicht als Rechtsauskunft lesen.
      </p>
    </div>
  );
}

/**
 * English courtesy banner shown on the /en legal pages. The legal bodies stay
 * German (a German Impressum/Datenschutz/AGB derives its effect from the German
 * wording + statute citations — a translation would be informational at best).
 * Neutral-toned so it reads as a note, not a warning.
 */
export function LegalLanguageNotice() {
  return (
    <div
      role="note"
      className="mt-10 mb-2 flex flex-col gap-2 rounded border border-neutral-300 bg-neutral-50 px-5 py-4"
    >
      <span className="inline-flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.1em] text-neutral-700">
        <span aria-hidden>⚖</span> Legally binding in German
      </span>
      <p className="text-[15px] leading-relaxed text-neutral-600">
        This page is legally binding in German only. The German text below is the
        authoritative version; this notice is informational and not a certified
        translation.
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

/**
 * A {{ … }} TODO marker for draft legal pages. Renders the literal
 * `{{ PLATZHALTER: … }}` braces in an amber, dashed, mono pill so every spot a
 * lawyer still has to fill or verify is greppable (`{{`) AND visually
 * unmistakable — it can never be mistaken for binding prose. The child carries
 * the specific instruction plus its review note ("… — juristisch prüfen" /
 * "… vom Anwalt prüfen lassen").
 */
export function LegalTodo({ children }: { children: ReactNode }) {
  return (
    <span className="inline rounded border border-dashed border-warning-500/50 bg-warning-50 px-1.5 py-0.5 align-baseline font-mono text-[13px] font-medium text-warning-700">
      {"{{ PLATZHALTER: "}
      {children}
      {" }}"}
    </span>
  );
}

/**
 * The muted "Stand"-line. Used both as the shell's top marker and as a page's
 * closing date band (passed via LegalProse's `closing` slot) — one source for
 * the styling so the two never drift.
 */
export function LegalStand({ children }: { children: ReactNode }) {
  return (
    <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-neutral-400">
      Stand: {children}
    </p>
  );
}
