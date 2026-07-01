import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Konsoul } from "@/components/site/Konsoul";
import { SiteShell, PageHero, CtaBlock } from "@/components/site/SiteShell";
import { Stagger } from "@/components/site/Stagger";
import { buildAlternates, ogDefaultsFor } from "@/lib/marketing/seo";

export const metadata: Metadata = {
  title: { absolute: "Platform — All of Klymeo's modules" },
  description:
    "Study design, recruiting, voice & text interviews, stimulus engine, synthesis, personas, cross-study, reporting — every module of the Klymeo platform.",
  alternates: buildAlternates("en", "/plattform"),
  openGraph: {
    ...ogDefaultsFor("en"),
    title: "Platform — All of Klymeo's modules",
    description: "Eight modules: Design, Recruiting, Interviews, Stimulus, Synthesis, Personas, Cross-Study, Reporting.",
    url: "/en/plattform",
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
    title: "Study Designer",
    body: "Your briefing becomes a discussion guide with laddering logic, a screener and stimuli. Methodically sound, with a rationale for every question.",
    bullets: ["Guide generator", "Screener with quotas", "Stimulus library", "12+ study types"],
    mood: "think",
    image: "/site/plat-design.jpg",
    quip: "I suggest a question order — you decide.",
  },
  {
    n: "02",
    tag: "Recruiting",
    title: "Sample & Panel",
    body: "Your own distribution lists, customer lists, or panel integration. Deduplicated, live quotas, reminders sent automatically.",
    bullets: ["Your own list · CSV", "Panel integration", "Live quota monitoring", "Anonymous links"],
    mood: "scan",
    image: "/site/plat-recruit.jpg",
    quip: "I reach your audience — and keep an eye on quotas.",
  },
  {
    n: "03",
    tag: "Interview",
    title: "Voice & Text Engine",
    body: "Participants speak or type — their choice. Moderated, probed further, with the order adapted dynamically.",
    bullets: ["Live voice (DE/EN)", "Adaptive follow-ups", "Saturation detection", "Pause & resume"],
    mood: "listen",
    image: "/site/plat-interview.jpg",
    quip: "This is where I dig deeper — politely, but persistently.",
  },
  {
    n: "04",
    tag: "Stimulus",
    title: "Live Creative Test",
    body: "Packaging, concept, landing page or ad — embedded right in the interview, shown at exactly the right moment.",
    bullets: ["Image · video · web", "A/B in conversation", "Click tracks", "Reactions in the transcript"],
    mood: "wow",
    image: "/site/plat-stimulus.jpg",
    quip: "I show stimuli at the exact moment they land.",
  },
  {
    n: "05",
    tag: "Analysis",
    title: "Synthesis Engine",
    body: "Coding, theme clustering, sentiment from wording (never vocal affect). Every statement linked to the transcript.",
    bullets: ["Theme clustering", "Evidenced quotes", "Sentiment from wording", "Excel · CSV export"],
    mood: "scan",
    image: "/site/plat-synthese.jpg",
    quip: "I distill — and evidence every statement.",
  },
  {
    n: "06",
    tag: "Personas",
    title: "Persona Builder",
    body: "Persona clusters are distilled directly from the interviews — not from stereotypes, but from real jobs-to-be-done.",
    bullets: ["Data-driven", "JTBD logic", "With quotes", "Alive per study"],
    mood: "smile",
    image: "/site/plat-personas.jpg",
    quip: "Real people, not clichés.",
  },
  {
    n: "07",
    tag: "Cross-Study",
    title: "Ask Konsoul",
    body: "Ask across your whole portfolio: “In how many studies does onboarding frustration show up?” Only relevant sources are loaded, and counted exactly.",
    bullets: ["Natural language", "Evidenced with sources", "Study comparison", "Slack & Notion"],
    mood: "think",
    image: "/site/plat-cross.jpg",
    quip: "Ask me across all of your studies.",
  },
  {
    n: "08",
    tag: "Reporting",
    title: "Auto-Report",
    body: "Shareable stories from every study — as PDF, slides, or a Notion page. Quotes are clickable straight to the audio moment.",
    bullets: ["PDF & PPT", "Notion · Slack · Miro", "Custom branding", "Snippet export"],
    mood: "smile",
    image: "/site/plat-report.jpg",
    quip: "One click — and the story is ready.",
  },
];

export default function PlatformPage() {
  return (
    <SiteShell lang="en">
      <PageHero
        eyebrow="Platform"
        title="One platform. Eight"
        italic="modules."
        lead="Klymeo is an end-to-end system for AI-powered qualitative market research — from briefing to side-by-side analysis across your entire study archive."
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
          <p className="text-xs uppercase tracking-[0.22em] text-soul">In comparison</p>
          <h2 className="mt-3 text-4xl md:text-5xl leading-[1.05]">
            Why <span className="mark mark-amber">Klymeo?</span>
          </h2>

          <div className="mt-10 overflow-hidden rounded-2xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-secondary/60 text-left text-xs uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="px-6 py-4 font-medium">Criterion</th>
                  <th className="px-6 py-4 font-medium">Klymeo</th>
                  <th className="px-6 py-4 font-medium">Others</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[
                  ["Voice & Text-first", "Both, one flow", "Usually text only"],
                  ["Stimulus live in conversation", "Yes", "Upfront or not at all"],
                  ["Languages (end-to-end)", "German & English", "Often English only"],
                  ["EU data residency", "Frankfurt", "—"],
                  ["Affect tracking", "Deliberately no", "Gray area"],
                  ["Cross-study agent", "Yes", "—"],
                  ["Evidenced themes", "100% from the transcript", "Generic summary"],
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
          <h3 className="text-2xl">Want to see more?</h3>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/en/methoden"
              className="rounded-full border border-border bg-card px-5 py-2.5 text-sm font-medium text-ink hover:bg-secondary"
            >
              Methods in detail →
            </Link>
            <Link
              href="/en/loesungen"
              className="rounded-full border border-border bg-card px-5 py-2.5 text-sm font-medium text-ink hover:bg-secondary"
            >
              Solutions by use case →
            </Link>
            <Link
              href="/en/preise"
              className="rounded-full border border-border bg-card px-5 py-2.5 text-sm font-medium text-ink hover:bg-secondary"
            >
              Pricing →
            </Link>
          </div>
        </div>
      </section>

      <CtaBlock
        lang="en"
        title="See the modules"
        italic="in action."
        body="In the demo, a mini-study runs live — you'll see all eight modules at work in under 30 minutes."
      />
    </SiteShell>
  );
}
