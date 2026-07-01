import type { Metadata } from "next";
import Link from "next/link";
import { SiteShell, PageHero, CtaBlock } from "@/components/site/SiteShell";
import { buildAlternates, ogDefaultsFor, jsonLdHtml, SITE_URL } from "@/lib/marketing/seo";

const PATH = "/blog/ki-marktforschung-einsatz";

export const metadata: Metadata = {
  title: { absolute: "How to Use AI for Market Research — A Practical Guide (2026)" },
  description:
    "Step-by-step guide: how to use AI in market research — from briefing through conversational interviews to an evidenced report. With best practices, pitfalls, and use cases.",
  alternates: buildAlternates("en", PATH),
  openGraph: {
    ...ogDefaultsFor("en"),
    title: "How to Use AI for Market Research",
    description:
      "From briefing to evidenced report: how AI combines qualitative depth and automated synthesis in one workflow.",
    url: PATH,
  },
};

const FAQS: { q: string; a: string }[] = [
  {
    q: "Which market research tasks can AI genuinely take over today?",
    a: "Study design (guide, screener, hypotheses), recruiting from verified panels, conversational interview moderation, transcription, qualitative clustering, quantitative analysis, and reporting with source links. The decision on research objective, sampling strategy, and stakeholder communication stays with the human.",
  },
  {
    q: "Do I lose qualitative depth if I let AI moderate interviews?",
    a: "Not if the AI works conversationally — that is, it asks targeted follow-up questions on interesting answers instead of just ticking off questions. In studies, we often see AI interviews generate more openness than a human moderator, because respondents don't have social-desirability reflexes.",
  },
  {
    q: "How do I make sure AI insights are reliable?",
    a: "Three levers: (1) Real respondents from verified panels, not simulated personas. (2) Every finding in the report must link to the original quote. (3) Explicitly document sample size and selection criteria — just like in classic research.",
  },
  {
    q: "Where's the best place to start with AI in market research?",
    a: "Pick a recurring, well-standardizable study — a UX test, concept test, or NPS wave. Run it once classically and once with an AI platform, in parallel. Compare time-to-insight, cost, and depth of findings. That builds internal trust before you migrate more complex studies.",
  },
];

const STEPS = [
  {
    n: "01",
    title: "Sharpen the research question",
    body: "Before you open any tool: what decision depends on the result? Who's the stakeholder? Which audience? An AI platform accelerates everything — including the wrong question.",
  },
  {
    n: "02",
    title: "Choose the method and sample",
    body: "In-depth qualitative interview, concept test with stimuli, quantitative tracker? Let the AI build the guide from your briefing and review it, instead of starting from zero yourself.",
  },
  {
    n: "03",
    title: "Recruit from verified panels",
    body: "Define sample criteria, activate the panel. A good AI platform delivers in hours what classic institutes take weeks to achieve — with comparable quota control.",
  },
  {
    n: "04",
    title: "Let it interview conversationally",
    body: "The AI moderates the interview, follows up on interesting statements, sticks to the guide. You watch the first sessions live and refine the prompt if needed.",
  },
  {
    n: "05",
    title: "Analyze anchored to the original quote",
    body: "Cluster analysis, sentiment, theme heatmap — automatically generated, but every finding links to the original spot in the transcript. That keeps every statement verifiable.",
  },
  {
    n: "06",
    title: "Report and decide",
    body: "Executive summary, detailed findings, recommendations — as a slide, Notion page, or API. Stakeholders click straight from the insight into the original quote. Trust comes from evidence.",
  },
];

