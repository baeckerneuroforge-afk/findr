"use client";

import { useEffect, useState } from "react";

/**
 * Konsoul — der sprechbare Bot-Charakter des Cross-Study-Agenten: ein kleines
 * „Terminal-Fenster mit Gesicht", das die Ehrlichkeits-Stufe der Antwort
 * spiegelt, BEVOR man sie liest. Rein monochrom-Ink (Plattform-Tokens, also
 * automatisch Hell/Dunkel); Farbe NUR als Daten-Pip (grün=belegt,
 * amber=Interpretation, neutral=Ablehnung). Dekorativ → aria-hidden; die echten
 * Labels im Panel tragen die Bedeutung. Animationen respektieren
 * prefers-reduced-motion (Endzustand als ruhiges Gesicht).
 *
 * Zustände, 1:1 aus dem Panel-State abgeleitet:
 *   idle      — blinkender Cursor-Mund
 *   listen    — Augen wandern (man tippt)
 *   research  — tippt seine Recherche-Schleife mit (loading)
 *   answer    — lächelt, grüner Beleg-Pip (answered + belegt)
 *   hedge     — amber Schulterzucken (Interpretation vorhanden)
 *   guidance  — ruhig-aufmerksam, NEUTRALER Pip (Hilfe/How-to/Status); deutlich
 *               KEIN grünes Belegt-Gesicht — „beantwortet, nicht belegt"
 *   refuse    — ruhige, ebene Augen (ehrliche Ablehnung), nie rot
 *   greet     — winkt + Sprechblase, wenn man seinen Namen tippt („Konsoul")
 */
export type KonsoulState =
  | "idle"
  | "listen"
  | "research"
  | "answer"
  | "hedge"
  | "guidance"
  | "refuse"
  | "greet";

