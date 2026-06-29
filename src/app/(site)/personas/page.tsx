import type { Metadata } from "next";
import { ogDefaults } from "@/lib/marketing/seo";
import { Konsoul } from "@/components/site/Konsoul";
import { SiteShell, PageHero, CtaBlock } from "@/components/site/SiteShell";

export const metadata: Metadata = {
  title: { absolute: "Personas — daten-getrieben mit KI · Klymeo" },
  description: "Personas aus echten Interviews destilliert: Jobs-to-be-Done, Zitate, lebendig — kein Stereotyp, kein Bauchgefühl.",
  alternates: { canonical: "/personas" },
  openGraph: {
    ...ogDefaults,
    title: "Personas — daten-getrieben mit KI · Klymeo",
    description: "Personas aus echten Interviews — mit Zitaten, JTBD und Triggern, lebendig und prüfbar.",
    url: "/personas",
  },
};

export default function PersonasPage() {
  return (
    <SiteShell>
      <PageHero
        eyebrow="Personas"
        title="Personas, die"
        italic="atmen."
        lead="Schluss mit Slide-Personas, die niemand benutzt. Konsoul destilliert Persona-Cluster aus echten Interviews — mit Zitaten, JTBD und Triggern, die sich pro Studie aktualisieren."
        mood="smile"
      />

      <section className="py-24">
        <div className="mx-auto grid max-w-7xl gap-8 px-6 md:grid-cols-3">
          {[
            {
              n: "Maja, 34",
              role: "Effizienz-Optimiererin",
              job: "Will den Familien-Alltag um 20 % schneller machen — ohne Qualitätsverlust.",
              quote: "„Ich will keine App mehr lernen müssen. Wenn ich's nicht in 30 Sekunden kapiere, lösch ich's.“",
              triggers: ["Zeitdruck am Sonntagabend", "Empfehlung im Freundeskreis"],
              hurdles: ["Datenschutz-Sorgen", "Setup über 5 Min."],
              mood: "think" as const,
            },
            {
              n: "Sven, 41",
              role: "Skeptischer Pragmatiker",
              job: "Will solide Lösungen, die seine Kollegen schon eingesetzt haben.",
              quote: "„Zeig mir 3 Case Studies aus meiner Branche — dann reden wir.“",
              triggers: ["Konkurrent setzt es ein", "Quartals-Review steht an"],
              hurdles: ["Vendor-Lock-in", "Procurement-Prozess"],
              mood: "scan" as const,
            },
            {
              n: "Leo, 27",
              role: "Early-Adopter",
              job: "Will der erste sein, der das Neue im Team einführt.",
              quote: "„Ich probier alles aus, was im Slack-Channel hochkommt — das ist meine Währung.“",
              triggers: ["Launch auf Product Hunt", "Influencer-Reel"],
              hurdles: ["Team-Akzeptanz", "Integration mit Notion"],
              mood: "wow" as const,
            },
          ].map((p) => (
            <article key={p.n} className="rounded-2xl border border-border bg-card p-7">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-2xl">{p.n}</h3>
                  <p className="text-sm text-muted-foreground">{p.role}</p>
                </div>
                <Konsoul size={48} mood={p.mood} className="text-ink" />
              </div>
              <p className="mt-5 text-sm text-ink"><span className="mark mark-amber">Job:</span> {p.job}</p>
              <blockquote className="mt-4 border-l-2 border-soul pl-4 text-sm text-muted-foreground">
                {p.quote}
              </blockquote>
              <div className="mt-5 grid gap-3 text-xs">
                <div>
                  <p className="font-mono uppercase tracking-widest text-muted-foreground">Trigger</p>
                  <ul className="mt-1 space-y-1">
                    {p.triggers.map((t) => (
                      <li key={t} className="text-ink">→ {t}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="font-mono uppercase tracking-widest text-muted-foreground">Hürden</p>
                  <ul className="mt-1 space-y-1">
                    {p.hurdles.map((t) => (
                      <li key={t} className="text-ink">⨯ {t}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="border-y border-border bg-secondary/40 py-24">
        <div className="mx-auto grid max-w-7xl gap-12 px-6 md:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-soul">So entsteht eine Persona</p>
            <h2 className="mt-3 text-4xl leading-[1.05]">
              Aus <span className="mark mark-pink">Gesprächen</span>, nicht aus Annahmen.
            </h2>
            <p className="mt-4 text-muted-foreground">
              Konsoul clustert Interviews entlang von Jobs, Triggern, Hürden und Sprachwelt —
              nicht entlang Alter und Postleitzahl. Jede Aussage in der Persona ist mit dem Originalzitat verlinkt.
            </p>
          </div>
          <ol className="space-y-5">
            {[
              { k: "1. Interviews", v: "Mindestens 30 qualitative Gespräche in deinem Markt." },
              { k: "2. Coding", v: "Konsoul codiert JTBD, Trigger, Hürden, Sprache, Substitute." },
              { k: "3. Clustering", v: "Personas entstehen daten-getrieben (keine Hypothese erforderlich)." },
              { k: "4. Verifikation", v: "Du genehmigst Cluster — Konsoul lernt deine Sichtweise." },
              { k: "5. Lebendig", v: "Mit jeder neuen Studie aktualisieren sich Personas automatisch." },
            ].map((s) => (
              <li key={s.k} className="flex gap-4 border-b border-border pb-4">
                <span className="w-32 shrink-0 text-sm font-medium text-ink">{s.k}</span>
                <span className="text-sm text-muted-foreground">{s.v}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <CtaBlock title="Baue deine ersten" italic="Personas." body="In der Demo zeigen wir dir Personas aus einem echten Klymeo-Datensatz — und wie du deine eigenen in 2 Wochen baust." />
    </SiteShell>
  );
}
