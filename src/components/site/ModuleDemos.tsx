"use client";

/* eslint-disable react-hooks/static-components, react-hooks/set-state-in-effect --
   Decorative, self-contained interactive module demos ported 1:1 from the
   marketing design template: small inline sub-components (Bar/Card) and
   timer-driven setState inside effects animate the previews. Both patterns are
   intentional and scoped to this static, non-critical marketing surface. */

import { useEffect, useMemo, useRef, useState } from "react";
import { Konsoul } from "./Konsoul";

/* ---------- shared shell ---------- */

function DemoShell({
  hint,
  children,
}: {
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-6 rounded-xl border border-border bg-paper">
      <div className="flex items-center justify-between border-b border-border px-4 py-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        <span className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-soul animate-pulse" />
          Live-Demo
        </span>
        <span className="font-mono normal-case tracking-normal text-[10px] text-muted-foreground/80">
          {hint}
        </span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

/* ---------- 01 Studien-Designer ---------- */

const briefingPresets = [
  "Wie nehmen Eltern unsere neue Müsli-Verpackung wahr?",
  "Warum brechen B2B-User unser Onboarding nach Tag 3 ab?",
  "Welche Argumente überzeugen bei einer Preiserhöhung von 9 %?",
];

export function DesignerDemo() {
  const [briefing, setBriefing] = useState(briefingPresets[0]);
  const [generating, setGenerating] = useState(false);
  const [shown, setShown] = useState(0);

  const plan = useMemo(
    () => [
      { k: "Methodik", v: "Qual. Tiefeninterview, 8 TN, je 25 min" },
      { k: "Sample", v: "DE · 28–45 J. · Haushalt mit Kindern <10" },
      { k: "Leitfaden", v: "Warm-up → Wahrnehmung → Laddering → Trade-off" },
      { k: "Stimuli", v: "Packshot A / B, Regal-Mockup" },
      { k: "Output", v: "Themen + Quotes + Side-by-side" },
    ],
    []
  );

  function generate() {
    setShown(0);
    setGenerating(true);
  }

  useEffect(() => {
    if (!generating) return;
    if (shown >= plan.length) {
      setGenerating(false);
      return;
    }
    const t = setTimeout(() => setShown((s) => s + 1), 380);
    return () => clearTimeout(t);
  }, [generating, shown, plan.length]);

  return (
    <DemoShell hint="briefing → studien-plan">
      <div className="flex flex-wrap gap-1.5">
        {briefingPresets.map((b) => (
          <button
            key={b}
            onClick={() => setBriefing(b)}
            className={`rounded-full border px-2.5 py-1 text-[11px] transition ${
              b === briefing
                ? "border-ink bg-ink text-paper"
                : "border-border bg-card text-muted-foreground hover:text-ink"
            }`}
          >
            {b.length > 38 ? b.slice(0, 36) + "…" : b}
          </button>
        ))}
      </div>
      <textarea
        value={briefing}
        onChange={(e) => setBriefing(e.target.value)}
        rows={2}
        className="mt-3 w-full resize-none rounded-lg border border-border bg-card p-3 text-sm text-ink outline-none focus:border-ink"
      />
      <div className="mt-3 flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">
          Konsoul liest dein Briefing & schlägt einen Plan vor.
        </span>
        <button
          onClick={generate}
          disabled={generating}
          className="rounded-full bg-ink px-4 py-1.5 text-xs font-medium text-paper hover:bg-ink/90 disabled:opacity-60"
        >
          {generating ? "Konsoul denkt…" : "Plan generieren"}
        </button>
      </div>
      <ul className="mt-4 space-y-2">
        {plan.map((row, i) => (
          <li
            key={row.k}
            className={`flex items-start gap-3 rounded-md border border-border bg-card px-3 py-2 text-xs transition ${
              i < shown ? "opacity-100" : "opacity-30"
            }`}
          >
            <span className="font-mono text-[10px] text-soul">{String(i + 1).padStart(2, "0")}</span>
            <span className="w-20 shrink-0 font-medium text-ink">{row.k}</span>
            <span className="text-muted-foreground">{row.v}</span>
          </li>
        ))}
      </ul>
    </DemoShell>
  );
}

/* ---------- 02 Sample & Panel ---------- */

export function SampleDemo() {
  const [quotas, setQuotas] = useState({ female: 50, urban: 60, age: 45 });
  const [recruited, setRecruited] = useState(0);
  const target = 24;

  useEffect(() => {
    const t = setInterval(() => {
      setRecruited((r) => (r >= target ? 0 : r + 1));
    }, 240);
    return () => clearInterval(t);
  }, []);

  const Bar = ({ label, value, set }: { label: string; value: number; set: (n: number) => void }) => (
    <div>
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-ink">{label}</span>
        <span className="font-mono text-muted-foreground">{value}%</span>
      </div>
      <input
        type="range"
        min={10}
        max={90}
        value={value}
        onChange={(e) => set(Number(e.target.value))}
        className="mt-1 w-full accent-ink"
      />
    </div>
  );

  return (
    <DemoShell hint="quoten · live recruiting">
      <div className="grid gap-3">
        <Bar label="Anteil weiblich" value={quotas.female} set={(n) => setQuotas({ ...quotas, female: n })} />
        <Bar label="Urban" value={quotas.urban} set={(n) => setQuotas({ ...quotas, urban: n })} />
        <Bar label="Alter 25–45" value={quotas.age} set={(n) => setQuotas({ ...quotas, age: n })} />
      </div>
      <div className="mt-4 rounded-lg border border-border bg-card p-3">
        <div className="flex items-center justify-between text-[11px]">
          <span className="font-mono text-muted-foreground">recruited / target</span>
          <span className="font-mono text-ink">
            {recruited} / {target}
          </span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full bg-soul transition-all duration-200"
            style={{ width: `${(recruited / target) * 100}%` }}
          />
        </div>
        <div className="mt-3 grid grid-cols-12 gap-1">
          {Array.from({ length: target }).map((_, i) => (
            <div
              key={i}
              className={`h-3 rounded-sm transition-colors ${
                i < recruited ? "bg-ink" : "bg-secondary"
              }`}
            />
          ))}
        </div>
      </div>
    </DemoShell>
  );
}

/* ---------- 03 Voice & Text Engine ---------- */

const interview = [
  { who: "k", t: "Erzähl mir kurz, wie dein letzter Einkauf lief." },
  { who: "u", t: "Eigentlich okay, aber an der Kasse war's mal wieder Chaos." },
  { who: "k", t: "Was genau war chaotisch? Erzähl's mir wie einer Freundin." },
  { who: "u", t: "Drei Kassen offen, zwei davon nur Self-Checkout — und einer ging nicht." },
  { who: "k", t: "Wenn der Self-Checkout funktioniert hätte: hättest du den genommen?" },
  { who: "u", t: "Klar, ich will da nur durch. Nicht plaudern." },
  { who: "k", t: "Verstanden — Geschwindigkeit > Kontakt. Halten wir fest." },
];

export function InterviewDemo() {
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!playing) return;
    if (idx >= interview.length) return;
    const t = setTimeout(() => setIdx((i) => i + 1), 1400);
    return () => clearTimeout(t);
  }, [idx, playing]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 9999, behavior: "smooth" });
  }, [idx]);

  return (
    <DemoShell hint="adaptives interview · voice / text">
      <div
        ref={scrollRef}
        className="h-56 space-y-2 overflow-y-auto rounded-lg border border-border bg-card p-3"
      >
        {interview.slice(0, idx).map((m, i) => (
          <div
            key={i}
            className={`flex gap-2 ${m.who === "u" ? "justify-end" : ""} animate-fade-in`}
          >
            {m.who === "k" && <Konsoul size={22} mood="listen" className="mt-0.5 text-ink shrink-0" />}
            <div
              className={`max-w-[80%] rounded-2xl px-3 py-1.5 text-xs leading-snug ${
                m.who === "k"
                  ? "bg-secondary text-ink"
                  : "bg-ink text-paper"
              }`}
            >
              {m.t}
            </div>
          </div>
        ))}
        {idx < interview.length && (
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-soul" />
            {interview[idx].who === "k" ? "Konsoul formuliert Follow-up…" : "Teilnehmer:in spricht…"}
          </div>
        )}
      </div>
      <div className="mt-3 flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground">
          Follow-up #{Math.max(0, Math.floor(idx / 2))} · Sättigung {Math.min(100, idx * 14)}%
        </span>
        <button
          onClick={() => {
            if (idx >= interview.length) setIdx(0);
            setPlaying((p) => !p);
          }}
          className="rounded-full border border-border bg-card px-3 py-1 text-ink hover:bg-secondary"
        >
          {idx >= interview.length ? "Neu abspielen" : playing ? "Pause" : "Play"}
        </button>
      </div>
    </DemoShell>
  );
}

