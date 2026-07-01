import type { Metadata } from "next";
import Link from "next/link";
import { SiteShell, PageHero, CtaBlock } from "@/components/site/SiteShell";
import { buildAlternates, ogDefaultsFor } from "@/lib/marketing/seo";

export const metadata: Metadata = {
  title: { absolute: "Solutions — Market research with Klymeo" },
  description: "User Research, Concept Test, Brand Perception, Needs & Behavior — one engine, four research questions.",
  alternates: buildAlternates("en", "/loesungen"),
  openGraph: {
    ...ogDefaultsFor("en"),
    title: "Solutions — Market research with Klymeo",
    description: "One engine, four research questions: User Research, Concept Test, Brand Perception, Needs & Behavior.",
    url: "/loesungen",
  },
};

const solutions = [
  {
    to: "/en/loesungen/user-research",
    tag: "Product & UX",
    title: "User Research",
    body: "How do people really use your product — and where does it get stuck? Voice interviews with real users, in the context of their task.",
    mood: "listen" as const,
  },
  {
    to: "/en/loesungen/konzept-test",
    tag: "Innovation",
    title: "Concept & Creative Test",
    body: "Which concept lands — and why? Packaging, claims, ads, landing pages — embedded right in the conversation.",
    mood: "wow" as const,
  },
  {
    to: "/en/loesungen/markenwahrnehmung",
    tag: "Brand",
    title: "Brand Perception",
    body: "What does your brand stand for in your audience's mind? Implicit associations from open conversations.",
    mood: "think" as const,
  },
  {
    to: "/en/loesungen/bedarf-verhalten",
    tag: "Market",
    title: "Needs & Behavior",
    body: "What jobs, triggers and barriers drive decisions? Jobs-to-be-done, first-hand.",
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
    <SiteShell lang="en">
      <PageHero
        eyebrow="Solutions"
        title="One engine."
        italic="Four research questions."
        lead="Whether it's product, brand, concept or market — Konsoul picks the right methodology. You pick the use case."
        image="/site/photo-solutions.jpg"
        imageAlt="Concept and stimulus testing with Klymeo"
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
                  View <span className="transition group-hover:translate-x-1" aria-hidden>→</span>
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <CtaBlock lang="en" title="Which use case fits" italic="you?" body="We'll help you choose the right methodology in the demo — and start it right away." />
    </SiteShell>
  );
}
