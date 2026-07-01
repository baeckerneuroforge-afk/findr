import type { Metadata } from "next";
import { buildAlternates, ogDefaultsFor, jsonLdHtml } from "@/lib/marketing/seo";
import { SiteShell, PageHero, CtaBlock } from "@/components/site/SiteShell";
import { Stagger } from "@/components/site/Stagger";

const faqs = [
  { q: "Ersetzt Klymeo klassische Fokusgruppen?", a: "Es ersetzt nicht das Zuhören, sondern skaliert es: hunderte Tiefeninterviews parallel, mit Nuance, die Umfragen verfehlen." },
  { q: "Welche Sprachen sind unterstützt?", a: "Deutsch und Englisch end-to-end — vom Recruiting bis zum Report. Weitere Sprachen auf Anfrage." },
  { q: "Wie lange dauert eine Studie?", a: "Setup in Minuten. Erste Interviews live in 24 Stunden. Belegte Synthese in 3–7 Tagen." },
  { q: "Wer rekrutiert die Teilnehmer:innen?", a: "Du nutzt deine eigene Liste, Kunden-Pool oder unsere Panel-Anbindung — DSGVO-konform." },
  { q: "Wie hält es Klymeo mit Datenschutz?", a: "DSGVO-first: EU-Hosting in Frankfurt, KI-Offenlegung & Einwilligung vor der ersten Interaktion, kein biometrisches Affekt-Tracking." },
  { q: "Kann ich die Methodik selbst kontrollieren?", a: "Ja. Du genehmigst Leitfaden, Sample und Synthese. Konsoul macht die Methodik-Arbeit — du bleibst Insights-Lead." },
];

export const metadata: Metadata = {
  title: { absolute: "Methoden — Voice, Text, Stimulus, Cross-Study · Klymeo" },
  description: "Voice-Interviews, Text-Interviews, Stimulus-Tests, Tagebuchstudien, Cross-Study-Analysen — alle Methoden, die Klymeo orchestriert.",
  alternates: buildAlternates("de", "/methoden"),
  openGraph: {
    ...ogDefaultsFor("de"),
    title: "Methoden — Voice, Text, Stimulus, Cross-Study · Klymeo",
    description: "Sechs Methoden, ein Agent: Voice, Text, Stimulus, Tagebuch, Critical-Incident, Cross-Study.",
    url: "/methoden",
  },
};

const methods = [
  {
    n: "Voice-Interview",
    body: "Frei sprechen, im eigenen Tempo. Konsoul moderiert, bohrt nach, erkennt Sättigung — bewusst ohne Stimm-Affekt-Tracking.",
    when: "Tiefe Insights, emotionale Themen, hohe Bequemlichkeit für Teilnehmer:innen.",
    photo: "/site/photo-interview.jpg",
    alt: "Person im Voice-Interview",
  },
  {
    n: "Text-Interview",
    body: "Asynchron, schreibend, mit Konsoul-Nachfragen. Ideal für sensible Themen oder geräuschvolle Umgebungen.",
    when: "Sensible Themen, B2B-Settings, schriftliche Komfortzone.",
    photo: "/site/photo-text-chat.jpg",
    alt: "Hände tippen auf Laptop",
  },
  {
    n: "Stimulus-Test (liveCreative)",
    body: "Verpackung, Konzept, Video, Landing Page — eingebettet ins Gespräch. Reaktion vor Rationalisierung.",
    when: "Konzept-Auswahl, Verpackungs-Variante, Werbespot-Cuts.",
    photo: "/site/photo-stimulus.jpg",
    alt: "Smartphone zeigt Produkt-Mockup",
  },
  {
    n: "Tagebuch-Studie (light)",
    body: "Mehrere Interview-Runden über Tage. Konsoul fragt am dritten Tag, was sich seit Tag eins geändert hat.",
    when: "Nutzungs-Verhalten, Routinen, Kauf-Journeys.",
    photo: "/site/photo-diary.jpg",
    alt: "Offenes Notizbuch mit Tagebucheinträgen",
  },
  {
    n: "Critical-Incident-Technik",
    body: "Konsoul lässt einen konkreten Vorfall chronologisch erzählen — was war davor, danach, was wäre fast anders gewesen?",
    when: "Switch-Trigger, Pain-Points, Last-Mile-Friction.",
    photo: "/site/photo-incident.jpg",
    alt: "Sticky-Note-Timeline an Wand",
  },
  {
    n: "Cross-Study-Analyse",
    body: "Ask Konsoul: portfolio-weite Fragen über deinen gesamten Studien-Schatz, immer mit Quellenbeleg.",
    when: "Strategie-Workshops, Wissens-Synthese, Insight-Reviews.",
    photo: "/site/photo-cross-study.jpg",
    alt: "Mehrere Studien-Reports auf Schreibtisch",
  },
];

export default function MethodsPage() {
  return (
    <SiteShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdHtml({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: faqs.map((f) => ({
              "@type": "Question",
              name: f.q,
              acceptedAnswer: { "@type": "Answer", text: f.a },
            })),
          }),
        }}
      />

      <PageHero
        eyebrow="Methoden"
        title="Sechs Methoden,"
        italic="ein Agent."
        lead="Konsoul wählt die Methodik passend zur Forschungsfrage — oder du wählst sie bewusst. Hier ein Überblick, was geht."
        image="/site/photo-method.jpg"
        imageAlt="Voice-Interview mit Klymeo"
      />

      <section className="py-24">
        <Stagger step={90} className="mx-auto grid max-w-7xl gap-6 px-6 md:grid-cols-2">
          {methods.map((m) => (
            <article key={m.n} className="group overflow-hidden rounded-2xl border border-border bg-card transition hover:-translate-y-1 hover:border-ink hover:shadow-[0_24px_50px_-28px_oklch(0.16_0.01_260/0.35)]">
              <div className="aspect-[16/9] overflow-hidden border-b border-border">
                <img src={m.photo} alt={m.alt} loading="lazy" width={1280} height={720} className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.05]" />
              </div>
              <div className="p-7">
                <h2 className="text-xl">{m.n}</h2>
                <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{m.body}</p>
                <p className="mt-4 rounded-md bg-secondary/60 px-3 py-2 text-xs text-ink">
                  <span className="font-medium">Wann sinnvoll:</span> {m.when}
                </p>
              </div>
            </article>
          ))}
        </Stagger>
      </section>

      <section className="border-y border-border bg-secondary/40 py-24">
        <div className="mx-auto max-w-5xl px-6">
          <p className="text-xs uppercase tracking-[0.22em] text-soul">FAQ</p>
          <h2 className="mt-3 text-4xl leading-[1.05]">
            Häufige <span className="mark mark-amber">Fragen</span>
          </h2>
          <div className="mt-10 divide-y divide-border rounded-2xl border border-border bg-card">
            {faqs.map((f) => (
              <details key={f.q} className="group p-6">
                <summary className="flex cursor-pointer items-center justify-between text-base font-medium text-ink">
                  {f.q}
                  <span className="text-soul transition group-open:rotate-45" aria-hidden>+</span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <CtaBlock title="Welche Methodik passt zu" italic="deiner Frage?" body="In der Demo zeigen wir dir am eigenen Use Case, welche Methodik Konsoul empfiehlt." />
    </SiteShell>
  );
}
