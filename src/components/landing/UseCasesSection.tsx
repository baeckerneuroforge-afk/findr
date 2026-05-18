const USE_CASES: {
  tag: string;
  title: string;
  description: string;
  items: string[];
}[] = [
  {
    tag: "For VP Sales",
    title: "Win-Loss Analysis",
    description:
      "Understand why deals close lost. Coach reps on patterns, not anecdotes. Quantify competitive threats with real data.",
    items: [
      "Real-time risk-detection",
      "Auto post-loss interviews",
      "Competitive intelligence",
    ],
  },
  {
    tag: "For VP Product",
    title: "Continuous Discovery",
    description:
      "Talk to customers about features before you build them. Validate roadmap decisions with AI-moderated discovery interviews.",
    items: [
      "Pre-launch validation",
      "Feature-prioritization signals",
      "Buyer-research at scale",
    ],
  },
  {
    tag: "For VP Customer Success",
    title: "Customer Health",
    description:
      "Spot churn risk in days, not weeks. Trigger health-check interviews at usage drops. Aggregate renewal insights for QBRs.",
    items: [
      "Churn early-warning",
      "Auto health-check interviews",
      "Renewal-risk dashboard",
    ],
  },
];

function CheckIcon() {
  return (
    <svg
      className="mt-0.5 h-4 w-4 shrink-0 text-violet-400"
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

export default function UseCasesSection() {
  return (
    <section className="mx-auto mt-32 max-w-6xl px-6">
      <div className="text-center">
        <p className="text-sm font-medium uppercase tracking-wider text-violet-400">
          Use cases
        </p>
        <h2 className="mx-auto mt-4 max-w-4xl text-4xl font-medium tracking-tight text-white md:text-5xl">
          Built for revenue teams who can&rsquo;t afford to guess.
        </h2>
      </div>

      <div className="mt-16 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {USE_CASES.map((useCase) => (
          <div
            key={useCase.title}
            className="rounded-xl border border-mist/15 bg-mist/5 p-8"
          >
            <p className="text-xs font-medium uppercase tracking-wider text-violet-400">
              {useCase.tag}
            </p>
            <h3 className="mt-3 text-xl font-medium text-white">
              {useCase.title}
            </h3>
            <p className="mt-4 text-sm leading-relaxed text-mist">
              {useCase.description}
            </p>
            <ul className="mt-6 space-y-2">
              {useCase.items.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <CheckIcon />
                  <span className="text-sm text-mist">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
