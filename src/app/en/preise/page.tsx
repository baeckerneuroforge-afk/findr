import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SiteShell, PageHero, CtaBlock, DEMO_URL } from "@/components/site/SiteShell";
import { Konsoul } from "@/components/site/Konsoul";
import { buildAlternates, ogDefaultsFor } from "@/lib/marketing/seo";

export const metadata: Metadata = {
  title: { absolute: "Pricing — One license, every method · Klymeo" },
  description:
    "Klymeo adapts to your team — all four methods included. We set the price together on a demo call, transparent and without a one-size-fits-all plan.",
  alternates: buildAlternates("en", "/preise"),
  openGraph: {
    ...ogDefaultsFor("en"),
    title: "Pricing — One license, every method · Klymeo",
    description: "Four factors determine your price: access, scope, support, term.",
    url: "/en/preise",
  },
};

const factors = [
  {
    n: "01",
    title: "Access",
    body: "One license for your team — and all four methods are included from day one. You pay a base fee for access, not per method. Seats are added as your team grows.",
  },
  {
    n: "02",
    title: "Scope",
    body: "How much you run: parallel studies and reach. You conduct interviews within the agreed scope without limit — no per-conversation billing. Scope scales with what fits your organization's size.",
  },
  {
    n: "03",
    title: "Support",
    body: "From a lean start to a closely guided rollout: how much onboarding, training and ongoing support you need is part of your package — some teams get going on their own, others want us by their side.",
  },
  {
    n: "04",
    title: "Term",
    body: "Flexible month-to-month or a fixed term: how much commitment you want to plan for is part of the conversation and affects the terms. No fine print, no automatic traps.",
  },
];

const tracks = [
  {
    n: "Track 01",
    title: "Needs & Behavior",
    body: "Concrete situations, real workarounds and unmet needs — evidenced in conversation, not derived from hypotheses.",
    to: "/en/loesungen/bedarf-verhalten",
  },
  {
    n: "Track 02",
    title: "Brand Perception",
    body: "What associations, images and feelings your brand triggers — in your audience's own words.",
    to: "/en/loesungen/markenwahrnehmung",
  },
  {
    n: "Track 03",
    title: "Concept Test",
    body: "Comprehension first, then relevance: whether a concept holds up — and exactly where it succeeds or fails.",
    to: "/en/loesungen/konzept-test",
  },
  {
    n: "Track 04",
    title: "Creative Test",
    body: "First impression and emotional impact of a creative — before you put media budget behind it.",
    to: "/en/loesungen/user-research",
  },
];

const included = [
  { title: "Built in Germany", body: "Team & development based in Central Europe." },
  { title: "Hosted in the EU", body: "Data center in Frankfurt am Main." },
  { title: "GDPR-compliant", body: "Privacy as the foundation, not an afterthought." },
  { title: "EU AI Act", body: "Aligned with the European AI framework." },
  { title: "AI interviews in German and English", body: "Text or spoken via voice agent — natural conversational language, where English-only tools hit their limits." },
  { title: "Evidenced, not guessed", body: "Every statement is anchored to the exact transcript moment." },
];

const faqs = [
  {
    q: "Why don't you list fixed prices?",
    a: "Because the right price depends on the access, scope and support your team actually needs — all methods are included either way. A one-size-fits-all plan would either over- or under-serve most teams. On the demo call, we put together exactly what fits your situation instead — transparent and easy to follow.",
  },
  {
    q: "Can I start with just one method?",
    a: "Yes — and you don't need to book anything extra: all four methods are included in your license. You simply start with whichever has the biggest impact today, and use the others once your team is ready. They all share the same AI engine — interviews you've already run keep counting throughout.",
  },
  {
    q: "What determines scope, and how is it billed?",
    a: "Scope depends on your study volume, seats and level of support. You conduct interviews within the agreed scope without limit — there's no per-conversation billing. We work out together which sizes fit your team, with no hidden line items and no fine print.",
  },
  {
    q: "Do I get support with setup?",
    a: "Yes — though setup is deliberately lightweight: studies run via shareable links, your own participant pool, or panel integration, with no technical project involved. How closely we support you during rollout, onboarding and day-to-day operation is something we tailor to your team.",
  },
  {
    q: "Is this GDPR-compliant?",
    a: "Klymeo is built in Germany, hosted in Frankfurt, and GDPR-native, aligned with the EU AI Act. Privacy is the platform's foundation, not an afterthought — for every method and every account.",
  },
  {
    q: "Is there a pilot or trial start?",
    a: "A guided start is possible. We define a clear scope together so you can experience Klymeo on your real conversations before committing. What that start looks like in practice is something we discuss on the demo call.",
  },
];

