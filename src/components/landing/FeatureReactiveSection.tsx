const FEATURES = [
  "Multi-channel: Voice, text-chat, or async-video",
  "5-7 levels deep laddering interview",
  "Native EU + USA language support",
  "Findings auto-written to Salesforce/Hubspot",
];

const FINDINGS: { tag: string; content: string }[] = [
  {
    tag: "Pricing",
    content:
      "Felt locked-in by 12-month contract. Competitor offered month-to-month.",
  },
  {
    tag: "Onboarding",
    content:
      "Promised 2-week onboarding actually took 6. Lost confidence early.",
  },
  {
    tag: "Decision-maker",
    content:
      "CEO not involved in evaluation. Got vetoed at final stage.",
  },
];

function CheckIcon() {
  return (
    <svg
      className="mt-0.5 h-5 w-5 shrink-0 text-violet-400"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

export default function FeatureReactiveSection() {
  return (
    <section className="mx-auto mt-32 max-w-7xl px-6">
      <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
        {/* Visual (text first in DOM for mobile, ordered to left on lg) */}
        <div className="order-2 rounded-xl border border-mist/15 bg-obsidian-light p-6 lg:order-1">
          <div className="flex items-start justify-between gap-4">
            <h3 className="flex items-center gap-2 font-medium text-white">
              <span className="h-2 w-2 rounded-full bg-violet-500" aria-hidden="true" />
              Interview completed
            </h3>
            <span className="whitespace-nowrap text-xs text-mist">23 min</span>
          </div>
          <p className="mt-1 text-sm text-mist">
            With: Marcus Weber, CTO at Nordbank
          </p>

          <p className="mt-6 text-xs uppercase tracking-wider text-mist">
            Key findings:
          </p>
          <div className="mt-3 space-y-3">
            {FINDINGS.map((f) => (
              <div
                key={f.tag}
                className="rounded-r border-l-2 border-violet-500 bg-mist/5 p-3"
              >
                <p className="text-xs font-medium uppercase tracking-wider text-violet-400">
                  {f.tag}
                </p>
                <p className="mt-1 text-sm text-white">{f.content}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Text */}
        <div className="order-1 lg:order-2">
          <p className="text-sm font-medium uppercase tracking-wider text-violet-400">
            Reactive Layer
          </p>
          <h2 className="mt-4 text-4xl font-medium tracking-tight text-white">
            AI voice-interviews lost customers in 24 hours, not 3 weeks.
          </h2>
          <p className="mt-6 text-base leading-relaxed text-mist">
            When a deal closes lost, Findr automatically reaches out to the
            buyer with an AI-moderated voice interview. The conversation goes
            5–7 levels deep, surfaces the real reason for the loss, and writes
            findings back into your CRM. Available in German, French, Italian,
            Spanish, Dutch — and English.
          </p>
          <ul className="mt-8 space-y-3">
            {FEATURES.map((feature) => (
              <li key={feature} className="flex items-start gap-3">
                <CheckIcon />
                <span className="text-sm text-white">{feature}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
