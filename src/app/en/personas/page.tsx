import type { Metadata } from "next";
import { buildAlternates, ogDefaultsFor } from "@/lib/marketing/seo";
import { Konsoul } from "@/components/site/Konsoul";
import { SiteShell, PageHero, CtaBlock } from "@/components/site/SiteShell";

export const metadata: Metadata = {
  title: { absolute: "Personas — data-driven with AI · Klymeo" },
  description: "Personas distilled from real interviews: jobs-to-be-done, quotes, alive — no stereotypes, no gut feeling.",
  alternates: buildAlternates("en", "/personas"),
  openGraph: {
    ...ogDefaultsFor("en"),
    title: "Personas — data-driven with AI · Klymeo",
    description: "Personas from real interviews — with quotes, JTBD and triggers, alive and verifiable.",
    url: "/personas",
  },
};

export default function PersonasPage() {
  return (
    <SiteShell lang="en">
      <PageHero
        eyebrow="Personas"
        title="Personas that"
        italic="breathe."
        lead="No more slide personas nobody uses. Konsoul distills persona clusters from real interviews — with quotes, JTBD and triggers that update with every study."
        mood="smile"
      />

      <section className="py-24">
        <div className="mx-auto grid max-w-7xl gap-8 px-6 md:grid-cols-3">
          {[
            {
              n: "Maja, 34",
              role: "Efficiency Optimizer",
              job: "Wants to make family life 20% faster — without losing quality.",
              quote: "“I don't want to learn another app. If I don't get it in 30 seconds, I delete it.”",
              triggers: ["Sunday-evening time pressure", "Recommendation from friends"],
              hurdles: ["Privacy concerns", "Setup over 5 min."],
              mood: "think" as const,
            },
            {
              n: "Sven, 41",
              role: "Skeptical Pragmatist",
              job: "Wants solid solutions his colleagues have already deployed.",
              quote: "“Show me 3 case studies from my industry — then we'll talk.”",
              triggers: ["A competitor adopts it", "Quarterly review is coming up"],
              hurdles: ["Vendor lock-in", "Procurement process"],
              mood: "scan" as const,
            },
            {
              n: "Leo, 27",
              role: "Early Adopter",
              job: "Wants to be the first to bring the new thing into the team.",
              quote: "“I try out anything that shows up in the Slack channel — that's my currency.”",
              triggers: ["Launch on Product Hunt", "Influencer reel"],
              hurdles: ["Team buy-in", "Integration with Notion"],
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
                  <p className="font-mono uppercase tracking-widest text-muted-foreground">Triggers</p>
                  <ul className="mt-1 space-y-1">
                    {p.triggers.map((t) => (
                      <li key={t} className="text-ink">→ {t}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="font-mono uppercase tracking-widest text-muted-foreground">Hurdles</p>
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
            <p className="text-xs uppercase tracking-[0.22em] text-soul">How a persona comes to life</p>
            <h2 className="mt-3 text-4xl leading-[1.05]">
              From <span className="mark mark-pink">conversations</span>, not assumptions.
            </h2>
            <p className="mt-4 text-muted-foreground">
              Konsoul clusters interviews along jobs, triggers, hurdles and language — not along
              age and zip code. Every statement in the persona is linked to the original quote.
            </p>
          </div>
          <ol className="space-y-5">
            {[
              { k: "1. Interviews", v: "At least 30 qualitative conversations in your market." },
              { k: "2. Coding", v: "Konsoul codes JTBD, triggers, hurdles, language, substitutes." },
              { k: "3. Clustering", v: "Personas emerge data-driven (no hypothesis required)." },
              { k: "4. Verification", v: "You approve the clusters — Konsoul learns your point of view." },
              { k: "5. Alive", v: "Personas update automatically with every new study." },
            ].map((s) => (
              <li key={s.k} className="flex gap-4 border-b border-border pb-4">
                <span className="w-32 shrink-0 text-sm font-medium text-ink">{s.k}</span>
                <span className="text-sm text-muted-foreground">{s.v}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <CtaBlock lang="en" title="Build your first" italic="personas." body="In the demo, we'll show you personas from a real Klymeo dataset — and how you build your own in 2 weeks." />
    </SiteShell>
  );
}
