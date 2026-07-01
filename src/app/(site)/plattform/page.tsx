import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Konsoul } from "@/components/site/Konsoul";
import { SiteShell, PageHero, CtaBlock } from "@/components/site/SiteShell";
import { Stagger } from "@/components/site/Stagger";
import { buildAlternates, ogDefaultsFor } from "@/lib/marketing/seo";

export const metadata: Metadata = {
  title: { absolute: "Plattform — Alle Module von Klymeo" },
  description:
    "Studien-Design, Recruiting, Voice- & Text-Interviews, Stimulus-Engine, Synthese, Personas, Cross-Study, Reporting — alle Module der Klymeo-Plattform.",
  alternates: buildAlternates("de", "/plattform"),
  openGraph: {
    ...ogDefaultsFor("de"),
    title: "Plattform — Alle Module von Klymeo",
    description: "Acht Module: Design, Recruiting, Interviews, Stimulus, Synthese, Personas, Cross-Study, Reporting.",
    url: "/plattform",
  },
};

type ModuleItem = {
  n: string;
  tag: string;
  title: string;
  body: string;
  bullets: string[];
  mood: "smile" | "think" | "wow" | "scan" | "listen" | "wink";
  image: string;
  quip: string;
};

const modules: ModuleItem[] = [
  {
    n: "01",
    tag: "Design",
    title: "Studien-Designer",
    body: "Aus deinem Briefing entsteht ein Leitfaden mit Laddering-Logik, Screener und Stimuli. Methodisch sauber, mit Begründung pro Frage.",
    bullets: ["Leitfaden-Generator", "Screener mit Quoten", "Stimulus-Bibliothek", "12+ Studientypen"],
    mood: "think",
    image: "/site/plat-design.jpg",
    quip: "Ich schlage eine Frage-Reihenfolge vor — du entscheidest.",
  },
  {
    n: "02",
    tag: "Recruiting",
    title: "Sample & Panel",
    body: "Eigene Verteiler, Kunden-Listen oder Panel-Anbindung. Dedup­liziert, Quoten in Echtzeit, Reminder werden automatisch gesteuert.",
    bullets: ["Eigene Liste · CSV", "Panel-Integration", "Quoten-Monitoring live", "Anonyme Links"],
    mood: "scan",
    image: "/site/plat-recruit.jpg",
    quip: "Ich erreiche deine Zielgruppe — und passe auf Quoten auf.",
  },
  {
    n: "03",
    tag: "Interview",
    title: "Voice & Text Engine",
    body: "Teilnehmer:innen sprechen oder tippen — frei wählbar. Es wird moderiert, nachgebohrt, und die Reihenfolge dynamisch angepasst.",
    bullets: ["Live-Voice (DE/EN)", "Adaptive Follow-ups", "Sättigungs-Erkennung", "Pause & Resume"],
    mood: "listen",
    image: "/site/plat-interview.jpg",
    quip: "Hier bohre ich nach — höflich, aber konsequent.",
  },
  {
    n: "04",
    tag: "Stimulus",
    title: "liveCreative-Test",
    body: "Verpackung, Konzept, Landing Page oder Werbespot — eingebettet ins Interview, im richtigen Moment gezeigt.",
    bullets: ["Bild · Video · Web", "A/B im Gespräch", "Klick-Tracks", "Reactions im Transkript"],
    mood: "wow",
    image: "/site/plat-stimulus.jpg",
    quip: "Ich zeige Reize genau dann, wenn sie zünden.",
  },
  {
    n: "05",
    tag: "Auswertung",
    title: "Synthese-Engine",
    body: "Codierung, Themen-Clustering, Sentiment am Wortlaut (kein Stimm-Affekt). Jede Aussage am Transkript verlinkt.",
    bullets: ["Theme-Clustering", "Belegte Quotes", "Sentiment am Wortlaut", "Export Excel · CSV"],
    mood: "scan",
    image: "/site/plat-synthese.jpg",
    quip: "Ich verdichte — und belege jede Aussage.",
  },
  {
    n: "06",
    tag: "Personas",
    title: "Persona-Builder",
    body: "Persona-Cluster werden direkt aus den Interviews destilliert — nicht aus Stereotypen, sondern aus echten Jobs-to-be-Done.",
    bullets: ["Daten-getrieben", "JTBD-Logik", "Mit Zitaten", "Lebendig pro Studie"],
    mood: "smile",
    image: "/site/plat-personas.jpg",
    quip: "Echte Menschen, keine Klischees.",
  },
  {
    n: "07",
    tag: "Cross-Study",
    title: "Ask Konsoul",
    body: "Frag portfolio-weit: „In wie vielen Studien taucht Onboarding-Frust auf?“ Nur relevante Quellen werden geladen und exakt gezählt.",
    bullets: ["Natürliche Sprache", "Belegt mit Quellen", "Studien-Vergleich", "Slack & Notion"],
    mood: "think",
    image: "/site/plat-cross.jpg",
    quip: "Frag mich quer durch alle Studien.",
  },
  {
    n: "08",
    tag: "Reporting",
    title: "Auto-Report",
    body: "Teilbare Stories aus jeder Studie — als PDF, Slides oder Notion-Page. Quotes klickbar zur Audiostelle.",
    bullets: ["PDF & PPT", "Notion · Slack · Miro", "Custom-Branding", "Snippet-Export"],
    mood: "smile",
    image: "/site/plat-report.jpg",
    quip: "Ein Klick — und die Story steht.",
  },
];