/* ---------- 04 liveCreative-Test ---------- */

export function StimulusDemo() {
  const [votes, setVotes] = useState({ A: 12, B: 18 });
  const [picked, setPicked] = useState<"A" | "B" | null>(null);

  const vote = (k: "A" | "B") => {
    if (picked) return;
    setPicked(k);
    setVotes((v) => ({ ...v, [k]: v[k] + 1 }));
  };

  const total = votes.A + votes.B;
  const pctA = Math.round((votes.A / total) * 100);
  const pctB = 100 - pctA;

  const Card = ({
    k,
    label,
    swatch,
  }: {
    k: "A" | "B";
    label: string;
    swatch: React.ReactNode;
  }) => (
    <button
      onClick={() => vote(k)}
      className={`group relative overflow-hidden rounded-xl border bg-card p-3 text-left transition ${
        picked === k ? "border-ink" : "border-border hover:border-ink/60"
      }`}
    >
      <div className="aspect-[4/3] w-full overflow-hidden rounded-md">{swatch}</div>
      <div className="mt-2 flex items-center justify-between text-xs">
        <span className="font-medium text-ink">Konzept {k}</span>
        <span className="font-mono text-muted-foreground">
          {k === "A" ? pctA : pctB}%
        </span>
      </div>
      <div className="mt-1 h-1 overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full bg-soul transition-all duration-500"
          style={{ width: `${k === "A" ? pctA : pctB}%` }}
        />
      </div>
      <div className="mt-1 text-[10px] text-muted-foreground">{label}</div>
    </button>
  );

  return (
    <DemoShell hint="a/b im interview · stimulus">
      <div className="grid grid-cols-2 gap-3">
        <Card
          k="A"
          label="Mutig · Coral"
          swatch={
            <div className="flex h-full w-full items-center justify-center bg-[oklch(0.78_0.16_45)] text-2xl">
              <span className="mark mark-amber">frisch.</span>
            </div>
          }
        />
        <Card
          k="B"
          label="Ruhig · Sand"
          swatch={
            <div className="flex h-full w-full items-center justify-center bg-[oklch(0.92_0.04_85)] text-2xl">
              <span className="mark mark-pink">leicht.</span>
            </div>
          }
        />
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">
        {picked
          ? `Konsoul: „Danke. Was hat dich an ${picked} überzeugt?"`
          : "Konsoul fragt zum richtigen Moment — wähl ein Konzept."}
      </p>
    </DemoShell>
  );
}

