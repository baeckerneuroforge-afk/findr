import type { Metadata } from "next";
import type { ReactNode } from "react";
import { CtaLink } from "@/components/marketing/CtaLink";
import { Rv } from "@/components/marketing/studio/Rv";
import { CTASection } from "@/components/marketing/CTASection";
import { ogDefaultsFor, buildAlternates } from "@/lib/marketing/seo";
import { DEMO_BOOKING_URL } from "@/lib/marketing/constants";
import {
  localizedContent,
  localizePath,
  resolveLocale,
} from "@/i18n/marketing-locale";

/**
 * „Mensch & KI" — die Haltungs-/Positionierungsseite: Klymeo ergänzt und
 * verstärkt die Forschung, ersetzt aber niemals Menschen oder Jobs. Gebaut im
 * vollen Studio-Konsolen-Register (Rv-Choreografie, st-display-Poster, st-kap,
 * st-tool-Karten, st-serif-Akzent, st-hl-Marker, CTASection-Finale) — exakt das
 * Muster von /produkt, additiv: keine bestehende Seite wird angefasst.
 *
 * Strategie bewusst aus EIGENER Stärke (nie defensiv „wir nehmen dir nicht den
 * Job"): die Arbeitsteilung wird GEZEIGT statt behauptet, jede Aussage ist an
 * ein reales Feature gekoppelt. Anbindung: Footer („Unternehmen") + Sitemap über
 * nav-data.ts, locale-loser Redirect in next.config.ts — wie jede andere Seite.
 */

