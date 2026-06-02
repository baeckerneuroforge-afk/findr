import Link from "next/link";
import { Fragment } from "react";
import { MODULES } from "./PlatformModules";
import { ICONS, CheckIcon } from "./icons";

/**
 * Feature-/Modul-Matrix für die Preis-Seite (Outset-Stil): Zeilen = Fähigkeiten,
 * Spalten = die vier Plattform-Module. Sie zeigt, was in welchem Modul steckt —
 * der Baukasten, aus dem das individuelle Pricing entsteht.
 *
 * WICHTIG: nichts erfunden. Jede Zelle ist aus den realen Modul-Seiten abgeleitet
 * (`/produkt/<modul>` — die ProofPoints/HowItWorks-Schritte dort). Die Zeilen-
 * Kommentare nennen die Quelle. Spalten kommen aus der kanonischen MODULES-Liste
 * (Reihenfolge: Sales · Customer Success · Product Discovery · Market Research),
 * damit Name/Icon/Link nie von der übrigen Seite abweichen.
 *
 * Vollständig statisch (Server Component, kein Client-JS). Responsive: breite
 * Tabelle ab `lg`, darunter ein Karten-Stapel je Modul — keine horizontale
 * Scroll-Tabelle, auf Mobile lesbar.
 */

// Zellzustand: enthalten · bald (Roadmap) · nicht in diesem Modul.
type Cell = "yes" | "soon" | "no";

// Reihenfolge der vier Zellen == Reihenfolge von MODULES:
// [Sales Intelligence, Customer Success Health, Product Discovery, Market Research]
type MatrixRow = { label: string; cells: [Cell, Cell, Cell, Cell] };
type MatrixGroup = { title: string; rows: MatrixRow[] };

const GROUPS: MatrixGroup[] = [
  {
    title: "Gespräche erfassen",
    rows: [
      {
        // Sales-Step „Calls verbinden“ (Gong/Slack/Kalender, kein Upload/Tagging);
        // CS-Step „Calls & Reviews verbinden … dieselben Konnektoren wie Sales“;
        // PD-Proof „Voice of Customer aus bestehenden Calls“. MR fährt dedizierte
        // Studien statt bestehender Calls → kein Häkchen.
        label: "Bestehende Calls automatisch erfasst (Gong, Slack, Kalender)",
        cells: ["yes", "yes", "yes", "no"],
      },
      {
        // MR-Proofs „Offener Studien-Link & Walk-ins“ + „Screening-Gate“.
        label:
          "Dedizierte KI-Interview-Studien mit Screening-Gate (offener Link, Walk-ins)",
        cells: ["no", "no", "no", "yes"],
      },
      {
        // PD-Proof „KI-geführte Nutzer-Interviews … auf Deutsch und Englisch“;
        // MR-Proof „KI-Interviews auf Deutsch“.
        label: "KI-geführte Interviews (Deutsch & Englisch)",
        cells: ["no", "no", "yes", "yes"],
      },
    ],
  },
  {
    title: "Analysieren & belegen",
    rows: [
      {
        // Sales „0–100-Risiko-Score nach jedem Call“; CS „Health-Score pro Account“.
        label: "Score nach jedem Gespräch (0–100)",
        cells: ["yes", "yes", "no", "no"],
      },
      {
        // Plattform-weit: Sales „acht belegte Signale“, CS „belegte Risiko-Signale“,
        // PD „Quelle bei jeder Aussage“, MR „jede Zahl je Studie belegt“.
        label: "Signale am exakten Transkript-Moment belegt",
        cells: ["yes", "yes", "yes", "yes"],
      },
      {
        // Sales-Proof „Automatische Verlustgrund-Erkennung“.
        label: "Automatische Verlustgrund-Erkennung",
        cells: ["yes", "no", "no", "no"],
      },
      {
        // PD-Proof „Synthese, verankert im Transkript“; MR-Step „Synthese je Studie“.
        label: "Studien-Synthese: Themen, Pains, Signale",
        cells: ["no", "no", "yes", "yes"],
      },
    ],
  },
  {
    title: "Entscheiden & handeln",
    rows: [
      {
        // Sales „Lösungs-Report als PDF / Empfehlung + nächster Schritt“;
        // CS-Proof „Save-Plays“.
        label: "Belegte Empfehlung & nächster Schritt (Save-Play, Lösungs-Report)",
        cells: ["yes", "yes", "no", "no"],
      },
      {
        // Sales-Proof „Risiko-adjustierte Pipeline“.
        label: "Risiko-adjustierte Pipeline-Prognose",
        cells: ["yes", "no", "no", "no"],
      },
      {
        // CS-Proofs „Account-Value & Value-Typ“ + „Deterministischer Renewal-Forecast“.
        label: "Account-Value & deterministischer Renewal-Forecast",
        cells: ["no", "yes", "no", "no"],
      },
      {
        // PD-Proof „Research-Agent auf Zuruf“; MR-Step „Frag über alle Studien hinweg“.
        label: "Frag deine Daten in natürlicher Sprache",
        cells: ["no", "no", "yes", "yes"],
      },
      {
        // MR-Proof „Deterministische Cross-Study-Zählung … je Studie belegt“.
        label: "Deterministische Cross-Study-Zählung, je Studie belegt",
        cells: ["no", "no", "no", "yes"],
      },
      {
        // Sales-Proof „Voice-Loss-Loop“ (Bald) + CS-Proof „Voice-Nachfass bei Churn“
        // (Bald) — beides Roadmap.
        label: "Voice-Agent schließt den Kreis (Loss-/Churn-Nachfass)",
        cells: ["soon", "soon", "no", "no"],
      },
    ],
  },
];