/* ---------- 05 Synthese-Engine ---------- */

const quotes = [
  { t: "Onboarding ist zu lang.", theme: "Onboarding-Frust" },
  { t: "Ich hab nie gefunden, wie ich exportiere.", theme: "Navigations-Hürde" },
  { t: "Erste Mail war hilfreich, die zweite verwirrend.", theme: "Onboarding-Frust" },
  { t: "Suche liefert komische Reihenfolge.", theme: "Navigations-Hürde" },
  { t: "Preis ist fair — wenn alles drin ist.", theme: "Preis-Wahrnehmung" },
  { t: "Bei 9 € pro Monat zögere ich kurz, dann ja.", theme: "Preis-Wahrnehmung" },
];

const themeColors: Record<string, string> = {
  "Onboarding-Frust": "oklch(0.78 0.16 45)",
  "Navigations-Hürde": "oklch(0.75 0.13 230)",
  "Preis-Wahrnehmung": "oklch(0.82 0.14 130)",
};

export function SynthesisDemo() {
  const [clustered, setClustered] = useState(false);

  return (
    <DemoShell hint="codieren · clustern">
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted-foreground">6 Quotes aus 3 Interviews</span>
        <button
          onClick={() => setClustered((c) => !c)}
          className="rounded-full bg-ink px-3 py-1 text-xs text-paper hover:bg-ink/90"
        >
          {clustered ? "Reset" : "Themen clustern"}
        </button>
      </div>
      <div className="mt-3 grid gap-2">
        {quotes.map((q, i) => (
          <div
            key={i}
            className="flex items-start gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs transition-all duration-500"
            style={{
              borderLeftWidth: 3,
              borderLeftColor: clustered ? themeColors[q.theme] : "var(--border)",
              transform: clustered ? "translateX(0)" : "translateX(0)",
              order: clustered ? Object.keys(themeColors).indexOf(q.theme) : i,
            }}
          >
            <span className="serif text-soul">{'"'}</span>
            <span className="flex-1 text-ink">{q.t}</span>
            {clustered && (
              <span
                className="ml-2 rounded-full px-2 py-0.5 text-[10px] text-ink animate-fade-in"
                style={{ background: themeColors[q.theme] }}
              >
                {q.theme}
              </span>
            )}
          </div>
        ))}
      </div>
    </DemoShell>
  );
}

