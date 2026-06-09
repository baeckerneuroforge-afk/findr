import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { CtaLink } from "@/components/marketing/CtaLink";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Rv } from "@/components/marketing/studio/Rv";
import { StudioHero } from "@/components/marketing/studio/StudioHero";
import { Marquee } from "@/components/marketing/studio/Marquee";
import { SessionDeck } from "@/components/marketing/studio/SessionDeck";
import { MethodStack } from "@/components/marketing/studio/MethodStack";
import { NumbersBand } from "@/components/marketing/studio/NumbersBand";
import { SITE_URL, ogDefaults } from "@/lib/marketing/seo";

const TITLE = "findr. — Qualitative Marktforschung mit KI, DSGVO-nativ & auf Deutsch";
const DESCRIPTION =
  "findr. führt hunderte qualitative Tiefeninterviews mit deiner Zielgruppe — KI-geführt, auf Deutsch und DSGVO-nativ in Frankfurt gehostet. Vier Methoden, eine Engine: Bedarf & Verhalten, Markenwahrnehmung, Konzept- und Creative-Test, verdichtet zu belegten Insights.";

export const metadata: Metadata = {
  // absolute → skip the "%s — findr." template for the homepage title.
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  // Full openGraph object (Befund 1: per-key REPLACE, never a partial).
  openGraph: { ...ogDefaults, title: TITLE, url: "/" },
};

const ORGANIZATION_JSONLD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "findr.",
  url: SITE_URL,
  logo: `${SITE_URL}/og-image.png`,
  description: DESCRIPTION,
  areaServed: "DACH",
  foundingLocation: "Frankfurt am Main, Deutschland",
};

/** Kapitelmarke — Mono-Label + auslaufende Hairline. */
function Kap({ label, center = false }: { label: string; center?: boolean }) {
  return (
    <div className="st-kap" style={center ? { justifyContent: "center" } : undefined}>
      <span className="st-tag">{label}</span>
    </div>
  );
}

const WRAP = "mx-auto w-full max-w-[1280px] px-[clamp(20px,4vw,56px)]";

// Synthese-Fähigkeiten — die sechs realen Capabilities (Copy unverändert aus
// der bisherigen Synthese-Sektion; Highlight-Reels trägt ehrlich „Bald“).
const CAPS: { n: string; t: string; d: string; soon?: boolean }[] = [
  { n: "S.01", t: "Automatische Verdichtung", d: "Themen, Lager und Zitate über alle Interviews" },
  { n: "S.02", t: "Mit den Daten chatten", d: "Rückfragen an den ganzen Studien-Korpus" },
  { n: "S.03", t: "Highlight-Reels", d: "Die stärksten Momente als Zusammenschnitt", soon: true },
  { n: "S.04", t: "Teilbare Ergebnis-Links", d: "Synthese per Link, auch extern, im eigenen Branding" },
  { n: "S.05", t: "PDF-Export", d: "Ein klarer Report für Entscheider" },
  { n: "S.06", t: "Studienübergreifende Muster", d: "Was sich über Studien hinweg wiederholt" },
];

const RULES: { n: string; t: string; d: string }[] = [
  {
    n: "R.01",
    t: "Nachbohren statt abnicken",
    d: "Die KI fragt nach wie ein erfahrener Researcher — bis hinter die erste Antwort, statt bei der Hypothese stehenzubleiben.",
  },
  {
    n: "R.02",
    t: "Beleg statt Bauchgefühl",
    d: "Jede Erkenntnis trägt ihr Originalzitat. Fraud- und Qualitätsprüfung filtern Durchklicker heraus.",
  },
  {
    n: "R.03",
    t: "Deutsch, nicht übersetzt",
    d: "Tiefeninterviews in echtem Deutsch — Tonalität und Kontext, die US-Tools schlicht nicht treffen.",
  },
  {
    n: "R.04",
    t: "Frankfurt, nicht Virginia",
    d: "DSGVO-nativ, in der EU gehostet, ausgerichtet am EU AI Act. Keine US-Cloud, keine Lock-ins.",
  },
];

const STAMPS: { top: string; em: string; r: string; rec?: boolean }[] = [
  { top: "Datenschutz", em: "DSGVO-nativ", r: "-5deg", rec: true },
  { top: "Rechenzentrum", em: "Frankfurt a.M.", r: "3deg" },
  { top: "Ausgerichtet am", em: "EU AI Act", r: "-2deg" },
  { top: "Entwickelt in", em: "Deutschland", r: "4deg" },
];

