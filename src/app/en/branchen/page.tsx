import type { Metadata } from "next";
import Link from "next/link";
import { buildAlternates, ogDefaultsFor } from "@/lib/marketing/seo";
import { SiteShell, PageHero, CtaBlock } from "@/components/site/SiteShell";
import { Stagger } from "@/components/site/Stagger";

export const metadata: Metadata = {
  title: { absolute: "Industries — Market research with Klymeo" },
  description: "Consumer goods, FinTech, Pharma, Automotive, Retail, B2B SaaS, Media — Klymeo works across industries, EU-compliant.",
  alternates: buildAlternates("en", "/branchen"),
  openGraph: {
    ...ogDefaultsFor("en"),
    title: "Industries — Market research with Klymeo",
    description: "FMCG, SaaS, FinTech, Pharma, Automotive, Retail, Media & Energy — industry-agnostic and EU-compliant.",
    url: "/branchen",
  },
};

const industries = [
  {
    n: "Consumer Goods & FMCG",
    body: "Packaging, claim tests, pre-launch concepts and buyer journeys — voice interviews at the point of sale or at home.",
    cases: ["Packaging variant", "NPD concept screening", "Buyer-type study"],
  },
  {
    n: "B2B SaaS",
    body: "Buyer personas, win/loss interviews, onboarding friction, feature validation with real power users.",
    cases: ["Win/loss analysis", "ICP validation", "Pricing sensitivity"],
  },
  {
    n: "FinTech & Banking",
    body: "Trust drivers, switching barriers, regulatorily sensitive language — GDPR-first.",
    cases: ["Account-switch study", "App onboarding", "Brand trust"],
  },
  {
    n: "Pharma & Healthcare",
    body: "Patient journeys, HCP insights, adherence research — anonymous, ethical, with consent before the first word.",
    cases: ["Patient journey", "HCP consultation", "Treatment adherence"],
  },
  {
    n: "Automotive & Mobility",
    body: "Buyer triggers, e-mobility acceptance, in-car UX, brand image in transition.",
    cases: ["EV acceptance", "Dealership experience", "Connected services"],
  },
  {
    n: "Retail & E-Commerce",
    body: "Cart-abandonment stories, loyalty drivers, assortment tests, in-store experience.",
    cases: ["Cart-drop reasons", "Loyalty mechanics", "Click-&-collect UX"],
  },
  {
    n: "Media & Entertainment",
    body: "Format tests, audience insights, streaming behavior, ad tolerance.",
    cases: ["Pilot-episode test", "Subscription drivers", "Ad tolerance"],
  },
  {
    n: "Mobility & Energy",
    body: "Tariff comprehension, acceptance of new energy sources, willingness to switch.",
    cases: ["Tariff comprehension test", "Switch triggers", "Smart-meter study"],
  },
];

export default function IndustriesPage() {
  return (
    <SiteShell lang="en">
      <PageHero
        eyebrow="Industries"
        title="For every industry that"
        italic="takes its audience seriously."
        lead="Klymeo is industry-agnostic — and specialized enough to properly serve regulatorily sensitive fields like pharma or finance."
        image="/site/photo-industry.jpg"
        imageAlt="Cross-industry market research"
      />

      <section className="py-24">
        <Stagger step={70} className="mx-auto grid max-w-7xl gap-6 px-6 md:grid-cols-2 lg:grid-cols-4">
          {industries.map((i, idx) => {
            const photos = [
              "/site/photo-ind-fmcg.jpg",
              "/site/photo-ind-saas.jpg",
              "/site/photo-ind-fintech.jpg",
              "/site/photo-ind-pharma.jpg",
              "/site/photo-ind-auto.jpg",
              "/site/photo-ind-retail.jpg",
              "/site/photo-ind-media.jpg",
              "/site/photo-ind-energy.jpg",
            ];
            return (
              <article key={i.n} className="group overflow-hidden rounded-2xl border border-border bg-card transition hover:-translate-y-1 hover:border-ink hover:shadow-[0_24px_50px_-28px_oklch(0.16_0.01_260/0.35)]">
                <div className="aspect-[4/3] overflow-hidden border-b border-border">
                  <img src={photos[idx]} alt={i.n} loading="lazy" className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.05]" />
                </div>
                <div className="p-6">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Industry</span>
                  <h2 className="mt-3 text-xl">{i.n}</h2>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{i.body}</p>
                  <ul className="mt-4 space-y-1 text-xs text-ink">
                    {i.cases.map((c) => (
                      <li key={c} className="flex items-center gap-1.5">
                        <span className="h-1 w-1 rounded-full bg-soul" /> {c}
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            );
          })}
        </Stagger>
      </section>

      <section className="border-y border-border bg-secondary/40 py-20">
        <div className="mx-auto flex max-w-5xl flex-col items-start gap-6 px-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-3xl leading-[1.1]">Don't see your industry?</h2>
            <p className="mt-2 text-muted-foreground">Konsoul is method-neutral — we adapt the language, the sample and the stimuli.</p>
          </div>
          <Link href="/en/kontakt" className="rounded-full bg-ink px-6 py-3.5 text-sm font-medium text-paper hover:opacity-90">Talk to us →</Link>
        </div>
      </section>

      <CtaBlock lang="en" title="One methodology, every" italic="industry." />
    </SiteShell>
  );
}