export default function PricingPage() {
  return (
    <SiteShell lang="en">
      <PageHero
        eyebrow="Pricing"
        title="One license, every method — the price fits your team, not a"
        italic="one-size-fits-all plan."
        lead="Klymeo adapts to your team and your scope — all four methods are included. We set the actual price together in conversation, transparent and without a one-size-fits-all plan."
        image="/site/photo-pricing.jpg"
        imageAlt="Klymeo team session"
      />

      <section className="py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="max-w-2xl">
            <p className="text-xs uppercase tracking-[0.22em] text-soul">How our pricing works</p>
            <h2 className="mt-3 text-4xl leading-[1.05] md:text-5xl">
              Four factors determine <span className="serif">your price.</span>
            </h2>
            <p className="mt-5 text-muted-foreground">
              All four methods are always included. What determines the price are four levers —
              access, scope, support and term — which we go through together on the demo call.
            </p>
          </div>

          <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {factors.map((f) => (
              <article key={f.n} className="rounded-2xl border border-border bg-card p-7">
                <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">{f.n}</p>
                <h3 className="mt-3 text-2xl">{f.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Inline CTA — high-up, with Konsoul */}
      <section className="pb-8">
        <div className="mx-auto max-w-7xl px-6">
          <div className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-secondary/60 via-background to-secondary/30 p-8 md:p-12">
            <div
              aria-hidden
              className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-soul/25 blur-3xl blob-a"
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-28 -left-20 h-72 w-72 rounded-full bg-ink/10 blur-3xl blob-b"
            />
            <div className="relative grid items-center gap-10 md:grid-cols-[auto_1fr_auto]">
              <div className="relative">
                <div className="absolute -inset-3 rounded-3xl bg-soul/20 blur-xl" aria-hidden />
                <Konsoul size={108} mood="wow" className="relative text-ink" label="pricing" />
                <span className="absolute -bottom-1 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-[10px] font-mono uppercase tracking-widest text-muted-foreground shadow-sm">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-soul" />
                  online
                </span>
              </div>
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.25em] text-soul">
                  Pricing is a conversation
                </p>
                <h2 className="mt-3 text-3xl leading-[1.05] md:text-4xl">
                  Let's set your price <span className="mark mark-amber">individually.</span>
                </h2>
                <p className="mt-4 max-w-xl text-muted-foreground">
                  Instead of a one-size-fits-all plan: in 30 minutes, we'll go through access,
                  scope and support together with our team — and you'll get an offer that fits
                  your team exactly. Book a slot directly in the calendar.
                </p>
                <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
                  <li className="inline-flex items-center gap-1.5"><span className="h-1 w-1 rounded-full bg-soul" /> Transparent</li>
                  <li className="inline-flex items-center gap-1.5"><span className="h-1 w-1 rounded-full bg-soul" /> No sales pressure</li>
                  <li className="inline-flex items-center gap-1.5"><span className="h-1 w-1 rounded-full bg-soul" /> With a live mini-study</li>
                </ul>
              </div>
              <div className="flex flex-col gap-2.5 md:items-end">
                <a
                  href={DEMO_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="group inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3.5 text-sm font-medium text-paper transition hover:-translate-y-0.5 hover:shadow-[0_12px_40px_-10px_oklch(0.72_0.16_55_/_0.6)]"
                >
                  Book a demo slot
                  <span aria-hidden className="transition group-hover:translate-x-0.5">→</span>
                </a>
                <Link
                  href="/en/kontakt"
                  className="text-xs text-muted-foreground underline-offset-4 hover:text-ink hover:underline"
                >
                  or just write to us
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-secondary/40 py-24">
        <div className="mx-auto grid max-w-7xl gap-12 px-6 lg:grid-cols-[1fr_1.1fr] lg:items-center">
          <div className="relative aspect-[4/5] overflow-hidden rounded-3xl border border-border">
            <Image src="/site/photo-industry.jpg" alt="Klymeo workshop" fill sizes="(max-width: 1024px) 100vw, 45vw" className="object-cover" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-soul">Four methods, one engine</p>
            <h2 className="mt-3 text-4xl leading-[1.05] md:text-5xl">
              All four methods included — you start with the one <span className="serif">that matters today.</span>
            </h2>
            <p className="mt-5 text-muted-foreground">
              Four facets of one shared AI engine, all unlocked from day one. You start with the
              method that has the biggest impact — the others are ready as soon as your team is.
              Interviews you've run keep counting throughout.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {tracks.map((t) => (
                <Link
                  key={t.n}
                  href={t.to}
                  className="group rounded-xl border border-border bg-card p-5 transition hover:-translate-y-0.5 hover:border-ink"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{t.n}</span>
                    <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-widest text-soul">
                      <span className="h-1.5 w-1.5 rounded-full bg-soul animate-pulse" /> Live
                    </span>
                  </div>
                  <p className="mt-2 text-lg">{t.title}</p>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{t.body}</p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="max-w-2xl">
            <p className="text-xs uppercase tracking-[0.22em] text-soul">In every account</p>
            <h2 className="mt-3 text-4xl leading-[1.05] md:text-5xl">
              What's included in <span className="serif">every Klymeo account.</span>
            </h2>
            <p className="mt-5 text-muted-foreground">
              Regardless of which methods you choose: these fundamentals apply to every account —
              the European data sovereignty that matters, and the evidence promise that runs
              through every method.
            </p>
          </div>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {included.map((i) => (
              <div key={i.title} className="rounded-2xl border border-border bg-card p-6">
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-soul" />
                  <p className="text-sm font-medium text-ink">{i.title}</p>
                </div>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{i.body}</p>
              </div>
            ))}
          </div>
          <p className="mx-auto mt-10 max-w-3xl text-center text-sm text-muted-foreground">
            Want to see Klymeo on your own conversations first? A guided start is possible — we'll
            discuss the right scope on the demo call.
          </p>
        </div>
      </section>

      <section className="border-y border-border bg-secondary/40 py-24">
        <div className="mx-auto max-w-5xl px-6">
          <p className="text-xs uppercase tracking-[0.22em] text-soul">Frequently asked questions</p>
          <h2 className="mt-3 text-4xl leading-[1.05]">
            Everything you want to know <span className="serif">about pricing.</span>
          </h2>
          <p className="mt-4 text-muted-foreground">
            The questions that come up most before a custom offer — answered honestly.
          </p>
          <div className="mt-10 divide-y divide-border rounded-2xl border border-border bg-card">
            {faqs.map((f) => (
              <details key={f.q} className="group p-6">
                <summary className="flex cursor-pointer items-center justify-between text-base font-medium text-ink">
                  {f.q}
                  <span className="text-soul transition group-open:rotate-45" aria-hidden>+</span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      <CtaBlock
        lang="en"
        title="Talk to us about"
        italic="your scope."
        body="In a short conversation, we'll work out which access, scope and support fit your team — all methods included — and you'll see what Klymeo delivers on your real conversations."
        primary="Book a demo"
        secondary="See the platform"
      />
    </SiteShell>
  );
}
