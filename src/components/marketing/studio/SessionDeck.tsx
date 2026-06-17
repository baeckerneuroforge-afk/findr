"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  localizedContent,
  MARKETING_DEFAULT_LOCALE,
  type Locale,
} from "@/i18n/marketing-locale";

/**
 * „Die Session“ — das Herzstück der Studio-Homepage: ein Interview, das sich
 * selbst abspielt. Inszeniert einen Klymeo-Konzept-Test: Die KI zeigt einen
 * Entwurf (Stimulus), bohrt hörbar nach und wertet live aus.
 *
 * Umschaltbar zwischen Voice (Orb + Stimmpegel) und Text (Chat-Bubbles) —
 * dasselbe Interview, dieselbe Auswertung, zwei Modalitäten. Rechts schneidet
 * die Konsole drei echte Produkt-Artefakte mit: die Befunde (echte Kategorien),
 * die Stimulus-Analyse („was die KI im Bild sah“) und das Synthese-Fazit.
 * Befunde sind klickbar — ein Klick springt zur auslösenden Gesprächsstelle.
 *
 * Vorgefertigtes Beispiel — kein API-Call, kein Login, keine echten
 * Teilnehmerdaten. Reines Client-State-Theater, im Look 1:1 zum Bestand.
 *
 * prefers-reduced-motion: Play rendert sofort den fertigen Endzustand —
 * nichts tippt, nichts blinkt, nichts schiebt sich rein.
 */

type Turn = {
  who: string;
  f: boolean; // Interviewer (Klymeo) → Indigo-Badge / „spricht“
  text: string;
  reveal?: boolean; // Stimulus an diesem Turn einblenden
  finding?: number; // Kopplung zur Befund-Karte (k)
};

const STIMULUS = {
  brand: "NORDLICHT",
  sub: "Premium Kaffee",
  tag: "Material zum Gespräch · Variante A",
  alt: "Stilisierter Verpackungs-Entwurf: dunkelblau, Wortmarke „NORDLICHT“, ohne Preis.",
};

const TURNS: Turn[] = [
  {
    who: "Klymeo",
    f: true,
    text: "Ich zeig dir gleich einen Entwurf — sag einfach, was dir spontan durch den Kopf geht.",
    reveal: true,
  },
  {
    who: "Person",
    f: false,
    text: "Das Dunkelblau wirkt richtig hochwertig, fast premium.",
    finding: 1,
  },
  {
    who: "Klymeo",
    f: true,
    text: "Und wenn du das im Regal sehen würdest — was suchst du als Nächstes?",
  },
  {
    who: "Person",
    f: false,
    text: "Ehrlich? Den Preis. Den finde ich hier gar nicht.",
    finding: 2,
  },
  {
    who: "Klymeo",
    f: true,
    text: "Angenommen, der Preis stünde gut sichtbar drauf — würdest du zugreifen?",
  },
  {
    who: "Person",
    f: false,
    text: "Wahrscheinlich ja. Ohne Preis lege ich's eher zurück.",
    finding: 3,
  },
  { who: "Klymeo", f: true, text: "Danke — das hilft enorm." },
];

type Finding = {
  k: number;
  stamp: string; // kompaktes Label für den Stempel auf der Zeile
  name: string; // volles Anzeige-Label in der Karte
  schema: string; // echte Produkt-Kategorie (Mono-Mikrotag)
  strength: string;
  cls: string; // Stempel-/Karten-Farbvariante
  quote: string;
  analysisField?: number; // koppelt an ein Stimulus-Analyse-Feld (k)
};

const FINDINGS: Finding[] = [
  {
    k: 1,
    stamp: "Markenbild",
    name: "Markenwahrnehmung",
    schema: "BRAND_PERCEPTION",
    strength: "Stark",
    cls: "",
    quote: "Das Dunkelblau wirkt richtig hochwertig, fast premium.",
    analysisField: 2,
  },
  {
    k: 2,
    stamp: "Preis",
    name: "Preis-Sichtbarkeit",
    schema: "PRICE_SENSITIVITY",
    strength: "Hoch",
    cls: "st-stamp--2",
    quote: "Den Preis finde ich hier gar nicht.",
    analysisField: 3,
  },
  {
    k: 3,
    stamp: "Kaufabsicht",
    name: "Kaufabsicht",
    schema: "PURCHASE_INTENT",
    strength: "Bedingt",
    cls: "st-stamp--3",
    quote: "Ohne Preis lege ich's eher zurück.",
  },
];

