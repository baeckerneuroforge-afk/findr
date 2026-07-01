import type { Metadata } from "next";
import Link from "next/link";
import { SiteShell, PageHero, CtaBlock } from "@/components/site/SiteShell";
import { buildAlternates, ogDefaultsFor, jsonLdHtml, SITE_URL } from "@/lib/marketing/seo";

const PATH = "/blog/system-usability-scale-guide";

export const metadata: Metadata = {
  title: { absolute: "System Usability Scale (SUS): The Complete Guide — Klymeo" },
  description:
    "System Usability Scale (SUS) explained: the 10 questions, how to calculate the score, benchmarks, and how Klymeo's AI agent Konsoul runs and analyzes SUS studies automatically.",
  alternates: buildAlternates("en", PATH),
  openGraph: {
    ...ogDefaultsFor("en"),
    title: "System Usability Scale (SUS) — Guide",
    description:
      "Methodology, score calculation, benchmarks, and automated SUS analysis with AI.",
    url: PATH,
  },
};

// Canonical English original wording (John Brooke, 1986) — not a back-translation
// of the German copy, since SUS is a validated instrument with fixed item text.
const QUESTIONS = [
  "I think that I would like to use this system frequently.",
  "I found the system unnecessarily complex.",
  "I thought the system was easy to use.",
  "I think that I would need the support of a technical person to be able to use this system.",
  "I found the various functions in this system were well integrated.",
  "I thought there was too much inconsistency in this system.",
  "I would imagine that most people would learn to use this system very quickly.",
  "I found the system very cumbersome to use.",
  "I felt very confident using the system.",
  "I needed to learn a lot of things before I could get going with this system.",
];

