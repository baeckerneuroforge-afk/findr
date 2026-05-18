import Link from "next/link";

export default function FinalCTASection() {
  return (
    <section className="mx-auto mt-32 max-w-5xl px-6">
      <div className="rounded-2xl border border-violet-600/30 bg-gradient-to-br from-violet-600/20 to-violet-600/5 p-12 text-center md:p-20">
        <p className="text-sm font-medium uppercase tracking-wider text-violet-400">
          Ready to stop losing?
        </p>
        <h2 className="mx-auto mt-4 max-w-3xl text-4xl font-medium tracking-tight text-white md:text-5xl">
          Stop losing deals you should win.
        </h2>
        <p className="mt-6 text-base text-mist">
          14-day trial. No credit card required. Connect your CRM in 2 minutes.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/sign-up"
            className="rounded-lg bg-violet-600 px-6 py-3 font-medium text-white transition-colors hover:bg-violet-700"
          >
            Start free trial
          </Link>
          <Link
            href="#book-demo"
            className="rounded-lg border border-mist/30 px-6 py-3 font-medium text-white transition-colors hover:bg-mist/5"
          >
            Book a demo
          </Link>
        </div>
      </div>
    </section>
  );
}