type AnalysisField = { k: number; label: string; value: string };

const ANALYSIS: AnalysisField[] = [
  { k: 1, label: "Layout & Aufbau", value: "Zentrierter Packshot, viel Weißraum, klare Mittelachse." },
  { k: 2, label: "Farbwelt", value: "Dominantes Dunkelblau, goldener Akzent — kühl, hochwertig." },
  { k: 3, label: "Bildelemente", value: "Verpackung mittig, Markenname oben — kein Preis-Element." },
  { k: 4, label: "Text im Bild", value: "„NORDLICHT · Premium Kaffee“" },
  { k: 5, label: "Claim / Botschaft", value: "Ruhig, hochwertig — Genuss-Positionierung." },
  { k: 6, label: "Auffällige Gestaltung", value: "Sehr großzügiger Weißraum; Preis und CTA fehlen." },
];

const SYNTHESIS = {
  annahme: "Premium-Look reicht zum Verkauf.",
  realitaet: "Der Look überzeugt — fehlende Preis-Sichtbarkeit ist das eigentliche Conversion-Risiko.",
};

// Stimmpegel-Höhen (Theater, kein echtes Audio) — wie in K.04. Sprachneutral.
const VOICE_BARS = [38, 62, 24, 78, 46, 90, 30, 70, 52, 84, 36, 58, 26, 66];

type Phase = "idle" | "playing" | "done";
type Mode = "voice" | "text";
type OrbState = "idle" | "listening" | "speaking" | "thinking" | "done";

const ORB_LABEL: Record<OrbState, string> = {
  idle: "Bereit",
  listening: "Hört zu …",
  speaking: "Spricht …",
  thinking: "Denkt nach …",
  done: "Abgeschlossen",
};

// ── EN-Zwillinge der Inszenierungs-Objekte ───────────────────────────────────
// Spiegeln STIMULUS/TURNS/FINDINGS/ANALYSIS/SYNTHESIS/ORB_LABEL strukturgleich.
// HART: TURNS_EN/FINDINGS_EN behalten gleiche Länge + gleiche finding/k-Index-
// Zuordnung (turnIndexOfFinding/useState hängen daran). Schema-Codes,
// f/reveal/finding/cls/k/analysisField bleiben unverändert.

const STIMULUS_EN = {
  brand: "NORDLICHT",
  sub: "Premium Coffee",
  tag: "Discussion material · Variant A",
  alt: "Stylized packaging draft: dark blue, wordmark “NORDLICHT”, no price.",
};

const TURNS_EN: Turn[] = [
  {
    who: "Klymeo",
    f: true,
    text: "I'll show you a draft in a second — just tell me whatever comes to mind first.",
    reveal: true,
  },
  {
    who: "Person",
    f: false,
    text: "The dark blue feels really high-end, almost premium.",
    finding: 1,
  },
  {
    who: "Klymeo",
    f: true,
    text: "And if you spotted this on the shelf — what would you look for next?",
  },
  {
    who: "Person",
    f: false,
    text: "Honestly? The price. I can't find it here at all.",
    finding: 2,
  },
  {
    who: "Klymeo",
    f: true,
    text: "Say the price was clearly printed on it — would you reach for it?",
  },
  {
    who: "Person",
    f: false,
    text: "Probably yes. Without a price I'd more likely put it back.",
    finding: 3,
  },
  { who: "Klymeo", f: true, text: "Thank you — that helps a lot." },
];

const FINDINGS_EN: Finding[] = [
  {
    k: 1,
    stamp: "Brand image",
    name: "Brand perception",
    schema: "BRAND_PERCEPTION",
    strength: "Strong",
    cls: "",
    quote: "The dark blue feels really high-end, almost premium.",
    analysisField: 2,
  },
  {
    k: 2,
    stamp: "Price",
    name: "Price visibility",
    schema: "PRICE_SENSITIVITY",
    strength: "High",
    cls: "st-stamp--2",
    quote: "I can't find the price here at all.",
    analysisField: 3,
  },
  {
    k: 3,
    stamp: "Purchase intent",
    name: "Purchase intent",
    schema: "PURCHASE_INTENT",
    strength: "Conditional",
    cls: "st-stamp--3",
    quote: "Without a price I'd more likely put it back.",
  },
];

