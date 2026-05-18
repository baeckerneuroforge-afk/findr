import Link from "next/link";

export default function PricingTeaser() {
  return (
    <section className="mx-auto mt-32 max-w-4xl px-6 text-center">
      <p className="text-sm font-medium uppercase tracking-wider text-violet-400">
        Pricing
      </p>
      <h2 className="mt-4 text-4xl font-medium tracking-tight text-white md:text-5xl">
        Pay only for what you analyze.
      </h2>
      <p className="mx-auto mt-4 max-w-2xl text-lg text-mist">
        Plans start at $99/month. Outcome-based pricing available — pay 1–2% of
        recovered ARR only when Findr saves you a deal.
      </p>
      <Link
        href="/pricing"
        className="mt-8 inline-block rounded-lg bg-violet-600 px-6 py-3 font-medium text-white transition-colors hover:bg-violet-700"
      >
        See pricing
      </Link>
    </section>
  );
}
