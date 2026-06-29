import type { Metadata } from "next";
import Link from "next/link";
import { Konsoul } from "@/components/site/Konsoul";
import { SiteShell, CtaBlock, DEMO_URL } from "@/components/site/SiteShell";
import { Stagger } from "@/components/site/Stagger";
import { ogDefaults } from "@/lib/marketing/seo";

export const metadata: Metadata = {
  title: { absolute: "Klymeo — KI-Marktforschung, orchestriert von Konsoul" },
  description:
    "Qualitative & quantitative Studien in Tagen: konzipieren, rekrutieren, interviewen, auswerten — orchestriert von Konsoul. EU-gehostet in Frankfurt.",
  alternates: { canonical: "/" },
  openGraph: {
    ...ogDefaults,
    title: "Klymeo — KI-Marktforschung",
    description:
      "Konsoul orchestriert deine Studien. Belegt am Transkript. Veröffentlicht in Tagen.",
    url: "/",
  },
};

export default function Landing() {
  return (
    <SiteShell>
      {/* HERO */}
      <section className="relative">
        <div
          className="absolute inset-0 dotgrid opacity-60 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]"
          aria-hidden
        />
        <div className="relative mx-auto max-w-7xl px-6 pt-20 pb-24 lg:pt-28 lg:pb-32">
          <div className="grid items-center gap-16 lg:grid-cols-[1.05fr_1fr]">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-soul opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-soul" />
                </span>
                Konsoul · KI-Agent für Marktforschung
              </div>

              <h1 className="text-[clamp(2.6rem,5.8vw,4.8rem)] leading-[1.02] tracking-[-0.03em]">
                Was dein Markt dir{" "}
                <span className="mark mark-amber">wirklich</span> sagt.
                <br />
                Belegt, in Tagen.
              </h1>

              <p className="mt-7 max-w-xl text-lg leading-relaxed text-muted-foreground">
                Klymeo bündelt qualitative Tiefe und quantitative Skalierung in einer Plattform —
                konzipiert, durchgeführt und ausgewertet von{" "}
                <span className="text-ink font-medium">Konsoul</span>, deinem KI-Forschungs-Agenten.
                Jede Erkenntnis am Transkript belegt. EU-gehostet in Frankfurt.
              </p>

              <div className="mt-9 flex flex-wrap items-center gap-3">
                <a
                  href={DEMO_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full bg-ink px-6 py-3.5 text-sm font-medium text-paper transition hover:scale-[1.02] hover:shadow-[0_18px_50px_-12px_oklch(0.16_0.01_260_/_0.55)]"
                >
                  <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-soul/50 to-transparent transition-transform duration-[900ms] group-hover:translate-x-full" aria-hidden />
                  <span className="relative">Demo mit Konsoul buchen</span>
                  <span className="relative transition group-hover:translate-x-0.5" aria-hidden>→</span>
                </a>
                <Link
                  href="/plattform"
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-6 py-3.5 text-sm font-medium text-ink transition hover:bg-secondary"
                >
                  Plattform-Tour
                </Link>
              </div>

              <div className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                <span>🇪🇺 EU-gehostet</span>
                <span className="h-3 w-px bg-border" />
                <span>DSGVO</span>
                <span className="h-3 w-px bg-border" />
                <span>Voice & Text</span>
                <span className="h-3 w-px bg-border" />
                <span>Belegt am Transkript</span>
              </div>
            </div>

            {/* Hero visual: photo + product chip */}
            <div className="relative">
              <div className="relative aspect-[4/5] overflow-hidden rounded-3xl border border-border bg-secondary">
                <img
                  src="/site/photo-interview.jpg"
                  alt="Teilnehmerin im Interview mit Kopfhörern"
                  className="h-full w-full object-cover kenburns"
                  width={1280}
                  height={1280}
                />
                <div className="absolute inset-x-4 bottom-4 rounded-2xl border border-border bg-card/95 p-4 backdrop-blur">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                        Live · Voice Interview
                      </p>
                      <p className="mt-1 text-sm font-medium text-ink">
                        „Erzähl mal genauer — wann zuletzt?“
                      </p>
                    </div>
                    <span className="flex items-center gap-1.5 rounded-full bg-soul/15 px-2 py-1 text-[10px] font-medium text-ink">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-soul" />
                      REC
                    </span>
                  </div>
                </div>
              </div>

              <div className="absolute -left-5 -top-4 hidden rotate-[-3deg] items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs shadow-sm floaty sm:flex">
                <span className="text-soul">●</span> 312 Interviews · 7 Studien
              </div>
              <div className="absolute -bottom-4 right-6 rotate-[2deg] rounded-xl border border-border bg-ink px-3 py-2 text-xs font-medium text-paper shadow-sm drift">
                Belegt am Transkript ✓
              </div>
            </div>

          </div>
        </div>

        {/* value ticker */}
        <div className="border-y border-border bg-secondary/40">
          <div className="mx-auto max-w-7xl overflow-hidden px-6 py-5">
            <div className="flex items-center gap-6 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
              <span className="shrink-0">So arbeitet Klymeo</span>
              <div className="flex flex-1 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
                <div className="flex shrink-0 gap-10 pr-10 marquee">
                  {[
                    "Studie in Stunden statt Wochen",
                    "Voice & Text — adaptiv",
                    "Belegt am Transkript",
                    "Eigene Listen oder Panel",
                    "EU-Hosting · Frankfurt",
                    "Reports als PDF · Slides · Notion",
                    "Cross-Study-Suche",
                    "Quoten live im Recruiting",
                  ].flatMap((n) => [n, n]).map((n, i) => (
                    <span key={i} className="flex items-center gap-3">
                      <span className="font-display text-base normal-case tracking-normal text-ink/80">{n}</span>
                      <span className="h-1 w-1 rounded-full bg-soul/70" />
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* MEET KONSOUL — softer, photo-led */}
      <section className="relative py-28">
        <div className="mx-auto grid max-w-7xl items-center gap-16 px-6 lg:grid-cols-[1.1fr_1fr]">
          <div className="relative">
            <div className="relative aspect-[4/5] overflow-hidden rounded-3xl border border-border bg-secondary">
              <img
                src="/site/photo-team.jpg"
                alt="Insights-Team bei der Auswertung"
                loading="lazy"
                className="h-full w-full object-cover"
                width={1600}
                height={1024}
              />
            </div>
            <div className="absolute -bottom-6 -right-4 hidden w-56 rotate-[3deg] rounded-2xl border border-border bg-card p-4 shadow-sm sm:block">
              <div className="flex items-center gap-3">
                <Konsoul size={36} mood="smile" className="text-ink" />
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    Konsoul
                  </p>
                  <p className="text-xs text-ink">Synthese läuft · 84 %</p>
                </div>
              </div>
            </div>
            <div className="absolute -left-4 top-6 hidden w-44 -rotate-[4deg] rounded-2xl border border-border bg-paper p-3 shadow-sm sm:block">
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Theme · cluster 03
              </p>
              <p className="mt-1 text-xs text-ink">„Onboarding fühlt sich überfordernd an.“</p>
            </div>
          </div>

          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-soul">Der Agent im Hintergrund</p>
            <h2 className="mt-4 text-5xl leading-[1.05]">
              Menschen reden. <span className="mark mark-pink">Konsoul</span> hört zu.
            </h2>
            <p className="mt-6 max-w-lg text-muted-foreground leading-relaxed">
              Konsoul ist das Orchestrierungs-Modul deiner Forschung — er plant Studien,
              koordiniert Recruiting, führt Interviews und verdichtet zu Themen. Du bleibst
              Insights-Lead. Konsoul macht die Arbeit.
            </p>

            <Stagger as="ul" step={90} className="mt-8 space-y-4">
              {[
                { k: "Plant", v: "Leitfaden, Sample, Stimuli — aus einem Satz Briefing." },
                { k: "Führt durch", v: "Voice- und Text-Interviews mit echtem Nachhaken." },
                { k: "Belegt", v: "Jede Aussage rückverfolgbar zum Transkript." },
                { k: "Lernt", v: "Wird mit jeder Studie schärfer auf deine Methodik." },
              ].map((i) => (
                <li key={i.k} className="flex gap-4 border-b border-border pb-4 transition hover:border-ink">
                  <span className="w-24 shrink-0 text-sm font-medium text-ink">{i.k}</span>
                  <span className="text-sm text-muted-foreground">{i.v}</span>
                </li>
              ))}
            </Stagger>

            <div className="mt-8">
              <Link
                href="/konsoul"
                className="inline-flex items-center gap-2 text-sm font-medium text-ink underline-offset-4 hover:underline"
              >
                Konsoul im Detail →
              </Link>
            </div>
          </div>
        </div>
      </section>



      {/* WORKFLOW */}
      <section className="relative border-y border-border bg-secondary/40 py-28">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-xl">
              <p className="text-xs uppercase tracking-[0.22em] text-soul">Workflow</p>
              <h2 className="mt-3 text-5xl leading-[1.05]">
                Fünf Schritte. <span className="mark mark-sky">Eine Plattform.</span>
              </h2>
            </div>
            <p className="max-w-sm text-sm text-muted-foreground">
              Konsoul übernimmt die Methodik-Arbeit. Du bleibst Insights-Lead — schneller, ohne Tool-Bruch.
            </p>
          </div>

          <Stagger step={100} className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-5">
            {[
              { n: "01", title: "Konzipieren", body: "Brief → Leitfaden, Screener, Stimuli.", mood: "think" as const },
              { n: "02", title: "Rekrutieren", body: "Eigene Liste oder Panel — DE/EN.", mood: "scan" as const },
              { n: "03", title: "Interviewen", body: "Voice & Text, parallel, 24/7.", mood: "listen" as const },
              { n: "04", title: "Auswerten", body: "Themen, Personas, Synthese — belegt.", mood: "wow" as const },
              { n: "05", title: "Teilen", body: "PDF, Slides, Notion, Cross-Study Agent.", mood: "smile" as const },
            ].map((s) => (
              <article key={s.n} className="group bg-card p-6 transition hover:bg-paper">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-muted-foreground">{s.n}</span>
                  <Konsoul
                    size={36}
                    mood={s.mood}
                    className="text-ink transition group-hover:-translate-y-1"
                  />
                </div>
                <h3 className="mt-5 text-xl">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              </article>
            ))}
          </Stagger>
        </div>
      </section>

      {/* SOLUTIONS */}
      <section className="py-28">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-14 flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-xl">
              <p className="text-xs uppercase tracking-[0.22em] text-soul">Lösungen</p>
              <h2 className="mt-3 text-5xl leading-[1.05]">
                Eine Engine. <span className="mark mark-lilac">Vier Forschungsfragen.</span>
              </h2>
            </div>
            <Link
              href="/loesungen"
              className="text-sm font-medium text-ink underline-offset-4 hover:underline"
            >
              Alle Lösungen →
            </Link>
          </div>
          <Stagger step={90} className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                to: "/loesungen/user-research",
                tag: "Produkt & UX",
                title: "User Research",
                body: "Wie nutzen Menschen dein Produkt — und wo hakt es?",
              },
              {
                to: "/loesungen/konzept-test",
                tag: "Innovation",
                title: "Konzept- & Kreativ-Test",
                body: "Welches Konzept zündet — und vor allem: warum?",
              },
              {
                to: "/loesungen/markenwahrnehmung",
                tag: "Brand",
                title: "Markenwahrnehmung",
                body: "Wofür steht deine Marke im Kopf deiner Zielgruppe?",
              },
              {
                to: "/loesungen/bedarf-verhalten",
                tag: "Markt",
                title: "Bedarf & Verhalten",
                body: "Welche Jobs, Trigger und Hürden treiben Entscheidungen?",
              },
            ].map((s) => (
              <Link
                key={s.to}
                href={s.to}
                className="group rounded-2xl border border-border bg-card p-7 transition hover:-translate-y-1 hover:border-ink hover:shadow-[0_24px_50px_-28px_oklch(0.16_0.01_260/0.35)]"
              >
                <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                  {s.tag}
                </p>
                <h3 className="mt-3 text-2xl">{s.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
                <span className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-ink">
                  Ansehen{" "}
                  <span className="transition group-hover:translate-x-1.5" aria-hidden>
                    →
                  </span>
                </span>
              </Link>
            ))}
          </Stagger>
        </div>
      </section>

      {/* FEATURES */}
      <section className="border-t border-border py-28">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-14 max-w-2xl">
            <p className="text-xs uppercase tracking-[0.22em] text-soul">Plattform</p>
            <h2 className="mt-3 text-5xl leading-[1.05]">
              Tiefe wie ein Interview. <span className="mark mark-amber">Tempo wie eine Umfrage.</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-6 md:grid-rows-2">
            <div className="md:col-span-4 md:row-span-2 rounded-2xl border border-border bg-ink p-8 text-paper">
              <div className="flex h-full flex-col justify-between gap-8">
                <div>
                  <span className="font-mono text-[11px] uppercase tracking-widest text-paper/60">
                    Live Voice · Cross-Study
                  </span>
                  <h3 className="mt-3 text-3xl">
                    KI, die <span className="mark mark-pink">nachhakt</span>.
                  </h3>
                  <p className="mt-3 max-w-md text-sm text-paper/70">
                    Konsoul orchestriert die Konversation in Echtzeit — wählt Follow-ups,
                    erkennt Widersprüche, verdichtet zu Themen mit Beleg.
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="rounded-xl bg-paper/10 px-4 py-3 text-sm">
                    <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-paper/50">
                      Konsoul
                    </p>
                    „Erzähl mal genauer — wann hast du das zuletzt erlebt?“
                  </div>
                  <div className="ml-10 rounded-xl bg-paper/10 px-4 py-3 text-sm">
                    „Letzten Dienstag, beim Einkaufen mit den Kindern…“
                  </div>
                  <div className="rounded-xl bg-soul/20 px-4 py-3 text-sm text-paper">
                    <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-paper/60">
                      Konsoul · Follow-up
                    </p>
                    „Spannend — war es eher der Preis oder die Auswahl?“
                  </div>
                </div>
              </div>
            </div>

            <div className="md:col-span-2 rounded-2xl border border-border bg-card p-6">
              <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                EU & DSGVO
              </p>
              <h3 className="mt-2 text-xl">Hosting in Frankfurt</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Daten bleiben in der EU. Keine Trainingsweitergabe an Modell­anbieter.
              </p>
            </div>

            <div className="md:col-span-2 rounded-2xl border border-border bg-card p-6">
              <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                Auto-Report
              </p>
              <h3 className="mt-2 text-xl">PDF · Slides · Notion</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Konsoul liefert geteilte Stories aus jeder Studie — auf einen Klick.
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            {[
              { t: "Belegt am Transkript", b: "Jede Aussage zeigt den exakten Quote." },
              { t: "Voice & Text", b: "Das Format, das deine Zielgruppe wirklich nutzt." },
              { t: "Studie in 24h", b: "Vom Briefing bis zum ersten Insight." },
            ].map((c) => (
              <div key={c.t} className="rounded-2xl border border-border bg-card p-6">
                <h3 className="text-lg">{c.t}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{c.b}</p>
              </div>
            ))}
          </div>

          <div className="mt-10">
            <Link
              href="/plattform"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 text-sm font-medium text-ink transition hover:bg-secondary"
            >
              Alle Module ansehen →
            </Link>
          </div>
        </div>
      </section>

      {/* PROOF — replaces fake testimonials */}
      <section className="border-y border-border bg-secondary/40 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid items-end gap-10 md:grid-cols-[1.2fr_1fr]">
            <h2 className="text-4xl md:text-5xl leading-[1.05]">
              Klassische Marktforschung, <span className="mark mark-mint">neu gerechnet.</span>
            </h2>
            <p className="text-muted-foreground md:text-right">
              Vergleichswerte aus Projekten, die Klymeo durchlaufen — gemessen am
              klassischen Setup mit Agentur, Rekrutierung und manueller Auswertung.
            </p>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {[
              { k: "Time-to-Insight", v: "3–5", u: "Tage", note: "statt 4–6 Wochen — vom Briefing bis zum belegten Report.", img: "/site/photo-portrait-1.jpg" },
              { k: "Kostenstruktur", v: "−70", u: "%", note: "im Vergleich zu klassischer Agentur-Forschung gleicher Tiefe.", img: "/site/photo-portrait-2.jpg" },
              { k: "Belegrate", v: "100", u: "%", note: "jede Aussage im Report verlinkt zum Original-Transkript.", img: "/site/photo-portrait-3.jpg" },
            ].map((s, i) => (
              <article
                key={s.k}
                className="group overflow-hidden rounded-2xl border border-border bg-card opacity-0 [animation:fade-in_.7s_ease-out_forwards]"
                style={{ animationDelay: `${i * 120}ms` }}
              >
                <div className="aspect-[5/4] overflow-hidden bg-secondary">
                  <img
                    src={s.img}
                    alt=""
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-[1.04]"
                  />
                </div>
                <div className="p-7">
                  <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                    {s.k}
                  </p>
                  <p className="mt-3 flex items-baseline gap-2">
                    <span className="font-display text-6xl leading-none text-ink">{s.v}</span>
                    <span className="text-lg text-muted-foreground">{s.u}</span>
                  </p>
                  <p className="mt-5 border-t border-border pt-4 text-sm text-muted-foreground">
                    {s.note}
                  </p>
                </div>
              </article>
            ))}
          </div>

          <p className="mt-10 max-w-2xl text-xs text-muted-foreground">
            Werte basieren auf internen Vergleichsläufen über qualitative und
            quantitative Studien. Wir nennen gerne konkrete Referenzen im Gespräch —
            statt anonymisierter Zitate.
          </p>
        </div>
      </section>



      <CtaBlock
        title="Lass deinen Markt"
        italic="sprechen."
        body="30-Minuten-Demo. Echte Daten aus deinem Use Case. Du gehst raus mit einer Studienidee, die Konsoul direkt starten kann."
      />
    </SiteShell>
  );
}
