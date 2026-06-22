import Link from "next/link";
import { Reveal } from "../Reveal";
import { ICONS } from "../icons";
import {
  getUseCases,
  getUseCaseMethods,
  getUseCaseHref,
} from "../use-cases-data";
import {
  localizedContent,
  localizePath,
  MARKETING_DEFAULT_LOCALE,
  type Locale,
} from "@/i18n/marketing-locale";

/**
 * Homepage-Grid der ANWENDUNGSFÄLLE (Outset-Modell: eine Engine, flaches
 * Use-Case-Grid). Liest aus der Use-Case-Registry. LIVE Use Cases sind dunkle
 * Tonband-Karten (st-minitape) mit Link auf /loesungen/<slug>; Marktforschung
 * trägt zusätzlich die vier Methoden als Chips. "prepared"-Use-Cases (heute
 * nicht nutzbar) erscheinen abgedunkelt, NICHT klickbar, mit "In Vorbereitung"
 * — keine Behauptung, dass sie heute gehen; ein späterer Flip aktiviert sie.
 */
export function UseCaseDeck({
  lang = MARKETING_DEFAULT_LOCALE,
}: {
  lang?: Locale;
}) {
  const locale = lang;
  const cases = getUseCases(locale);
  const moreLabel = localizedContent(locale, {
    de: "Mehr erfahren",
    en: "Learn more",
  });
  const prepLabel = localizedContent(locale, {
    de: "In Vorbereitung",
    en: "In preparation",
  });

  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {cases.map((u, i) => {
        const Icon = ICONS[u.icon];
        const idx = String(i + 1).padStart(2, "0");
        const methods = getUseCaseMethods(locale, u.slug);

        const head = (
          <>
            <div className="flex items-center justify-between">
              <span className="st-idx">{idx}</span>
              <Icon className="h-6 w-6 text-[var(--st-rec)]" />
            </div>
            <h3>{u.name}</h3>
            <p>{u.tagline}</p>
            {methods.length > 0 ? (
              <div className="mt-1 flex flex-wrap gap-1.5">
                {methods.map((m) => (
                  <span
                    key={m.href}
                    className="rounded border border-[rgba(238,239,248,0.18)] px-2 py-0.5 font-mono text-[11px] text-[rgba(238,239,248,0.8)]"
                  >
                    {m.name}
                  </span>
                ))}
              </div>
            ) : null}
          </>
        );

        if (u.status !== "live") {
          return (
            <Reveal key={u.slug} y={0} delay={i * 0.06} className="flex">
              <div
                className="st-minitape h-full w-full opacity-55"
                aria-disabled="true"
              >
                {head}
                <span className="st-more" aria-hidden>
                  {prepLabel}
                </span>
              </div>
            </Reveal>
          );
        }

        return (
          <Reveal key={u.slug} y={0} delay={i * 0.06} className="flex">
            <Link
              href={localizePath(locale, getUseCaseHref(u.slug))}
              className="st-minitape group h-full w-full focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500"
            >
              {head}
              <span className="st-more">
                {moreLabel}
                <span
                  aria-hidden
                  className="transition-transform group-hover:translate-x-0.5"
                >
                  →
                </span>
              </span>
            </Link>
          </Reveal>
        );
      })}
    </div>
  );
}
