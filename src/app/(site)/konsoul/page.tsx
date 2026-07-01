import type { Metadata } from "next";
import Link from "next/link";
import { Konsoul } from "@/components/site/Konsoul";
import { SiteShell, PageHero, CtaBlock } from "@/components/site/SiteShell";
import { buildAlternates, ogDefaultsFor } from "@/lib/marketing/seo";

export const metadata: Metadata = {
  title: { absolute: "Konsoul — Der KI-Orchestrator hinter Klymeo" },
  description:
    "Konsoul plant, führt durch, wertet aus. Der KI-Agent, der deine gesamte Marktforschung orchestriert — von Briefing bis Cross-Study-Vergleich.",
  alternates: buildAlternates("de", "/konsoul"),
  openGraph: {
    ...ogDefaultsFor("de"),
    title: "Konsoul · KI-Forschungs-Orchestrator",
    description: "Lerne den Agenten kennen, der deine Studien orchestriert.",
    url: "/konsoul",
  },
};

export default function KonsoulPage() {
  return (
    <SiteShell>
      <PageHero
        eyebrow="Der Agent"
        title="Konsoul orchestriert"
        italic="alles."
        lead='Konsoul ist nicht „ein Chatbot mit Marktforschung daneben“. Er ist das Orchestrierungs-Modul der gesamten Plattform — der Ort, an dem Briefings zu Studien werden und Studien zu Entscheidungen.'
        image="/site/konsoul-hero.jpg"
        imageAlt="Insights-Team bei der Arbeit"
      />

      {/* PILLARS — varied cards, each with its own visual identity */}
      <section className="py-24">
        <div className="mx-auto max-w-7xl px-6">
          <p className="text-xs uppercase tracking-[0.22em] text-soul">Was Konsoul tut</p>
          <h2 className="mt-3 text-4xl leading-[1.05] md:text-5xl">
            Vier Rollen, <span className="mark mark-sky">ein Kopf.</span>
          </h2>
          <div className="mt-12 grid gap-5 md:grid-cols-6">
            {/* Plant Studien — large, with floating doc lines */}
            <article className="group relative overflow-hidden rounded-3xl border border-border bg-card p-8 md:col-span-4 md:row-span-2">
              <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-soul/15 blur-2xl transition-transform duration-700 group-hover:scale-110" aria-hidden />
              <div className="relative flex items-start justify-between gap-6">
                <div className="max-w-md">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-soul">01 · Planen</span>
                  <h3 className="mt-2 text-3xl leading-tight">Plant Studien.</h3>
                  <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                    Aus einem Satz Briefing entwirft Konsoul Leitfaden, Sample-Plan, Screener und Stimuli —
                    methodisch sauber, mit Begründung.
                  </p>
                </div>
                <Konsoul size={84} mood="think" className="text-ink shrink-0" label="planner" />
              </div>
              <div className="relative mt-8 space-y-1.5">
                {["Forschungsfrage übersetzen", "Methodik wählen", "Sample-Quoten setzen", "Leitfaden generieren"].map((s, i) => (
                  <div
                    key={s}
                    className="flex items-center gap-3 rounded-lg border border-border bg-background/60 px-3 py-2 text-xs text-muted-foreground opacity-0"
                    style={{ animation: `fade-in .6s ease-out ${0.2 + i * 0.12}s forwards` }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-soul animate-pulse" />
                    <span className="font-mono">{String(i + 1).padStart(2, "0")}</span>
                    <span>{s}</span>
                  </div>
                ))}
              </div>
            </article>

            {/* Führt Interviews — voice waveform */}
            <article className="group relative overflow-hidden rounded-3xl border border-border bg-ink p-8 text-paper md:col-span-2">
              <span className="font-mono text-[10px] uppercase tracking-widest text-soul">02 · Sprechen</span>
              <h3 className="mt-2 text-2xl leading-tight">Führt Interviews.</h3>
              <p className="mt-3 text-xs leading-relaxed text-paper/70">
                Voice & Text in einem Fluss. Bohrt nach, erkennt Widersprüche, bricht bei Sättigung ab.
              </p>
              <div className="mt-6 flex items-end gap-1 h-16" aria-hidden>
                {Array.from({ length: 22 }).map((_, i) => (
                  <span
                    key={i}
                    className="w-1.5 rounded-full bg-soul/80"
                    style={{
                      height: `${20 + Math.abs(Math.sin(i * 1.3)) * 70}%`,
                      animation: `soul-pulse 1.${(i % 9) + 1}s ease-in-out ${i * 0.05}s infinite alternate`,
                    }}
                  />
                ))}
              </div>
              <div className="mt-4 flex items-center gap-2 text-[11px] font-mono text-paper/60">
                <span className="h-1.5 w-1.5 rounded-full bg-soul animate-pulse" />
                live · de-DE
              </div>
            </article>

            {/* Wertet aus — clusters */}
            <article className="group relative overflow-hidden rounded-3xl border border-border bg-secondary/60 p-8 md:col-span-2">
              <span className="font-mono text-[10px] uppercase tracking-widest text-soul">03 · Synthetisieren</span>
              <h3 className="mt-2 text-2xl leading-tight">Wertet aus.</h3>
              <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                Themen, Personas, Side-by-side-Vergleiche — jede Aussage klickbar am Transkript verlinkt.
              </p>
              <div className="relative mt-6 h-24" aria-hidden>
                {[
                  { x: "10%", y: "20%", s: 18, d: "0s" },
                  { x: "38%", y: "55%", s: 28, d: ".3s" },
                  { x: "60%", y: "15%", s: 22, d: ".6s" },
                  { x: "78%", y: "60%", s: 16, d: ".9s" },
                  { x: "25%", y: "75%", s: 14, d: "1.1s" },
                ].map((c, i) => (
                  <span
                    key={i}
                    className="absolute rounded-full bg-ink/80"
                    style={{
                      left: c.x,
                      top: c.y,
                      width: c.s,
                      height: c.s,
                      animation: `soul-pulse 2.4s ease-in-out ${c.d} infinite alternate`,
                    }}
                  />
                ))}
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full opacity-40">
                  <path d="M12 25 L40 60 L62 22 L80 62" stroke="currentColor" fill="none" strokeDasharray="2 3" />
                </svg>
              </div>
            </article>

            {/* Cross-Study */}
            <article className="group relative overflow-hidden rounded-3xl border border-border bg-card p-8 md:col-span-3">
              <div className="flex items-start gap-5">
                <Konsoul size={56} mood="wow" className="text-ink" label="cross" />
                <div>
                  <span className="font-mono text-[10px] uppercase tracking-widest text-soul">04 · Vergleichen</span>
                  <h3 className="mt-2 text-2xl leading-tight">Vergleicht über Studien.</h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    Cross-Study-Agent: frag quer über deinen Wissensschatz, Konsoul lädt nur relevante
                    Quellen und zählt exakt.
                  </p>
                </div>
              </div>
            </article>

            {/* Stat card */}
            <article className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-soul/20 to-background p-8 md:col-span-3">
              <span className="font-mono text-[10px] uppercase tracking-widest text-soul">Beleg-Quote</span>
              <p className="mt-3 text-6xl tracking-tight">100<span className="text-soul">%</span></p>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                der Aussagen am exakten Transkript-Moment verlinkt — Konsoul behauptet nichts, was er nicht
                belegen kann.
              </p>
            </article>
          </div>
        </div>
      </section>

      {/* ANATOMY — sub-agents with distinct visual treatments */}
      <section className="border-y border-border bg-secondary/40 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <p className="text-xs uppercase tracking-[0.22em] text-soul">Aufbau</p>
          <h2 className="mt-3 text-4xl md:text-5xl leading-[1.05]">
            Wie <span className="mark mark-amber">Konsoul</span> denkt.
          </h2>
          <p className="mt-4 max-w-2xl text-muted-foreground">
            Konsoul ist ein Multi-Agent-System. Er entscheidet, welcher Sub-Agent welche Aufgabe übernimmt —
            und behält den Studien-Kontext durchgehend im Kopf.
          </p>

          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {[
              {
                k: "Planner",
                v: "Übersetzt Forschungsfrage in Methodik. Wählt qualitativ / quantitativ, Stichprobengröße, Stimuli.",
                mood: "think" as const,
                accent: "mark-amber",
                badge: "denkt",
                visual: (
                  <div className="flex flex-wrap gap-1.5">
                    {["qual", "n=24", "B2B", "DACH", "5 Stimuli"].map((t) => (
                      <span key={t} className="rounded-full border border-border bg-background px-2.5 py-1 text-[10px] font-mono text-muted-foreground">{t}</span>
                    ))}
                  </div>
                ),
              },
              {
                k: "Recruiter",
                v: "Schreibt Screener, prüft Quoten, dedupliziert. Greift auf Panels oder eigene Listen zu.",
                mood: "scan" as const,
                accent: "mark-mint",
                badge: "sucht",
                visual: (
                  <div className="space-y-1.5">
                    {[
                      { n: "Anna M.", s: "qualifiziert", ok: true },
                      { n: "Tobias K.", s: "Quote voll", ok: false },
                      { n: "Lea R.", s: "qualifiziert", ok: true },
                    ].map((r) => (
                      <div key={r.n} className="flex items-center justify-between rounded-lg border border-border bg-background px-3 py-1.5 text-[11px]">
                        <span className="text-ink">{r.n}</span>
                        <span className={`font-mono ${r.ok ? "text-soul" : "text-muted-foreground line-through"}`}>{r.s}</span>
                      </div>
                    ))}
                  </div>
                ),
              },
              {
                k: "Moderator",
                v: "Führt das Interview. Wählt Follow-up-Frage live aus, basierend auf Aussage & Leitfaden.",
                mood: "listen" as const,
                accent: "mark-pink",
                badge: "hört zu",
                visual: (
                  <div className="rounded-xl border border-border bg-background p-3 text-[11px] leading-snug">
                    <p className="text-muted-foreground">„…also schwierig, weil das System dann hängt.“</p>
                    <div className="mt-2 flex items-center gap-2 text-soul">
                      <span className="inline-flex h-1.5 w-1.5 rounded-full bg-soul animate-pulse" />
                      <span className="font-mono text-[10px] uppercase tracking-widest">tippt</span>
                      <span className="inline-flex gap-0.5">
                        <span className="h-1 w-1 rounded-full bg-soul" style={{ animation: "soul-pulse .9s ease-in-out 0s infinite alternate" }} />
                        <span className="h-1 w-1 rounded-full bg-soul" style={{ animation: "soul-pulse .9s ease-in-out .15s infinite alternate" }} />
                        <span className="h-1 w-1 rounded-full bg-soul" style={{ animation: "soul-pulse .9s ease-in-out .3s infinite alternate" }} />
                      </span>
                    </div>
                  </div>
                ),
              },
              {
                k: "Analyst",
                v: "Codiert, clustert, synthetisiert. Verankert jede Aussage am Transkript.",
                mood: "scan" as const,
                accent: "mark-sky",
                badge: "clustert",
                visual: (
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { l: "Onboarding", n: 12 },
                      { l: "Pricing", n: 7 },
                      { l: "Performance", n: 18 },
                      { l: "Support", n: 4 },
                    ].map((c) => (
                      <span key={c.l} className="inline-flex items-center gap-1.5 rounded-full bg-ink px-2.5 py-1 text-[10px] text-paper">
                        {c.l} <span className="font-mono text-soul">{c.n}</span>
                      </span>
                    ))}
                  </div>
                ),
              },
              {
                k: "Reporter",
                v: "Generiert Slides, PDFs, Notion-Pages. Verlinkt Quotes direkt zur Audiostelle.",
                mood: "smile" as const,
                accent: "mark-lilac",
                badge: "exportiert",
                visual: (
                  <div className="flex items-end gap-2">
                    {["PDF", "PPTX", "Notion", "Slides"].map((f, i) => (
                      <div
                        key={f}
                        className="rounded-md border border-border bg-background px-2 py-1 text-[10px] font-mono text-muted-foreground"
                        style={{ transform: `translateY(${(i % 2) * -3}px) rotate(${(i - 1.5) * 2}deg)` }}
                      >
                        {f}
                      </div>
                    ))}
                  </div>
                ),
              },
              {
                k: "Cross-Study",
                v: "Lädt nur relevante Studien, vergleicht Themen, beantwortet portfolio-weite Fragen.",
                mood: "wow" as const,
                accent: "mark-amber",
                badge: "vergleicht",
                visual: (
                  <svg viewBox="0 0 120 50" className="w-full text-ink">
                    {[10, 30, 50, 70, 90, 110].map((x, i) => (
                      <g key={x}>
                        <circle cx={x} cy={25} r="5" fill="currentColor" opacity={0.3 + (i % 3) * 0.25} />
                        {i < 5 && <line x1={x + 5} y1="25" x2={x + 15} y2="25" stroke="currentColor" strokeDasharray="2 2" opacity="0.4" />}
                      </g>
                    ))}
                  </svg>
                ),
              },
            ].map((s, idx) => (
              <article
                key={s.k}
                className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 transition hover:-translate-y-0.5 hover:shadow-[0_18px_40px_-24px_rgba(0,0,0,0.25)]"
                style={{ animation: `fade-in .6s ease-out ${idx * 0.08}s both` }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Konsoul size={36} mood={s.mood} className="text-ink" label={s.k.toLowerCase()} />
                    <div>
                      <h2 className="text-lg leading-tight">{s.k}</h2>
                      <p className="text-[10px] font-mono uppercase tracking-widest text-soul">{s.badge}</p>
                    </div>
                  </div>
                </div>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{s.v}</p>
                <div className="mt-5 border-t border-border pt-4">{s.visual}</div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* PRINCIPLES */}
      <section className="py-24">
        <div className="mx-auto grid max-w-7xl gap-12 px-6 md:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-soul">Prinzipien</p>
            <h2 className="mt-3 text-4xl leading-[1.05]">
              Gebaut auf <span className="mark mark-pink">Substanz</span>, nicht Behauptungen.
            </h2>
            <p className="mt-4 text-muted-foreground">
              Konsoul macht keine Black-Box-Magie. Jede Erkenntnis ist nachvollziehbar,
              jede Entscheidung im Studien-Design dokumentiert.
            </p>
          </div>
          <ul className="space-y-5">
            {[
              { k: "Belegbarkeit", v: "100 % der Aussagen am exakten Transkript-Moment verlinkt." },
              { k: "Kein Affekt-Tracking", v: "Wir lesen, was gesagt wird — nicht Mimik oder Stimme." },
              { k: "EU-Datenresidenz", v: "Daten in Frankfurt, keine Weitergabe an Modell­anbieter." },
              { k: "Mensch im Loop", v: "Du genehmigst Leitfaden, Sample und Synthese — Konsoul macht die Arbeit." },
            ].map((p) => (
              <li key={p.k} className="flex gap-4 border-b border-border pb-5">
                <span className="w-40 shrink-0 text-sm font-medium text-ink">{p.k}</span>
                <span className="text-sm text-muted-foreground">{p.v}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <CtaBlock
        title="Bereit, Konsoul"
        italic="zuzuhören?"
        body="Buch eine 30-Minuten-Demo. Wir starten eine Mini-Studie live in deinem Use Case."
      />

      <div className="border-t border-border bg-secondary/30 py-10">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 text-sm">
          <span className="text-muted-foreground">Weiterlesen:</span>
          <div className="flex flex-wrap gap-4">
            <Link href="/plattform" className="text-ink underline-offset-4 hover:underline">
              Alle Plattform-Module →
            </Link>
            <Link href="/methoden" className="text-ink underline-offset-4 hover:underline">
              Methoden im Detail →
            </Link>
            <Link href="/personas" className="text-ink underline-offset-4 hover:underline">
              Personas mit Konsoul →
            </Link>
          </div>
        </div>
      </div>
    </SiteShell>
  );
}