export default function SusGuide() {
  return (
    <SiteShell lang="en">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLdHtml({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: "System Usability Scale (SUS): The Complete Guide",
            description:
              "Methodology, calculation, benchmarks, and AI-powered analysis of the System Usability Scale (SUS).",
            author: { "@type": "Organization", name: "Klymeo" },
            publisher: { "@type": "Organization", name: "Klymeo" },
            mainEntityOfPage: `${SITE_URL}${PATH}`,
            inLanguage: "en-US",
          }),
        }}
      />

      <PageHero
        eyebrow="Methods Guide"
        title="System Usability Scale —"
        italic="the complete guide"
        lead="How the SUS works, how to calculate the score, what the values mean — and how Konsoul runs SUS studies in hours instead of weeks."
        image="/site/blog-sus.jpg"
        imageAlt="Person testing a digital application"
      />

      <article className="mx-auto max-w-3xl px-6 py-20 prose-klymeo">
        <nav className="mb-12 rounded-2xl border border-border bg-secondary/40 p-6 text-sm">
          <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            Contents
          </p>
          <ol className="grid gap-2 text-ink/80">
            <li><a href="#was-ist-sus" className="hover:underline">1. What is the System Usability Scale?</a></li>
            <li><a href="#fragebogen" className="hover:underline">2. The SUS Questionnaire (10 Items)</a></li>
            <li><a href="#berechnung" className="hover:underline">3. Calculating the SUS Score</a></li>
            <li><a href="#benchmarks" className="hover:underline">4. Benchmarks & Interpretation</a></li>
            <li><a href="#einsatz" className="hover:underline">5. When to Use SUS — and When Not To</a></li>
            <li><a href="#konsoul" className="hover:underline">6. Automating SUS with Konsoul</a></li>
          </ol>
        </nav>

        <section id="was-ist-sus">
          <h2>1. What is the System Usability Scale?</h2>
          <p>
            The <strong>System Usability Scale (SUS)</strong> is a ten-item questionnaire
            developed by John Brooke in 1986 that measures the <em>perceived usability</em> of a
            digital application. Despite its brevity, SUS is considered one of the most robust and
            most widely validated usability metrics — with just 10 items, it delivers a single,
            comparable score from 0 to 100.
          </p>
          <p>
            SUS is method-agnostic: it works for websites, mobile apps, enterprise software,
            hardware interfaces, and even voice UIs. That makes it the standard tool whenever
            teams want to <strong>compare</strong> versions, competitors, or releases.
          </p>
        </section>

        <section id="fragebogen">
          <h2>2. The SUS Questionnaire</h2>
          <p>
            Participants rate ten statements on a 5-point Likert scale from
            <em> 1 = strongly disagree </em> to <em> 5 = strongly agree</em>. Odd-numbered items
            are worded positively, even-numbered items negatively — this prevents acquiescence
            bias.
          </p>
          <ol>
            {QUESTIONS.map((q, i) => (
              <li key={i}>
                <span className="font-mono text-xs text-muted-foreground">Q{i + 1} ({i % 2 === 0 ? "+" : "−"})</span>{" "}
                {q}
              </li>
            ))}
          </ol>
        </section>

        <section id="berechnung">
          <h2>3. Calculating the SUS Score</h2>
          <ol>
            <li>For <strong>odd-numbered items</strong> (positive): response value minus 1.</li>
            <li>For <strong>even-numbered items</strong> (negative): 5 minus the response value.</li>
            <li>Multiply the sum of all 10 transformed values by <strong>2.5</strong>.</li>
          </ol>
          <p>
            The result: a score between <strong>0 and 100</strong>. Important: the SUS score is
            <em> not a percentage</em> — 68 doesn't mean "68% usability," it roughly corresponds
            to the average across all systems ever measured.
          </p>
        </section>

        <section id="benchmarks">
          <h2>4. Benchmarks & Interpretation</h2>
          <p>
            According to Sauro &amp; Lewis (2016), SUS scores can be translated into a
            letter-grade scale:
          </p>
          <div className="not-prose my-6 overflow-hidden rounded-2xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-secondary/60 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">SUS Score</th>
                  <th className="px-4 py-3">Grade</th>
                  <th className="px-4 py-3">Meaning</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[
                  ["> 80.3", "A", "Excellent — users would actively recommend it"],
                  ["68–80.3", "B / C", "Good to acceptable — above average"],
                  ["51–68", "D", "Below average — action needed"],
                  ["< 51", "F", "Poor — fundamental usability problems"],
                ].map(([range, grade, meaning]) => (
                  <tr key={range}>
                    <td className="px-4 py-3 font-mono">{range}</td>
                    <td className="px-4 py-3 font-medium">{grade}</td>
                    <td className="px-4 py-3 text-muted-foreground">{meaning}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p>
            The cross-industry average sits at around <strong>68</strong>. Anything below that is
            a clear signal that users are experiencing friction.
          </p>
        </section>

        <section id="einsatz">
          <h2>5. When to Use SUS — and When Not To</h2>
          <p><strong>Well suited for:</strong></p>
          <ul>
            <li>Comparing versions (A/B releases, before/after).</li>
            <li>Competitive benchmarks against rival products.</li>
            <li>Quick pulse tracking across quarters.</li>
            <li>Studies with small samples (usable from ~12–15 participants).</li>
          </ul>
          <p><strong>Not suited for:</strong></p>
          <ul>
            <li>Diagnosing <em>why</em> a system is unusable — for that you need qualitative interviews.</li>
            <li>Measuring individual features (SUS measures the overall experience).</li>
            <li>Early discovery phases where the product isn't testable yet.</li>
          </ul>
        </section>

        <section id="konsoul">
          <h2>6. Automating SUS with Konsoul</h2>
          <p>
            A classic SUS study typically costs a UX team <strong>2–3 weeks</strong>: recruiting,
            distribution, reminders, data cleanup, score calculation, report. With Konsoul,
            Klymeo's AI agent, the same cycle runs in <strong>hours</strong>:
          </p>
          <ul>
            <li>
              <strong>Setup in plain language.</strong> You describe the target audience and the
              application to be tested to Konsoul — the questionnaire is instantiated with
              validated SUS logic.
            </li>
            <li>
              <strong>Recruiting &amp; fieldwork.</strong> Konsoul selects matching participants
              from the Klymeo panel, sends invitations, and monitors quotas in real time.
            </li>
            <li>
              <strong>Score calculation.</strong> Every response is instantly transformed per the
              SUS formula; the mean score plus confidence interval is ready as soon as the quota
              is reached.
            </li>
            <li>
              <strong>Qualitative depth.</strong> Optionally, Konsoul asks for a brief rationale
              after each SUS item and clusters the open responses by theme — so you get not just
              the grade, but the reason behind it.
            </li>
            <li>
              <strong>Report &amp; comparison.</strong> Benchmarks against earlier waves or
              competitor studies are calculated automatically and summarized in a shareable
              report — every statement evidenced in the transcript.
            </li>
          </ul>
        </section>

        <div className="mt-12 rounded-2xl border border-border bg-secondary/40 p-6 text-sm text-muted-foreground">
          <p className="mb-3 font-medium text-ink">Keep reading</p>
          <ul className="grid gap-2">
            <li>
              <Link href="/en/loesungen/user-research" className="text-ink hover:underline">
                User research with Klymeo →
              </Link>
            </li>
            <li>
              <Link href="/en/methoden" className="text-ink hover:underline">
                All methods at a glance →
              </Link>
            </li>
            <li>
              <Link href="/en/konsoul" className="text-ink hover:underline">
                How Konsoul works →
              </Link>
            </li>
          </ul>
        </div>
      </article>

      <CtaBlock
        lang="en"
        title="Ready for your first"
        italic="SUS in 24 hours?"
        body="Konsoul recruits, surveys and analyzes — you get the score, benchmark and qualitative depth in one report."
      />
    </SiteShell>
  );
}
