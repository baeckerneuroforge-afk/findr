import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Konsoul } from "@/components/site/Konsoul";
import { SiteShell, CtaBlock, DEMO_URL } from "@/components/site/SiteShell";
import { Stagger } from "@/components/site/Stagger";
import { buildAlternates, ogDefaultsFor } from "@/lib/marketing/seo";

export const metadata: Metadata = {
  title: { absolute: "Klymeo — AI-powered market research, orchestrated by Konsoul" },
  description:
    "Qualitative & quantitative studies in days: design, recruit, interview, analyze — orchestrated by Konsoul. Hosted in the EU, Frankfurt.",
  alternates: buildAlternates("en", "/"),
  openGraph: {
    ...ogDefaultsFor("en"),
    title: "Klymeo — AI-powered market research",
    description: "Konsoul orchestrates your studies. Evidenced in the transcript. Published in days.",
    url: "/en",
  },
};

export default function Landing() {
  return (
    <SiteShell lang="en">
      {/* HERO */}
      <section className="relative">
        <div
          className="absolute inset-0 dotgrid opacity-60 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]"
          aria-hidden
        />
        <div className="relative mx-auto max-w-7xl px-6 pt-20 pb-24 lg:pt-28 lg:pb-32">
          <div className="grid items-center gap-16 lg:grid-cols-[1.05fr_1fr]">
            <div>
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-soul opacity-60" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-soul" />
                </span>
                Konsoul · AI agent for market research
              </div>

              <h1 className="text-[clamp(2.6rem,5.8vw,4.8rem)] leading-[1.02] tracking-[-0.03em]">
                What your market is{" "}
                <span className="mark mark-amber">really</span> telling you.
                <br />
                Evidenced, in days.
              </h1>

              <p className="mt-7 max-w-xl text-lg leading-relaxed text-muted-foreground">
                Klymeo combines qualitative depth and quantitative scale in one platform —
                designed, conducted and analyzed by{" "}
                <span className="text-ink font-medium">Konsoul</span>, your AI research agent.
                Every finding evidenced in the transcript. Hosted in the EU, Frankfurt.
              </p>

              <div className="mt-9 flex flex-wrap items-center gap-3">
                <a
                  href={DEMO_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="group relative inline-flex items-center gap-2 overflow-hidden rounded-full bg-ink px-6 py-3.5 text-sm font-medium text-paper transition hover:scale-[1.02] hover:shadow-[0_18px_50px_-12px_oklch(0.16_0.01_260_/_0.55)]"
                >
                  <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-soul/50 to-transparent transition-transform duration-[900ms] group-hover:translate-x-full" aria-hidden />
                  <span className="relative">Book a demo with Konsoul</span>
                  <span className="relative transition group-hover:translate-x-0.5" aria-hidden>→</span>
                </a>
                <Link
                  href="/en/plattform"
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-6 py-3.5 text-sm font-medium text-ink transition hover:bg-secondary"
                >
                  Platform tour
                </Link>
              </div>

              <div className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                <span>🇪🇺 EU-hosted</span>
                <span className="h-3 w-px bg-border" />
                <span>GDPR</span>
                <span className="h-3 w-px bg-border" />
                <span>Voice & Text</span>
                <span className="h-3 w-px bg-border" />
                <span>Evidenced in the transcript</span>
              </div>
            </div>

            {/* Hero visual: photo + product chip */}
            <div className="relative">
              <div className="relative aspect-[4/5] overflow-hidden rounded-3xl border border-border bg-secondary">
                {/* Homepage LCP → preload + high fetch priority (Next 16:
                    `preload` replaces the deprecated `priority` prop). */}
                <Image
                  src="/site/photo-interview.jpg"
                  alt="Participant wearing headphones during an interview"
                  fill
                  preload
                  fetchPriority="high"
                  sizes="(max-width: 1024px) 100vw, 45vw"
                  className="object-cover kenburns"
                />
                <div className="absolute inset-x-4 bottom-4 rounded-2xl border border-border bg-card/95 p-4 backdrop-blur">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                        Live · Voice Interview
                      </p>
                      <p className="mt-1 text-sm font-medium text-ink">
                        “Tell me more — when was the last time?”
                      </p>
                    </div>
                    <span className="flex items-center gap-1.5 rounded-full bg-soul/15 px-2 py-1 text-[10px] font-medium text-ink">
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-soul" />
                      REC
                    </span>
                  </div>
                </div>
              </div>

              <div className="absolute -left-5 -top-4 hidden rotate-[-3deg] items-center gap-2 rounded-xl border border-border bg-card px-3 py-2 text-xs shadow-sm floaty sm:flex">
                <span className="text-soul">●</span> 312 interviews · 7 studies
              </div>
              <div className="absolute -bottom-4 right-6 rotate-[2deg] rounded-xl border border-border bg-ink px-3 py-2 text-xs font-medium text-paper shadow-sm drift">
                Evidenced in the transcript ✓
              </div>
            </div>

          </div>
        </div>

        {/* value ticker */}
        <div className="border-y border-border bg-secondary/40">
          <div className="mx-auto max-w-7xl overflow-hidden px-6 py-5">
            <div className="flex items-center gap-6 text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
              <span className="shrink-0">How Klymeo works</span>
              <div className="flex flex-1 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
                <div className="flex shrink-0 gap-10 pr-10 marquee">
                  {[
                    "Study in hours, not weeks",
                    "Voice & Text — adaptive",
                    "Evidenced in the transcript",
                    "Your own lists or panel",
                    "EU hosting · Frankfurt",
                    "Reports as PDF · Slides · Notion",
                    "Cross-study search",
                    "Live quotas in recruiting",
                  ].flatMap((n) => [n, n]).map((n, i) => (
                    <span key={i} className="flex items-center gap-3">
                      <span className="font-display text-base normal-case tracking-normal text-ink/80">{n}</span>
                      <span className="h-1 w-1 rounded-full bg-soul/70" />
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* MEET KONSOUL — softer, photo-led */}
      <section className="relative py-28">
        <div className="mx-auto grid max-w-7xl items-center gap-16 px-6 lg:grid-cols-[1.1fr_1fr]">
          <div className="relative">
            <div className="relative aspect-[4/5] overflow-hidden rounded-3xl border border-border bg-secondary">
              <Image
                src="/site/photo-team.jpg"
                alt="Insights team during analysis"
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover"
              />
            </div>
            <div className="absolute -bottom-6 -right-4 hidden w-56 rotate-[3deg] rounded-2xl border border-border bg-card p-4 shadow-sm sm:block">
              <div className="flex items-center gap-3">
                <Konsoul size={36} mood="smile" className="text-ink" />
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                    Konsoul
                  </p>
                  <p className="text-xs text-ink">Synthesis running · 84%</p>
                </div>
              </div>
            </div>
            <div className="absolute -left-4 top-6 hidden w-44 -rotate-[4deg] rounded-2xl border border-border bg-paper p-3 shadow-sm sm:block">
              <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Theme · cluster 03
              </p>
              <p className="mt-1 text-xs text-ink">“Onboarding feels overwhelming.”</p>
            </div>
          </div>

          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-soul">The agent behind the scenes</p>
            <h2 className="mt-4 text-5xl leading-[1.05]">
              People talk. <span className="mark mark-pink">Konsoul</span> listens.
            </h2>
            <p className="mt-6 max-w-lg text-muted-foreground leading-relaxed">
              Konsoul is the orchestration module for your research — it plans studies,
              coordinates recruiting, conducts interviews, and distills them into themes. You
              stay the insights lead. Konsoul does the work.
            </p>

            <Stagger as="ul" step={90} className="mt-8 space-y-4">
              {[
                { k: "Plans", v: "Guide, sample, stimuli — from one sentence of briefing." },
                { k: "Conducts", v: "Voice and text interviews with real follow-up questions." },
                { k: "Evidences", v: "Every statement traceable back to the transcript." },
                { k: "Learns", v: "Gets sharper on your methodology with every study." },
              ].map((i) => (
                <li key={i.k} className="flex gap-4 border-b border-border pb-4 transition hover:border-ink">
                  <span className="w-24 shrink-0 text-sm font-medium text-ink">{i.k}</span>
                  <span className="text-sm text-muted-foreground">{i.v}</span>
                </li>
              ))}
            </Stagger>

            <div className="mt-8">
              <Link
                href="/en/konsoul"
                className="inline-flex items-center gap-2 text-sm font-medium text-ink underline-offset-4 hover:underline"
              >
                Konsoul in detail →
              </Link>
            </div>
          </div>
        </div>
      </section>



      {/* WORKFLOW */}
      <section className="relative border-y border-border bg-secondary/40 py-28">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-xl">
              <p className="text-xs uppercase tracking-[0.22em] text-soul">Workflow</p>
              <h2 className="mt-3 text-5xl leading-[1.05]">
                Five steps. <span className="mark mark-sky">One platform.</span>
              </h2>
            </div>
            <p className="max-w-sm text-sm text-muted-foreground">
              Konsoul takes on the methodology work. You stay the insights lead — faster, with no tool-switching.
            </p>
          </div>

          <Stagger step={100} className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-5">
            {[
              { n: "01", title: "Design", body: "Brief → guide, screener, stimuli.", mood: "think" as const },
              { n: "02", title: "Recruit", body: "Your own list or panel — DE/EN.", mood: "scan" as const },
              { n: "03", title: "Interview", body: "Voice & Text, in parallel, 24/7.", mood: "listen" as const },
              { n: "04", title: "Analyze", body: "Themes, personas, synthesis — evidenced.", mood: "wow" as const },
              { n: "05", title: "Share", body: "PDF, Slides, Notion, Cross-Study Agent.", mood: "smile" as const },
            ].map((s) => (
              <article key={s.n} className="group bg-card p-6 transition hover:bg-paper">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-muted-foreground">{s.n}</span>
                  <Konsoul
                    size={36}
                    mood={s.mood}
                    className="text-ink transition group-hover:-translate-y-1"
                  />
                </div>
                <h3 className="mt-5 text-xl">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
              </article>
            ))}
          </Stagger>
        </div>
      </section>

      {/* SOLUTIONS */}
      <section className="py-28">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-14 flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-xl">
              <p className="text-xs uppercase tracking-[0.22em] text-soul">Solutions</p>
              <h2 className="mt-3 text-5xl leading-[1.05]">
                One engine. <span className="mark mark-lilac">Four research questions.</span>
              </h2>
            </div>
            <Link
              href="/en/loesungen"
              className="text-sm font-medium text-ink underline-offset-4 hover:underline"
            >
              All solutions →
            </Link>
          </div>
          <Stagger step={90} className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                to: "/en/loesungen/user-research",
                tag: "Product & UX",
                title: "User Research",
                body: "How do people use your product — and where does it get stuck?",
              },
              {
                to: "/en/loesungen/konzept-test",
                tag: "Innovation",
                title: "Concept & Creative Test",
                body: "Which concept lands — and more importantly, why?",
              },
              {
                to: "/en/loesungen/markenwahrnehmung",
                tag: "Brand",
                title: "Brand Perception",
                body: "What does your brand stand for in your audience's mind?",
              },
              {
                to: "/en/loesungen/bedarf-verhalten",
                tag: "Market",
                title: "Needs & Behavior",
                body: "What jobs, triggers and barriers drive decisions?",
              },
            ].map((s) => (
              <Link
                key={s.to}
                href={s.to}
                className="group rounded-2xl border border-border bg-card p-7 transition hover:-translate-y-1 hover:border-ink hover:shadow-[0_24px_50px_-28px_oklch(0.16_0.01_260/0.35)]"
              >
                <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                  {s.tag}
                </p>
                <h3 className="mt-3 text-2xl">{s.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
                <span className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-ink">
                  View{" "}
                  <span className="transition group-hover:translate-x-1.5" aria-hidden>
                    →
                  </span>
                </span>
              </Link>
            ))}
          </Stagger>
        </div>
      </section>

      {/* FEATURES */}
      <section className="border-t border-border py-28">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-14 max-w-2xl">
            <p className="text-xs uppercase tracking-[0.22em] text-soul">Platform</p>
            <h2 className="mt-3 text-5xl leading-[1.05]">
              The depth of an interview. <span className="mark mark-amber">The speed of a survey.</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-6 md:grid-rows-2">
            <div className="md:col-span-4 md:row-span-2 rounded-2xl border border-border bg-ink p-8 text-paper">
              <div className="flex h-full flex-col justify-between gap-8">
                <div>
                  <span className="font-mono text-[11px] uppercase tracking-widest text-paper/60">
                    Live Voice · Cross-Study
                  </span>
                  <h3 className="mt-3 text-3xl">
                    AI that <span className="mark mark-pink">follows up</span>.
                  </h3>
                  <p className="mt-3 max-w-md text-sm text-paper/70">
                    Konsoul orchestrates the conversation in real time — choosing follow-ups,
                    spotting contradictions, and distilling evidenced themes.
                  </p>
                </div>
                <div className="space-y-2">
                  <div className="rounded-xl bg-paper/10 px-4 py-3 text-sm">
                    <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-paper/50">
                      Konsoul
                    </p>
                    “Tell me more — when did you last experience that?”
                  </div>
                  <div className="ml-10 rounded-xl bg-paper/10 px-4 py-3 text-sm">
                    “Last Tuesday, while shopping with the kids…”
                  </div>
                  <div className="rounded-xl bg-soul/20 px-4 py-3 text-sm text-paper">
                    <p className="mb-1 font-mono text-[10px] uppercase tracking-widest text-paper/60">
                      Konsoul · Follow-up
                    </p>
                    “Interesting — was it more about the price or the selection?”
                  </div>
                </div>
              </div>
            </div>

            <div className="md:col-span-2 rounded-2xl border border-border bg-card p-6">
              <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                EU & GDPR
              </p>
              <h3 className="mt-2 text-xl">Hosted in Frankfurt</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Data stays in the EU. Never shared with model providers for training.
              </p>
            </div>

            <div className="md:col-span-2 rounded-2xl border border-border bg-card p-6">
              <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                Auto-Report
              </p>
              <h3 className="mt-2 text-xl">PDF · Slides · Notion</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Konsoul delivers shareable stories from every study — in one click.
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            {[
              { t: "Evidenced in the transcript", b: "Every statement shows the exact quote." },
              { t: "Voice & Text", b: "The format your audience actually uses." },
              { t: "Study in 24h", b: "From briefing to first insight." },
            ].map((c) => (
              <div key={c.t} className="rounded-2xl border border-border bg-card p-6">
                <h3 className="text-lg">{c.t}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{c.b}</p>
              </div>
            ))}
          </div>

          <div className="mt-10">
            <Link
              href="/en/plattform"
              className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-5 py-2.5 text-sm font-medium text-ink transition hover:bg-secondary"
            >
              See all modules →
            </Link>
          </div>
        </div>
      </section>

      {/* PROOF — replaces fake testimonials */}
      <section className="border-y border-border bg-secondary/40 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid items-end gap-10 md:grid-cols-[1.2fr_1fr]">
            <h2 className="text-4xl md:text-5xl leading-[1.05]">
              Classic market research, <span className="mark mark-mint">recalculated.</span>
            </h2>
            <p className="text-muted-foreground md:text-right">
              Comparison figures from projects run through Klymeo — measured against the
              classic setup with an agency, recruiting, and manual analysis.
            </p>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-3">
            {[
              { k: "Time-to-insight", v: "3–5", u: "days", note: "instead of 4–6 weeks — from briefing to evidenced report.", img: "/site/photo-portrait-1.jpg" },
              { k: "Cost structure", v: "−70", u: "%", note: "compared to classic agency research of the same depth.", img: "/site/photo-portrait-2.jpg" },
              { k: "Evidence rate", v: "100", u: "%", note: "every statement in the report links to the original transcript.", img: "/site/photo-portrait-3.jpg" },
            ].map((s, i) => (
              <article
                key={s.k}
                className="group overflow-hidden rounded-2xl border border-border bg-card opacity-0 [animation:fade-in_.7s_ease-out_forwards]"
                style={{ animationDelay: `${i * 120}ms` }}
              >
                <div className="relative aspect-[5/4] overflow-hidden bg-secondary">
                  <Image
                    src={s.img}
                    alt=""
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="object-cover transition-transform duration-[1200ms] ease-out group-hover:scale-[1.04]"
                  />
                </div>
                <div className="p-7">
                  <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                    {s.k}
                  </p>
                  <p className="mt-3 flex items-baseline gap-2">
                    <span className="font-display text-6xl leading-none text-ink">{s.v}</span>
                    <span className="text-lg text-muted-foreground">{s.u}</span>
                  </p>
                  <p className="mt-5 border-t border-border pt-4 text-sm text-muted-foreground">
                    {s.note}
                  </p>
                </div>
              </article>
            ))}
          </div>

          <p className="mt-10 max-w-2xl text-xs text-muted-foreground">
            Figures are based on internal comparison runs across qualitative and quantitative
            studies. We're happy to share concrete references in conversation — rather than
            anonymized quotes.
          </p>
        </div>
      </section>



      <CtaBlock
        lang="en"
        title="Let your market"
        italic="speak."
        body="30-minute demo. Real data from your use case. You'll leave with a study idea Konsoul can kick off right away."
      />
    </SiteShell>
  );
}
