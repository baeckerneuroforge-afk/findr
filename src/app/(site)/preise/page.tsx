import type { Metadata } from "next";
import Link from "next/link";
import { SiteShell, PageHero, CtaBlock, DEMO_URL } from "@/components/site/SiteShell";
import { Konsoul } from "@/components/site/Konsoul";
import { buildAlternates, ogDefaultsFor } from "@/lib/marketing/seo";

export const metadata: Metadata = {
  title: { absolute: "Preise — Eine Lizenz, alle Methoden · Klymeo" },
  description:
    "Klymeo passt sich an dein Team an — alle vier Methoden inklusive. Den Preis legen wir gemeinsam im Demo-Call fest, transparent und ohne Schubladen-Tarif.",
  alternates: buildAlternates("de", "/preise"),
  openGraph: {
    ...ogDefaultsFor("de"),
    title: "Preise — Eine Lizenz, alle Methoden · Klymeo",
    description: "Vier Faktoren bestimmen deinen Preis: Zugang, Umfang, Begleitung, Laufzeit.",
    url: "/preise",
  },
};

const factors = [
  {
    n: "01",
    title: "Zugang",
    body: "Eine Lizenz für dein Team — und alle vier Methoden sind von Tag eins dabei. Du zahlst eine Grundgebühr für den Zugang, nicht pro Methode. Sitzplätze kommen hinzu, wie dein Team wächst.",
  },
  {
    n: "02",
    title: "Umfang",
    body: "Wie viel du erhebst: parallele Studien und Reichweite. Interviews führst du im vereinbarten Rahmen unbegrenzt — keine Abrechnung pro Gespräch. Der Umfang skaliert mit dem, was zur Größe deiner Organisation passt.",
  },
  {
    n: "03",
    title: "Begleitung",
    body: "Von schlankem Start bis zum eng begleiteten Rollout: Wie viel Onboarding, Schulung und laufende Betreuung du brauchst, ist Teil deines Pakets — manche Teams legen allein los, andere wollen uns an ihrer Seite.",
  },
  {
    n: "04",
    title: "Laufzeit",
    body: "Monatlich flexibel oder mit fester Laufzeit: Wie verbindlich du planen willst, ist Teil des Gesprächs und wirkt sich auf die Konditionen aus. Ohne Kleingedrucktes, ohne automatische Fallen.",
  },
];

const tracks = [
  {
    n: "Spur 01",
    title: "Bedarf & Verhalten",
    body: "Konkrete Situationen, echte Workarounds und unerfüllte Bedürfnisse — belegt am Gespräch, statt aus Hypothesen abgeleitet.",
    to: "/loesungen/bedarf-verhalten",
  },
  {
    n: "Spur 02",
    title: "Markenwahrnehmung",
    body: "Welche Assoziationen, Bilder und Gefühle deine Marke auslöst — in den eigenen Worten deiner Zielgruppe.",
    to: "/loesungen/markenwahrnehmung",
  },
  {
    n: "Spur 03",
    title: "Konzept-Test",
    body: "Erst Verständnis, dann Relevanz: ob ein Konzept trägt — und woran genau es das tut oder scheitert.",
    to: "/loesungen/konzept-test",
  },
  {
    n: "Spur 04",
    title: "Creative-Test",
    body: "Erster Eindruck und emotionale Wirkung einer Kreation — bevor du Media-Budget dahinter legst.",
    to: "/loesungen/user-research",
  },
];

const included = [
  { title: "In Deutschland gebaut", body: "Team & Entwicklung in der DACH-Region." },
  { title: "In der EU gehostet", body: "Rechenzentrum Frankfurt am Main." },
  { title: "DSGVO-konform", body: "Datenschutz als Grundlage, nicht als Nachgedanke." },
  { title: "EU AI Act", body: "Auf den europäischen KI-Rahmen ausgerichtet." },
  { title: "KI-Interviews auf Deutsch", body: "Text oder hörbar per Voice-Agent — DACH-Gesprächssprache, wo rein englische Tools an ihre Grenzen kommen." },
  { title: "Belegt, nicht geraten", body: "Jede Aussage ist am exakten Transkript-Moment verankert." },
];