// Kurz-Labels für die Spaltenköpfe (die vollen Namen sprengen 4 schmale Spalten).
// Per href an MODULES gebunden, damit Reihenfolge/Link/Icon Single-Source bleiben.
const SHORT_BY_HREF: Record<string, string> = {
  "/produkt/sales-intelligence": "Sales",
  "/produkt/customer-health": "Customer Success",
  "/produkt/product-discovery": "Product Discovery",
  "/produkt/market-research": "Market Research",
};

const COLUMNS = MODULES.map((m) => ({
  name: m.name,
  short: SHORT_BY_HREF[m.href] ?? m.name,
  href: m.href,
  Icon: ICONS[m.icon],
}));

const ALL_ROWS = GROUPS.flatMap((g) => g.rows);

/** „bald“-Marker (Roadmap). Text bewusst neutral-700 (10:1 auf neutral-100 = WCAG
 *  AA für 9-px-Kleinschrift; neutral-500 läge bei 4.40:1 knapp darunter). */
function SoonBadge() {
  return (
    <span className="inline-flex items-center rounded bg-neutral-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-neutral-700">
      bald
    </span>
  );
}

/** Zell-Marker in der breiten Tabelle. */
function CellMark({ cell }: { cell: Cell }) {
  if (cell === "yes") {
    return (
      <>
        <CheckIcon className="h-[18px] w-[18px] text-primary-600" />
        <span className="sr-only">enthalten</span>
      </>
    );
  }
  if (cell === "soon") {
    return (
      <>
        <SoonBadge />
        <span className="sr-only">in Kürze</span>
      </>
    );
  }
  return (
    <>
      <span aria-hidden className="text-base text-neutral-300">
        –
      </span>
      <span className="sr-only">nicht enthalten</span>
    </>
  );
}

