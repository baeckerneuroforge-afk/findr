"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

/**
 * Interactive live-analysis demo for the Sales-Intelligence module page — the
 * 'use client' island that fills the template's demo slot (§4.3). Click
 * "Analysieren" → the risk score counts up to 72 and the four evidence-anchored
 * signals reveal in sequence. Reduced-motion users get the final state instantly
 * (no count-up, no stagger). All copy verbatim from landing.html:1126–1224.
 */

type Severity = "high" | "med";

const TRANSCRIPT: {
  rep?: boolean;
  before?: string;
  highlight?: string;
  tone?: "champion" | "dm" | "comp" | "stall";
  after?: string;
  text?: string;
}[] = [
  { rep: true, text: "Also, erzähl mal — was hat sich seit unserem letzten Gespräch verändert?" },
  {
    before: "Ja, also ",
    highlight: "Sarah hat letzte Woche das Unternehmen verlassen",
    tone: "champion",
    after: ", was echt schade ist — sie hat das hier wirklich vorangetrieben.",
  },
  { rep: true, text: "Oh, das tut mir leid. Wer übernimmt jetzt das Projekt?" },
  {
    before: "Ehrlich gesagt ",
    highlight:
      "bin ich mir nicht ganz sicher. Der CFO hat was davon gesagt, alle Lieferanten-Ausgaben zu prüfen.",
    tone: "dm",
  },
  { rep: true, text: "Verstehe. Konntet ihr euch das Pricing ansehen, das wir geschickt haben?" },
  {
    before: "Haben wir. ",
    highlight: "Eure Wettbewerber lagen ehrlich gesagt etwas darunter.",
    tone: "comp",
  },
  { rep: true, text: "Verstehe. Wo lagen die preislich?" },
  {
    before: "Sagen wir mal so: Intern ist das eine schwierige Diskussion. ",
    highlight: "Wir müssen das vielleicht auf Q3 verschieben.",
    tone: "stall",
  },
  { rep: true, text: "Total nachvollziehbar. Bleiben wir in Kontakt." },
];

const TONE_HL: Record<NonNullable<(typeof TRANSCRIPT)[number]["tone"]>, string> = {
  champion: "bg-primary-50 text-primary-700",
  dm: "bg-warning-50 text-warning-700",
  comp: "bg-danger-50 text-danger-700",
  stall: "bg-success-50 text-success-700",
};

const SIGNALS: { name: string; sev: Severity; quote: string }[] = [
  {
    name: "Champion-Verlust",
    sev: "high",
    quote: "„Sarah hat letzte Woche das Unternehmen verlassen …“",
  },
  {
    name: "Später Entscheider",
    sev: "high",
    quote: "„Der CFO hat was davon gesagt, alle Lieferanten-Ausgaben zu prüfen.“",
  },
  {
    name: "Wettbewerber-Druck",
    sev: "med",
    quote: "„Eure Wettbewerber lagen ehrlich gesagt etwas darunter.“",
  },
  {
    name: "Hinhalten",
    sev: "med",
    quote: "„Wir müssen das vielleicht auf Q3 verschieben.“",
  },
];

const TARGET = 72;

function ScoreRing({ score }: { score: number }) {
  const r = 40;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - score / 100);
  return (
    <div className="relative h-24 w-24 shrink-0">
      <svg width="96" height="96" className="-rotate-90" aria-hidden>
        <circle cx="48" cy="48" r={r} fill="none" stroke="#dcdeef" strokeWidth="5" />
        <circle
          cx="48"
          cy="48"
          r={r}
          fill="none"
          stroke="#4a51a8"
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-3xl font-semibold text-neutral-900 tabular-nums">
        {score}
      </div>
    </div>
  );
}