/* ---------- 06 Persona-Builder ---------- */

const personas = [
  {
    name: "Effizienz-Lena",
    jtbd: "„Ich will durch — nicht plaudern.“",
    size: "42 %",
    traits: ["Self-Checkout", "App-first", "Zeitknapp"],
  },
  {
    name: "Wert-Markus",
    jtbd: "„Wenn fair, zahl ich gern.“",
    size: "31 %",
    traits: ["Preis-sensibel", "Loyal", "Vergleicht"],
  },
  {
    name: "Erlebnis-Yara",
    jtbd: "„Ich will inspiriert werden.“",
    size: "27 %",
    traits: ["Stöbert", "Social", "Premium"],
  },
];

export function PersonaDemo() {
  const [active, setActive] = useState(0);
  const p = personas[active];
  return (
    <DemoShell hint="cluster · jtbd-getrieben">
      <div className="flex gap-1.5">
        {personas.map((pp, i) => (
          <button
            key={pp.name}
            onClick={() => setActive(i)}
            className={`flex-1 rounded-md border px-2 py-1.5 text-[11px] transition ${
              i === active
                ? "border-ink bg-ink text-paper"
                : "border-border bg-card text-muted-foreground hover:text-ink"
            }`}
          >
            {pp.name.split("-")[0]}
          </button>
        ))}
      </div>
      <div className="mt-3 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-3">
          <Konsoul size={40} mood="smile" className="text-ink" label={p.name.toLowerCase()} />
          <div>
            <p className="text-sm font-medium text-ink">{p.name}</p>
            <p className="font-mono text-[10px] text-muted-foreground">{p.size} des Samples</p>
          </div>
        </div>
        <p className="mt-3 mark text-base text-ink">{p.jtbd}</p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {p.traits.map((t) => (
            <span
              key={t}
              className="rounded-full border border-border bg-secondary/70 px-2 py-0.5 text-[10px] text-ink"
            >
              {t}
            </span>
          ))}
        </div>
      </div>
    </DemoShell>
  );
}

/* ---------- 07 Cross-Study ---------- */

const crossPresets = [
  {
    q: "In wie vielen Studien taucht Onboarding-Frust auf?",
    a: "In 7 von 14 Studien. Stärkste Häufung: SaaS-Trial Q2 (38 % der Quotes).",
    sources: ["SaaS-Trial Q2", "Pricing-Test Mai", "B2B-Activation"],
  },
  {
    q: "Wie reagieren Eltern auf den Preis ab 9 €?",
    a: "Eher zögerlich, aber nur bis „alles drin“ klar ist. 4 Studien, 22 Quotes.",
    sources: ["Familien-Bundle", "FMCG-Müsli", "Preis-Wahrnehmung"],
  },
];

