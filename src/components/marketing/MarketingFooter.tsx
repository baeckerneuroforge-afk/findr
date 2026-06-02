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
// erfundenen Belege. Dieselben Claims stehen auch in den Hero-Trust-Chips (`/`,
// `/demo`) und einzelnen Modul-Beschreibungen.
const COMPLIANCE = [
  "In Deutschland gebaut",
  "In Frankfurt gehostet",
  "DSGVO-konform",
  "EU-AI-Act-konform",
];

export function MarketingFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-neutral-200 bg-neutral-50">
      <Container className="py-16">
        <div className={`grid gap-x-8 gap-y-12 md:grid-cols-2 ${GRID_COLS}`}>
          <div className="flex flex-col gap-3">
            <Wordmark />
            <p className="max-w-xs text-sm leading-relaxed text-neutral-500">
              Ein KI-Gehirn für jedes Kundengespräch — vier Produkte auf einer
              Conversation-Intelligence-Plattform.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <div key={col.title} className="flex flex-col gap-3">
              <h3 className="text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-500">
                {col.title}
              </h3>
              <ul className="flex flex-col gap-2.5">
                {col.links.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="rounded text-sm text-neutral-700 transition-colors hover:text-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-2"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-14 flex flex-col gap-4 border-t border-neutral-200 pt-6 text-xs text-neutral-500 sm:flex-row sm:items-center sm:justify-between">
          <ul className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {COMPLIANCE.map((c) => (
              <li key={c} className="inline-flex items-center gap-2">
                <span aria-hidden className="h-1 w-1 rounded-full bg-primary-400" />
                {c}
              </li>
            ))}
          </ul>
          <div>© {year} findr.</div>
        </div>
      </Container>
    </footer>
  );
}