export function PricingMatrix() {
  return (
    <div>
      {/* Legende */}
      <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[12px] text-neutral-500">
        <span className="inline-flex items-center gap-2">
          <CheckIcon className="h-4 w-4 text-primary-600" />
          enthalten
        </span>
        <span className="inline-flex items-center gap-2">
          <SoonBadge />
          in Kürze
        </span>
        <span className="inline-flex items-center gap-2">
          <span aria-hidden className="text-neutral-300">
            –
          </span>
          nicht in diesem Modul
        </span>
      </div>

      {/* ── Breite Matrix (ab lg) ─────────────────────────────────────────── */}
      <div className="mt-8 hidden overflow-hidden rounded border border-neutral-200 bg-white lg:block">
        <div className="grid grid-cols-[1.7fr_repeat(4,1fr)]">
          {/* Kopfzeile */}
          <div
            aria-hidden
            className="border-b border-neutral-200 px-5 py-5"
          />
          {COLUMNS.map((c) => (
            <Link
              key={c.href}
              href={c.href}
              className="group flex flex-col items-center gap-2 border-b border-l border-neutral-200 px-3 py-5 text-center transition-colors hover:bg-neutral-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500"
            >
              <c.Icon className="h-6 w-6 text-primary-600" />
              <span className="text-[13px] font-semibold leading-tight text-neutral-900">
                {c.short}
              </span>
            </Link>
          ))}

          {/* Gruppen + Zeilen */}
          {GROUPS.map((group) => (
            <Fragment key={group.title}>
              <div className="col-span-full border-b border-neutral-200 bg-neutral-50 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-700">
                {group.title}
              </div>
              {group.rows.map((row) => (
                <Fragment key={row.label}>
                  <div className="border-b border-neutral-200 px-5 py-3.5 text-[13.5px] leading-snug text-neutral-700">
                    {row.label}
                  </div>
                  {row.cells.map((cell, ci) => (
                    <div
                      key={COLUMNS[ci].href}
                      className="flex items-center justify-center border-b border-l border-neutral-200 px-3 py-3.5"
                    >
                      <CellMark cell={cell} />
                    </div>
                  ))}
                </Fragment>
              ))}
            </Fragment>
          ))}
        </div>
      </div>

      {/* ── Karten-Stapel je Modul (unter lg) ─────────────────────────────── */}
      <div className="mt-8 flex flex-col gap-4 lg:hidden">
        {COLUMNS.map((c, mi) => {
          const rows = ALL_ROWS.filter((r) => r.cells[mi] !== "no");
          return (
            <div
              key={c.href}
              className="rounded border border-neutral-200 bg-white p-6"
            >
              <Link
                href={c.href}
                className="group inline-flex items-center gap-2.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-2"
              >
                <c.Icon className="h-5 w-5 shrink-0 text-primary-600" />
                <span className="font-marketing text-lg font-semibold tracking-[-0.01em] text-neutral-900">
                  {c.name}
                </span>
                <span
                  aria-hidden
                  className="text-primary-600 transition-transform group-hover:translate-x-0.5"
                >
                  →
                </span>
              </Link>
              <ul className="mt-4 flex flex-col gap-2.5 border-t border-dashed border-neutral-200 pt-4">
                {rows.map((r) => {
                  const soon = r.cells[mi] === "soon";
                  return (
                    <li
                      key={r.label}
                      className={`flex items-start gap-2.5 text-[13.5px] leading-snug ${
                        soon ? "text-neutral-500" : "text-neutral-700"
                      }`}
                    >
                      <span
                        aria-hidden
                        className={`mt-0.5 shrink-0 ${
                          soon ? "text-neutral-300" : "text-primary-600"
                        }`}
                      >
                        {soon ? "◆" : <CheckIcon className="h-4 w-4" />}
                      </span>
                      <span>
                        {/* SR-Parität zur Desktop-Tabelle: „enthalten“ ansagen
                            (bei „bald“ trägt das sichtbare Badge die Ansage). */}
                        {!soon ? <span className="sr-only">enthalten: </span> : null}
                        {r.label}
                        {soon ? <span className="ml-2"><SoonBadge /></span> : null}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
}
