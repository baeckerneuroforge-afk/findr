import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { buildAlternates, ogDefaultsFor } from "@/lib/marketing/seo";
import { SiteShell, PageHero, CtaBlock } from "@/components/site/SiteShell";
import { Stagger } from "@/components/site/Stagger";

export const metadata: Metadata = {
  title: { absolute: "Branchen — Marktforschung mit Klymeo" },
  description: "Konsumgüter, FinTech, Pharma, Auto, Retail, B2B-SaaS, Pharma, Media — Klymeo arbeitet branchenagnostisch und EU-konform.",
  alternates: buildAlternates("de", "/branchen"),
  openGraph: {
    ...ogDefaultsFor("de"),
    title: "Branchen — Marktforschung mit Klymeo",
    description: "FMCG, SaaS, FinTech, Pharma, Automotive, Retail, Media & Energy — branchenagnostisch und EU-konform.",
    url: "/branchen",
  },
};

const industries = [
  {
    n: "Konsumgüter & FMCG",
    body: "Verpackung, Claim-Tests, Pre-Launch-Konzepte und Käuferreise — Voice-Interviews am POS oder zu Hause.",
    cases: ["Verpackungs-Variante", "NPD-Konzept-Screening", "Käufertypen-Studie"],
  },
  {
    n: "B2B-SaaS",
    body: "Buyer-Personas, Win/Loss-Interviews, Onboarding-Friction, Feature-Validierung mit echten Power-Usern.",
    cases: ["Win/Loss-Analyse", "ICP-Validation", "Pricing-Sensitivität"],
  },
  {
    n: "FinTech & Banking",
    body: "Vertrauens-Treiber, Switching-Barrieren, regulatorisch sensible Sprache — DSGVO-first.",
    cases: ["Konto-Switch-Studie", "App-Onboarding", "Marken-Vertrauen"],
  },
  {
    n: "Pharma & Healthcare",
    body: "Patient Journeys, HCP-Insights, Adherence-Forschung — anonym, ethisch, mit Einwilligung vor dem ersten Wort.",
    cases: ["Patient-Journey", "HCP-Beratung", "Therapie-Adherence"],
  },
  {
    n: "Automotive & Mobility",
    body: "Käufer-Trigger, E-Mobility-Akzeptanz, In-Car-UX, Brand-Image im Wandel.",
    cases: ["E-Auto-Akzeptanz", "Händler-Erlebnis", "Connected-Services"],
  },
  {
    n: "Retail & E-Commerce",
    body: "Cart-Abandonment-Stories, Loyalty-Treiber, Sortiments-Tests, Filialerlebnis.",
    cases: ["Cart-Drop-Reasons", "Loyalty-Mechanik", "Click-&-Collect-UX"],
  },
  {
    n: "Media & Entertainment",
    body: "Format-Tests, Audience-Insights, Streaming-Verhalten, Werbe-Akzeptanz.",
    cases: ["Pilot-Folge-Test", "Subscription-Treiber", "Werbe-Toleranz"],
  },
  {
    n: "Mobility & Energy",
    body: "Tarif-Verständnis, Akzeptanz neuer Energiequellen, Wechsel-Bereitschaft.",
    cases: ["Tarif-Verständnis-Test", "Wechsel-Trigger", "Smart-Meter-Studie"],
  },
];

export default function IndustriesPage() {
  return (
    <SiteShell>
      <PageHero
        eyebrow="Branchen"
        title="Für jede Branche, die"
        italic="ihre Zielgruppe ernst nimmt."
        lead="Klymeo ist branchenagnostisch — und gleichzeitig spezialisiert genug, um regulatorisch sensible Bereiche wie Pharma oder Finance sauber zu bedienen."
        image="/site/photo-industry.jpg"
        imageAlt="Branchenübergreifende Marktforschung"
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
                <div className="relative aspect-[4/3] overflow-hidden border-b border-border">
                  <Image src={photos[idx]} alt={i.n} fill sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 25vw" className="object-cover transition duration-700 group-hover:scale-[1.05]" />
                </div>
                <div className="p-6">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">Branche</span>
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
            <h2 className="text-3xl leading-[1.1]">Deine Branche fehlt?</h2>
            <p className="mt-2 text-muted-foreground">Konsoul ist methodenneutral — wir passen die Sprache, das Sample und die Stimuli an.</p>
          </div>
          <Link href="/kontakt" className="rounded-full bg-ink px-6 py-3.5 text-sm font-medium text-paper hover:opacity-90">Sprich mit uns →</Link>
        </div>
      </section>

      <CtaBlock title="Eine Methodik, jede" italic="Branche." />
    </SiteShell>
  );
}