export function SalesLiveDemo() {
  const reduce = useReducedMotion();
  const [analyzed, setAnalyzed] = useState(false);
  const [score, setScore] = useState(0);
  const rafRef = useRef(0);

  function analyze() {
    setAnalyzed(true);
    if (reduce) {
      setScore(TARGET);
      return;
    }
    cancelAnimationFrame(rafRef.current);
    const start = performance.now();
    const dur = 1100;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setScore(Math.round(TARGET * eased));
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }

  function reset() {
    cancelAnimationFrame(rafRef.current);
    setAnalyzed(false);
    setScore(0);
  }

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Transcript pane */}
      <div className="rounded border border-neutral-200 bg-white p-5 sm:p-6">
        <div className="flex items-center justify-between border-b border-neutral-200 pb-3 text-xs text-neutral-500">
          <span>Transkript · Acme Corp × Northwind · 34:12</span>
          <span className="inline-flex items-center gap-1.5 font-medium text-primary-700">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-primary-600" />
            Live
          </span>
        </div>

        <div className="mt-4 flex flex-col gap-3.5">
          {TRANSCRIPT.map((line, i) => (
            <div key={i} className="flex gap-3">
              <span
                className={`mt-0.5 inline-flex h-6 shrink-0 items-center rounded px-2 text-[11px] font-medium ${
                  line.rep
                    ? "bg-neutral-100 text-neutral-700"
                    : "bg-primary-50 text-primary-700"
                }`}
              >
                {line.rep ? "Rep" : "Kunde"}
              </span>
              <p className="text-sm leading-relaxed text-neutral-700">
                {line.text ? (
                  line.text
                ) : (
                  <>
                    {line.before}
                    <mark
                      className={`rounded px-1 ${TONE_HL[line.tone!]}`}
                    >
                      {line.highlight}
                    </mark>
                    {line.after}
                  </>
                )}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={analyze}
            disabled={analyzed}
            className="inline-flex h-10 items-center justify-center gap-2 rounded bg-primary-600 px-4 text-sm font-medium text-white transition-colors hover:bg-primary-700 disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-2"
          >
            Diesen Call analysieren
          </button>
          {analyzed ? (
            <button
              type="button"
              onClick={reset}
              className="inline-flex h-10 items-center justify-center rounded px-3 text-sm text-neutral-500 transition-colors hover:text-primary-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 focus-visible:ring-offset-2"
            >
              ↺ Demo zurücksetzen
            </button>
          ) : null}
        </div>
      </div>

      {/* Analysis pane */}
      <div className="rounded border border-neutral-200 bg-neutral-50 p-5 sm:p-6">
        <div className="text-xs font-medium uppercase tracking-[0.14em] text-neutral-500">
          findr.-Analyse
        </div>

        {!analyzed ? (
          <div className="mt-6 flex min-h-[320px] flex-col items-center justify-center gap-2 rounded border border-dashed border-neutral-300 p-6 text-center">
            <p className="text-sm text-neutral-500">
              Klick auf <span className="font-medium text-neutral-700">Analysieren</span> —
              findr. fängt die Signale, die ein menschlicher Reviewer übersehen hat.
            </p>
          </div>
        ) : (
          <>
            <div className="mt-5 flex items-center gap-5 border-b border-neutral-200 pb-5">
              <ScoreRing score={score} />
              <div>
                <div className="text-xs uppercase tracking-[0.1em] text-neutral-500">
                  Deal-Risiko
                </div>
                <div className="mt-1 inline-flex items-center gap-1.5 rounded bg-danger-50 px-2.5 py-1 text-sm font-semibold text-danger-700">
                  Hoch
                </div>
              </div>
            </div>

            <div className="mt-5 text-[11px] font-medium uppercase tracking-[0.14em] text-neutral-500">
              Erkannte Risiko-Signale
            </div>
            <div className="mt-3 flex flex-col gap-2.5">
              {SIGNALS.map((s, i) => (
                <div
                  key={s.name}
                  className={`rounded border border-neutral-200 bg-white p-3 transition-all duration-500 ${
                    analyzed ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"
                  } ${reduce ? "transition-none" : ""}`}
                  style={reduce ? undefined : { transitionDelay: `${i * 160}ms` }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-neutral-900">
                      {s.name}
                    </span>
                    <span
                      className={`rounded px-2 py-0.5 text-[11px] font-medium ${
                        s.sev === "high"
                          ? "bg-danger-50 text-danger-700"
                          : "bg-warning-50 text-warning-700"
                      }`}
                    >
                      {s.sev === "high" ? "Hoch" : "Mittel"}
                    </span>
                  </div>
                  <p className="mt-1 text-xs italic leading-relaxed text-neutral-500">
                    {s.quote}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded border border-primary-200 bg-primary-50/60 p-4">
              <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-primary-700">
                CRM vs. Realität
              </div>
              <div className="mt-2 flex items-baseline justify-between gap-3 text-sm">
                <span className="text-neutral-500">CRM-Tag</span>
                <span className="text-neutral-500 line-through">
                  Verloren wegen Preis
                </span>
              </div>
              <div className="mt-1 flex items-baseline justify-between gap-3 text-sm">
                <span className="text-neutral-500">findr.</span>
                <span className="font-medium text-neutral-900">
                  Champion weg + CFO nie eingebunden
                </span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
