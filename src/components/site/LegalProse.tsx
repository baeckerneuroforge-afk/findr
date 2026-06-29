import type { ReactNode } from "react";

/**
 * Legal-page primitives for the (site) design.
 * Self-contained — no imports from @/components/marketing or @/i18n.
 *
 * Exports match the public API of the old @/components/marketing/LegalProse
 * so that the four legal pages (impressum / datenschutz / agb / cookies)
 * compile unchanged after updating their import path.
 *
 * Design tokens used: font-display (IBM Plex Serif / site serif),
 * text-ink, text-muted-foreground, border-border, bg-card, soul/40,
 * and the .prose-klymeo long-form class defined in (site)/site.css.
 */

/**
 * Page shell: H1 + optional intro + optional "Stand" line + (optional)
 * placeholder banner + body.
 *
 * @param notice  Render the "⚠ Entwurf" draft banner (default true).
 *                Pass `false` once a page carries real, binding text.
 * @param stand   Optional "Stand" marker rendered as a muted mono label.
 * @param lang    Accept but ignore — (site) is DE-only; never auto-shows
 *                an EN banner.
 * @param closing Optional closing band below the body, separated by a
 *                hairline.
 */
export function LegalProse({
  title,
  intro,
  stand,
  notice = true,
  lang: _lang,
  closing,
  children,
}: {
  title: ReactNode;
  intro?: ReactNode;
  stand?: ReactNode;
  notice?: boolean;
  /** Accept for API compatibility; ignored — DE-only site. */
  lang?: string;
  closing?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="py-16 sm:py-20">
      <div className="mx-auto max-w-[760px] px-6">
        <article className="flex flex-col">
          <h1 className="font-display text-[clamp(30px,4.5vw,46px)] leading-[1.08] tracking-[-0.02em] text-ink">
            {title}
          </h1>
          {intro ? (
            <p className="mt-4 text-[17px] leading-relaxed text-muted-foreground">
              {intro}
            </p>
          ) : null}
          {stand ? (
            <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
              Stand: {stand}
            </p>
          ) : null}
          {notice ? <LegalPlaceholderNotice /> : null}
          <div className={`flex flex-col gap-9${notice ? "" : " mt-10"}`}>
            {children}
          </div>
          {closing ? (
            <div className="mt-12 border-t border-border pt-6">{closing}</div>
          ) : null}
        </article>
      </div>
    </section>
  );
}

/**
 * Prominent "this is a draft, not legal advice yet" banner.
 * Restyle uses soul/40 tones (site design token) instead of warning palette.
 * The text content is verbatim from the old marketing component.
 */
export function LegalPlaceholderNotice() {
  return (
    <div
      role="note"
      className="mt-10 mb-12 flex flex-col gap-2 rounded-xl border border-soul/40 bg-soul/10 px-5 py-4"
    >
      <span className="inline-flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.1em] text-ink">
        <span aria-hidden>⚠</span> Entwurf — keine Rechtsberatung
      </span>
      <p className="text-[15px] leading-relaxed text-ink/80">
        Diese Seite ist ein <strong className="font-semibold">Entwurf</strong>.
        Unkritische Abschnitte sind als Standardtext vorausgefüllt; alle mit{" "}
        <code className="rounded bg-soul/10 px-1 font-mono text-[13px] text-ink">
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
 * English courtesy banner — included for API completeness.
 * On the DE-only (site) tree this is never auto-rendered by LegalProse,
 * but is exported so pages that import it explicitly still compile.
 */
export function LegalLanguageNotice() {
  return (
    <div
      role="note"
      className="mt-10 mb-2 flex flex-col gap-2 rounded-xl border border-border bg-card px-5 py-4"
    >
      <span className="inline-flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.1em] text-ink">
        <span aria-hidden>⚖</span> Legally binding in German
      </span>
      <p className="text-[15px] leading-relaxed text-muted-foreground">
        This page is legally binding in German only. The German text below is
        the authoritative version; this notice is informational and not a
        certified translation.
      </p>
    </div>
  );
}

/** A titled section: factual heading + body. */
export function LegalSection({
  heading,
  children,
}: {
  heading: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="font-display text-xl leading-snug text-ink">{heading}</h2>
      <div className="prose-klymeo text-[15px] leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

/**
 * A placeholder token. Dashed border + mono + muted colour — can never be
 * read as real legal prose; visibly marks "content goes here".
 */
export function Placeholder({ children }: { children: ReactNode }) {
  return (
    <span className="inline rounded border border-dashed border-border bg-card px-1.5 py-0.5 font-mono text-[13px] text-muted-foreground">
      [Platzhalter: {children}]
    </span>
  );
}

/**
 * A {{ … }} TODO marker for draft legal pages. Renders the literal
 * `{{ PLATZHALTER: … }}` braces in an amber/soul-tinted dashed mono pill
 * so every spot a lawyer still has to fill or verify is greppable (`{{`)
 * AND visually unmistakable — it can never be mistaken for binding prose.
 */
export function LegalTodo({ children }: { children: ReactNode }) {
  return (
    <span className="inline rounded border border-dashed border-soul/50 bg-soul/10 px-1.5 py-0.5 align-baseline font-mono text-[13px] font-medium text-ink">
      {"{{ PLATZHALTER: "}
      {children}
      {" }}"}
    </span>
  );
}

/**
 * The muted "Stand" line. Used both as the shell's top marker and as a
 * page's closing date band (via LegalProse's `closing` slot).
 */
export function LegalStand({ children }: { children: ReactNode }) {
  return (
    <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
      Stand: {children}
    </p>
  );
}