const faqs = [
  {
    q: "Warum nennt ihr keine festen Preise?",
    a: "Weil der passende Preis von Zugang, Umfang und Begleitung abhängt, die dein Team wirklich braucht — die Methoden sind ohnehin alle inklusive. Ein Schubladen-Tarif würde die meisten Teams entweder über- oder unterversorgen. Im Demo-Call schnüren wir stattdessen genau das, was zu deiner Situation passt — transparent und nachvollziehbar.",
  },
  {
    q: "Kann ich mit einer einzigen Methode starten?",
    a: "Ja — und du musst nichts extra buchen: Alle vier Methoden sind in deiner Lizenz enthalten. Du beginnst einfach mit der, die heute den größten Hebel hat, und nutzt die anderen, sobald dein Team so weit ist. Alle teilen dieselbe KI-Engine — bereits geführte Interviews zählen durchgängig weiter.",
  },
  {
    q: "Wonach richtet sich der Umfang, und wie wird abgerechnet?",
    a: "Der Umfang richtet sich nach dem Studien-Scope, den Sitzplätzen und dem Grad der Begleitung. Interviews führst du im vereinbarten Rahmen unbegrenzt — es gibt keine Abrechnung pro Gespräch. Welche Größen zu deinem Team passen, legen wir gemeinsam fest, ohne versteckte Posten und ohne Kleingedrucktes.",
  },
  {
    q: "Bekomme ich Unterstützung beim Setup?",
    a: "Ja — wobei das Setup bewusst klein ist: Studien laufen über teilbare Links, deinen eigenen Teilnehmer-Pool oder die Panel-Anbindung, ganz ohne technisches Projekt. Wie eng wir dich beim Rollout, beim Onboarding und im laufenden Betrieb begleiten, stimmen wir auf dein Team ab.",
  },
  {
    q: "Ist das DSGVO-konform?",
    a: "Klymeo ist in Deutschland gebaut, in Frankfurt gehostet und DSGVO-nativ, ausgerichtet auf den EU AI Act. Datenschutz ist die Grundlage der Plattform, nicht der Nachgedanke — das gilt für jede Methode und jeden Account.",
  },
  {
    q: "Gibt es einen Piloten oder Einstieg?",
    a: "Ein begleiteter Einstieg ist möglich. Wir definieren gemeinsam einen klaren Rahmen, in dem du Klymeo an deinen echten Gesprächen erlebst, bevor du dich festlegst. Wie dieser Einstieg konkret aussieht, besprechen wir im Demo-Call.",
  },
];