export default function PlatformPage() {
  return (
    <SiteShell>
      <PageHero
        eyebrow="Plattform"
        title="Eine Plattform. Acht"
        italic="Module."
        lead="Klymeo ist ein End-to-End-System für qualitative Marktforschung mit KI — vom Briefing bis zur Side-by-side-Auswertung über deinen ganzen Studien-Schatz."
        mood="scan"
      />

      <section className="py-20 md:py-24">
        <div className="mx-auto max-w-7xl px-6">
          <Stagger step={80} className="grid gap-8 md:grid-cols-2 lg:gap-10">
            {modules.map((m) => (
              <article
                key={m.n}
                className="group overflow-hidden rounded-2xl border border-border bg-card transition hover:-translate-y-1 hover:border-ink hover:shadow-[0_24px_50px_-28px_oklch(0.16_0.01_260/0.35)]"
              >
                <div className="relative aspect-[16/10] overflow-hidden bg-secondary">
                  <Image
                    src={m.image}
                    alt={m.title}
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-cover transition duration-700 group-hover:scale-[1.05]"
                  />
                  <div className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full bg-card/90 px-3 py-1.5 text-[11px] font-mono uppercase tracking-widest text-ink backdrop-blur">
                    <span className="text-muted-foreground">{m.n}</span>
                    <span className="h-1 w-1 rounded-full bg-soul" />
                    <span>{m.tag}</span>
                  </div>

                  {/* Konsoul speech bubble */}
                  <div className="absolute bottom-4 left-4 right-4 flex items-end gap-2 translate-y-2 opacity-0 transition duration-500 group-hover:translate-y-0 group-hover:opacity-100">
                    <Konsoul size={40} mood={m.mood} className="shrink-0 text-ink drop-shadow-md" />
                    <div className="relative max-w-[80%] rounded-2xl rounded-bl-sm bg-card/95 px-3.5 py-2 text-xs text-ink shadow-sm backdrop-blur">
                      <span className="mr-1.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                        Konsoul
                      </span>
                      {m.quip}
                    </div>
                  </div>
                </div>

                <div className="p-7">
                  <h3 className="text-2xl leading-tight">{m.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{m.body}</p>
                  <ul className="mt-5 flex flex-wrap gap-1.5 text-xs">
                    {m.bullets.map((b) => (
                      <li
                        key={b}
                        className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/50 px-2.5 py-1 text-ink transition hover:bg-secondary"
                      >
                        <span className="h-1 w-1 rounded-full bg-soul" />
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            ))}
          </Stagger>
        </div>
      </section>

      {/* COMPARISON */}
      <section className="border-y border-border bg-secondary/40 py-24">
        <div className="mx-auto max-w-5xl px-6">
          <p className="text-xs uppercase tracking-[0.22em] text-soul">Im Vergleich</p>
          <h2 className="mt-3 text-4xl md:text-5xl leading-[1.05]">
            Warum <span className="mark mark-amber">Klymeo?</span>
          </h2>

          <div className="mt-10 overflow-hidden rounded-2xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-secondary/60 text-left text-xs uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="px-6 py-4 font-medium">Kriterium</th>
                  <th className="px-6 py-4 font-medium">Klymeo</th>
                  <th className="px-6 py-4 font-medium">Andere</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[
                  ["Voice & Text-first", "Beides, ein Fluss", "Meist nur Text"],
                  ["Stimulus live im Gespräch", "Ja", "Vorab oder gar nicht"],
                  ["Sprachen (end-to-end)", "Deutsch & Englisch", "Oft nur Englisch"],
                  ["EU-Datenresidenz", "Frankfurt", "—"],
                  ["Affekt-Tracking", "Bewusst nein", "Graubereich"],
                  ["Cross-Study-Agent", "Ja", "—"],
                  ["Belegte Themen", "100 % am Transkript", "Generische Summary"],
                ].map(([k, a, b]) => (
                  <tr key={k}>
                    <td className="px-6 py-4 font-medium text-ink">{k}</td>
                    <td className="px-6 py-4 text-ink">{a}</td>
                    <td className="px-6 py-4 text-muted-foreground">{b}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="py-20">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6">
          <h3 className="text-2xl">Mehr sehen?</h3>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/methoden"
              className="rounded-full border border-border bg-card px-5 py-2.5 text-sm font-medium text-ink hover:bg-secondary"
            >
              Methoden im Detail →
            </Link>
            <Link
              href="/loesungen"
              className="rounded-full border border-border bg-card px-5 py-2.5 text-sm font-medium text-ink hover:bg-secondary"
            >
              Lösungen nach Use Case →
            </Link>
            <Link
              href="/preise"
              className="rounded-full border border-border bg-card px-5 py-2.5 text-sm font-medium text-ink hover:bg-secondary"
            >
              Preise →
            </Link>
          </div>
        </div>
      </section>

      <CtaBlock
        title="Sieh die Module"
        italic="in Aktion."
        body="In der Demo läuft eine Mini-Studie live — du siehst alle acht Module in unter 30 Minuten arbeiten."
      />
    </SiteShell>
  );
}
