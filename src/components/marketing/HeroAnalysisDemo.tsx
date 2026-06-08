"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

/**
 * Homepage centerpiece — a clearly-labelled EXAMPLE analysis. Click "Diesen
 * Call analysieren" and findr.'s read plays back as pure client-side state
 * animation: the flagged phrases light up in the transcript (rot = stark,
 * orange = mittel, gelb = leicht), the three risk signals reveal in sequence,
 * and the deal-risk score counts 0 → 72. NO API call, no login, no real
 * customer data — every value below is hardcoded. Reduced-motion users get the
 * final state instantly (no count-up, no stagger).
 *
 * Sibling of SalesLiveDemo (the Sales-Intelligence module page); this homepage
 * variant carries the full red/orange/yellow severity scale and the "Beispiel"
 * framing. The two are intentionally independent components.
 *
 * Severity colours come straight from existing tokens — no new colours:
 *   stark  → danger-500  (#ef4444, rot)
 *   mittel → risk-high   (#f97316, orange)
 *   leicht → warning-500 (#f59e0b, gelb/amber)
 */

type Sev = "stark" | "mittel" | "leicht";

const SEV: Record<
  Sev,
  { label: string; dot: string; bar: string; chip: string; mark: string }
> = {
  stark: {
    label: "Stark",
    dot: "bg-danger-500",
    bar: "border-danger-500",
    chip: "bg-danger-500/12",
    mark: "bg-danger-500/15",
  },
  mittel: {
    label: "Mittel",
    dot: "bg-risk-high",
    bar: "border-risk-high",
    chip: "bg-risk-high/12",
    mark: "bg-risk-high/15",
  },
  leicht: {
    label: "Leicht",
    dot: "bg-warning-500",
    bar: "border-warning-500",
    chip: "bg-warning-500/14",
    mark: "bg-warning-500/20",
  },
};

type Line =
  | { rep: true; text: string }
  | { rep?: false; before: string; phrase: string; sev: Sev; after?: string };

const TRANSCRIPT: Line[] = [
  { rep: true, text: "Wie steht es um das Renewal im Q2?" },
  {
    before: "Ehrlich gesagt … ",
    phrase: "Sarah hat letzte Woche gekündigt.",
    sev: "stark",
    after: " Sie hat das Projekt bei uns getragen.",
  },
  { rep: true, text: "Das tut mir leid. Wer übernimmt jetzt?" },
  {
    before: "Noch unklar. ",
    phrase: "Der CFO will gerade alle Tool-Budgets durchgehen.",
    sev: "mittel",
  },
  { rep: true, text: "Verstehe. Und wie lief das Pricing-Gespräch?" },
  {
    before: "Passt soweit — ",
    phrase: "ein Wettbewerber lag zuletzt etwas günstiger.",
    sev: "leicht",
  },
  { rep: true, text: "Danke für die Offenheit. Wir bleiben dran." },
];

const SIGNALS: { name: string; sev: Sev; quote: string; why: string }[] = [
  {
    name: "Champion-Verlust",
    sev: "stark",
    quote: "„Sarah hat letzte Woche gekündigt.“",
    why: "Die treibende Kraft auf Kundenseite ist weg.",
  },
  {
    name: "Budget-Review",
    sev: "mittel",
    quote: "„Der CFO will alle Tool-Budgets durchgehen.“",
    why: "Neuer, später Entscheider mit Spar-Mandat.",
  },
  {
    name: "Wettbewerber-Preis",
    sev: "leicht",
    quote: "„Ein Wettbewerber lag etwas günstiger.“",
    why: "Preisdruck — aber noch kein Dealbreaker.",
  },
];

const TARGET = 72;

function ScoreRing({ score }: { score: number }) {
  const r = 42;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - score / 100);
  return (
    <div className="relative h-[104px] w-[104px] shrink-0">
      <svg width="104" height="104" className="-rotate-90" aria-hidden>
        <circle
          cx="52"
          cy="52"
          r={r}
          fill="none"
          stroke="var(--color-primary-100)"
          strokeWidth="6"
        />
        <circle
          cx="52"
          cy="52"
          r={r}
          fill="none"
          stroke="var(--color-primary-600)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-[34px] font-semibold tabular-nums text-neutral-900">
        {score}
      </div>
    </div>
  );
}

