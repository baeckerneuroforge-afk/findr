import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { CtaLink } from "@/components/marketing/CtaLink";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Rv } from "@/components/marketing/studio/Rv";
import { NumbersBand } from "@/components/marketing/studio/NumbersBand";
import { PlatformModules } from "@/components/marketing/PlatformModules";
import { CTASection } from "@/components/marketing/CTASection";
import { SITE_URL, ogDefaults } from "@/lib/marketing/seo";

const PATH = "/produkt";
const OG_TITLE = "Plattform — findr.";
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
  name: "findr.",
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

// P.04 — Qualität & Rekrutierung: die sechs realen Schutz- und Rekrutierungs-
// Fähigkeiten (Screening-Fragen, Quoten, Open-Link mit Kontingent/Ablauf,
// eigener Teilnehmer-Pool, Panel-Anbindung, Fraud-/Qualitätsprüfung).
const QUALITY: { n: string; t: string; d: string }[] = [
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
];

export default function ProduktPage() {
  return (
    <>
      <JsonLd data={SOFTWARE_JSONLD} />

      {/* ── Poster-Kopf ──────────────────────────────────────────────── */}
      <section className="st-sky relative overflow-hidden pb-[clamp(70px,10vh,120px)] pt-[clamp(120px,16vh,180px)]">
        <div className={WRAP}>
          <Rv as="p" className="st-fade st-tag !text-[var(--st-rec-deep)]">
            Die Plattform
          </Rv>
          <Rv as="h1" className="st-rv st-display mt-5 text-[clamp(38px,7vw,108px)]">
            <span className="st-ln">
              <i>Die ganze</i>
            </span>
            <span className="st-ln">
              <i>
                Forschungs-<span className="st-serif">Konsole.</span>
              </i>
            </span>
          </Rv>
          <div className="mt-[clamp(28px,4vh,48px)] flex flex-wrap items-end justify-between gap-7">
            <Rv
              as="p"
              className="st-fade max-w-[58ch] text-[clamp(16px,1.4vw,19px)] leading-[1.7] text-neutral-500"
              d={120}
            >
              Eine Engine führt die Interviews, vier Methoden richten sie aus —
              und die Werkzeuge drumherum machen daraus einen kompletten
              Forschungs-Arbeitsplatz: <b className="font-medium text-neutral-900">Voice-Agent</b>,{" "}
              <b className="font-medium text-neutral-900">Stimulus</b>, Screening
              und Quoten, Synthese mit{" "}
              <b className="font-medium text-neutral-900">PDF- &amp; PowerPoint-Export</b>.
            </Rv>
            <Rv className="st-fade flex flex-wrap gap-3.5" d={220}>
              <CtaLink href="/demo" variant="primary" size="lg" className="magnetic">
                <span className="st-dot" aria-hidden />
                Demo buchen
              </CtaLink>
              <CtaLink href="#voice" variant="secondary" size="lg" className="magnetic">
                Werkzeuge ansehen ↓
              </CtaLink>
            </Rv>
          </div>
        </div>
      </section>

      {/* ── P.01 — Voice-Agent ───────────────────────────────────────── */}
      <section id="voice" className="scroll-mt-24 py-[clamp(80px,12vh,150px)]">
        <div className={WRAP}>
          <Kap label="P.01 — Der Voice-Agent" />
          <div className="grid items-center gap-10 lg:grid-cols-2">
            <div>
              <Rv as="h2" className="st-rv st-display text-[clamp(30px,4.6vw,64px)]">
                <span className="st-ln">
                  <i>Interviews, die</i>
                </span>
                <span className="st-ln">
                  <i>
                    man <span className="st-serif">hört.</span>
                  </i>
                </span>
              </Rv>
              <Rv as="p" className="st-fade mt-6 max-w-[52ch] leading-[1.75] text-neutral-500" d={100}>
                Der findr.-Voice-Agent führt das Tiefeninterview hörbar: Er
                stellt die Fragen, hört zu und bohrt nach — Teilnehmer:innen
                sprechen einfach, statt zu tippen. Das senkt die Hürde, macht
                Antworten länger und ehrlicher und erreicht auch Zielgruppen,
                die keine Lust auf Formulare haben.
              </Rv>
              <Rv as="ul" className="st-fade mt-7 flex flex-col gap-2.5" d={180}>
                {[
                  "Spricht und versteht Deutsch — dieselbe Nachbohr-Logik wie im Text-Interview",
                  "Tippen bleibt jederzeit möglich; beides landet im selben Transkript",
                  "Jede Erkenntnis bleibt am Transkript belegt — Voice ändert nichts an der Beleg-Disziplin",
                ].map((p) => (
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
                <span className="st-tag">Voice-Session · Beispiel</span>
                <span className="st-lamp st-lamp--light">
                  <b aria-hidden />
                  Live
                </span>
              </div>
              <div className="st-voicebars" aria-hidden>
                {VOICE_BARS.map((h, i) => (
                  <i key={i} style={{ "--h": `${h}%`, "--i": i } as CSSProperties} />
                ))}
              </div>
              <div className="flex flex-col gap-3">
                <div className="st-tape-row !mb-0 !pr-0">
                  <span className="st-who !bg-[var(--st-rec)] !text-white !border-[var(--st-rec)]">findr.</span>
                  <p className="!text-[14px]">„Und wenn dir nichts einfällt — was machst du dann?“</p>
                </div>
                <div className="st-tape-row !mb-0 !pr-0">
                  <span className="st-who">Person</span>
                  <p className="!text-[14px] text-neutral-500">
                    <em className="st-quote">gesprochen, live transkribiert —</em>{" "}
                    „Meistens bestell ich dann einfach was …“
                  </p>
                </div>
              </div>
              <div className="st-tool-foot">
                <span>Sprechen statt tippen</span>
                <span>Barge-in erlaubt</span>
                <span>Ein Transkript</span>
              </div>
            </Rv>
          </div>
        </div>
      </section>

      {/* ── P.02 — Stimulus ──────────────────────────────────────────── */}
      <section id="stimulus" className="scroll-mt-24 bg-warm py-[clamp(80px,12vh,150px)]">
        <div className={WRAP}>
          <Kap label="P.02 — Stimulus" />
          <div className="grid items-center gap-10 lg:grid-cols-2">
            {/* Mock zuerst (auf Desktop links), Copy rechts — gespiegelt zu P.01 */}
            <Rv className="st-fade st-tool order-2 lg:order-1" threshold={0.3} d={120}>
              <div className="flex items-center justify-between">
                <span className="st-tag">Konzept-Test · Beispiel</span>
                <span className="st-lamp st-lamp--light">
                  <b aria-hidden />
                  Live
                </span>
              </div>
              <div className="st-stim" aria-hidden>
                <div className="st-stim-asset">
                  <span className="st-tag !text-[9px]">Dein Entwurf</span>
                  <b>A</b>
                </div>
                <div className="st-stim-chat">
                  <span className="is-f">Was fällt dir zuerst auf?</span>
                  <span>„Das Dunkelblau wirkt hochwertig — aber ich finde den Preis nicht.“</span>
                  <span className="is-f">Wo hast du ihn gesucht?</span>
                </div>
              </div>
              <div className="st-tool-foot">
                <span>Bild oder Link</span>
                <span>Split-View im Interview</span>
                <span>Mehrere Varianten testbar</span>
              </div>
            </Rv>

            <div className="order-1 lg:order-2">
              <Rv as="h2" className="st-rv st-display text-[clamp(30px,4.6vw,64px)]">
                <span className="st-ln">
                  <i>Zeig, woran</i>
                </span>
                <span className="st-ln">
                  <i>
                    du <span className="st-serif">arbeitest.</span>
                  </i>
                </span>
              </Rv>
              <Rv as="p" className="st-fade mt-6 max-w-[52ch] leading-[1.75] text-neutral-500" d={100}>
                Lade einen Entwurf in die Studie — Packshot, Anzeige, Claim,
                Landingpage — und deine Zielgruppe sieht ihn direkt neben dem
                Gespräch. Statt über Erinnerungen zu reden, nehmen
                Teilnehmer:innen Bezug auf genau das Material, das du testen
                willst. Das ist der Kern von Konzept- und Creative-Test.
              </Rv>
              <Rv as="ul" className="st-fade mt-7 flex flex-col gap-2.5" d={180}>
                {[
                  "Bild hochladen oder Link einbinden — Teilnehmer:innen sehen es im Split-View",
                  "Die KI fragt gezielt zum Gezeigten nach: Ersteindruck, Verständnis, Kaufimpuls",
                  "Gebaut für Design-, Marken- und Marketingteams — vom Scribble bis zur fertigen Kampagne",
                ].map((p) => (
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
          <Kap label="P.03 — Synthese & Export" />
          <div className="mb-[clamp(36px,6vh,60px)] flex flex-wrap items-end justify-between gap-6">
            <Rv as="h2" className="st-rv st-display text-[clamp(30px,4.6vw,64px)]">
              <span className="st-ln">
                <i>Vom Gespräch</i>
              </span>
              <span className="st-ln">
                <i>
                  zur <span className="st-serif">Folie.</span>
                </i>
              </span>
            </Rv>
            <Rv as="p" className="st-fade max-w-[44ch] text-neutral-500" d={100}>
              Die Synthese verdichtet alle Interviews zu Themen, Lagern und
              Originalzitaten — und exportiert das Ergebnis als PDF-Report oder
              PowerPoint-Deck im eigenen Branding. Vom O-Ton bis zur
              Vorstandsfolie, ohne Copy-Paste.
            </Rv>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {[
              {
                n: "01",
                t: "So ist sie aufgebaut",
                d: "Themen mit Gewicht, Lager mit Größe, jedes mit Originalzitaten verankert — dazu das Verdikt: Annahme vs. Realität. Keine Black-Box-Zusammenfassung, jeder Befund trägt seinen Beleg.",
              },
              {
                n: "02",
                t: "Frag die Daten",
                d: "Stell dem gesamten Studien-Korpus Rückfragen im Chat und bekomme belegte Antworten. Über mehrere Studien zählt findr. deterministisch: „in 3 von 7 Studien“ — nie geschätzt.",
              },
              {
                n: "03",
                t: "Exportier das Ergebnis",
                d: "Ein Klick: PDF-Report für Entscheider oder PowerPoint-Deck fürs Meeting — beides im eigenen Branding. Dazu teilbare Ergebnis-Links für Stakeholder, auch extern.",
              },
            ].map((c, i) => (
              <Rv key={c.n} className="st-fade st-tool !gap-3" d={i * 90}>
                <span className="st-tag !text-[var(--st-rec-deep)]">{c.n}</span>
                <h3 className="!text-[clamp(19px,1.9vw,24px)]">{c.t}</h3>
                <p>{c.d}</p>
              </Rv>
            ))}
          </div>

          {/* Export-Leiste: die realen Ausgabeformate als Konsolen-Chips. */}
          <Rv className="st-fade mt-6 flex flex-wrap items-center gap-3" d={200}>
            <span className="st-tag">Ausgabe:</span>
            {["PDF-Report", "PowerPoint-Deck", "Teilbarer Link", "Eigenes Branding"].map((f) => (
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
          <Kap label="P.04 — Qualität & Rekrutierung" />
          <div className="mb-[clamp(28px,5vh,48px)] flex flex-wrap items-end justify-between gap-6">
            <Rv as="h2" className="st-rv st-display text-[clamp(30px,4.6vw,64px)]">
              <span className="st-ln">
                <i>Die richtigen Leute,</i>
              </span>
              <span className="st-ln">
                <i>
                  sauber <span className="st-serif">rekrutiert.</span>
                </i>
              </span>
            </Rv>
            <Rv as="p" className="st-fade max-w-[44ch] text-neutral-500" d={100}>
              Eine Synthese ist nur so gut wie ihre Stichprobe. findr. bringt
              die Werkzeuge mit, die dafür sorgen, dass die richtigen Menschen
              antworten — und nur die.
            </Rv>
          </div>

          <div className="border-t border-[var(--st-line)]">
            {QUALITY.map((q, i) => (
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
      <PlatformModules title="Vier Methoden, eine Engine." />

      {/* ── Zahlen + CTA ─────────────────────────────────────────────── */}
      <NumbersBand />

      <CTASection
        title={<>Eine Konsole. Alles drin.</>}
        lead="Sieh in einer Demo, wie Voice-Agent, Stimulus und Synthese zusammenspielen — von der ersten Frage bis zum exportierten Deck."
      />
    </>
  );
}