export default function HomePage() {
  return (
    <>
      <JsonLd data={ORGANIZATION_JSONLD} />

      {/* ── Hero: Aufnahme läuft ─────────────────────────────────────── */}
      <StudioHero />

      <Marquee />

      {/* ── K.01 — Das Problem (Statement + Studio-Regeln) ───────────── */}
      <section className="py-[clamp(110px,16vh,200px)]">
        <div className={WRAP}>
          <Kap label="K.01 — Das Problem" />
          <Rv as="p" className="st-fade st-big">
            Umfragen geben dir Zahlen. Aber niemand erzählt einer Skala von
            eins bis zehn,{" "}
            <Rv as="span" className="st-hl" threshold={0.6}>
              warum er geht
            </Rv>
            .
          </Rv>
          <Rv as="p" className="st-fade st-big mt-[1.2em]" d={100}>
            findr.{" "}
            <Rv as="span" className="st-hl st-hl--soft" threshold={0.6} d={180}>
              bohrt nach
            </Rv>{" "}
            — und liefert dir Entscheidungen, die{" "}
            <Rv as="span" className="st-hl" threshold={0.6} d={360}>
              am Gespräch belegt
            </Rv>{" "}
            sind.
          </Rv>

          <div className="mt-[clamp(64px,9vh,110px)] border-t border-[var(--st-line)]">
            {RULES.map((r, i) => (
              <Rv key={r.n} className="st-fade st-rule" d={i * 60}>
                <span className="st-n">{r.n}</span>
                <h3>{r.t}</h3>
                <p>{r.d}</p>
              </Rv>
            ))}
          </div>
        </div>
      </section>

      {/* ── K.02 — Die Session ───────────────────────────────────────── */}
      <section id="session" className="pb-[clamp(90px,14vh,170px)]">
        <div className={WRAP}>
          <Kap label="K.02 — Die Session" />
          <div className="mb-[clamp(36px,6vh,64px)] flex flex-wrap items-end justify-between gap-6">
            <Rv as="h2" className="st-rv st-display text-[clamp(34px,6vw,84px)]">
              <span className="st-ln">
                <i>So klingt</i>
              </span>
              <span className="st-ln">
                <i>
                  <span className="st-serif">Forschung.</span>
                </i>
              </span>
            </Rv>
            <Rv as="p" className="st-fade max-w-[40ch] text-neutral-500">
              Ein Ausschnitt aus einem findr.-Tiefeninterview — vorgefertigtes
              Beispiel, kein Login, keine echten Teilnehmerdaten. Drück Play.
            </Rv>
          </div>
          <Rv className="st-fade">
            <SessionDeck />
          </Rv>
        </div>
      </section>

      {/* ── K.03 — Das Repertoire (Sticky-Tonband-Stapel) ────────────── */}
      <section id="methoden" className="pt-[clamp(40px,8vh,100px)]">
        <div className={WRAP}>
          <Kap label="K.03 — Das Repertoire" />
          <div className="mb-[clamp(40px,7vh,80px)] flex flex-wrap items-end justify-between gap-6">
            <Rv as="h2" className="st-rv st-display text-[clamp(34px,6vw,84px)]">
              <span className="st-ln">
                <i>Vier Methoden,</i>
              </span>
              <span className="st-ln">
                <i>
                  <span className="st-serif">eine</span> Engine.
                </i>
              </span>
            </Rv>
            <Rv as="p" className="st-fade max-w-[42ch] text-neutral-500">
              Dieselbe Tiefe, dasselbe Nachbohren, dieselbe Beleg-Disziplin —
              egal ob Bedarf, Marke, Konzept oder Creative. Jedes Interview
              zahlt auf dasselbe Gehirn ein.
            </Rv>
          </div>
          <MethodStack />
        </div>
      </section>

      {/* ── K.04 — Die Auswertung (Syntheseblatt + Fähigkeiten) ──────── */}
      <section id="synthese" className="py-[clamp(110px,16vh,190px)]">
        <div className={WRAP}>
          <Kap label="K.04 — Die Auswertung" />
          <div className="mb-[clamp(40px,7vh,72px)] flex flex-wrap items-end justify-between gap-6">
            <Rv as="h2" className="st-rv st-display text-[clamp(34px,6vw,84px)]">
              <span className="st-ln">
                <i>Aus Stimmen</i>
              </span>
              <span className="st-ln">
                <i>
                  wird <span className="st-serif">Beweis.</span>
                </i>
              </span>
            </Rv>
            <Rv as="p" className="st-fade max-w-[42ch] text-neutral-500">
              findr. verdichtet jedes Interview und alle zusammen — Themen,
              Lager, Originalzitate. Ohne manuelles Tagging, ohne
              Auswertungs-Wochen.
            </Rv>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
            {/* Syntheseblatt — Balken füllen sich, der Stempel schlägt ein. */}
            <Rv className="st-sheet st-fade" threshold={0.35}>
              <div className="flex justify-between gap-3 border-b border-[var(--st-line)] pb-3.5">
                <span className="st-tag">Syntheseblatt · Beispiel</span>
                <span className="st-tag">3 Themen</span>
              </div>
              <div className="st-theme" style={{ "--w": ".86" } as CSSProperties}>
                <div className="st-t-head">
                  <span className="st-t-name">Entscheidungslast</span>
                  <span className="st-t-n">häufigstes Lager</span>
                </div>
                <div className="st-t-bar">
                  <b />
                </div>
              </div>
              <div className="st-theme" style={{ "--w": ".58" } as CSSProperties}>
                <div className="st-t-head">
                  <span className="st-t-name">Impulsives Ausweichen</span>
                  <span className="st-t-n">wiederkehrend</span>
                </div>
                <div className="st-t-bar">
                  <b />
                </div>
              </div>
              <div className="st-theme" style={{ "--w": ".34" } as CSSProperties}>
                <div className="st-t-head">
                  <span className="st-t-name">Bedien-Hürden</span>
                  <span className="st-t-n">vereinzelt</span>
                </div>
                <div className="st-t-bar">
                  <b />
                </div>
              </div>
              <blockquote>
                „Ich stand jeden Abend planlos vor dem Kühlschrank.“
                <footer>Originalzitat · Session 001 · 02:14</footer>
              </blockquote>
              <span className="st-belegt" aria-hidden>
                Belegt am Transkript
              </span>
            </Rv>

            {/* Fähigkeiten-Liste */}
            <div className="flex flex-col border-t border-[var(--st-line)]">
              {CAPS.map((c, i) => (
                <Rv key={c.n} className="st-fade st-cap" d={i * 50}>
                  <span className="st-n">{c.n}</span>
                  <span className="st-t">
                    {c.t}
                    {c.soon ? (
                      <span className="st-lamp st-lamp--soon ml-3 align-middle">
                        <b aria-hidden />
                        Bald
                      </span>
                    ) : null}
                  </span>
                  <span className="st-d">{c.d}</span>
                </Rv>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Zahlen ───────────────────────────────────────────────────── */}
      <NumbersBand />

      {/* ── K.05 — Die Herkunft (Stempelhof) ─────────────────────────── */}
      <section id="herkunft" className="py-[clamp(110px,16vh,190px)] text-center">
        <div className={WRAP}>
          <Kap label="K.05 — Die Herkunft" center />
          <Rv as="h2" className="st-fade st-display text-[clamp(30px,5vw,64px)]">
            Souverän aus Europa.
          </Rv>
          <Rv
            as="p"
            className="st-fade mx-auto mt-4 max-w-[54ch] text-neutral-500"
            d={80}
          >
            In Deutschland gebaut, in Frankfurt am Main gehostet, ausgerichtet
            am EU AI Act. Deine Forschungsdaten verlassen die EU nicht — und
            gehören dir.
          </Rv>
          <div className="mt-[clamp(44px,7vh,72px)] flex flex-wrap items-center justify-center gap-[clamp(18px,4vw,44px)]">
            {STAMPS.map((s, i) => (
              <Rv
                key={s.em}
                className={`st-bigstamp ${s.rec ? "st-bigstamp--rec" : ""}`}
                threshold={0.4}
                d={i * 140}
                style={{ "--r": s.r } as CSSProperties}
              >
                {s.top}
                <em>{s.em}</em>
              </Rv>
            ))}
          </div>
        </div>
      </section>

      {/* ── Finale: dunkler Anker, fließt in den Studio-Footer ───────── */}
      <section id="demo-cta" className="st-on-dark relative overflow-hidden bg-anchor py-[clamp(110px,17vh,210px)]">
        <div className={WRAP}>
          <Rv as="h2" className="st-rv st-display text-[clamp(42px,8.5vw,128px)]">
            <span className="st-ln">
              <i>Hör deiner</i>
            </span>
            <span className="st-ln">
              <i>
                Zielgruppe <span className="st-serif">zu.</span>
              </i>
            </span>
          </Rv>
          <Rv className="st-fade mt-[clamp(34px,5vh,56px)] flex flex-wrap items-center gap-6">
            <CtaLink href="/demo" variant="primary" size="lg" className="magnetic">
              <span className="st-dot" aria-hidden />
              Demo buchen
            </CtaLink>
            <span className="font-mono text-[11.5px] uppercase tracking-[0.14em] text-anchor-foreground/60">
              14 Tage gratis · ohne Kreditkarte
            </span>
          </Rv>
        </div>
      </section>
    </>
  );
}
