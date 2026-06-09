import Link from "next/link";
import { Container } from "./primitives";
import { Wordmark } from "./Wordmark";
import { FOOTER_COLUMNS, FOOTER_GRID_BY_COLS } from "./nav-data";

// Footer columns + the matching grid template both come from the single nav
// registry (nav-data.ts), which composes the canonical MODULES / ROLES /
// INDUSTRIES sets. Adding a product/role/industry there flows into the footer,
// the header mega-menu and the sitemap at once — no hand-kept copy to drift.
const COLUMNS = FOOTER_COLUMNS;
const GRID_COLS =
  FOOTER_GRID_BY_COLS[COLUMNS.length] ?? FOOTER_GRID_BY_COLS[5];

// TODO D3: UWG-Claim — "DSGVO-konform" und "EU-AI-Act-konform" sind werbliche
// Aussagen, die vor Live entweder belegt oder entschärft werden müssen
// (Entscheidung André, vor Go-live). Bewusst UNVERÄNDERT gelassen — keine
// erfundenen Belege. Dieselben Claims stehen auch in den Hero-Trust-Zeilen
// (`/`, `/demo`) und einzelnen Modul-Beschreibungen.
const COMPLIANCE = [
  "In Deutschland gebaut",
  "In Frankfurt gehostet",
  "DSGVO-konform",
  "EU-AI-Act-konform",
];

export function MarketingFooter() {
  const year = new Date().getFullYear();
  return (
    // Studio-Dunkel (#14110c, --color-anchor): der Anker unter jeder Seite.
    // Creme-Druckfarbe, Mono-Spaltentitel, Hairlines in Creme bei 12 % — und
    // als Abschluss die riesige Outline-Wortmarke (st-ghostword) wie im
    // freigegebenen Entwurf.
    <footer className="st-on-dark relative overflow-hidden border-t border-white/10 bg-anchor">
      <Container className="relative z-10 py-16">
        <div className={`grid gap-x-8 gap-y-12 md:grid-cols-2 ${GRID_COLS}`}>
          <div className="flex flex-col gap-3">
            <Wordmark tone="light" />
            <p className="max-w-xs text-sm leading-relaxed text-anchor-foreground/70">
              Qualitative Marktforschung mit KI — hunderte Tiefeninterviews,
              DSGVO-nativ und auf Deutsch, verdichtet zu belegten Insights.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title} className="flex flex-col gap-3">
              <h3 className="font-mono text-[10.5px] font-medium uppercase tracking-[0.2em] text-anchor-foreground/45">
                {col.title}
              </h3>
              <ul className="flex flex-col gap-2.5">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="rounded text-sm text-anchor-foreground/75 transition-colors hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-2 focus-visible:ring-offset-anchor"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col gap-4 border-t border-white/10 pt-6 font-mono text-[10.5px] uppercase tracking-[0.16em] text-anchor-foreground/45 sm:flex-row sm:items-center sm:justify-between">
          <ul className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {COMPLIANCE.map((c) => (
              <li key={c} className="inline-flex items-center gap-2">
                <span
                  aria-hidden
                  className="h-1 w-1 rounded-full bg-[#ff4b2e]"
                />
                {c}
              </li>
            ))}
          </ul>
          <div>© {year} findr. — Aufgenommen in Frankfurt am Main</div>
        </div>
      </Container>

      {/* Riesige Outline-Wortmarke als unterster Abschluss der Seite. */}
      <div className="relative h-[clamp(80px,12vw,180px)]" aria-hidden>
        <span className="st-ghostword">findr.</span>
      </div>
    </footer>
  );
}
