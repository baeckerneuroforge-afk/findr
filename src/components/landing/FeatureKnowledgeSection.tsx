const FEATURES = [
  "Quarterly Loss-Pattern reports",
  "Anonymized industry benchmarks",
  "Compound insights across deals",
  "Public Open Benchmarks (coming Q4)",
];

const PATTERNS: { label: string; percent: number }[] = [
  { label: "Pricing", percent: 42 },
  { label: "Onboarding speed", percent: 31 },
  { label: "Champion loss", percent: 18 },
  { label: "Decision-maker", percent: 9 },
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

export default function FeatureKnowledgeSection() {
  return (
    <section className="mx-auto mt-32 max-w-7xl px-6">
      <div className="grid grid-cols-1 items-center gap-12 lg:grid-cols-2">
        {/* Text */}
        <div>
          <p className="text-sm font-medium uppercase tracking-wider text-violet-400">
            Knowledge Graph
          </p>
          <h2 className="mt-4 text-4xl font-medium tracking-tight text-white">
            Stop losing the same way twice.
          </h2>
          <p className="mt-6 text-base leading-relaxed text-mist">
            Findr aggregates patterns across all your deals — and anonymized
            across all customers. See which loss-reasons compound. Spot which
            competitors win on what dimensions. Get quarterly benchmarks
            showing where you sit vs. industry average.
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

        {/* Visual: Pattern chart */}
        <div className="rounded-xl border border-mist/15 bg-obsidian-light p-6">
          <h3 className="font-medium text-white">Loss patterns — Q1 2026</h3>
          <div className="mt-4 space-y-4">
            {PATTERNS.map((p) => (
              <div key={p.label} className="flex items-center gap-4">
                <span className="w-32 shrink-0 text-sm text-mist">
                  {p.label}
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-mist/10">
                  <div
                    className="h-full rounded-full bg-violet-500"
                    style={{ width: `${p.percent}%` }}
                  />
                </div>
                <span className="w-12 shrink-0 text-right text-sm font-medium text-white">
                  {p.percent}%
                </span>
              </div>
            ))}
          </div>
          <p className="mt-6 text-xs text-mist">vs. industry avg</p>
          <p className="mt-2 text-sm text-alert-400">
            You lose 11% MORE on Pricing than industry avg
          </p>
        </div>
      </div>
    </section>
  );
}
