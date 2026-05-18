const FEATURES = [
  "Real-time call analysis with Claude Sonnet 4",
  "Six loss-risk pattern detection",
  "Slack and Teams alerts at risk-score > 70",
  "Risk-score trend per deal over time",
];

const SIGNALS = ["Stakeholder churn", "Competitor mention", "Stalled 12 days"];

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

export default function FeaturePredictiveSection() {
  return (
    <section className="mx-auto mt-32 max-w-7xl px-6">
      <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
        {/* Text */}
        <div>
          <p className="text-sm font-medium uppercase tracking-wider text-violet-400">
            Predictive Layer
          </p>
          <h2 className="mt-4 text-4xl font-medium tracking-tight text-white">
            Catch loss-risk before the deal slips.
          </h2>
          <p className="mt-6 text-base leading-relaxed text-mist">
            Findr listens to every sales call and watches your CRM in real-time.
            It detects six loss-risk signals — stakeholder churn, competitor
            mentions, stalling patterns, budget friction, champion loss,
            late-stage decision-maker entry — and flags deals before they go
            cold.
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

        {/* Visual: Risk-Score Card mockup */}
        <div className="rounded-xl border border-mist/15 bg-obsidian-light p-6">
          <div className="flex items-start justify-between gap-4">
            <h3 className="font-medium text-white">
              Deal: TechCorp Renewal — $120k ARR
            </h3>
            <span className="whitespace-nowrap rounded-md bg-mist/10 px-2 py-0.5 text-xs text-mist">
              From Hubspot
            </span>
          </div>

          {/* Risk meter */}
          <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-mist/10">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-500 to-alert-500"
              style={{ width: "78%" }}
            />
          </div>

          <p className="mt-3 text-3xl font-medium text-alert-500">78 / 100</p>
          <p className="mt-1 text-sm text-alert-400">
            ↑ +24 since yesterday&rsquo;s call
          </p>

          <p className="mt-6 text-xs uppercase tracking-wider text-mist">
            Signals detected:
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {SIGNALS.map((signal) => (
              <span
                key={signal}
                className="rounded-md border border-alert-500/30 bg-alert-500/10 px-3 py-1 text-xs text-alert-400"
              >
                {signal}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
