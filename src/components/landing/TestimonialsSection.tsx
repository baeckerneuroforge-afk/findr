const TESTIMONIALS: {
  quote: string;
  initials: string;
  name: string;
  title: string;
}[] = [
  {
    quote:
      "We were losing 6-figure deals and had no idea why. Findr's first quarter, we recovered three deals worth $340k combined.",
    initials: "MK",
    name: "Marcus K.",
    title: "VP RevOps · Series B SaaS",
  },
  {
    quote:
      "The post-loss interviews alone justify the cost. We're getting honest feedback from buyers who would never respond to a survey.",
    initials: "SR",
    name: "Sarah R.",
    title: "Head of Sales · DACH FinTech",
  },
  {
    quote:
      "Risk-scoring caught a champion-loss two weeks before our team would've noticed. We saved that deal — €85k ARR.",
    initials: "TH",
    name: "Tobias H.",
    title: "Chief Revenue Officer · B2B Platform",
  },
];

export default function TestimonialsSection() {
  return (
    <section className="mx-auto mt-32 max-w-6xl px-6">
      <div className="text-center">
        <p className="text-sm font-medium uppercase tracking-wider text-violet-400">
          Customer stories
        </p>
        <h2 className="mt-4 text-4xl font-medium tracking-tight text-white">
          From skeptics to evangelists.
        </h2>
      </div>

      <div className="mt-16 grid grid-cols-1 gap-6 md:grid-cols-3">
        {TESTIMONIALS.map((t) => (
          <figure
            key={t.name}
            className="rounded-xl border border-mist/15 bg-mist/5 p-8"
          >
            <blockquote className="text-base leading-relaxed text-white">
              &ldquo;{t.quote}&rdquo;
            </blockquote>
            <figcaption className="mt-6 flex items-center gap-3">
              <span
                className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-600/20 font-medium text-violet-400"
                aria-hidden="true"
              >
                {t.initials}
              </span>
              <div>
                <p className="text-sm font-medium text-white">{t.name}</p>
                <p className="text-xs text-mist">{t.title}</p>
              </div>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