const ANALYSIS_EN: AnalysisField[] = [
  { k: 1, label: "Layout & structure", value: "Centered packshot, lots of whitespace, clear central axis." },
  { k: 2, label: "Color world", value: "Dominant dark blue, golden accent — cool, high-end." },
  { k: 3, label: "Image elements", value: "Packaging centered, brand name at top — no price element." },
  { k: 4, label: "Text in the image", value: "“NORDLICHT · Premium Coffee”" },
  { k: 5, label: "Claim / message", value: "Calm, high-end — an indulgence positioning." },
  { k: 6, label: "Notable design", value: "Very generous whitespace; price and CTA are missing." },
];

const SYNTHESIS_EN = {
  annahme: "A premium look is enough to sell.",
  realitaet: "The look convinces — missing price visibility is the real conversion risk.",
};

const ORB_LABEL_EN: Record<OrbState, string> = {
  idle: "Ready",
  listening: "Listening …",
  speaking: "Speaking …",
  thinking: "Thinking …",
  done: "Complete",
};

// German copy bundle. EN noch nicht getextet → DE-Fallback (EN=DE). Die
// Demo-Objekte (STIMULUS/TURNS/FINDINGS/ANALYSIS/SYNTHESIS/ORB_LABEL) sind
// die übersetzbare Inszenierung; die Schema-Codes (BRAND_PERCEPTION, …) und
// alle Nicht-Text-Felder (who-Logik via f/finding/cls/k) bleiben unverändert.
// TURNS/FINDINGS oben bleiben zusätzlich Modul-Konstanten, weil Längen-/
// Index-Logik (turnIndexOfFinding, useState-Initialwerte) struktur- und damit
// sprachneutral ist.
const CONTENT_DE = {
  stimulus: STIMULUS,
  turns: TURNS,
  findings: FINDINGS,
  analysis: ANALYSIS,
  synthesis: SYNTHESIS,
  orbLabel: ORB_LABEL,
  // Lose UI-Strings rund um die Bühne.
  recLabel: "Session 001",
  conceptTag: "Konzept-Test",
  modeGroupLabel: "Interview-Modus",
  modeVoice: "Voice",
  modeText: "Text",
  voiceInterviewLabel: "Sprach-Interview",
  stimDesc: "Konzept-Entwurf, live im Interview gezeigt.",
  stimPlaceholder: "Material wird im Gespräch eingeblendet …",
  textInputPlaceholder: "Antwort eintippen …",
  playIdle: "▶  Session abspielen",
  playPlaying: "●  Aufnahme läuft …",
  playReplay: "↺  Nochmal abspielen",
  skip: "Überspringen ⏭",
  findingsTag: "Befunde — live mitgeschnitten",
  jumpLabel: "↧ zur Stelle",
  analysisName: "Stimulus-Analyse",
  analysisSub: "Was die KI im Bild sah · 6 Felder",
  verdiktTag: "Synthese-Fazit",
  verdiktAssumption: "Annahme",
  verdiktBrand: "Klymeo",
};

const CONTENT_EN: typeof CONTENT_DE = {
  stimulus: STIMULUS_EN,
  turns: TURNS_EN,
  findings: FINDINGS_EN,
  analysis: ANALYSIS_EN,
  synthesis: SYNTHESIS_EN,
  orbLabel: ORB_LABEL_EN,
  // Loose UI strings around the stage.
  recLabel: "Session 001",
  conceptTag: "Concept Test",
  modeGroupLabel: "Interview mode",
  modeVoice: "Voice",
  modeText: "Text",
  voiceInterviewLabel: "Voice interview",
  stimDesc: "Concept draft, shown live during the interview.",
  stimPlaceholder: "Material appears during the conversation …",
  textInputPlaceholder: "Type your answer …",
  playIdle: "▶  Play session",
  playPlaying: "●  Recording …",
  playReplay: "↺  Play again",
  skip: "Skip ⏭",
  findingsTag: "Findings — captured live",
  jumpLabel: "↧ to the moment",
  analysisName: "Stimulus analysis",
  analysisSub: "What the AI saw in the image · 6 fields",
  verdiktTag: "Synthesis verdict",
  verdiktAssumption: "Assumption",
  verdiktBrand: "Klymeo",
};