const EYE_L = 46;
const EYE_R = 94;
const EYEY = 18;
const STROKE = {
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 3,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

/** Locale-neutrale, code-artige „Tool-Schleife", die Konsoul beim Recherchieren
 *  mittippt — kein i18n nötig, weil es technische Tokens sind. */
const TRACE = ["list_studies → …", "load_synthesis · …", "aggregate …"];

function DotEye({ cx }: { cx: number }) {
  return <circle cx={cx} cy={EYEY} r={3.4} fill="currentColor" />;
}
function ArcEye({ cx }: { cx: number }) {
  return (
    <path
      d={`M${cx - 6} ${EYEY + 2} Q${cx} ${EYEY - 6} ${cx + 6} ${EYEY + 2}`}
      {...STROKE}
    />
  );
}
function DashEye({ cx }: { cx: number }) {
  return <path d={`M${cx - 6} ${EYEY} H${cx + 6}`} {...STROKE} />;
}

function Face({ state }: { state: KonsoulState }) {
  return (
    <svg viewBox="0 0 140 46" className="h-full w-full overflow-visible">
      {state === "answer" || state === "greet" ? (
        <>
          <ArcEye cx={EYE_L} />
          <ArcEye cx={EYE_R} />
          <path d="M60 34 Q70 44 80 34" {...STROKE} />
        </>
      ) : state === "refuse" ? (
        <>
          <DashEye cx={EYE_L} />
          <DashEye cx={EYE_R} />
          <path d="M62 38 H78" {...STROKE} />
        </>
      ) : state === "hedge" ? (
        <>
          <DotEye cx={EYE_L} />
          <DotEye cx={EYE_R} />
          <path d="M60 37 q5 -5 10 0 t10 0" {...STROKE} />
        </>
      ) : state === "guidance" ? (
        /* guidance — ruhig-aufmerksam, monochrom: ebene Punkt-Augen + ein neutral
           gerader Mund mit dezenter Aufwärts-Note (hilfsbereit, NICHT das
           „belegt"-Lächeln). Kein currentColor-Grün, statisch (reduced-motion). */
        <>
          <DotEye cx={EYE_L} />
          <DotEye cx={EYE_R} />
          <path d="M61 36 H79" {...STROKE} />
        </>
      ) : state === "listen" ? (
        <>
          <g className="knsl-scan">
            <DotEye cx={EYE_L} />
            <DotEye cx={EYE_R} />
          </g>
          <path d="M62 36 Q70 41 78 36" {...STROKE} />
        </>
      ) : (
        /* idle */
        <>
          <DotEye cx={EYE_L} />
          <DotEye cx={EYE_R} />
          <rect
            x={67}
            y={30}
            width={6}
            height={12}
            rx={1}
            fill="currentColor"
            className="knsl-blink"
          />
        </>
      )}
    </svg>
  );
}

/** Daten-Pip im Fuß: die einzige Farbe — und nur, wenn sie etwas bedeutet. */
function footPip(state: KonsoulState): { cls: string; sym: string } {
  switch (state) {
    case "answer":
      return { cls: "bg-success-500", sym: "✓" };
    case "hedge":
      return { cls: "bg-warning-500", sym: "~" };
    case "guidance":
      return { cls: "bg-neutral-400", sym: "›" };
    case "refuse":
      return { cls: "bg-neutral-400", sym: "—" };
    case "research":
      return { cls: "bg-neutral-400", sym: "…" };
    default:
      return { cls: "bg-neutral-300", sym: "" };
  }
}

export function Konsoul({
  state,
  greeting,
  className = "",
}: {
  state: KonsoulState;
  /** Lokalisierter Gruß-Text — als Sprechblase im „greet"-Zustand gezeigt. */
  greeting?: string;
  className?: string;
}) {
  // Tipp-Trace beim Recherchieren. Der Start ist via Timeout DEFERRED (kein
  // synchrones setState im Effekt-Body — Repo-Lint), und setState passiert nur
  // im Timeout-Callback. Beim Verlassen von „research" wird der Overlay per
  // State ausgeblendet, daher kein Reset nötig.
  const [traceCount, setTraceCount] = useState(0);
  useEffect(() => {
    if (state !== "research") return;
    let i = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const tick = () => {
      i = i >= TRACE.length ? 1 : i + 1;
      setTraceCount(i);
      timers.push(setTimeout(tick, i >= TRACE.length ? 1000 : 560));
    };
    timers.push(setTimeout(tick, 60));
    return () => timers.forEach(clearTimeout);
  }, [state]);

  const pip = footPip(state);

  return (
    <div aria-hidden="true" className={`relative ${className}`}>
      {/* Sprechblase, wenn man seinen Namen tippt */}
      {state === "greet" && greeting && (
        <div className="absolute right-full top-1.5 z-10 mr-3 w-max max-w-[200px] rounded-lg border border-neutral-200 bg-card px-3 py-1.5 text-small text-neutral-900 shadow-md">
          {greeting}
          <span className="absolute right-[-5px] top-3 h-2.5 w-2.5 rotate-45 border-r border-t border-neutral-200 bg-card" />
        </div>
      )}

      <div
        className={`w-[248px] overflow-hidden rounded-card border border-neutral-200 bg-card text-neutral-900 shadow-card ${
          state === "greet" ? "knsl-bounce" : ""
        }`}
      >
        {/* Titelleiste */}
        <div className="flex h-[28px] items-center gap-2 border-b border-neutral-200 bg-neutral-50 px-4">
          <span className="flex gap-[5px]">
            <i className="h-[7px] w-[7px] rounded-full bg-neutral-400" />
            <i className="h-[7px] w-[7px] rounded-full bg-neutral-400" />
            <i className="h-[7px] w-[7px] rounded-full bg-neutral-400" />
          </span>
          <span className="font-mono text-[12px] text-neutral-500">konsoul</span>
        </div>

        {/* Gesicht ODER Tipp-Trace */}
        <div className="relative flex h-[98px] flex-col justify-center px-4">
          {state === "research" ? (
            <div className="flex flex-col justify-center gap-1.5 font-mono text-[12.5px] leading-tight text-neutral-500">
              {TRACE.slice(0, traceCount).map((line, i) => (
                <div key={i} className="truncate">
                  {line}
                  {i === traceCount - 1 && (
                    <span className="ml-0.5 inline-block h-[12px] w-[6px] translate-y-px bg-neutral-900 align-baseline knsl-blink" />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="h-[62px]">
              <Face state={state} />
            </div>
          )}

          {/* amber Schulterzucken-Klammern (hedge) */}
          {state === "hedge" && (
            <>
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-[55%] font-mono text-[22px] text-warning-500">
                ⌐
              </span>
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-[55%] font-mono text-[22px] text-warning-500">
                ¬
              </span>
            </>
          )}
        </div>

        {/* Progress-Sliver (research) */}
        <div className="h-[2px] overflow-hidden bg-neutral-100">
          {state === "research" && (
            <div className="h-full w-2/5 rounded-full bg-neutral-900 animate-analysis-progress" />
          )}
        </div>

        {/* Daten-Pip */}
        <div className="flex min-h-[32px] items-center gap-2 border-t border-neutral-200 px-4 py-2 font-mono text-[12.5px] text-neutral-500">
          <span className={`h-2 w-2 shrink-0 rounded-full ${pip.cls}`} />
          {pip.sym && (
            <span
              className={
                state === "answer"
                  ? "font-semibold text-success-700"
                  : state === "hedge"
                    ? "text-warning-700"
                    : ""
              }
            >
              {pip.sym}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default Konsoul;
