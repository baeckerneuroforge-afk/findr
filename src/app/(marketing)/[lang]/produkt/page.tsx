import type { Metadata } from "next";
import type { CSSProperties, ReactNode } from "react";
import { CtaLink } from "@/components/marketing/CtaLink";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Rv } from "@/components/marketing/studio/Rv";
import { NumbersBand } from "@/components/marketing/studio/NumbersBand";
import { PlatformModules } from "@/components/marketing/PlatformModules";
import { CTASection } from "@/components/marketing/CTASection";
import { SITE_URL, ogDefaults } from "@/lib/marketing/seo";
import { DEMO_BOOKING_URL } from "@/lib/marketing/constants";
import { localizedContent, resolveLocale } from "@/i18n/marketing-locale";

const PATH = "/produkt";
const OG_TITLE = "Plattform — Klymeo";
const DESCRIPTION =
  "Die ganze Forschungs-Konsole: KI-Tiefeninterviews auf Deutsch — auf Wunsch hörbar per Voice-Agent —, Entwürfe als Stimulus direkt im Gespräch, Screening, Quoten und Panel-Anbindung für die Rekrutierung, und eine Synthese, die als PDF-Report oder PowerPoint-Deck exportiert. DSGVO-nativ, in Frankfurt gehostet.";

export const metadata: Metadata = {
  title: "Plattform",
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: { ...ogDefaults, title: OG_TITLE, url: PATH },
};

const SOFTWARE_JSONLD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Klymeo",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: `${SITE_URL}${PATH}`,
  description: DESCRIPTION,
  featureList: [
    "Voice-Agent-Interviews",
    "Stimulus: Entwürfe im Interview zeigen",
    "Synthese mit PDF- & PowerPoint-Export",
    "Screening, Quoten & Panel-Anbindung",
    "Bedarf & Verhalten",
    "Markenwahrnehmung",
    "Konzept-Test",
    "Creative-Test",
  ],
};

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

export default async function ProduktPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const locale = resolveLocale(lang);
  const c = localizedContent(lang, { de: CONTENT_DE });

  return (
    <>
      <JsonLd data={SOFTWARE_JSONLD} />

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
      <PlatformModules title={c.modulesTitle} />

      {/* ── Zahlen + CTA ─────────────────────────────────────────────── */}
      <NumbersBand lang={locale} />

      <CTASection
        title={c.ctaTitle}
        lead={c.ctaLead}
      />
    </>
  );
}