/** Tiny severity chip: a coloured dot + dark, always-readable label. */
function SevChip({ sev }: { sev: Sev }) {
  const s = SEV[sev];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded px-2 py-0.5 text-[11px] font-medium text-neutral-700 ${s.chip}`}
    >
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

export function HeroAnalysisDemo() {
  const reduce = useReducedMotion();
  const [analyzed, setAnalyzed] = useState(false);
  // `revealed` flips one frame AFTER the signal cards mount, so their staggered
  // "list builds up" transition actually fires (a freshly-mounted node at its
  // final class never animates). Reduced-motion sets it instantly.
  const [revealed, setRevealed] = useState(false);
  const [done, setDone] = useState(false);
  const [score, setScore] = useState(0);
  const rafRef = useRef(0);
  const revealRafRef = useRef(0);

  function analyze() {
    setAnalyzed(true);
    if (reduce) {
      setScore(TARGET);
      setRevealed(true);
      setDone(true);
      return;
    }
    // Double rAF: let the cards paint at opacity-0, then flip → transition runs.
    revealRafRef.current = requestAnimationFrame(() => {
      revealRafRef.current = requestAnimationFrame(() => setRevealed(true));
    });
    cancelAnimationFrame(rafRef.current);
    const start = performance.now();
    const dur = 1100;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setScore(Math.round(TARGET * eased));
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
      else setDone(true);
    };
    rafRef.current = requestAnimationFrame(tick);
  }

  function reset() {
    cancelAnimationFrame(rafRef.current);
    cancelAnimationFrame(revealRafRef.current);
    setAnalyzed(false);
    setRevealed(false);
    setDone(false);
    setScore(0);
  }

  useEffect(
    () => () => {
      cancelAnimationFrame(rafRef.current);
      cancelAnimationFrame(revealRafRef.current);
    },
    [],
  );

  // Pre-compute each flagged phrase's position so the highlight stagger is a
  // pure derived value (no counter mutation during render).
  let running = 0;
  const phraseOrder = TRANSCRIPT.map((line) =>
    "rep" in line && line.rep ? -1 : running++,
  );

  return (
    <div className="overflow-hidden rounded-md border border-neutral-200 bg-white shadow-[0_1px_0_rgba(24,24,27,0.04),0_24px_60px_-32px_rgba(74,81,168,0.28)]">
      {/* Window chrome — honest "example" framing, deliberately NOT a live badge */}
      <div className="flex items-center justify-between gap-3 border-b border-neutral-200 bg-neutral-50 px-4 py-2.5 sm:px-5">
        <div className="flex items-center gap-2">
          <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-neutral-300" />
          <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-neutral-300" />
          <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-neutral-300" />
          <span className="ml-2 text-[12px] font-medium text-neutral-500">
            findr. · Beispiel-Analyse
          </span>
        </div>
        <span className="rounded bg-neutral-100 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em] text-neutral-500">
          Sales Intelligence
        </span>
      </div>

      <div className="grid lg:grid-cols-2">
        {/* ── Transcript pane ─────────────────────────────────────── */}
        <div className="border-b border-neutral-200 p-5 sm:p-6 lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between border-b border-neutral-200 pb-3 text-[11px] text-neutral-500">
            <span>Transkript · Acme Corp × Northwind · 34:12</span>
            <span>Vorgefertigtes Beispiel</span>
          </div>

          <div className="mt-4 flex flex-col gap-3.5">
            {TRANSCRIPT.map((line, i) => {
              const rep = "rep" in line && line.rep;
              const seq = phraseOrder[i];
              return (
                <div key={i} className="flex gap-3">
                  <span
                    className={`mt-0.5 inline-flex h-6 shrink-0 items-center rounded px-2 text-[11px] font-medium ${
                      rep
                        ? "bg-neutral-100 text-neutral-700"
                        : "bg-primary-50 text-primary-700"
                    }`}
                  >
                    {rep ? "Rep" : "Kunde"}
                  </span>
                  <p className="text-[13.5px] leading-relaxed text-neutral-700">
                    {rep ? (
                      (line as { text: string }).text
                    ) : (
                      <>
                        {line.before}
                        <mark
                          className={`rounded px-0.5 text-neutral-900 transition-colors duration-500 ${
                            analyzed ? SEV[line.sev].mark : "bg-transparent"
                          } ${reduce ? "transition-none" : ""}`}
                          style={
                            reduce || !analyzed
                              ? undefined
                              : { transitionDelay: `${200 + seq * 340}ms` }
                          }
                        >
                          {line.phrase}
                        </mark>
                        {line.after}
                      </>
                    )}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={analyze}
              disabled={analyzed}
              className="inline-flex h-10 items-center justify-center gap-2 rounded bg-primary-600 px-4 text-sm font-medium text-white transition-colors hover:bg-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-2 disabled:cursor-default disabled:opacity-40"
            >
              {!analyzed
                ? "Diesen Call analysieren"
                : done
                  ? "Analyse abgeschlossen"
                  : "Analysiere …"}
            </button>
            {analyzed ? (
              <button
                type="button"
                onClick={reset}
                className="inline-flex h-10 items-center justify-center rounded px-3 text-sm text-neutral-500 transition-colors hover:text-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-2"
              >
                ↺ Zurücksetzen
              </button>
            ) : null}
          </div>
        </div>

        {/* ── Analysis pane ───────────────────────────────────────── */}
        <div className="bg-neutral-50 p-5 sm:p-6">
          <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-500">
            findr.-Analyse
          </div>

          {!analyzed ? (
            <div className="mt-5 flex min-h-[340px] flex-col items-center justify-center gap-2 rounded border border-dashed border-neutral-300 p-6 text-center">
              <p className="max-w-[34ch] text-sm text-neutral-500">
                Klick auf{" "}
                <span className="font-medium text-neutral-700">Analysieren</span>{" "}
                — findr. fängt die Signale, die ein menschlicher Reviewer
                übersehen hat.
              </p>
            </div>
          ) : (
            <div aria-live="polite">
              {/* Score */}
              <div className="mt-4 flex flex-col items-start gap-4 border-b border-neutral-200 pb-5 sm:flex-row sm:items-center sm:gap-5">
                <ScoreRing score={score} />
                <div>
                  <div className="text-[11px] uppercase tracking-[0.1em] text-neutral-500">
                    Deal-Risiko
                  </div>
                  <div className="mt-1.5 inline-flex items-center gap-1.5 rounded bg-danger-500/12 px-2.5 py-1 text-sm font-semibold text-danger-700">
                    <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-danger-500" />
                    Hoch
                  </div>
                  <p className="mt-2 max-w-[24ch] text-[11px] leading-snug text-neutral-500">
                    Score {TARGET}/100 — drei Risiko-Signale im Transkript belegt.
                  </p>
                </div>
              </div>

              {/* Signals build-up */}
              <div className="mt-5 text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-500">
                Erkannte Risiko-Signale
              </div>
              <div className="mt-3 flex flex-col gap-2.5">
                {SIGNALS.map((s, i) => (
                  <div
                    key={s.name}
                    className={`rounded border border-neutral-200 border-l-[3px] bg-white p-3 transition-all duration-500 ${
                      SEV[s.sev].bar
                    } ${revealed ? "translate-x-0 opacity-100" : "translate-x-3 opacity-0"} ${
                      reduce ? "transition-none" : ""
                    }`}
                    style={
                      reduce ? undefined : { transitionDelay: `${1150 + i * 220}ms` }
                    }
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] font-semibold text-neutral-900">
                        {s.name}
                      </span>
                      <SevChip sev={s.sev} />
                    </div>
                    <p className="mt-1 border-l-2 border-neutral-200 pl-2.5 text-[12px] italic leading-relaxed text-neutral-500">
                      {s.quote}
                    </p>
                    <p className="mt-1.5 text-[12px] leading-relaxed text-neutral-600">
                      <span className="font-medium text-neutral-700">Warum: </span>
                      {s.why}
                    </p>
                  </div>
                ))}
              </div>

              {/* CRM vs. reality — the "belegt, nicht geraten" payoff */}
              <div
                className={`mt-5 rounded border border-primary-200 bg-primary-50/60 p-4 transition-opacity duration-500 ${
                  done || reduce ? "opacity-100" : "opacity-0"
                } ${reduce ? "transition-none" : ""}`}
                style={reduce ? undefined : { transitionDelay: "1900ms" }}
              >
                <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-primary-700">
                  CRM vs. Realität
                </div>
                <div className="mt-2 flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-neutral-500">CRM-Notiz</span>
                  <span className="text-neutral-500 line-through">
                    Verloren wegen Preis
                  </span>
                </div>
                <div className="mt-1 flex items-baseline justify-between gap-3 text-sm">
                  <span className="text-neutral-500">findr.</span>
                  <span className="font-medium text-neutral-900">
                    Champion weg, CFO nie eingebunden
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
