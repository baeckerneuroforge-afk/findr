const STATS: { value: string; label: string; description: string }[] = [
  {
    value: "40%",
    label: "Pipeline lost",
    description:
      "Of qualified deals end as Closed Lost in average B2B SaaS",
  },
  {
    value: "$300",
    label: "Per post-mortem",
    description:
      "Manual loss interviews cost time, money, and rarely happen",
  },
  {
    value: "3 weeks",
    label: "From loss to insight",
    description: "By then you've lost the next deal the same way",
  },
];

export default function ProblemSection() {
  return (
    <section className="mx-auto mt-32 max-w-5xl px-6 text-center">
      <p className="mb-4 text-sm font-medium uppercase tracking-wider text-alert-400">
        The problem
      </p>
      <h2 className="mx-auto max-w-4xl text-4xl font-medium tracking-tight text-white md:text-5xl">
        B2B SaaS teams lose 40% of qualified deals and don&rsquo;t know why.
      </h2>
      <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-mist">
        Loss-reason dropdowns like &ldquo;Price&rdquo; or &ldquo;Competitor&rdquo;
        don&rsquo;t tell you what really happened. Post-mortem interviews cost
        $300 each and take weeks to schedule. By the time you spot a pattern,
        you&rsquo;ve lost three more deals to it.
      </p>

      <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-3">
        {STATS.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-mist/15 bg-mist/5 p-6 text-left"
          >
            <p className="text-5xl font-medium text-alert-500">{stat.value}</p>
            <p className="mt-3 font-medium text-white">{stat.label}</p>
            <p className="mt-2 text-sm text-mist">{stat.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
