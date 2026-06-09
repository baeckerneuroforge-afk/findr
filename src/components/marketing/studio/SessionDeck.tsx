"use client";

import { useEffect, useRef, useState } from "react";

/**
 * „Die Session“ — das Herzstück der Studio-Homepage: ein Transkript auf
 * Papier, das sich selbst tippt. Bei jeder Schlüsselaussage stempelt ein
 * Befund (BEDÜRFNIS / WORKAROUND / REIBUNG) auf die Zeile, rechts schneiden
 * die Befund-Karten live mit, am Ende klappt „Annahme vs. Realität“ auf.
 *
 * Vorgefertigtes Beispiel — gleicher ehrlicher Inhalt wie die bisherige
 * Beispiel-Analyse (kein API-Call, kein Login, keine echten Teilnehmerdaten).
 * Reines Client-State-Theater, 1:1 portiert aus dem freigegebenen Entwurf.
 *
 * prefers-reduced-motion: Play rendert sofort den fertigen Endzustand —
 * nichts tippt, nichts blinkt, nichts schiebt sich rein.
 */

type Line = {
  who: string;
  f: boolean;
  text: string;
  stamp?: { label: string; cls: string };
  finding?: number;
};

const LINES: Line[] = [
  {
    who: "findr.",
    f: true,
    text: "Erzähl mal von letzter Woche — wie hast du entschieden, was du kochst?",
  },
  {
    who: "Person",
    f: false,
    text: "Ehrlich? Ich stand jeden Abend planlos vor dem Kühlschrank. Das nervt mich schon länger.",
    stamp: { label: "Bedürfnis", cls: "" },
    finding: 1,
  },
  { who: "findr.", f: true, text: "Und wenn dir nichts einfällt — was machst du dann?" },
  {
    who: "Person",
    f: false,
    text: "Meistens bestelle ich einfach was, obwohl ich's mir anders vorgenommen hatte.",
    stamp: { label: "Workaround", cls: "st-stamp--2" },
    finding: 2,
  },
  { who: "findr.", f: true, text: "Hast du schon mal etwas ausprobiert, um das zu lösen?" },
  {
    who: "Person",
    f: false,
    text: "Eine App kurz getestet — aber das ewige Eintippen war mir zu mühsam.",
    stamp: { label: "Reibung", cls: "st-stamp--3" },
    finding: 3,
  },
  { who: "findr.", f: true, text: "Danke — das ist sehr aufschlussreich." },
];

const FINDINGS = [
  {
    k: 1,
    name: "Bedürfnis",
    strength: "Stark",
    quote: "Ich stand jeden Abend planlos vor dem Kühlschrank.",
  },
  {
    k: 2,
    name: "Workaround",
    strength: "Mittel",
    quote: "… bestelle ich einfach was, obwohl ich's mir anders vorgenommen hatte.",
  },
  {
    k: 3,
    name: "Reibung",
    strength: "Leicht",
    quote: "… das ewige Eintippen war mir zu mühsam.",
  },
];

type Phase = "idle" | "playing" | "done";

