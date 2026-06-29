import Link from "next/link";
import { Konsoul } from "./Konsoul";
import { SiteShell, PageHero, CtaBlock } from "./SiteShell";
import { Stagger } from "./Stagger";
import type { ReactNode } from "react";

export type SolutionData = {
  eyebrow: string;
  title: string;
  italic?: string;
  lead: string;
  mood: "smile" | "think" | "wow" | "wink" | "listen" | "scan";
  whatItIs: string;
  questions: string[];
  process: { n: string; t: string; b: string }[];
  deliverables: string[];
  exampleQuote: { q: string; a: string };
  related: { label: string; href: string }[];
};

export function SolutionPage({ data, extra }: { data: SolutionData; extra?: ReactNode }) {
  return (
    <SiteShell>
      <PageHero
        eyebrow={data.eyebrow}
        title={data.title}
        italic={data.italic}
        lead={data.lead}
        mood={data.mood}
      />

      <section className="py-20">
        <div className="mx-auto grid max-w-7xl gap-12 px-6 md:grid-cols-[1fr_1.2fr]">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-soul">Was es ist</p>
            <h2 className="mt-3 text-3xl leading-[1.1]">Eine klare Antwort, belegt am Wortlaut.</h2>
            <p className="mt-5 text-muted-foreground leading-relaxed">{data.whatItIs}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-soul">Typische Fragen</p>
            <Stagger as="ul" step={90} className="mt-4 grid gap-3">
              {data.questions.map((q) => (
                <li
                  key={q}
                  className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 text-sm transition hover:-translate-y-0.5 hover:border-ink"
                >
                  <Konsoul size={28} mood="think" className="text-ink shrink-0" />
                  <span className="text-ink">{q}</span>
                </li>
              ))}
            </Stagger>
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-secondary/40 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <p className="text-xs uppercase tracking-[0.22em] text-soul">So läuft&apos;s</p>
          <h2 className="mt-3 text-4xl leading-[1.05]">
            In <span className="mark mark-amber">Tagen</span>, nicht Wochen.
          </h2>
          <Stagger step={110} className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-4">
            {data.process.map((p) => (
              <article key={p.n} className="bg-card p-6 transition hover:bg-paper">
                <span className="font-mono text-xs text-muted-foreground">{p.n}</span>
                <h3 className="mt-4 text-xl">{p.t}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{p.b}</p>
              </article>
            ))}
          </Stagger>
        </div>
      </section>

      <section className="py-24">
        <div className="mx-auto grid max-w-7xl gap-12 px-6 md:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-soul">Du bekommst</p>
            <h2 className="mt-3 text-3xl leading-[1.1]">Deliverables, mit denen du Entscheidungen triffst.</h2>
            <Stagger as="ul" step={70} className="mt-6 space-y-3">
              {data.deliverables.map((d) => (
                <li key={d} className="flex gap-3 border-b border-border pb-3 text-sm">
                  <span className="text-soul">●</span>
                  <span className="text-ink">{d}</span>
                </li>
              ))}
            </Stagger>
          </div>
          <figure className="rounded-2xl border border-border bg-card p-8">
            <span className="serif text-4xl leading-none text-soul">{'"'}</span>
            <blockquote className="mt-3 text-xl leading-snug text-ink">{data.exampleQuote.q}</blockquote>
            <figcaption className="mt-6 flex items-center gap-3 border-t border-border pt-4 text-sm">
              <Konsoul size={32} mood="wink" className="text-ink" />
              <span className="text-muted-foreground">{data.exampleQuote.a}</span>
            </figcaption>
          </figure>
        </div>
      </section>

      {extra}

      <CtaBlock title="Lass uns deine Studie" italic="aufsetzen." body="30 Minuten reichen, um deine konkrete Forschungsfrage in einen Studien-Plan zu übersetzen." />

      <div className="border-t border-border bg-secondary/30 py-10">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 text-sm">
          <span className="text-muted-foreground">Verwandte Lösungen:</span>
          <div className="flex flex-wrap gap-4">
            {data.related.map((r) => (
              <Link key={r.label} href={r.href} className="text-ink underline-offset-4 hover:underline">
                {r.label} →
              </Link>
            ))}
          </div>
        </div>
      </div>
    </SiteShell>
  );
}