const PATH = "/mensch-und-ki";
const META = {
  title: { de: "Mensch & KI", en: "Humans & AI" },
  ogTitle: { de: "Mensch & KI — Klymeo", en: "Humans & AI — Klymeo" },
  description: {
    de: "Klymeo revolutioniert die Marktforschung — ohne Menschen zu ersetzen. Die KI übernimmt den Maschinen-Teil (hunderte Interviews führen, transkribieren, verdichten), du behältst den Menschen-Teil: die Frage, das Urteil, die Entscheidung. Mensch und KI, Hand in Hand.",
    en: "Klymeo revolutionizes market research — without replacing people. The AI takes the machine part (running hundreds of interviews, transcribing, distilling); you keep the human part: the question, the judgment, the decision. Humans and AI, hand in hand.",
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const locale = resolveLocale((await params).lang);
  return {
    title: localizedContent(locale, META.title),
    description: localizedContent(locale, META.description),
    alternates: buildAlternates(locale, PATH),
    openGraph: {
      ...ogDefaultsFor(locale),
      title: localizedContent(locale, META.ogTitle),
      url: localizePath(locale, PATH),
    },
  };
}

const WRAP = "mx-auto w-full max-w-[1280px] px-[clamp(20px,4vw,56px)]";

/** Kapitelmarke — Mono-Label + auslaufende Hairline (gleich wie Homepage/Produkt). */
function Kap({ label }: { label: string }) {
  return (
    <div className="st-kap">
      <span className="st-tag">{label}</span>
    </div>
  );
}

type ProofCard = { tag: ReactNode; body: ReactNode; pill: string };

type Content = {
  heroEyebrow: string;
  heroTitle: ReactNode;
  heroLead: ReactNode;
  heroCtaPrimary: string;
  heroCtaSecondary: string;

  splitKap: string;
  splitTitle: ReactNode;
  splitLead: ReactNode;
  splitCardTag: string;
  splitCardHandoff: string;
  machineHead: string;
  machineItems: ReactNode[];
  humanHead: string;
  humanItems: ReactNode[];
  humanFoot: string;
  band: string;

  proofKap: string;
  proofTitle: ReactNode;
  proofLead: ReactNode;
  proofCards: ProofCard[];

  pull: ReactNode;

  ctaEyebrow: string;
  ctaTitle: ReactNode;
  ctaLead: string;
  ctaPrimary: string;
  ctaSecondary: string;
};

const CONTENT_DE: Content = {
  heroEyebrow: "Mensch & KI",
  heroTitle: (
    <>
      <span className="st-ln">
        <i>Die Engine führt.</i>
      </span>
      <span className="st-ln">
        <i>
          Du <span className="st-serif">entscheidest.</span>
        </i>
      </span>
    </>
  ),
  heroLead: (
    <>
      Klymeo nimmt dir den Maschinen-Teil der Forschung ab — hunderte Interviews
      führen, transkribieren, verdichten. Den Menschen-Teil behältst du: die
      Frage, die zählt, das Urteil, die Entscheidung. Kein Ersatz, ein
      Verstärker.
    </>
  ),
  heroCtaPrimary: "Demo buchen",
  heroCtaSecondary: "Die Plattform ansehen",

  splitKap: "Die zwei Hälften der Forschung",
  splitTitle: (
    <>
      <span className="st-ln">
        <i>Maschinen-Teil.</i>
      </span>
      <span className="st-ln">
        <i>
          <span className="st-serif">Menschen-Teil.</span>
        </i>
      </span>
    </>
  ),
  splitLead: (
    <>
      Klare Rollenteilung: Klymeo übernimmt das Skalierbare und Mühsame. Du
      behältst das, wofür es einen Menschen braucht.
    </>
  ),
  splitCardTag: "Die zwei Hälften der Forschung",
  splitCardHandoff: "Übergabe",
  machineHead: "Das macht ab jetzt die Engine",
  machineItems: [
    "Jedes Wort transkribieren",
    "Hunderte Gespräche führen und nachbohren",
    "Zitate am O-Ton verankern",
    "Die Zahlen server-seitig rechnen",
  ],
  humanHead: "Das bleibt deine Arbeit",
  humanItems: [
    "Die richtige Frage stellen",
    "Eine Pause im Gesagten erkennen",
    "Entscheiden, was es bedeutet",
    "Die Story bauen, die das Team bewegt",
  ],
  humanFoot: "Dafür gibt es dich.",
  band: "Zahl ist Fakt. Formulierung ist Vorschlag. Das Urteil bleibt bei dir.",

  proofKap: "Belegt, nicht behauptet",
  proofTitle: (
    <>
      <span className="st-ln">
        <i>Im Produkt</i>
      </span>
      <span className="st-ln">
        <i>
          <span className="st-serif">verankert.</span>
        </i>
      </span>
    </>
  ),
  proofLead: (
    <>
      Drei Stellen, an denen der Mensch im Zentrum bleibt — nicht als
      Versprechen, sondern als gebautes Verhalten.
    </>
  ),
  proofCards: [
    {
      tag: "Mensch gestaltet · KI assistiert",
      body: (
        <>
          Klymeo entwirft deinen Leitfaden. Du editierst Topics, Fragen und
          Probes, bevor jemand interviewt wird.
        </>
      ),
      pill: "verankert · guide-generator",
    },
    {
      tag: "Zahl = Fakt · Deutung = deine",
      body: (
        <>
          Häufigkeiten rechnet der Server — deterministisch, erst ab drei
          Gesprächen. Die Formulierung bleibt ein Vorschlag.
        </>
      ),
      pill: "verankert · synthesis/engine",
    },
    {
      tag: "Keine Persona ohne O-Ton",
      body: (
        <>
          Personas entstehen erst ab zehn Interviews, jede aus mindestens zwei
          echten Stimmen mit verankerten Zitaten.
        </>
      ),
      pill: "verankert · audience-personas",
    },
  ],

  pull: (
    <>
      Werkzeuge, die über Menschen urteilen, gibt es genug. Wir bauen eins, das{" "}
      <Rv as="span" className="st-hl" threshold={0.6}>
        für Menschen nachbohrt
      </Rv>
      .
    </>
  ),

  ctaEyebrow: "Hand in Hand",
  ctaTitle: (
    <>
      Mehr Tiefe. <span className="st-serif">Deine</span> Entscheidung.
    </>
  ),
  ctaLead:
    "Sieh im Demo-Call, wie Klymeo den Maschinen-Teil übernimmt — und dir den Menschen-Teil zurückgibt.",
  ctaPrimary: "Demo buchen →",
  ctaSecondary: "Die Plattform ansehen",
};

const CONTENT_EN: Content = {
  heroEyebrow: "Humans & AI",
  heroTitle: (
    <>
      <span className="st-ln">
        <i>The engine runs.</i>
      </span>
      <span className="st-ln">
        <i>
          You <span className="st-serif">decide.</span>
        </i>
      </span>
    </>
  ),
  heroLead: (
    <>
      Klymeo takes the machine part of research off your plate — running hundreds
      of interviews, transcribing, distilling. You keep the human part: the
      question that matters, the judgment, the decision. Not a replacement, an
      amplifier.
    </>
  ),
  heroCtaPrimary: "Book a demo",
  heroCtaSecondary: "See the platform",

  splitKap: "The two halves of research",
  splitTitle: (
    <>
      <span className="st-ln">
        <i>The machine part.</i>
      </span>
      <span className="st-ln">
        <i>
          The <span className="st-serif">human part.</span>
        </i>
      </span>
    </>
  ),
  splitLead: (
    <>
      A clear division of labor: Klymeo takes on what scales and what&apos;s
      tedious. You keep what takes a human.
    </>
  ),
  splitCardTag: "The two halves of research",
  splitCardHandoff: "Handover",
  machineHead: "What the engine now does",
  machineItems: [
    "Transcribe every word",
    "Run hundreds of conversations and probe",
    "Anchor quotes to the verbatim",
    "Compute the numbers server-side",
  ],
  humanHead: "What stays your work",
  humanItems: [
    "Ask the right question",
    "Catch a pause in what was said",
    "Decide what it means",
    "Build the story that moves the team",
  ],
  humanFoot: "That's what you're for.",
  band: "The number is fact. The wording is a suggestion. The judgment stays with you.",

  proofKap: "Evidenced, not claimed",
  proofTitle: (
    <>
      <span className="st-ln">
        <i>Anchored in the</i>
      </span>
      <span className="st-ln">
        <i>
          <span className="st-serif">product.</span>
        </i>
      </span>
    </>
  ),
  proofLead: (
    <>
      Three places where the human stays at the center — not as a promise, but as
      built behavior.
    </>
  ),
  proofCards: [
    {
      tag: "Human designs · AI assists",
      body: (
        <>
          Klymeo drafts your guide. You edit topics, questions and probes before
          anyone is interviewed.
        </>
      ),
      pill: "anchored · guide-generator",
    },
    {
      tag: "Number = fact · meaning = yours",
      body: (
        <>
          Frequencies are computed server-side — deterministic, and only from
          three conversations on. The wording stays a suggestion.
        </>
      ),
      pill: "anchored · synthesis/engine",
    },
    {
      tag: "No persona without verbatim",
      body: (
        <>
          Personas only emerge from ten interviews on, each from at least two
          real voices with anchored quotes.
        </>
      ),
      pill: "anchored · audience-personas",
    },
  ],

  pull: (
    <>
      There are enough tools that pass judgment on people. We&apos;re building one
      that{" "}
      <Rv as="span" className="st-hl" threshold={0.6}>
        digs deeper for them
      </Rv>
      .
    </>
  ),

  ctaEyebrow: "Hand in hand",
  ctaTitle: (
    <>
      More depth. <span className="st-serif">Your</span> decision.
    </>
  ),
  ctaLead:
    "See in the demo call how Klymeo takes on the machine part — and hands the human part back to you.",
  ctaPrimary: "Book a demo →",
  ctaSecondary: "See the platform",
};

export default async function MenschUndKiPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const locale = resolveLocale(lang);
  const c = localizedContent(lang, { de: CONTENT_DE, en: CONTENT_EN });

  return (
    <>
      {/* 1 ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="st-sky relative overflow-hidden pb-[clamp(70px,10vh,120px)] pt-[clamp(120px,16vh,180px)]">
        <div className={WRAP}>
          <Rv as="p" className="st-fade st-tag !text-[var(--st-ink-60)]">
            {c.heroEyebrow}
          </Rv>
          <Rv as="h1" className="st-rv st-display mt-5 text-[clamp(38px,7vw,108px)]">
            {c.heroTitle}
          </Rv>
          <Rv
            as="p"
            className="st-fade mt-6 max-w-[58ch] text-[clamp(16px,1.4vw,19px)] leading-[1.7] text-neutral-500"
            d={120}
          >
            {c.heroLead}
          </Rv>
          <Rv className="st-fade mt-9 flex flex-wrap gap-3.5" d={220}>
            <CtaLink href={DEMO_BOOKING_URL} variant="primary" size="lg" className="magnetic">
              <span className="st-dot" aria-hidden />
              {c.heroCtaPrimary}
            </CtaLink>
            <CtaLink href="/produkt" variant="secondary" size="lg">
              {c.heroCtaSecondary}
            </CtaLink>
          </Rv>
        </div>
      </section>

      {/* 2 ── DIE ZWEI HÄLFTEN (der Kern) ───────────────────────────────────── */}
      <section className="pb-[clamp(90px,14vh,170px)]">
        <div className={WRAP}>
          <Kap label={c.splitKap} />
          <div className="mb-[clamp(36px,6vh,64px)] flex flex-wrap items-end justify-between gap-6">
            <Rv as="h2" className="st-rv st-display text-[clamp(30px,4.6vw,64px)]">
              {c.splitTitle}
            </Rv>
            <Rv as="p" className="st-fade max-w-[42ch] text-neutral-500" d={100}>
              {c.splitLead}
            </Rv>
          </div>

          <Rv className="st-fade">
            <div className="overflow-hidden rounded-xl bg-[var(--st-paper)] shadow-[0_1px_0_rgba(24,24,27,0.04),0_50px_110px_-45px_rgba(31,35,80,0.4),0_0_0_1px_var(--st-line)]">
              <div className="flex items-center justify-between gap-3 border-b border-[var(--st-line)] bg-gradient-to-b from-[var(--st-paper)] to-[var(--st-paper-shade)] px-[clamp(18px,3vw,26px)] py-4">
                <span className="st-tag">{c.splitCardTag}</span>
                <span className="st-deck-rec">
                  <b aria-hidden />
                  {c.splitCardHandoff}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2">
                {/* Maschine — gedämpft, fast „abgeschaltet" */}
                <div className="bg-[var(--st-paper-shade)] p-[clamp(20px,3vw,30px)]">
                  <div className="mb-4 font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--st-ink-35)]">
                    {c.machineHead}
                  </div>
                  <ul className="flex flex-col">
                    {c.machineItems.map((item, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2.5 py-2 text-[14px] leading-snug text-[var(--st-ink-35)]"
                      >
                        <span
                          aria-hidden
                          className="mt-2.5 h-px w-2.5 shrink-0 bg-[var(--st-line-strong)]"
                        />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                {/* Mensch — in Tinte, mit Indigo-Markern */}
                <div className="border-t border-[var(--st-line)] p-[clamp(20px,3vw,30px)] sm:border-l sm:border-t-0">
                  <div className="mb-4 font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--st-ink-60)]">
                    {c.humanHead}
                  </div>
                  <ul className="flex flex-col">
                    {c.humanItems.map((item, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2.5 py-2 text-[14px] font-medium leading-snug text-[var(--st-ink)]"
                      >
                        <span
                          aria-hidden
                          className="mt-1.5 h-[7px] w-[7px] shrink-0 rounded-full bg-[var(--st-rec)]"
                        />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <p className="st-quote mt-4 text-[17px] text-[var(--st-ink)]">
                    {c.humanFoot}
                  </p>
                </div>
              </div>
              <div className="st-quote border-t border-[var(--st-line)] px-[clamp(18px,3vw,26px)] py-4 text-center text-[16px] text-[var(--st-ink)]">
                {c.band}
              </div>
            </div>
          </Rv>
        </div>
      </section>

      {/* 3 ── BELEGT, NICHT BEHAUPTET (Proof-Karten) ────────────────────────── */}
      <section className="pb-[clamp(90px,14vh,170px)]">
        <div className={WRAP}>
          <Kap label={c.proofKap} />
          <div className="mb-[clamp(36px,6vh,64px)] flex flex-wrap items-end justify-between gap-6">
            <Rv as="h2" className="st-rv st-display text-[clamp(30px,4.6vw,64px)]">
              {c.proofTitle}
            </Rv>
            <Rv as="p" className="st-fade max-w-[42ch] text-neutral-500" d={100}>
              {c.proofLead}
            </Rv>
          </div>
          <div className="grid gap-6 sm:grid-cols-3">
            {c.proofCards.map((card, i) => (
              <Rv key={i} className="st-fade st-tool" threshold={0.3} d={i * 100}>
                <span className="st-tag !text-[var(--st-ink-60)]">{card.tag}</span>
                <p>{card.body}</p>
                <div className="st-tool-foot">
                  <span>{card.pill}</span>
                </div>
              </Rv>
            ))}
          </div>
        </div>
      </section>

      {/* 4 ── HALTUNGSSATZ ──────────────────────────────────────────────────── */}
      <section className="pb-[clamp(100px,15vh,180px)]">
        <div className={WRAP}>
          <Rv as="p" className="st-fade st-big mx-auto max-w-[24ch] text-center">
            {c.pull}
          </Rv>
        </div>
      </section>

      {/* 5 ── FINALE (wiederverwendbare Twilight-CTA) ───────────────────────── */}
      <CTASection
        lang={locale}
        eyebrow={c.ctaEyebrow}
        title={c.ctaTitle}
        lead={c.ctaLead}
        primary={{ label: c.ctaPrimary, href: DEMO_BOOKING_URL }}
        secondary={{ label: c.ctaSecondary, href: "/produkt" }}
      />
    </>
  );
}