export function SessionDeck() {
  // typed[i]: -1 = Zeile noch nicht da, sonst Anzahl getippter Zeichen.
  const [typed, setTyped] = useState<number[]>(() => LINES.map(() => -1));
  const [stamped, setStamped] = useState<boolean[]>(() => LINES.map(() => false));
  const [phase, setPhase] = useState<Phase>("idle");
  const [tc, setTc] = useState("TC 00:00:00");

  const deckRef = useRef<HTMLDivElement>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const rafRef = useRef(0);
  const startedRef = useRef(false);
  // Imperativer Doppelstart-Schutz (Event-Handler + IO-Autostart teilen ihn) —
  // bewusst KEIN Spiegel des States im Render (react-hooks/refs).
  const playingRef = useRef(false);

  const clearTimers = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    cancelAnimationFrame(rafRef.current);
  };
  const later = (fn: () => void, ms: number) => {
    timersRef.current.push(setTimeout(fn, ms));
  };

  const finishAll = () => {
    clearTimers();
    playingRef.current = false;
    setTyped(LINES.map((l) => l.text.length));
    setStamped(LINES.map(() => true));
    setPhase("done");
    setTc("TC 00:08:42");
  };

  const play = () => {
    if (playingRef.current) return;
    playingRef.current = true;
    startedRef.current = true;
    clearTimers();
    setTyped(LINES.map(() => -1));
    setStamped(LINES.map(() => false));
    setPhase("playing");

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      finishAll();
      return;
    }

    // Session-Timecode läuft (gerafft) während der Wiedergabe.
    const tStart = performance.now();
    const pad = (n: number) => (n < 10 ? "0" : "") + n;
    const tcTick = (now: number) => {
      const s = Math.floor(((now - tStart) / 1000) * 14);
      setTc(`TC 00:${pad(Math.floor(s / 60))}:${pad(s % 60)}`);
      rafRef.current = requestAnimationFrame(tcTick);
    };
    rafRef.current = requestAnimationFrame(tcTick);

    let delay = 250;
    LINES.forEach((line, li) => {
      const SPEED = line.f ? 14 : 24; // ms pro Zeichen
      later(() => {
        let i = 0;
        const typeChar = () => {
          i++;
          setTyped((cur) => {
            const next = [...cur];
            next[li] = i;
            return next;
          });
          if (i < line.text.length) {
            timersRef.current.push(setTimeout(typeChar, SPEED));
          } else if (line.stamp) {
            later(() => {
              setStamped((cur) => {
                const next = [...cur];
                next[li] = true;
                return next;
              });
            }, 240);
          }
        };
        typeChar();
      }, delay);
      delay += line.text.length * SPEED + (line.stamp ? 950 : 480);
    });

    later(() => {
      cancelAnimationFrame(rafRef.current);
      playingRef.current = false;
      setPhase("done");
      setTc("TC 00:08:42");
    }, delay + 600);
  };

  // Autostart, sobald das Deck ins Bild scrollt (einmalig).
  useEffect(() => {
    const el = deckRef.current;
    if (!el || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(
      (e) => {
        if (e[0]?.isIntersecting && !startedRef.current) {
          play();
          io.disconnect();
        }
      },
      { threshold: 0.45 },
    );
    io.observe(el);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Timer beim Unmount abräumen.
  useEffect(() => () => clearTimers(), []);

  const findingShown = (k: number) =>
    phase === "done" || stamped[LINES.findIndex((l) => l.finding === k)];

  // Welche Zeile tippt gerade? (für den Caret)
  const activeLine = typed.findIndex(
    (n, i) => n > -1 && n < LINES[i].text.length,
  );

  return (
    <div ref={deckRef} className={`st-deck ${phase === "playing" ? "playing" : ""}`}>
      <div className="st-deck-top">
        <div className="flex items-center gap-3.5">
          <span className="st-deck-rec">
            <b aria-hidden />
            Session 001
          </span>
          <span className="st-tag">Bedarf &amp; Verhalten</span>
        </div>
        <span className="st-deck-tc">{tc}</span>
      </div>

      <div className="st-deck-body">
        {/* ── Transkript-Spur ───────────────────────────────────────── */}
        <div className="st-tape">
          <div aria-live="polite">
            {LINES.map((line, li) =>
              typed[li] > -1 ? (
                <div key={li} className={`st-tape-row ${line.f ? "is-f" : ""}`}>
                  <span className="st-who">{line.who}</span>
                  <p>
                    {line.text.slice(0, typed[li])}
                    {li === activeLine ? (
                      <span className="st-caret" aria-hidden />
                    ) : null}
                  </p>
                  {line.stamp ? (
                    <span
                      className={`st-stamp ${line.stamp.cls} ${
                        stamped[li] ? "show" : ""
                      }`}
                    >
                      {line.stamp.label}
                    </span>
                  ) : null}
                </div>
              ) : null,
            )}
          </div>
          <div className="mt-2 flex gap-3 pt-2">
            <button
              type="button"
              className="st-play-btn magnetic"
              disabled={phase === "playing"}
              onClick={play}
            >
              {phase === "idle"
                ? "▶  Session abspielen"
                : phase === "playing"
                  ? "●  Aufnahme läuft …"
                  : "↺  Nochmal abspielen"}
            </button>
            <button type="button" className="st-skip-btn" onClick={finishAll}>
              Überspringen ⏭
            </button>
          </div>
        </div>

        {/* ── Befund-Seitenspalte ───────────────────────────────────── */}
        <aside className="st-findings">
          <span className="st-tag mb-4 block">Befunde — live mitgeschnitten</span>
          {FINDINGS.map((f) => (
            <div
              key={f.k}
              data-k={f.k}
              className={`st-finding ${findingShown(f.k) ? "show" : ""}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="st-f-name">{f.name}</span>
                <span className="st-f-k">{f.strength}</span>
              </div>
              <q>{f.quote}</q>
            </div>
          ))}
          <div className={`st-verdikt ${phase === "done" ? "show" : ""}`}>
            <span className="st-tag mb-2.5 block">Annahme vs. Realität</span>
            <div className="st-row">
              <span>Annahme</span>
              <span className="old">Mehr Rezepte gewünscht</span>
            </div>
            <div className="st-row">
              <span>findr.</span>
              <span className="neu">Entscheidungslast, nicht Rezeptmangel</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
