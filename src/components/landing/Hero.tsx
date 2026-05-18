import Link from "next/link";
import AlertCardDemo from "./AlertCardDemo";

export default function Hero() {
  return (
    <section className="px-6 pt-16 pb-16 md:pt-20">
      <div className="mx-auto max-w-6xl text-center">
        {/* Eyebrow pill */}
        <div className="inline-flex items-center gap-2 rounded-full bg-alert-500/10 px-3 py-1.5 text-xs font-medium text-alert-400">
          <span className="h-1.5 w-1.5 rounded-full bg-alert-500" aria-hidden="true" />
          Now in private beta
        </div>

        {/* H1 */}
        <h1 className="mx-auto mt-6 max-w-4xl text-4xl font-medium leading-[1.05] tracking-[-2px] text-white md:text-5xl lg:text-6xl">
          Stop losing deals you should win.
        </h1>

        {/* Subheadline */}
        <p className="mx-auto mt-6 max-w-xl text-xl text-mist">
          Findr listens to every sales call, flags loss-risk before the deal
          slips, and interviews lost prospects so you stop losing the same way
          twice.
        </p>

        {/* CTAs */}
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/sign-up"
            className="inline-flex items-center justify-center rounded-lg bg-violet-600 px-6 py-[13px] text-base font-medium text-white transition-colors hover:bg-violet-700"
          >
            Start free trial
          </Link>
          <Link
            href="#book-demo"
            className="inline-flex items-center justify-center rounded-lg border border-mist/30 px-6 py-[13px] text-base font-medium text-white transition-colors hover:bg-mist/5"
          >
            Book a demo
          </Link>
        </div>

        <AlertCardDemo />

        {/* SocialProof wird hier eingefügt */}
      </div>
    </section>
  );
}