const turnIndexOfFinding = (k: number) => TURNS.findIndex((t) => t.finding === k);

export function SessionDeck({
  lang = MARKETING_DEFAULT_LOCALE,
}: {
  lang?: Locale;
}) {
  const c = localizedContent(lang, { de: CONTENT_DE, en: CONTENT_EN });
  // typed[i]: -1 = Zeile noch nicht da, sonst Anzahl getippter Zeichen.
  const [typed, setTyped] = useState<number[]>(() => TURNS.map(() => -1));
  const [stamped, setStamped] = useState<boolean[]>(() => TURNS.map(() => false));
  const [phase, setPhase] = useState<Phase>("idle");
  const [tc, setTc] = useState("TC 00:00:00");
  const [mode, setMode] = useState<Mode>("voice");
  const [revealed, setRevealed] = useState(false);
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const [activeFinding, setActiveFinding] = useState<number | null>(null);
  const [highlightTurn, setHighlightTurn] = useState<number | null>(null);

  const deckRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const rafRef = useRef(0);
  const startedRef = useRef(false);
  // Imperativer Doppelstart-Schutz (Event-Handler + IO-Autostart teilen ihn) —
  // bewusst KEIN Spiegel des States im Render (react-hooks/refs).
  const playingRef = useRef(false);
  // Wiedergabe-Generation: jeder play()/finishAll() erhöht sie. Ein typeChar-/
  // tcTick-Callback, der bereits in der Task-Queue hängt (clearTimeout greift dann
  // nicht mehr), erkennt sich als veraltet und bricht ab — verhindert, dass eine
  // alte Zeile beim schnellen Replay/Skip mit Stale-Index neu zu tippen beginnt.
  const genRef = useRef(0);

  const reduceMotion = () =>
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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
    genRef.current++; // alle noch hängenden typeChar-Callbacks für ungültig erklären
    playingRef.current = false;
    startedRef.current = true;
    setTyped(TURNS.map((l) => l.text.length));
    setStamped(TURNS.map(() => true));
    setRevealed(true);
    setAnalysisOpen(true);
    setPhase("done");
    setTc("TC 00:08:42");
  };

  const play = () => {
    if (playingRef.current) return;
    playingRef.current = true;
    startedRef.current = true;
    clearTimers();
    const gen = ++genRef.current; // diese Wiedergabe; ältere Callbacks erkennen sich als veraltet
    setTyped(TURNS.map(() => -1));
    setStamped(TURNS.map(() => false));
    setRevealed(false);
    setAnalysisOpen(false);
    setActiveFinding(null);
    setHighlightTurn(null);
    setPhase("playing");

    if (reduceMotion()) {
      finishAll();
      return;
    }

    // Session-Timecode läuft (gerafft) während der Wiedergabe.
    const tStart = performance.now();
    const pad = (n: number) => (n < 10 ? "0" : "") + n;
    const tcTick = (now: number) => {
      if (genRef.current !== gen) return;
      const s = Math.floor(((now - tStart) / 1000) * 14);
      setTc(`TC 00:${pad(Math.floor(s / 60))}:${pad(s % 60)}`);
      rafRef.current = requestAnimationFrame(tcTick);
    };
    rafRef.current = requestAnimationFrame(tcTick);

    let delay = 250;
    TURNS.forEach((line, li) => {
      const SPEED = line.f ? 14 : 24; // ms pro Zeichen
      later(() => {
        if (line.reveal) setRevealed(true);
        let i = 0;
        const typeChar = () => {
          if (genRef.current !== gen) return; // veralteter Callback einer früheren Wiedergabe
          i++;
          setTyped((cur) => {
            const next = [...cur];
            next[li] = i;
            return next;
          });
          if (i < line.text.length) {
            timersRef.current.push(setTimeout(typeChar, SPEED));
          } else if (line.finding) {
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
      delay += line.text.length * SPEED + (line.finding ? 950 : 480);
    });

    later(() => {
      if (genRef.current !== gen) return;
      cancelAnimationFrame(rafRef.current);
      playingRef.current = false;
      setPhase("done");
      setAnalysisOpen(true);
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

  // Klick auf einen Befund → ans Ende springen (falls nötig), Zeile + Feld
  // hervorheben und sanft ins Bild scrollen. Erneuter Klick hebt die Auswahl auf.
  const handleFinding = (f: Finding) => {
    if (phase !== "done") finishAll();
    const next = activeFinding === f.k ? null : f.k;
    setActiveFinding(next);
    if (next === null) {
      setHighlightTurn(null);
      return;
    }
    const li = turnIndexOfFinding(f.k);
    setHighlightTurn(li);
    const behavior: ScrollBehavior = reduceMotion() ? "auto" : "smooth";
    requestAnimationFrame(() => {
      rowRefs.current[li]?.scrollIntoView({ behavior, block: "center" });
    });
  };

  const findingShown = (k: number) =>
    phase === "done" || stamped[turnIndexOfFinding(k)];

  // Welche Zeile tippt gerade? (für Caret + Orb-Zustand)
  const activeLine = typed.findIndex(
    (n, i) => n > -1 && n < TURNS[i].text.length,
  );

  let orbState: OrbState = "idle";
  if (phase === "done") orbState = "done";
  else if (phase === "playing")
    orbState = activeLine > -1 ? (TURNS[activeLine].f ? "speaking" : "listening") : "thinking";

  const hotField =
    activeFinding != null
      ? (FINDINGS.find((f) => f.k === activeFinding)?.analysisField ?? null)
      : null;

  return (
    <div ref={deckRef} className={`st-deck ${phase === "playing" ? "playing" : ""}`}>
      <div className="st-deck-top">
        <div className="flex items-center gap-3.5">
          <span className="st-deck-rec">
            <b aria-hidden />
            {c.recLabel}
          </span>
          <span className="st-tag">{c.conceptTag}</span>
        </div>
        <div className="flex items-center gap-3.5">
          <div className="st-modetabs" role="group" aria-label={c.modeGroupLabel}>
            <button
              type="button"
              className="st-modetab"
              aria-pressed={mode === "voice"}
              onClick={() => setMode("voice")}
            >
              {c.modeVoice}
            </button>
            <button
              type="button"
              className="st-modetab"
              aria-pressed={mode === "text"}
              onClick={() => setMode("text")}
            >
              {c.modeText}
            </button>
          </div>
          <span className="st-deck-tc">{tc}</span>
        </div>
      </div>

      <div className="st-deck-body">
        {/* ── Bühne (modusabhängig) ─────────────────────────────────── */}
        <div className={`st-tape ${mode === "text" ? "is-chat" : ""}`}>
          {/* Voice: Orb + Stimmpegel */}
          {mode === "voice" ? (
            <div className="st-orbstrip">
              <div className={`st-orb is-${orbState}`} aria-hidden>
                <span className="st-orb-core" />
              </div>
              <div className="st-orbstatus">
                <b>{c.orbLabel[orbState]}</b>
                <span>{c.voiceInterviewLabel}</span>
              </div>
              <div className="st-voicebars" aria-hidden>
                {VOICE_BARS.map((h, i) => (
                  <i key={i} style={{ "--h": `${h}%`, "--i": i } as CSSProperties} />
                ))}
              </div>
            </div>
          ) : null}

          {/* Stimulus: Entwurf, im Gespräch eingeblendet */}
          <div className="st-stimstage">
            {revealed ? (
              <div className="st-stimcard show" aria-label={c.stimulus.alt}>
                <div className="st-packshot" aria-hidden>
                  <span className="st-packshot-brand">{c.stimulus.brand}</span>
                  <span className="st-packshot-rule" />
                  <span className="st-packshot-sub">{c.stimulus.sub}</span>
                </div>
                <div className="st-stimmeta">
                  <span className="st-tag">{c.stimulus.tag}</span>
                  <p>{c.stimDesc}</p>
                </div>
              </div>
            ) : (
              <div className="st-stim-ph" aria-hidden>
                {c.stimPlaceholder}
              </div>
            )}
          </div>

          {/* Transkript / Chat */}
          <div className="st-stream" aria-live="polite">
            {c.turns.map((line, li) =>
              typed[li] > -1 ? (
                <div
                  key={li}
                  ref={(el) => {
                    rowRefs.current[li] = el;
                  }}
                  className={`st-tape-row ${line.f ? "is-f" : ""} ${
                    highlightTurn === li ? "is-hot" : ""
                  }`}
                >
                  <span className="st-who">{line.who}</span>
                  <p>
                    {line.text.slice(0, typed[li])}
                    {li === activeLine ? <span className="st-caret" aria-hidden /> : null}
                  </p>
                  {line.finding ? (
                    <span
                      className={`st-stamp ${c.findings.find((f) => f.k === line.finding)?.cls ?? ""} ${
                        stamped[li] ? "show" : ""
                      }`}
                    >
                      {c.findings.find((f) => f.k === line.finding)?.stamp}
                    </span>
                  ) : null}
                </div>
              ) : null,
            )}
          </div>

          {/* Text-Modus: angedeutetes Eingabefeld (verkauft die Modalität) */}
          {mode === "text" ? (
            <div className="st-textinput" aria-hidden>
              {c.textInputPlaceholder}<b>↵</b>
            </div>
          ) : null}

          <div className="mt-2 flex gap-3 pt-2">
            <button
              type="button"
              className="st-play-btn magnetic"
              disabled={phase === "playing"}
              onClick={play}
            >
              {phase === "idle"
                ? c.playIdle
                : phase === "playing"
                  ? c.playPlaying
                  : c.playReplay}
            </button>
            <button type="button" className="st-skip-btn" onClick={finishAll}>
              {c.skip}
            </button>
          </div>
        </div>

        {/* ── Auswertungs-Seitenspalte ──────────────────────────────── */}
        <aside className="st-findings">
          <span className="st-tag mb-4 block">{c.findingsTag}</span>
          {c.findings.map((f) => (
            <button
              key={f.k}
              type="button"
              data-k={f.k}
              className={`st-finding ${findingShown(f.k) ? "show" : ""} ${
                activeFinding === f.k ? "is-selected" : ""
              }`}
              onClick={() => handleFinding(f)}
              aria-pressed={activeFinding === f.k}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="st-f-name">{f.name}</span>
                <span className="st-f-k">{f.strength}</span>
              </div>
              <span className="st-f-schema">{f.schema}</span>
              <q>{f.quote}</q>
              <span className="st-f-jump" aria-hidden>
                {c.jumpLabel}
              </span>
            </button>
          ))}

          {/* Stimulus-Analyse — was die KI im Bild gesehen hat */}
          <div className={`st-analysis ${phase === "done" ? "show" : ""}`}>
            <button
              type="button"
              className="st-analysis-head"
              aria-expanded={analysisOpen}
              onClick={() => setAnalysisOpen((v) => !v)}
            >
              <span>
                <span className="st-f-name">{c.analysisName}</span>
                <span className="st-analysis-sub">{c.analysisSub}</span>
              </span>
              <span className={`st-chevron ${analysisOpen ? "open" : ""}`} aria-hidden>
                ⌄
              </span>
            </button>
            {analysisOpen ? (
              <div className="st-analysis-body">
                {c.analysis.map((a) => (
                  <div
                    key={a.k}
                    className={`st-afield ${hotField === a.k ? "is-hot" : ""}`}
                  >
                    <span className="st-afield-k">{a.label}</span>
                    <span className="st-afield-v">{a.value}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {/* Synthese-Fazit */}
          <div className={`st-verdikt ${phase === "done" ? "show" : ""}`}>
            <span className="st-tag mb-2.5 block">{c.verdiktTag}</span>
            <div className="st-row">
              <span>{c.verdiktAssumption}</span>
              <span className="old">{c.synthesis.annahme}</span>
            </div>
            <div className="st-row">
              <span>{c.verdiktBrand}</span>
              <span className="neu">{c.synthesis.realitaet}</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
