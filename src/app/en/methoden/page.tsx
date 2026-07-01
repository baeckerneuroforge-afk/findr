import type { Metadata } from "next";
import { buildAlternates, ogDefaultsFor, jsonLdHtml } from "@/lib/marketing/seo";
import { SiteShell, PageHero, CtaBlock } from "@/components/site/SiteShell";
import { Stagger } from "@/components/site/Stagger";

const faqs = [
  { q: "Does Klymeo replace classic focus groups?", a: "It doesn't replace listening, it scales it: hundreds of in-depth interviews in parallel, with the nuance surveys miss." },
  { q: "Which languages are supported?", a: "German and English end-to-end — from recruiting to the report. Additional languages on request." },
  { q: "How long does a study take?", a: "Setup in minutes. First interviews live within 24 hours. Evidenced synthesis in 3–7 days." },
  { q: "Who recruits the participants?", a: "You use your own list, customer pool, or our panel integration — GDPR-compliant." },
  { q: "How does Klymeo handle privacy?", a: "GDPR-first: EU hosting in Frankfurt, AI disclosure & consent before the first interaction, no biometric affect tracking." },
  { q: "Can I control the methodology myself?", a: "Yes. You approve the guide, sample and synthesis. Konsoul does the methodology work — you stay the insights lead." },
];

export const metadata: Metadata = {
  title: { absolute: "Methods — Voice, Text, Stimulus, Cross-Study · Klymeo" },
  description: "Voice interviews, text interviews, stimulus tests, diary studies, cross-study analyses — every method Klymeo orchestrates.",
  alternates: buildAlternates("en", "/methoden"),
  openGraph: {
    ...ogDefaultsFor("en"),
    title: "Methods — Voice, Text, Stimulus, Cross-Study · Klymeo",
    description: "Six methods, one agent: Voice, Text, Stimulus, Diary, Critical Incident, Cross-Study.",
    url: "/methoden",
  },
};

const methods = [
  {
    n: "Voice Interview",
    body: "Speak freely, at your own pace. Konsoul moderates, probes further, detects saturation — deliberately without vocal affect tracking.",
    when: "Deep insights, emotional topics, high comfort for participants.",
    photo: "/site/photo-interview.jpg",
    alt: "Person in a voice interview",
  },
  {
    n: "Text Interview",
    body: "Asynchronous, written, with Konsoul follow-ups. Ideal for sensitive topics or noisy environments.",
    when: "Sensitive topics, B2B settings, a written comfort zone.",
    photo: "/site/photo-text-chat.jpg",
    alt: "Hands typing on a laptop",
  },
  {
    n: "Stimulus Test (Live Creative)",
    body: "Packaging, concept, video, landing page — embedded in the conversation. Reaction before rationalization.",
    when: "Concept selection, packaging variants, ad cuts.",
    photo: "/site/photo-stimulus.jpg",
    alt: "Smartphone showing a product mockup",
  },
  {
    n: "Diary Study (light)",
    body: "Multiple interview rounds over several days. On day three, Konsoul asks what's changed since day one.",
    when: "Usage behavior, routines, purchase journeys.",
    photo: "/site/photo-diary.jpg",
    alt: "Open notebook with diary entries",
  },
  {
    n: "Critical Incident Technique",
    body: "Konsoul has a specific incident told chronologically — what happened before, after, what almost went differently?",
    when: "Switch triggers, pain points, last-mile friction.",
    photo: "/site/photo-incident.jpg",
    alt: "Sticky-note timeline on a wall",
  },
  {
    n: "Cross-Study Analysis",
    body: "Ask Konsoul: portfolio-wide questions across your entire study archive, always with source evidence.",
    when: "Strategy workshops, knowledge synthesis, insight reviews.",
    photo: "/site/photo-cross-study.jpg",
    alt: "Several study reports on a desk",
  },
];

export default function MethodsPage() {
  return (
    <SiteShell lang="en">
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
        eyebrow="Methods"
        title="Six methods,"
        italic="one agent."
        lead="Konsoul chooses the methodology to fit the research question — or you choose it deliberately. Here's an overview of what's possible."
        image="/site/photo-method.jpg"
        imageAlt="Voice interview with Klymeo"
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
                  <span className="font-medium">When it fits:</span> {m.when}
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
            Frequently asked <span className="mark mark-amber">questions</span>
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

      <CtaBlock lang="en" title="Which methodology fits" italic="your question?" body="In the demo, we'll show you on your own use case which methodology Konsoul recommends." />
    </SiteShell>
  );
}