export default function PricingPage() {
  return (
    <SiteShell>
      <PageHero
        eyebrow="Preise"
        title="Eine Lizenz, alle Methoden — der Preis passt zu deinem Team, nicht zu einem"
        italic="Schubladen-Tarif."
        lead="Klymeo passt sich an dein Team und deinen Umfang an — alle vier Methoden sind dabei. Den konkreten Preis legen wir gemeinsam im Gespräch fest, transparent und ohne Schubladen-Tarif."
        image="/site/photo-pricing.jpg"
        imageAlt="Klymeo Team-Session"
      />

      <section className="py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="max-w-2xl">
            <p className="text-xs uppercase tracking-[0.22em] text-soul">So funktioniert unser Pricing</p>
            <h2 className="mt-3 text-4xl leading-[1.05] md:text-5xl">
              Vier Faktoren bestimmen <span className="serif">deinen Preis.</span>
            </h2>
            <p className="mt-5 text-muted-foreground">
              Alle vier Methoden sind immer inklusive. Was den Preis bestimmt, sind vier Stellschrauben —
              Zugang, Umfang, Begleitung und Laufzeit —, die wir im Demo-Call gemeinsam durchgehen.
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
                  Preise sind ein Gespräch
                </p>
                <h2 className="mt-3 text-3xl leading-[1.05] md:text-4xl">
                  Lass uns deinen Preis <span className="mark mark-amber">individuell</span> festlegen.
                </h2>
                <p className="mt-4 max-w-xl text-muted-foreground">
                  Statt Schubladen-Tarif: In 30 Minuten gehen wir gemeinsam mit unserem Team Zugang, Umfang
                  und Begleitung durch — und du bekommst ein Angebot, das exakt zu deinem Team passt. Buch dir
                  direkt einen Termin im Kalender.
                </p>
                <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-muted-foreground">
                  <li className="inline-flex items-center gap-1.5"><span className="h-1 w-1 rounded-full bg-soul" /> Transparent</li>
                  <li className="inline-flex items-center gap-1.5"><span className="h-1 w-1 rounded-full bg-soul" /> Ohne Verkaufsdruck</li>
                  <li className="inline-flex items-center gap-1.5"><span className="h-1 w-1 rounded-full bg-soul" /> Mit Live-Mini-Studie</li>
                </ul>
              </div>
              <div className="flex flex-col gap-2.5 md:items-end">
                <a
                  href={DEMO_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="group inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3.5 text-sm font-medium text-paper transition hover:-translate-y-0.5 hover:shadow-[0_12px_40px_-10px_oklch(0.72_0.16_55_/_0.6)]"
                >
                  Demo-Termin buchen
                  <span aria-hidden className="transition group-hover:translate-x-0.5">→</span>
                </a>
                <Link
                  href="/kontakt"
                  className="text-xs text-muted-foreground underline-offset-4 hover:text-ink hover:underline"
                >
                  oder direkt schreiben
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-border bg-secondary/40 py-24">
        <div className="mx-auto grid max-w-7xl gap-12 px-6 lg:grid-cols-[1fr_1.1fr] lg:items-center">
          <div className="relative aspect-[4/5] overflow-hidden rounded-3xl border border-border">
            <img src="/site/photo-industry.jpg" alt="Klymeo Workshop" loading="lazy" className="h-full w-full object-cover" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-soul">Vier Methoden, eine Engine</p>
            <h2 className="mt-3 text-4xl leading-[1.05] md:text-5xl">
              Alle vier Methoden inklusive — du startest mit der, <span className="serif">die heute zählt.</span>
            </h2>
            <p className="mt-5 text-muted-foreground">
              Vier Facetten einer gemeinsamen KI-Engine, alle ab Tag eins freigeschaltet. Du beginnst mit der
              Methode, die den größten Hebel hat — die anderen stehen bereit, sobald dein Team so weit ist.
              Geführte Interviews zählen durchgängig weiter.
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
            <p className="text-xs uppercase tracking-[0.22em] text-soul">In jedem Konto</p>
            <h2 className="mt-3 text-4xl leading-[1.05] md:text-5xl">
              Was bei jedem Klymeo-Konto <span className="serif">dabei ist.</span>
            </h2>
            <p className="mt-5 text-muted-foreground">
              Unabhängig davon, welche Methoden du wählst: Diese Grundlagen gelten für jeden Account — die
              DACH-Souveränität, auf die es in Europa ankommt, und das Beleg-Versprechen, das durch jede
              Methode läuft.
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
            Du willst Klymeo erst an deinen eigenen Gesprächen sehen? Ein begleiteter Einstieg ist möglich
            — den passenden Rahmen besprechen wir im Demo-Call.
          </p>
        </div>
      </section>

      <section className="border-y border-border bg-secondary/40 py-24">
        <div className="mx-auto max-w-5xl px-6">
          <p className="text-xs uppercase tracking-[0.22em] text-soul">Häufige Fragen</p>
          <h2 className="mt-3 text-4xl leading-[1.05]">
            Alles, was du zum Pricing <span className="serif">wissen willst.</span>
          </h2>
          <p className="mt-4 text-muted-foreground">
            Die Fragen, die vor einem Custom-Angebot am häufigsten kommen — ehrlich beantwortet.
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
        title="Sprich mit uns über"
        italic="deinen Umfang."
        body="In einem kurzen Gespräch klären wir, welcher Zugang, welcher Umfang und welche Begleitung zu deinem Team passen — alle Methoden sind dabei — und du siehst, was Klymeo an deinen echten Gesprächen leistet."
        primary="Demo buchen"
        secondary="Plattform ansehen"
      />
    </SiteShell>
  );
}
