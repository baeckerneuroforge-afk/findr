import Link from "next/link";
import { Container } from "./primitives";
import { Wordmark } from "./Wordmark";
import {
  getFooterColumns,
  FOOTER_COLUMNS,
  FOOTER_GRID_BY_COLS,
} from "./nav-data";
import {
  localizedContent,
  localizePath,
  MARKETING_DEFAULT_LOCALE,
  type Locale,
} from "@/i18n/marketing-locale";

// Footer columns + the matching grid template both come from the single nav
// registry (nav-data.ts), which composes the canonical MODULES / ROLES /
// INDUSTRIES sets. Adding a product/role/industry there flows into the footer,
// the header mega-menu and the sitemap at once — no hand-kept copy to drift.
// Column COUNT is locale-independent, so the grid template can stay module-level.
const GRID_COLS =
  FOOTER_GRID_BY_COLS[FOOTER_COLUMNS.length] ?? FOOTER_GRID_BY_COLS[5];

// TODO D3: UWG-Claim — "DSGVO-konform" und "EU-AI-Act-konform" sind werbliche
// Aussagen, die vor Live entweder belegt oder entschärft werden müssen
// (Entscheidung André, vor Go-live). Bewusst UNVERÄNDERT gelassen — keine
// erfundenen Belege. Dieselben Claims stehen auch in den Hero-Trust-Zeilen
// (`/`, `/demo`) und einzelnen Modul-Beschreibungen.
export function MarketingFooter({
  lang = MARKETING_DEFAULT_LOCALE,
}: {
  // Optional: the [lang] layout always passes it; the global 404 pages reuse
  // this chrome and fall back to German.
  lang?: Locale;
}) {
  const year = new Date().getFullYear();
  const columns = getFooterColumns(lang);
  const compliance = localizedContent(lang, {
    de: [
      "In Deutschland gebaut",
      "In Frankfurt gehostet",
      "DSGVO-konform",
      "EU-AI-Act-konform",
    ],
    en: [
      "Built in Germany",
      "Hosted in Frankfurt",
      "GDPR-compliant",
      "EU AI Act-compliant",
    ],
  });
  return (
    // Twilight-Dunkel (#141734, --color-anchor): die Dämmerungsstunde unter
    // jeder Seite — Dusk-Verlauf + Sternenhimmel (st-dusk/st-stars), Indigo-
    // Creme-Druckfarbe, Mono-Spaltentitel, Hairlines bei 12 % — und als
    // Abschluss die riesige Outline-Wortmarke (st-ghostword).
    <footer className="st-on-dark st-dusk st-stars relative overflow-hidden border-t border-white/10">
      <Container className="relative z-10 py-16">
        <div className={`grid gap-x-8 gap-y-12 md:grid-cols-2 ${GRID_COLS}`}>
          <div className="flex flex-col gap-3">
            <Wordmark tone="light" href={localizePath(lang, "/")} />
            <p className="max-w-xs text-sm leading-relaxed text-anchor-foreground/70">
              {localizedContent(lang, {
                de: "Qualitative Marktforschung mit KI — hunderte Tiefeninterviews, auf Wunsch per Voice-Agent, DSGVO-nativ und auf Deutsch, verdichtet zu belegten Insights.",
                en: "AI-powered qualitative market research — hundreds of in-depth interviews, optionally voice-led, GDPR-native, in German and English, distilled into evidenced insights.",
              })}
            </p>
          </div>

          {columns.map((col) => (
            <div key={col.title} className="flex flex-col gap-3">
              <h3 className="font-mono text-[10.5px] font-medium uppercase tracking-[0.2em] text-anchor-foreground/45">
                {col.title}
              </h3>
              <ul className="flex flex-col gap-2.5">
                {col.links.map((l) => {
                  // "Demo buchen" points at the external Cal.com scheduler;
                  // render it as a new-tab anchor (rel=noopener) instead of a
                  // next/link route. Internal links stay client-routed.
                  const isExternal = /^https?:\/\//.test(l.href);
                  const linkClass =
                    "rounded text-sm text-anchor-foreground/75 transition-colors hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-anchor";
                  return (
                    <li key={l.href}>
                      {isExternal ? (
                        <a
                          href={l.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={linkClass}
                        >
                          {l.label}
                        </a>
                      ) : (
                        <Link href={l.href} className={linkClass}>
                          {l.label}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col gap-4 border-t border-white/10 pt-6 font-mono text-[10.5px] uppercase tracking-[0.16em] text-anchor-foreground/45 sm:flex-row sm:items-center sm:justify-between">
          <ul className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {compliance.map((c) => (
              <li key={c} className="inline-flex items-center gap-2">
                <span
                  aria-hidden
                  className="h-1 w-1 rounded-full bg-[var(--st-rec)]"
                />
                {c}
              </li>
            ))}
          </ul>
          <div>
            © {year} Klymeo —{" "}
            {localizedContent(lang, {
              de: "Aufgenommen in Frankfurt am Main",
              en: "Recorded in Frankfurt am Main",
            })}
          </div>
        </div>
      </Container>

      {/* Riesige Outline-Wortmarke als unterster Abschluss der Seite. */}
      <div className="relative h-[clamp(80px,12vw,180px)]" aria-hidden>
        <span className="st-ghostword">Klymeo</span>
      </div>
    </footer>
  );
}