export function CrossStudyDemo() {
  const [picked, setPicked] = useState<typeof crossPresets[number] | null>(null);
  const [typing, setTyping] = useState(false);

  const ask = (p: typeof crossPresets[number]) => {
    setPicked(null);
    setTyping(true);
    setTimeout(() => {
      setPicked(p);
      setTyping(false);
    }, 900);
  };

  return (
    <DemoShell hint="ask konsoul · portfolio-weit">
      <div className="grid gap-1.5">
        {crossPresets.map((p) => (
          <button
            key={p.q}
            onClick={() => ask(p)}
            className="rounded-md border border-border bg-card px-3 py-2 text-left text-xs text-ink hover:border-ink"
          >
            <span className="font-mono text-[10px] text-soul">ask › </span>
            {p.q}
          </button>
        ))}
      </div>
      <div className="mt-3 min-h-[110px] rounded-lg border border-border bg-card p-3">
        {typing && (
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <Konsoul size={22} mood="scan" className="text-ink" />
            Konsoul scannt 14 Studien…
          </div>
        )}
        {picked && !typing && (
          <div className="animate-fade-in">
            <div className="flex items-start gap-2">
              <Konsoul size={22} mood="wow" className="mt-0.5 text-ink shrink-0" />
              <p className="text-xs leading-relaxed text-ink">{picked.a}</p>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {picked.sources.map((s) => (
                <span
                  key={s}
                  className="rounded-full border border-border bg-secondary/70 px-2 py-0.5 text-[10px] text-muted-foreground"
                >
                  📎 {s}
                </span>
              ))}
            </div>
          </div>
        )}
        {!picked && !typing && (
          <p className="text-[11px] text-muted-foreground">
            Wähl eine Frage — Konsoul antwortet mit Belegen aus deinem Studien-Schatz.
          </p>
        )}
      </div>
    </DemoShell>
  );
}

/* ---------- 08 Auto-Report ---------- */

const reportSteps = [
  "Quotes sortieren",
  "Themen → Slides mappen",
  "Personas einblenden",
  "Branding anwenden",
  "Export bereit",
];

export function ReportDemo() {
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState(-1);
  const [format, setFormat] = useState("PDF");

  useEffect(() => {
    if (!running) return;
    if (step >= reportSteps.length - 1) {
      setRunning(false);
      return;
    }
    const t = setTimeout(() => setStep((s) => s + 1), 520);
    return () => clearTimeout(t);
  }, [running, step]);

  function start() {
    setStep(-1);
    setRunning(true);
    setTimeout(() => setStep(0), 200);
  }

  return (
    <DemoShell hint="export · pdf · slides · notion">
      <div className="flex flex-wrap items-center gap-2">
        {["PDF", "Slides", "Notion"].map((f) => (
          <button
            key={f}
            onClick={() => setFormat(f)}
            className={`rounded-full border px-3 py-1 text-[11px] transition ${
              f === format
                ? "border-ink bg-ink text-paper"
                : "border-border bg-card text-muted-foreground hover:text-ink"
            }`}
          >
            {f}
          </button>
        ))}
        <button
          onClick={start}
          disabled={running}
          className="ml-auto rounded-full bg-soul px-3 py-1 text-[11px] font-medium text-ink hover:opacity-90 disabled:opacity-60"
        >
          {running ? "Generiert…" : `Report als ${format}`}
        </button>
      </div>
      <ul className="mt-3 grid gap-1.5">
        {reportSteps.map((s, i) => (
          <li
            key={s}
            className={`flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-xs transition ${
              i <= step ? "text-ink" : "text-muted-foreground/60"
            }`}
          >
            <span
              className={`flex h-4 w-4 items-center justify-center rounded-full text-[9px] ${
                i <= step ? "bg-ink text-paper" : "bg-secondary"
              }`}
            >
              {i <= step ? "✓" : i + 1}
            </span>
            {s}
          </li>
        ))}
      </ul>
      {step >= reportSteps.length - 1 && (
        <div className="mt-3 flex items-center justify-between rounded-md border border-ink bg-ink/5 px-3 py-2 text-xs animate-fade-in">
          <span className="text-ink">klymeo-studie-12.{format.toLowerCase()}</span>
          <span className="font-mono text-[10px] text-muted-foreground">2.4 MB · 24 slides</span>
        </div>
      )}
    </DemoShell>
  );
}

/* ---------- registry ---------- */

export const moduleDemos: Record<string, () => React.ReactElement> = {
  "01": DesignerDemo,
  "02": SampleDemo,
  "03": InterviewDemo,
  "04": StimulusDemo,
  "05": SynthesisDemo,
  "06": PersonaDemo,
  "07": CrossStudyDemo,
  "08": ReportDemo,
};
