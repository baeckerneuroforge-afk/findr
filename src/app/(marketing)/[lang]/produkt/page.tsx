import type { Metadata } from "next";
import type { CSSProperties, ReactNode } from "react";
import { CtaLink } from "@/components/marketing/CtaLink";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Rv } from "@/components/marketing/studio/Rv";
import { NumbersBand } from "@/components/marketing/studio/NumbersBand";
import { PlatformModules } from "@/components/marketing/PlatformModules";
import { CTASection } from "@/components/marketing/CTASection";
import { SITE_URL, ogDefaultsFor, buildAlternates } from "@/lib/marketing/seo";
import { DEMO_BOOKING_URL } from "@/lib/marketing/constants";
import {
  localizedContent,
  localizePath,
  resolveLocale,
  toBcp47,
  type Locale,
} from "@/i18n/marketing-locale";

const PATH = "/produkt";

const META = {
  title: { de: "Plattform", en: "Platform" },
  ogTitle: { de: "Plattform — Klymeo", en: "Platform — Klymeo" },
  description: {
    de: "Die ganze Forschungs-Konsole: KI-Tiefeninterviews auf Deutsch — auf Wunsch hörbar per Voice-Agent —, Entwürfe als Stimulus direkt im Gespräch, Screening, Quoten und Panel-Anbindung für die Rekrutierung, und eine Synthese, die als PDF-Report oder PowerPoint-Deck exportiert. DSGVO-nativ, in Frankfurt gehostet.",
    en: "The whole research console: AI in-depth interviews in German and English — optionally audible via the Voice Agent —, drafts shown as Stimulus right in the conversation, screening, quotas and panel integration for recruitment, and a synthesis that exports as a PDF report or PowerPoint deck. GDPR-native, hosted in Frankfurt.",
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

function buildJsonLd(locale: Locale) {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Klymeo",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: `${SITE_URL}${localizePath(locale, PATH)}`,
    inLanguage: toBcp47(locale),
    description: localizedContent(locale, META.description),
    featureList: localizedContent(locale, {
      de: [
        "Voice-Agent-Interviews",
        "Stimulus: Entwürfe im Interview zeigen",
        "Synthese mit PDF- & PowerPoint-Export",
        "Screening, Quoten & Panel-Anbindung",
        "Bedarf & Verhalten",
        "Markenwahrnehmung",
        "Konzept-Test",
        "Creative-Test",
      ],
      en: [
        "Voice Agent interviews",
        "Stimulus: show drafts in the interview",
        "Synthesis with PDF & PowerPoint export",
        "Screening, quotas & panel integration",
        "Needs & Behavior",
        "Brand Perception",
        "Concept Test",
        "Creative Test",
      ],
    }),
  };
}

/** Kapitelmarke — Mono-Label + auslaufende Hairline (wie auf der Homepage). */
function Kap({ label }: { label: string }) {
  return (
    <div className="st-kap">
      <span className="st-tag">{label}</span>
    </div>
  );
}

const WRAP = "mx-auto w-full max-w-[1280px] px-[clamp(20px,4vw,56px)]";

// Voice-Pegel fürs Konsolen-Theater (statische Höhen, CSS animiert).
const VOICE_BARS = [38, 62, 24, 78, 46, 90, 30, 70, 52, 84, 36, 58, 26, 66];

/**
 * German page copy, extracted so an English variant can be filled in later.
 * EN noch nicht getextet → DE-Fallback (EN=DE). Fragmentierte/markierte
 * Headlines liegen als ganze ReactNodes vor; strukturierte Arrays (Bullets,
 * Karten, Chips, QUALITY) bleiben als Felder. Nicht-Text (Zahlen, Icon-Refs,
 * classNames) bleibt im JSX.
 */
type ProduktContent = {
  heroEyebrow: string;
  heroTitle: ReactNode;
  heroLead: ReactNode;
  heroCtaPrimary: string;
  heroCtaSecondary: string;

  voiceKap: string;
  voiceTitle: ReactNode;
  voiceLead: string;
  voiceBullets: string[];
  voiceToolTag: string;
  voiceToolLive: string;
  voiceTapeKlymeoWho: string;
  voiceTapeKlymeoText: string;
  voiceTapePersonWho: string;
  voiceTapePersonText: ReactNode;
  voiceToolFoot: string[];

  stimulusKap: string;
  stimulusTitle: ReactNode;
  stimulusLead: string;
  stimulusBullets: string[];
  stimulusToolTag: string;
  stimulusToolLive: string;
  stimulusAssetTag: string;
  stimulusChat: ReactNode;
  stimulusToolFoot: string[];

  syntheseKap: string;
  syntheseTitle: ReactNode;
  syntheseLead: string;
  syntheseCards: { n: string; t: string; d: string }[];
  syntheseOutputLabel: string;
  syntheseOutputs: string[];

  qualitaetKap: string;
  qualitaetTitle: ReactNode;
  qualitaetLead: string;
  quality: { n: string; t: string; d: string }[];

  modulesTitle: string;

  ctaTitle: ReactNode;
  ctaLead: string;
};

const CONTENT_DE: ProduktContent = {
  // ── Poster-Kopf ──────────────────────────────────────────────────────
  heroEyebrow: "Die Plattform",
  heroTitle: (
    <>
      <span className="st-ln">
        <i>Die ganze</i>
      </span>
      <span className="st-ln">
        <i>
          Forschungs-<span className="st-serif">Konsole.</span>
        </i>
      </span>
    </>
  ),
  heroLead: (
    <>
      Eine Engine führt die Interviews, vier Methoden richten sie aus —
      und die Werkzeuge drumherum machen daraus einen kompletten
      Forschungs-Arbeitsplatz: <b className="font-medium text-neutral-900">Voice-Agent</b>,{" "}
      <b className="font-medium text-neutral-900">Stimulus</b>, Screening
      und Quoten, Synthese mit{" "}
      <b className="font-medium text-neutral-900">PDF- &amp; PowerPoint-Export</b>.
    </>
  ),
  heroCtaPrimary: "Demo buchen",
  heroCtaSecondary: "Werkzeuge ansehen ↓",

  // ── P.01 — Voice-Agent ───────────────────────────────────────────────
  voiceKap: "P.01 — Der Voice-Agent",
  voiceTitle: (
    <>
      <span className="st-ln">
        <i>Interviews, die</i>
      </span>
      <span className="st-ln">
        <i>
          man <span className="st-serif">hört.</span>
        </i>
      </span>
    </>
  ),
  voiceLead:
    "Der Klymeo-Voice-Agent führt das Tiefeninterview hörbar: Er stellt die Fragen, hört zu und bohrt nach — Teilnehmer:innen sprechen einfach, statt zu tippen. Das senkt die Hürde, macht Antworten länger und ehrlicher und erreicht auch Zielgruppen, die keine Lust auf Formulare haben.",
  voiceBullets: [
    "Spricht und versteht Deutsch — dieselbe Nachbohr-Logik wie im Text-Interview",
    "Tippen bleibt jederzeit möglich; beides landet im selben Transkript",
    "Jede Erkenntnis bleibt am Transkript belegt — Voice ändert nichts an der Beleg-Disziplin",
  ],
  voiceToolTag: "Voice-Session · Beispiel",
  voiceToolLive: "Live",
  voiceTapeKlymeoWho: "Klymeo",
  voiceTapeKlymeoText: "„Und wenn dir nichts einfällt — was machst du dann?“",
  voiceTapePersonWho: "Person",
  voiceTapePersonText: (
    <>
      <em className="st-quote">gesprochen, live transkribiert —</em>{" "}
      „Meistens bestell ich dann einfach was …“
    </>
  ),
  voiceToolFoot: ["Sprechen statt tippen", "Barge-in erlaubt", "Ein Transkript"],

  // ── P.02 — Stimulus ──────────────────────────────────────────────────
  stimulusKap: "P.02 — Stimulus",
  stimulusTitle: (
    <>
      <span className="st-ln">
        <i>Zeig, woran</i>
      </span>
      <span className="st-ln">
        <i>
          du <span className="st-serif">arbeitest.</span>
        </i>
      </span>
    </>
  ),
  stimulusLead:
    "Lade einen Entwurf in die Studie — Packshot, Anzeige, Claim, Landingpage — und deine Zielgruppe sieht ihn direkt neben dem Gespräch. Statt über Erinnerungen zu reden, nehmen Teilnehmer:innen Bezug auf genau das Material, das du testen willst. Das ist der Kern von Konzept- und Creative-Test.",
  stimulusBullets: [
    "Bild hochladen oder Link einbinden — Teilnehmer:innen sehen es im Split-View",
    "Die KI fragt gezielt zum Gezeigten nach: Ersteindruck, Verständnis, Kaufimpuls",
    "Gebaut für Design-, Marken- und Marketingteams — vom Scribble bis zur fertigen Kampagne",
  ],
  stimulusToolTag: "Konzept-Test · Beispiel",
  stimulusToolLive: "Live",
  stimulusAssetTag: "Dein Entwurf",
  stimulusChat: (
    <>
      <span className="is-f">Was fällt dir zuerst auf?</span>
      <span>„Das Dunkelblau wirkt hochwertig — aber ich finde den Preis nicht.“</span>
      <span className="is-f">Wo hast du ihn gesucht?</span>
    </>
  ),
  stimulusToolFoot: ["Bild oder Link", "Split-View im Interview", "Mehrere Varianten testbar"],

  // ── P.03 — Synthese & Export ─────────────────────────────────────────
  syntheseKap: "P.03 — Synthese & Export",
  syntheseTitle: (
    <>
      <span className="st-ln">
        <i>Vom Gespräch</i>
      </span>
      <span className="st-ln">
        <i>
          zur <span className="st-serif">Folie.</span>
        </i>
      </span>
    </>
  ),
  syntheseLead:
    "Die Synthese verdichtet alle Interviews zu Themen, Lagern und Originalzitaten — und exportiert das Ergebnis als PDF-Report oder PowerPoint-Deck im eigenen Branding. Vom O-Ton bis zur Vorstandsfolie, ohne Copy-Paste.",
  syntheseCards: [
    {
      n: "01",
      t: "So ist sie aufgebaut",
      d: "Themen mit Gewicht, Lager mit Größe, jedes mit Originalzitaten verankert — dazu das Verdikt: Annahme vs. Realität. Keine Black-Box-Zusammenfassung, jeder Befund trägt seinen Beleg.",
    },
    {
      n: "02",
      t: "Frag die Daten",
      d: "Stell dem gesamten Studien-Korpus Rückfragen im Chat und bekomme belegte Antworten. Über mehrere Studien zählt Klymeo deterministisch: „in 3 von 7 Studien“ — nie geschätzt.",
    },
    {
      n: "03",
      t: "Exportier das Ergebnis",
      d: "Ein Klick: PDF-Report für Entscheider oder PowerPoint-Deck fürs Meeting — beides im eigenen Branding. Dazu teilbare Ergebnis-Links für Stakeholder, auch extern.",
    },
  ],
  syntheseOutputLabel: "Ausgabe:",
  syntheseOutputs: ["PDF-Report", "PowerPoint-Deck", "Teilbarer Link", "Eigenes Branding"],

  // ── P.04 — Qualität & Rekrutierung ───────────────────────────────────
  qualitaetKap: "P.04 — Qualität & Rekrutierung",
  qualitaetTitle: (
    <>
      <span className="st-ln">
        <i>Die richtigen Leute,</i>
      </span>
      <span className="st-ln">
        <i>
          sauber <span className="st-serif">rekrutiert.</span>
        </i>
      </span>
    </>
  ),
  qualitaetLead:
    "Eine Synthese ist nur so gut wie ihre Stichprobe. Klymeo bringt die Werkzeuge mit, die dafür sorgen, dass die richtigen Menschen antworten — und nur die.",
  // P.04 — Qualität & Rekrutierung: die sechs realen Schutz- und Rekrutierungs-
  // Fähigkeiten (Screening-Fragen, Quoten, Open-Link mit Kontingent/Ablauf,
  // eigener Teilnehmer-Pool, Panel-Anbindung, Fraud-/Qualitätsprüfung).
  quality: [
    {
      n: "Q.01",
      t: "Screening-Gate",
      d: "Qualifizier Teilnehmer:innen vor dem Interview — die richtige Zielgruppe kommt rein, der Rest wird sauber und DSGVO-konform abgewiesen.",
    },
    {
      n: "Q.02",
      t: "Quoten",
      d: "Steuer die Stichprobe nach Merkmalen, statt zu hoffen, dass sie sich von selbst verteilt.",
    },
    {
      n: "Q.03",
      t: "Offener Studien-Link",
      d: "Ein Link, den du überall teilen kannst — mit Kontingent und Ablaufdatum gegen Missbrauch.",
    },
    {
      n: "Q.04",
      t: "Eigener Teilnehmer-Pool",
      d: "Bau deinen wiederverwendbaren Pool auf und lade gezielt zu neuen Studien ein.",
    },
    {
      n: "Q.05",
      t: "Panel-Anbindung",
      d: "Rekrutiere externe Teilnehmer:innen über die Panel-Integration, wenn der eigene Kreis nicht reicht.",
    },
    {
      n: "Q.06",
      t: "Fraud- & Qualitätsprüfung",
      d: "Durchklicker und Mehrfachteilnahmen werden erkannt und gefiltert — bevor sie deine Synthese verwässern.",
    },
  ],

  // ── P.05 — Die vier Methoden ─────────────────────────────────────────
  modulesTitle: "Vier Methoden, eine Engine.",

  // ── Zahlen + CTA ─────────────────────────────────────────────────────
  ctaTitle: <>Eine Konsole. Alles drin.</>,
  ctaLead:
    "Sieh in einer Demo, wie Voice-Agent, Stimulus und Synthese zusammenspielen — von der ersten Frage bis zum exportierten Deck.",
};

const CONTENT_EN: ProduktContent = {
  // ── Poster-Kopf ──────────────────────────────────────────────────────
  heroEyebrow: "The platform",
  heroTitle: (
    <>
      <span className="st-ln">
        <i>The whole</i>
      </span>
      <span className="st-ln">
        <i>
          research <span className="st-serif">console.</span>
        </i>
      </span>
    </>
  ),
  heroLead: (
    <>
      One engine runs the interviews, four methods aim them —
      and the tools around them turn it into a complete
      research workspace: <b className="font-medium text-neutral-900">Voice Agent</b>,{" "}
      <b className="font-medium text-neutral-900">Stimulus</b>, screening
      and quotas, synthesis with{" "}
      <b className="font-medium text-neutral-900">PDF &amp; PowerPoint export</b>.
    </>
  ),
  heroCtaPrimary: "Book a demo",
  heroCtaSecondary: "See the tools ↓",

  // ── P.01 — Voice-Agent ───────────────────────────────────────────────
  voiceKap: "P.01 — The Voice Agent",
  voiceTitle: (
    <>
      <span className="st-ln">
        <i>Interviews you</i>
      </span>
      <span className="st-ln">
        <i>
          can <span className="st-serif">hear.</span>
        </i>
      </span>
    </>
  ),
  voiceLead:
    "The Klymeo Voice Agent runs the in-depth interview out loud: it asks the questions, listens and probes deeper — participants simply speak instead of typing. That lowers the barrier, makes answers longer and more honest, and reaches audiences who have no patience for forms.",
  voiceBullets: [
    "Speaks and understands German and English — the same follow-up logic as the text interview",
    "Typing stays available at any time; both land in the same transcript",
    "Every insight stays backed by the transcript — voice changes nothing about the evidence discipline",
  ],
  voiceToolTag: "Voice session · example",
  voiceToolLive: "Live",
  voiceTapeKlymeoWho: "Klymeo",
  voiceTapeKlymeoText: "“And when nothing comes to mind — what do you do then?”",
  voiceTapePersonWho: "Person",
  voiceTapePersonText: (
    <>
      <em className="st-quote">spoken, transcribed live —</em>{" "}
      “Usually I just order something …”
    </>
  ),
  voiceToolFoot: ["Speak, don't type", "Barge-in allowed", "One transcript"],

  // ── P.02 — Stimulus ──────────────────────────────────────────────────
  stimulusKap: "P.02 — Stimulus",
  stimulusTitle: (
    <>
      <span className="st-ln">
        <i>Show what you&apos;re</i>
      </span>
      <span className="st-ln">
        <i>
          working <span className="st-serif">on.</span>
        </i>
      </span>
    </>
  ),
  stimulusLead:
    "Load a draft into the study — packshot, ad, claim, landing page — and your audience sees it right next to the conversation. Instead of talking about memories, participants react to exactly the material you want to test. That's the heart of concept and creative testing.",
  stimulusBullets: [
    "Upload an image or embed a link — participants see it in split view",
    "The AI probes specifically about what's shown: first impression, comprehension, purchase impulse",
    "Built for design, brand and marketing teams — from the scribble to the finished campaign",
  ],
  stimulusToolTag: "Concept test · example",
  stimulusToolLive: "Live",
  stimulusAssetTag: "Your draft",
  stimulusChat: (
    <>
      <span className="is-f">What stands out first?</span>
      <span>“The dark blue feels premium — but I can&apos;t find the price.”</span>
      <span className="is-f">Where did you look for it?</span>
    </>
  ),
  stimulusToolFoot: ["Image or link", "Split view in the interview", "Test several variants"],

  // ── P.03 — Synthese & Export ─────────────────────────────────────────
  syntheseKap: "P.03 — Synthesis & Export",
  syntheseTitle: (
    <>
      <span className="st-ln">
        <i>From conversation</i>
      </span>
      <span className="st-ln">
        <i>
          to <span className="st-serif">slide.</span>
        </i>
      </span>
    </>
  ),
  syntheseLead:
    "Synthesis distills every interview into themes, camps and verbatim quotes — and exports the result as a PDF report or PowerPoint deck in your own branding. From verbatim to boardroom slide, without copy-paste.",
  syntheseCards: [
    {
      n: "01",
      t: "How it's built",
      d: "Themes with weight, camps with size, each anchored in verbatim quotes — plus the verdict: assumption vs. reality. No black-box summary; every finding carries its evidence.",
    },
    {
      n: "02",
      t: "Ask your data",
      d: "Put follow-up questions to the entire study corpus in chat and get evidenced answers. Across multiple studies Klymeo counts deterministically: “in 3 of 7 studies” — never estimated.",
    },
    {
      n: "03",
      t: "Export the result",
      d: "One click: a PDF report for decision-makers or a PowerPoint deck for the meeting — both in your own branding. Plus shareable result links for stakeholders, including external ones.",
    },
  ],
  syntheseOutputLabel: "Output:",
  syntheseOutputs: ["PDF report", "PowerPoint deck", "Shareable link", "Your own branding"],

  // ── P.04 — Qualität & Rekrutierung ───────────────────────────────────
  qualitaetKap: "P.04 — Quality & Recruitment",
  qualitaetTitle: (
    <>
      <span className="st-ln">
        <i>The right people,</i>
      </span>
      <span className="st-ln">
        <i>
          cleanly <span className="st-serif">recruited.</span>
        </i>
      </span>
    </>
  ),
  qualitaetLead:
    "A synthesis is only as good as its sample. Klymeo brings the tools that make sure the right people answer — and only them.",
  quality: [
    {
      n: "Q.01",
      t: "Screening gate",
      d: "Qualify participants before the interview — the right audience gets in, the rest is turned away cleanly and GDPR-compliantly.",
    },
    {
      n: "Q.02",
      t: "Quotas",
      d: "Steer the sample by attributes, instead of hoping it balances out on its own.",
    },
    {
      n: "Q.03",
      t: "Open study link",
      d: "A link you can share anywhere — with a quota and an expiry date to guard against abuse.",
    },
    {
      n: "Q.04",
      t: "Your own participant pool",
      d: "Build your reusable pool and invite people directly to new studies.",
    },
    {
      n: "Q.05",
      t: "Panel integration",
      d: "Recruit external participants through the panel integration when your own circle isn't enough.",
    },
    {
      n: "Q.06",
      t: "Fraud & quality checks",
      d: "Click-throughs and duplicate entries are detected and filtered — before they dilute your synthesis.",
    },
  ],

  // ── P.05 — Die vier Methoden ─────────────────────────────────────────
  modulesTitle: "Four methods. One engine.",

  // ── Zahlen + CTA ─────────────────────────────────────────────────────
  ctaTitle: <>One console. Everything in it.</>,
  ctaLead:
    "See in a demo how the Voice Agent, Stimulus and synthesis work together — from the first question to the exported deck.",
};

export default async function ProduktPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const locale = resolveLocale(lang);
  const c = localizedContent(lang, { de: CONTENT_DE, en: CONTENT_EN });

  return (
    <>
      <JsonLd data={buildJsonLd(locale)} />

      {/* ── Poster-Kopf ──────────────────────────────────────────────── */}
      <section className="st-sky relative overflow-hidden pb-[clamp(70px,10vh,120px)] pt-[clamp(120px,16vh,180px)]">
        <div className={WRAP}>
          <Rv as="p" className="st-fade st-tag !text-[var(--st-rec-deep)]">
            {c.heroEyebrow}
          </Rv>
          <Rv as="h1" className="st-rv st-display mt-5 text-[clamp(38px,7vw,108px)]">
            {c.heroTitle}
          </Rv>
          <div className="mt-[clamp(28px,4vh,48px)] flex flex-wrap items-end justify-between gap-7">
            <Rv
              as="p"
              className="st-fade max-w-[58ch] text-[clamp(16px,1.4vw,19px)] leading-[1.7] text-neutral-500"
              d={120}
            >
              {c.heroLead}
            </Rv>
            <Rv className="st-fade flex flex-wrap gap-3.5" d={220}>
              <CtaLink href={DEMO_BOOKING_URL} variant="primary" size="lg" className="magnetic">
                <span className="st-dot" aria-hidden />
                {c.heroCtaPrimary}
              </CtaLink>
              <CtaLink href="#voice" variant="secondary" size="lg" className="magnetic">
                {c.heroCtaSecondary}
              </CtaLink>
            </Rv>
          </div>
        </div>
      </section>

      {/* ── P.01 — Voice-Agent ───────────────────────────────────────── */}
      <section id="voice" className="scroll-mt-24 py-[clamp(80px,12vh,150px)]">
        <div className={WRAP}>
          <Kap label={c.voiceKap} />
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <Rv as="h2" className="st-rv st-display text-[clamp(30px,4.6vw,64px)]">
                {c.voiceTitle}
              </Rv>
              <Rv as="p" className="st-fade mt-6 max-w-[52ch] leading-[1.75] text-neutral-500" d={100}>
                {c.voiceLead}
              </Rv>
              <Rv as="ul" className="st-fade mt-7 flex flex-col gap-2.5" d={180}>
                {c.voiceBullets.map((p) => (
                  <li key={p} className="relative pl-6 text-[15px] leading-relaxed text-neutral-700">
                    <span aria-hidden className="absolute left-0 top-[11px] h-px w-3.5 bg-primary-500" />
                    {p}
                  </li>
                ))}
              </Rv>
            </div>

            {/* Voice-Konsole: Pegel + Mini-Transkript */}
            <Rv className="st-fade st-tool" threshold={0.3} d={120}>
              <div className="flex items-center justify-between">
                <span className="st-tag">{c.voiceToolTag}</span>
                <span className="st-lamp st-lamp--light">
                  <b aria-hidden />
                  {c.voiceToolLive}
                </span>
              </div>
              <div className="st-voicebars" aria-hidden>
                {VOICE_BARS.map((h, i) => (
                  <i key={i} style={{ "--h": `${h}%`, "--i": i } as CSSProperties} />
                ))}
              </div>
              <div className="flex flex-col gap-3">
                <div className="st-tape-row !mb-0 !pr-0">
                  <span className="st-who !bg-[var(--st-rec)] !text-white !border-[var(--st-rec)]">{c.voiceTapeKlymeoWho}</span>
                  <p className="!text-[14px]">{c.voiceTapeKlymeoText}</p>
                </div>
                <div className="st-tape-row !mb-0 !pr-0">
                  <span className="st-who">{c.voiceTapePersonWho}</span>
                  <p className="!text-[14px] text-neutral-500">
                    {c.voiceTapePersonText}
                  </p>
                </div>
              </div>
              <div className="st-tool-foot">
                {c.voiceToolFoot.map((f) => (
                  <span key={f}>{f}</span>
                ))}
              </div>
            </Rv>
          </div>
        </div>
      </section>

      {/* ── P.02 — Stimulus ──────────────────────────────────────────── */}
      <section id="stimulus" className="scroll-mt-24 bg-warm py-[clamp(80px,12vh,150px)]">
        <div className={WRAP}>
          <Kap label={c.stimulusKap} />
          <div className="grid items-center gap-10 lg:grid-cols-2">
            {/* Mock zuerst (auf Desktop links), Copy rechts — gespiegelt zu P.01 */}
            <Rv className="st-fade st-tool order-2 lg:order-1" threshold={0.3} d={120}>
              <div className="flex items-center justify-between">
                <span className="st-tag">{c.stimulusToolTag}</span>
                <span className="st-lamp st-lamp--light">
                  <b aria-hidden />
                  {c.stimulusToolLive}
                </span>
              </div>
              <div className="st-stim" aria-hidden>
                <div className="st-stim-asset">
                  <span className="st-tag !text-[9px]">{c.stimulusAssetTag}</span>
                  <b>A</b>
                </div>
                <div className="st-stim-chat">
                  {c.stimulusChat}
                </div>
              </div>
              <div className="st-tool-foot">
                {c.stimulusToolFoot.map((f) => (
                  <span key={f}>{f}</span>
                ))}
              </div>
            </Rv>

            <div className="order-1 lg:order-2">
              <Rv as="h2" className="st-rv st-display text-[clamp(30px,4.6vw,64px)]">
                {c.stimulusTitle}
              </Rv>
              <Rv as="p" className="st-fade mt-6 max-w-[52ch] leading-[1.75] text-neutral-500" d={100}>
                {c.stimulusLead}
              </Rv>
              <Rv as="ul" className="st-fade mt-7 flex flex-col gap-2.5" d={180}>
                {c.stimulusBullets.map((p) => (
                  <li key={p} className="relative pl-6 text-[15px] leading-relaxed text-neutral-700">
                    <span aria-hidden className="absolute left-0 top-[11px] h-px w-3.5 bg-primary-500" />
                    {p}
                  </li>
                ))}
              </Rv>
            </div>
          </div>
        </div>
      </section>

      {/* ── P.03 — Synthese & Export ─────────────────────────────────── */}
      <section id="synthese" className="scroll-mt-24 py-[clamp(80px,12vh,150px)]">
        <div className={WRAP}>
          <Kap label={c.syntheseKap} />
          <div className="mb-[clamp(36px,6vh,60px)] flex flex-wrap items-end justify-between gap-6">
            <Rv as="h2" className="st-rv st-display text-[clamp(30px,4.6vw,64px)]">
              {c.syntheseTitle}
            </Rv>
            <Rv as="p" className="st-fade max-w-[44ch] text-neutral-500" d={100}>
              {c.syntheseLead}
            </Rv>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {c.syntheseCards.map((card, i) => (
              <Rv key={card.n} className="st-fade st-tool !gap-3" d={i * 90}>
                <span className="st-tag !text-[var(--st-rec-deep)]">{card.n}</span>
                <h3 className="!text-[clamp(19px,1.9vw,24px)]">{card.t}</h3>
                <p>{card.d}</p>
              </Rv>
            ))}
          </div>

          {/* Export-Leiste: die realen Ausgabeformate als Konsolen-Chips. */}
          <Rv className="st-fade mt-6 flex flex-wrap items-center gap-3" d={200}>
            <span className="st-tag">{c.syntheseOutputLabel}</span>
            {c.syntheseOutputs.map((f) => (
              <span
                key={f}
                className="rounded-full border border-[var(--st-line)] bg-neutral-0 px-4 py-2 font-mono text-[10.5px] uppercase tracking-[0.16em] text-neutral-700"
              >
                {f}
              </span>
            ))}
          </Rv>
        </div>
      </section>

      {/* ── P.04 — Qualität & Rekrutierung ───────────────────────────── */}
      <section id="qualitaet" className="scroll-mt-24 bg-warm py-[clamp(80px,12vh,150px)]">
        <div className={WRAP}>
          <Kap label={c.qualitaetKap} />
          <div className="mb-[clamp(28px,5vh,48px)] flex flex-wrap items-end justify-between gap-6">
            <Rv as="h2" className="st-rv st-display text-[clamp(30px,4.6vw,64px)]">
              {c.qualitaetTitle}
            </Rv>
            <Rv as="p" className="st-fade max-w-[44ch] text-neutral-500" d={100}>
              {c.qualitaetLead}
            </Rv>
          </div>

          <div className="border-t border-[var(--st-line)]">
            {c.quality.map((q, i) => (
              <Rv key={q.n} className="st-fade st-rule" d={i * 50}>
                <span className="st-n">{q.n}</span>
                <h3 className="!text-[clamp(17px,2vw,24px)]">{q.t}</h3>
                <p>{q.d}</p>
              </Rv>
            ))}
          </div>
        </div>
      </section>

      {/* ── P.05 — Die vier Methoden ─────────────────────────────────── */}
      <PlatformModules title={c.modulesTitle} locale={locale} />

      {/* ── Zahlen + CTA ─────────────────────────────────────────────── */}
      <NumbersBand lang={locale} />

      <CTASection
        lang={locale}
        title={c.ctaTitle}
        lead={c.ctaLead}
      />
    </>
  );
}
