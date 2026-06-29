import type { Metadata } from "next";
import Link from "next/link";
import { SiteShell, PageHero, CtaBlock } from "@/components/site/SiteShell";
import { ogDefaults } from "@/lib/marketing/seo";

export const metadata: Metadata = {
  title: { absolute: "Lösungen — Marktforschung mit Klymeo" },
  description: "User Research, Konzept-Test, Markenwahrnehmung, Bedarf & Verhalten — eine Engine, vier Forschungsfragen.",
  alternates: { canonical: "/loesungen" },
  openGraph: {
    ...ogDefaults,
    title: "Lösungen — Marktforschung mit Klymeo",
    description: "Eine Engine, vier Forschungsfragen: User Research, Konzept-Test, Markenwahrnehmung, Bedarf & Verhalten.",
    url: "/loesungen",
  },
};

const solutions = [
  {
    to: "/loesungen/user-research",
    tag: "Produkt & UX",
    title: "User Research",
    body: "Wie nutzen Menschen dein Produkt wirklich — und wo hakt es? Voice-Interviews mit echten Nutzer:innen, im Kontext ihrer Aufgabe.",
    mood: "listen" as const,
  },
  {
    to: "/loesungen/konzept-test",
    tag: "Innovation",
    title: "Konzept- & Kreativ-Test",
    body: "Welches Konzept zündet — und warum? Verpackungen, Claims, Spots, Landing Pages — eingebettet ins Gespräch.",
    mood: "wow" as const,
  },
  {
    to: "/loesungen/markenwahrnehmung",
    tag: "Brand",
    title: "Markenwahrnehmung",
    body: "Wofür steht deine Marke im Kopf deiner Zielgruppe? Implizite Assoziationen aus offenen Gesprächen.",
    mood: "think" as const,
  },
  {
    to: "/loesungen/bedarf-verhalten",
    tag: "Markt",
    title: "Bedarf & Verhalten",
    body: "Welche Jobs, Trigger und Hürden treiben Entscheidungen? Jobs-to-be-Done aus erster Hand.",
    mood: "scan" as const,
  },
];

const photos = [
  "/site/sol-ux.jpg",
  "/site/sol-brand.jpg",
  "/site/sol-needs.jpg",
  "/site/sol-journey.jpg",
];

export default function SolutionsIndex() {
  return (
    <SiteShell>
      <PageHero
        eyebrow="Lösungen"
        title="Eine Engine."
        italic="Vier Forschungsfragen."
        lead="Egal ob Produkt, Marke, Konzept oder Markt — Konsoul wählt die richtige Methodik. Du wählst den Use Case."
        image="/site/photo-solutions.jpg"
        imageAlt="Konzept- und Stimulus-Test mit Klymeo"
      />

      <section className="py-24">
        <div className="mx-auto grid max-w-7xl gap-6 px-6 md:grid-cols-2">
          {solutions.map((s, idx) => (
            <Link
              key={s.to}
              href={s.to}
              className="group overflow-hidden rounded-2xl border border-border bg-card transition hover:-translate-y-0.5 hover:border-ink"
            >
              <div className="aspect-[16/10] overflow-hidden border-b border-border">
                <img src={photos[idx % photos.length]} alt="" loading="lazy" className="h-full w-full object-cover transition group-hover:scale-[1.03]" />
              </div>
              <div className="p-8">
                <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">{s.tag}</p>
                <h2 className="mt-2 text-3xl">{s.title}</h2>
                <p className="mt-4 max-w-md text-sm leading-relaxed text-muted-foreground">{s.body}</p>
                <span className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-ink">
                  Ansehen <span className="transition group-hover:translate-x-1" aria-hidden>→</span>
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <CtaBlock title="Welcher Use Case passt zu" italic="dir?" body="Wir helfen dir in der Demo, die richtige Methodik zu wählen — und starten sie direkt." />
    </SiteShell>
  );
}