export default function AiUsageGuide() {
  return (
    <SiteShell lang="en">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdHtml({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: "How to Use AI for Market Research",
            description:
              "A practical guide to using AI in market research — from study design to reporting.",
            author: { "@type": "Organization", name: "Klymeo" },
            publisher: { "@type": "Organization", name: "Klymeo" },
            mainEntityOfPage: `${SITE_URL}${PATH}`,
            inLanguage: "en-US",
          }),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdHtml({
            "@context": "https://schema.org",
            "@type": "FAQPage",
            mainEntity: FAQS.map((f) => ({
              "@type": "Question",
              name: f.q,
              acceptedAnswer: { "@type": "Answer", text: f.a },
            })),
          }),
        }}
      />

      <PageHero
        eyebrow="Practical Guide"
        title="How to Use AI for"
        italic="Market Research"
        lead="From a classic setup to an AI-augmented workflow: how to combine qualitative depth and automated synthesis in six steps — without losing reliability."
        image="/site/blog-ki-marktforschung.jpg"
        imageAlt="Researcher with a laptop and an insight wall"
      />

      <article className="mx-auto max-w-3xl px-6 py-20 prose-klymeo">
        <nav className="mb-12 rounded-2xl border border-border bg-secondary/40 p-6 text-sm">
          <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            Contents
          </p>
          <ol className="grid gap-2 text-ink/80">
            <li><a href="#warum" className="hover:underline">1. Why AI in Market Research?</a></li>
            <li><a href="#workflow" className="hover:underline">2. The AI-Augmented Workflow in 6 Steps</a></li>
            <li><a href="#qualitativ" className="hover:underline">3. Qualitative Depth Despite Automation</a></li>
            <li><a href="#fallstricke" className="hover:underline">4. Common Pitfalls</a></li>
            <li><a href="#einstieg" className="hover:underline">5. How to Get Started Internally</a></li>
            <li><a href="#faq" className="hover:underline">6. FAQ</a></li>
          </ol>
        </nav>

        <section id="warum">
          <h2>1. Why AI in Market Research?</h2>
          <p>
            Classic market research is thorough, but slow and expensive. Briefing, guide,
            recruiting, fieldwork, transcription, coding, report — six to ten weeks per study go
            by quickly. Product teams that make decisions weekly can't afford that pace.
          </p>
          <p>
            AI doesn't just shorten the time, it shifts the bottleneck: instead of weeks for
            analysis, qualitative insights now flow back to the team almost in real time. What
            matters here is that AI doesn't replace respondents — it{" "}
            <strong>amplifies</strong> researchers' work. Design, moderation, synthesis, and
            reporting become one orchestrated workflow.
          </p>
        </section>

        <section id="workflow">
          <h2>2. The AI-Augmented Workflow in 6 Steps</h2>
          <div className="not-prose my-6 grid gap-4">
            {STEPS.map((s) => (
              <div key={s.n} className="rounded-2xl border border-border bg-secondary/30 p-6">
                <div className="mb-2 font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  Step {s.n}
                </div>
                <h3 className="mb-2 text-lg font-medium text-ink">{s.title}</h3>
                <p className="text-sm text-muted-foreground">{s.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="qualitativ">
          <h2>3. Qualitative Depth Despite Automation</h2>
          <p>
            The most common worry: do I lose depth if no researcher sits in on the interview live
            anymore? In practice, we often see the opposite. Three reasons:
          </p>
          <ul>
            <li>
              <strong>More openness.</strong> Respondents speak more freely with the AI — social
              desirability and interviewer bias fall away. Sensitive topics come up faster.
            </li>
            <li>
              <strong>Consistent depth.</strong> The AI follows up on every interesting statement,
              even in interview number 47, when a human would long since be tired.
            </li>
            <li>
              <strong>Full-text analysis.</strong> Instead of a sample of quotes, every transcript
              gets analyzed in full — no insights disappear into a filing cabinet.
            </li>
          </ul>
        </section>

        <section id="fallstricke">
          <h2>4. Common Pitfalls</h2>
          <ul>
            <li>
              <strong>Synthetic respondents instead of real people.</strong> Tools that only
              simulate LLM personas don't deliver reliable evidence. Good for hypotheses, bad for
              decisions.
            </li>
            <li>
              <strong>Reports without source links.</strong> If the AI finding doesn't link to
              the original quote, you can't defend it to stakeholders.
            </li>
            <li>
              <strong>Prompt engineering instead of research craft.</strong> AI doesn't replace a
              clean research question. Start without a hypothesis, and you get slick but useless
              reports.
            </li>
            <li>
              <strong>Underestimating privacy.</strong> A DPA, EU hosting, and the prohibition on
              using your studies for AI training aren't nice-to-haves — they're mandatory in the
              EU.
            </li>
          </ul>
        </section>

        <section id="einstieg">
          <h2>5. How to Get Started Internally</h2>
          <p>
            We recommend the <strong>parallel pilot</strong>: pick a recurring study you'd run
            anyway — a UX test, concept test, NPS wave. Run it once classically and once with an
            AI platform, in parallel. Compare three dimensions:
          </p>
          <ol>
            <li><strong>Time-to-insight</strong> — from briefing to the stakeholder presentation.</li>
            <li><strong>Cost</strong> — per insight, not just per study.</li>
            <li><strong>Depth of findings</strong> — the same, weaker, stronger?</li>
          </ol>
          <p>
            In most pilot projects, the AI workflow wins on time-to-insight by a factor of 5–10,
            saves 60–80% of the cost, and delivers comparable to better depth.
          </p>
        </section>

        <section id="faq">
          <h2>6. Frequently Asked Questions</h2>
          <div className="not-prose grid gap-4">
            {FAQS.map((f) => (
              <details
                key={f.q}
                className="group rounded-2xl border border-border bg-secondary/30 p-5 open:bg-secondary/50"
              >
                <summary className="cursor-pointer list-none font-medium text-ink">
                  {f.q}
                </summary>
                <p className="mt-3 text-sm text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        <div className="mt-12 rounded-2xl border border-border bg-secondary/40 p-6 text-sm text-muted-foreground">
          <p className="mb-3 font-medium text-ink">Keep reading</p>
          <ul className="grid gap-2">
            <li>
              <Link href="/en/blog/ai-market-research-tools-comparison" className="text-ink hover:underline">
                AI market research tools compared →
              </Link>
            </li>
            <li>
              <Link href="/en/methoden" className="text-ink hover:underline">
                All methods at a glance →
              </Link>
            </li>
            <li>
              <Link href="/en/plattform" className="text-ink hover:underline">
                What the Klymeo platform can do →
              </Link>
            </li>
          </ul>
        </div>
      </article>

      <CtaBlock
        lang="en"
        title="Ready for your"
        italic="first AI pilot?"
        body="15 minutes with our team — we'll look at one of your recurring studies and sketch out the AI-augmented workflow specifically for you."
      />
    </SiteShell>
  );
}
