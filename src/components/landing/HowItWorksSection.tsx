const STEPS: { number: string; title: string; description: string }[] = [
  {
    number: "1",
    title: "Connect your CRM",
    description:
      "Hubspot, Salesforce, Pipedrive. One-click OAuth, no data migration. Findr starts analyzing existing deals immediately.",
  },
  {
    number: "2",
    title: "Findr watches your pipeline",
    description:
      "Every sales call analyzed within minutes. Risk-scores update in real-time. Slack alerts when deals start to slip.",
  },
  {
    number: "3",
    title: "Save deals, learn patterns",
    description:
      "Get rescue recommendations during active deals. Auto-interview lost prospects. Quarterly reports surface patterns.",
  },
];

export default function HowItWorksSection() {
  return (
    <section className="mx-auto mt-32 max-w-6xl px-6">
      <div className="text-center">
        <p className="text-sm font-medium uppercase tracking-wider text-violet-400">
          How it works
        </p>
        <h2 className="mx-auto mt-4 max-w-3xl text-4xl font-medium tracking-tight text-white md:text-5xl">
          From sales call to saved deal in minutes.
        </h2>
      </div>

      <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-3">
        {STEPS.map((step) => (
          <div
            key={step.number}
            className="rounded-xl border border-mist/15 bg-mist/5 p-8"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-600 font-medium text-white">
              {step.number}
            </div>
            <h3 className="mt-6 text-xl font-medium text-white">
              {step.title}
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-mist">
              {step.description}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
