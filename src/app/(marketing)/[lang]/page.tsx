import type { Metadata } from "next";
import type { CSSProperties, ReactNode } from "react";
import { localizedContent, type Locale } from "@/i18n/marketing-locale";
import { CtaLink } from "@/components/marketing/CtaLink";
import { JsonLd } from "@/components/marketing/JsonLd";
import { Rv } from "@/components/marketing/studio/Rv";
import { StudioHero } from "@/components/marketing/studio/StudioHero";
import { Marquee } from "@/components/marketing/studio/Marquee";
import { SessionDeck } from "@/components/marketing/studio/SessionDeck";
import { MethodStack } from "@/components/marketing/studio/MethodStack";
import { NumbersBand } from "@/components/marketing/studio/NumbersBand";
import { SITE_URL, ogDefaults } from "@/lib/marketing/seo";
import { DEMO_BOOKING_URL } from "@/lib/marketing/constants";

const TITLE = "Klymeo — Qualitative Marktforschung mit KI, DSGVO-nativ & auf Deutsch";
const DESCRIPTION =
  "Klymeo führt hunderte qualitative Tiefeninterviews mit deiner Zielgruppe — auf Wunsch per Voice-Agent, mit Entwürfen als Stimulus direkt im Gespräch. Auf Deutsch, DSGVO-nativ in Frankfurt. Vier Methoden, eine Engine — verdichtet zu belegten Insights, exportiert als PDF oder PowerPoint.";

export const metadata: Metadata = {
  // absolute → skip the "%s — Klymeo" template for the homepage title.
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: "/" },
  // Full openGraph object (Befund 1: per-key REPLACE, never a partial).
  openGraph: { ...ogDefaults, title: TITLE, url: "/" },
};

const ORGANIZATION_JSONLD = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "Klymeo",
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

// Die Werkzeuge — Voice-Agent + Stimulus (K.04). Beide real: Voice-Interview
// über /api/interview/[token]/voice + LiveKit-Voice-Agent (/api/voice/*),
// Stimulus über /api/research/plans/[id]/stimulus + Split-View im Interview.
// Stimmpegel-Höhen sind sprachneutral (Theater, kein echtes Audio).
const VOICE_BARS = [38, 62, 24, 78, 46, 90, 30, 70, 52, 84, 36, 58, 26, 66];

// ── Seiten-Copy, per Locale. EN noch nicht getextet → DE-Fallback (EN=DE).
// Dies ist der Übersetzungs-Seam für die ganze Homepage: Kapitel-Labels,
// die fragmentierten Überschriften (als ReactNode), alle Absätze, die
// CAPS/RULES/STAMPS-Listen und die Button-Labels. Nicht-Text-Felder
// (n/soon/r/rec) bleiben in den Listen erhalten.
type HomeContent = {
  kap01: string;
  problem1: ReactNode;
  problem2: ReactNode;
  rules: { n: string; t: string; d: string }[];
  kap02: string;
  session2Headline: ReactNode;
  session2Lead: ReactNode;
  kap03: string;
  repertoireHeadline: ReactNode;
  repertoireLead: ReactNode;
  kap04: string;
  toolsHeadline: ReactNode;
  toolsLead: ReactNode;
  tool01Tag: ReactNode;
  tool01Live: ReactNode;
  tool01Title: ReactNode;
  tool01Body: ReactNode;
  tool01Foot: ReactNode;
  tool02Tag: ReactNode;
  tool02Live: ReactNode;
  tool02StimTag: ReactNode;
  tool02StimChatQ: ReactNode;
  tool02StimChatA: ReactNode;
  tool02Title: ReactNode;
  tool02Body: ReactNode;
  tool02Foot: ReactNode;
  kap05: string;
  synthesisHeadline: ReactNode;
  synthesisLead: ReactNode;
  sheetTag: ReactNode;
  sheetThemes: ReactNode;
  sheetTheme1Name: ReactNode;
  sheetTheme1N: ReactNode;
  sheetTheme2Name: ReactNode;
  sheetTheme2N: ReactNode;
  sheetTheme3Name: ReactNode;
  sheetTheme3N: ReactNode;
  sheetQuote: ReactNode;
  sheetQuoteFooter: ReactNode;
  sealVerified: ReactNode;
  sealTranscript: ReactNode;
  caps: { n: string; t: string; d: string; soon?: boolean }[];
  capsSoon: ReactNode;
  kap06: string;
  originHeadline: ReactNode;
  originLead: ReactNode;
  stamps: { top: string; em: string; r: string; rec?: boolean }[];
  finaleHeadline: ReactNode;
  finaleCta: ReactNode;
  finaleNote: ReactNode;
};

const CONTENT_DE: HomeContent = {
  kap01: "K.01 — Das Problem",
  problem1: (
    <>
      Umfragen geben dir Zahlen. Aber niemand erzählt einer Skala von
      eins bis zehn,{" "}
      <Rv as="span" className="st-hl" threshold={0.6}>
        warum er geht
      </Rv>
      .
    </>
  ),
  problem2: (
    <>
      Klymeo{" "}
      <Rv as="span" className="st-hl st-hl--soft" threshold={0.6} d={180}>
        bohrt nach
      </Rv>{" "}
      — und liefert dir Entscheidungen, die{" "}
      <Rv as="span" className="st-hl" threshold={0.6} d={360}>
        am Gespräch belegt
      </Rv>{" "}
      sind.
    </>
  ),
  // Studio-Regeln (K.01). Nicht-Text-Feld `n` bleibt erhalten.
  rules: [
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
  ],
  kap02: "K.02 — Die Session",
  session2Headline: (
    <>
      <span className="st-ln">
        <i>So klingt</i>
      </span>
      <span className="st-ln">
        <i>
          <span className="st-serif">Forschung.</span>
        </i>
      </span>
    </>
  ),
  session2Lead: (
    <>
      Ein Klymeo-Konzept-Test: Die KI zeigt einen Entwurf, bohrt hörbar
      nach und wertet live aus. Drück Play — oder wechsle zwischen Voice
      und Text. Vorgefertigtes Beispiel, kein Login, keine echten
      Teilnehmerdaten.
    </>
  ),
  kap03: "K.03 — Das Repertoire",
  repertoireHeadline: (
    <>
      <span className="st-ln">
        <i>Vier Methoden,</i>
      </span>
      <span className="st-ln">
        <i>
          <span className="st-serif">eine</span> Engine.
        </i>
      </span>
    </>
  ),
  repertoireLead: (
    <>
      Dieselbe Tiefe, dasselbe Nachbohren, dieselbe Beleg-Disziplin —
      egal ob Bedarf, Marke, Konzept oder Creative. Jedes Interview
      zahlt auf dasselbe Gehirn ein.
    </>
  ),
  kap04: "K.04 — Die Werkzeuge",
  toolsHeadline: (
    <>
      <span className="st-ln">
        <i>Sprich. Zeig.</i>
      </span>
      <span className="st-ln">
        <i>
          <span className="st-serif">Frag nach.</span>
        </i>
      </span>
    </>
  ),
  toolsLead: (
    <>
      Interviews, die sich wie echte Gespräche anfühlen: Der
      Voice-Agent führt sie hörbar, und mit Stimulus zeigst du deiner
      Zielgruppe live, woran du gerade arbeitest.
    </>
  ),
  tool01Tag: <>Werkzeug 01 · Voice</>,
  tool01Live: (
    <>
      <b aria-hidden />
      Live
    </>
  ),
  tool01Title: <>Der Voice-Agent führt das Interview</>,
  tool01Body: (
    <>
      Teilnehmer:innen sprechen einfach — die KI hört zu, bohrt
      hörbar nach und transkribiert live. Tippen bleibt jederzeit
      möglich, das Transkript bleibt die eine Quelle der Wahrheit.
    </>
  ),
  tool01Foot: (
    <>
      <span>Sprechen statt tippen</span>
      <span>Nachfragen in Echtzeit</span>
      <span>Volles Transkript</span>
    </>
  ),
  tool02Tag: <>Werkzeug 02 · Stimulus</>,
  tool02Live: (
    <>
      <b aria-hidden />
      Live
    </>
  ),
  tool02StimTag: <>Dein Entwurf</>,
  tool02StimChatQ: <>Was fällt dir zuerst auf?</>,
  tool02StimChatA: (
    <>„Das Dunkelblau wirkt hochwertig — aber ich finde den Preis nicht.“</>
  ),
  tool02Title: <>Stimulus: Entwürfe live zeigen</>,
  tool02Body: (
    <>
      Lade Konzepte, Packshots, Anzeigen oder Landingpages in die
      Studie — deine Zielgruppe sieht sie direkt im Interview und
      nimmt Bezug auf genau das, was du testen willst.
    </>
  ),
  tool02Foot: (
    <>
      <span>Bild oder Link</span>
      <span>Für Design & Marketing</span>
      <span>Konzept- & Creative-Test</span>
    </>
  ),
  kap05: "K.05 — Die Auswertung",
  synthesisHeadline: (
    <>
      <span className="st-ln">
        <i>Aus Stimmen</i>
      </span>
      <span className="st-ln">
        <i>
          wird <span className="st-serif">Beweis.</span>
        </i>
      </span>
    </>
  ),
  synthesisLead: (
    <>
      Klymeo verdichtet jedes Interview und alle zusammen — Themen,
      Lager, Originalzitate. Ohne manuelles Tagging, ohne
      Auswertungs-Wochen. Und am Ende exportierst du das Ganze als
      PDF-Report oder PowerPoint-Deck.
    </>
  ),
  sheetTag: <>Syntheseblatt · Beispiel</>,
  sheetThemes: <>3 Themen</>,
  sheetTheme1Name: <>Entscheidungslast</>,
  sheetTheme1N: <>häufigstes Lager</>,
  sheetTheme2Name: <>Impulsives Ausweichen</>,
  sheetTheme2N: <>wiederkehrend</>,
  sheetTheme3Name: <>Bedien-Hürden</>,
  sheetTheme3N: <>vereinzelt</>,
  sheetQuote: <>„Ich stand jeden Abend planlos vor dem Kühlschrank.“</>,
  sheetQuoteFooter: <>Originalzitat · Session 001 · 02:14</>,
  sealVerified: <>Belegt am</>,
  sealTranscript: <>Transkript</>,
  // Synthese-Fähigkeiten — die sechs realen Capabilities. Export nennt jetzt
  // ehrlich beide Formate (PDF-Report UND PowerPoint-Deck); Highlight-Reels
  // trägt weiter ehrlich „Bald“ (Nicht-Text-Feld `soon`).
  caps: [
    { n: "S.01", t: "Automatische Verdichtung", d: "Themen, Lager und Zitate über alle Interviews" },
    { n: "S.02", t: "Mit den Daten chatten", d: "Rückfragen an den ganzen Studien-Korpus" },
    { n: "S.03", t: "Highlight-Reels", d: "Die stärksten Momente als Zusammenschnitt", soon: true },
    { n: "S.04", t: "Teilbare Ergebnis-Links", d: "Synthese per Link, auch extern, im eigenen Branding" },
    { n: "S.05", t: "Export als PDF & PowerPoint", d: "Report und Folien-Deck, fertig fürs nächste Meeting" },
    { n: "S.06", t: "Studienübergreifende Muster", d: "Was sich über Studien hinweg wiederholt" },
  ],
  capsSoon: (
    <>
      <b aria-hidden />
      Bald
    </>
  ),
  kap06: "K.06 — Die Herkunft",
  originHeadline: <>Souverän aus Europa.</>,
  originLead: (
    <>
      In Deutschland gebaut, in Frankfurt am Main gehostet, ausgerichtet
      am EU AI Act. Deine Forschungsdaten verlassen die EU nicht — und
      gehören dir.
    </>
  ),
  // Herkunfts-Plaketten. Nicht-Text-Felder `r`/`rec` bleiben erhalten.
  stamps: [
    { top: "Datenschutz", em: "DSGVO-nativ", r: "-5deg", rec: true },
    { top: "Rechenzentrum", em: "Frankfurt a.M.", r: "3deg" },
    { top: "Ausgerichtet am", em: "EU AI Act", r: "-2deg" },
    { top: "Entwickelt in", em: "Deutschland", r: "4deg" },
  ],
  finaleHeadline: (
    <>
      <span className="st-ln">
        <i>Hör deiner</i>
      </span>
      <span className="st-ln">
        <i>
          Zielgruppe <span className="st-serif">zu.</span>
        </i>
      </span>
    </>
  ),
  finaleCta: (
    <>
      <span className="st-dot" aria-hidden />
      Demo buchen
    </>
  ),
  finaleNote: <>14 Tage gratis · ohne Kreditkarte</>,
};

export default async function HomePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const c = localizedContent(lang, { de: CONTENT_DE });

  return (
    <>
      <JsonLd data={ORGANIZATION_JSONLD} />

      {/* ── Hero: Aufnahme läuft ─────────────────────────────────────── */}
      <StudioHero lang={lang as Locale} />

      <Marquee lang={lang as Locale} />

      {/* ── K.01 — Das Problem (Statement + Studio-Regeln) ───────────── */}
      <section className="py-[clamp(110px,16vh,200px)]">
        <div className={WRAP}>
          <Kap label={c.kap01} />
          <Rv as="p" className="st-fade st-big">
            {c.problem1}
          </Rv>
          <Rv as="p" className="st-fade st-big mt-[1.2em]" d={100}>
            {c.problem2}
          </Rv>

          <div className="mt-[clamp(64px,9vh,110px)] border-t border-[var(--st-line)]">
            {c.rules.map((r, i) => (
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
          <Kap label={c.kap02} />
          <div className="mb-[clamp(36px,6vh,64px)] flex flex-wrap items-end justify-between gap-6">
            <Rv as="h2" className="st-rv st-display text-[clamp(34px,6vw,84px)]">
              {c.session2Headline}
            </Rv>
            <Rv as="p" className="st-fade max-w-[42ch] text-neutral-500">
              {c.session2Lead}
            </Rv>
          </div>
          <Rv className="st-fade">
            <SessionDeck lang={lang as Locale} />
          </Rv>
        </div>
      </section>

      {/* ── K.03 — Das Repertoire (Sticky-Tonband-Stapel) ────────────── */}
      <section id="methoden" className="pt-[clamp(40px,8vh,100px)]">
        <div className={WRAP}>
          <Kap label={c.kap03} />
          <div className="mb-[clamp(40px,7vh,80px)] flex flex-wrap items-end justify-between gap-6">
            <Rv as="h2" className="st-rv st-display text-[clamp(34px,6vw,84px)]">
              {c.repertoireHeadline}
            </Rv>
            <Rv as="p" className="st-fade max-w-[42ch] text-neutral-500">
              {c.repertoireLead}
            </Rv>
          </div>
          <MethodStack lang={lang as Locale} />
        </div>
      </section>

      {/* ── K.04 — Die Werkzeuge (Voice-Agent + Stimulus) ────────────── */}
      <section id="werkzeuge" className="pt-[clamp(100px,15vh,180px)]">
        <div className={WRAP}>
          <Kap label={c.kap04} />
          <div className="mb-[clamp(36px,6vh,64px)] flex flex-wrap items-end justify-between gap-6">
            <Rv as="h2" className="st-rv st-display text-[clamp(34px,6vw,84px)]">
              {c.toolsHeadline}
            </Rv>
            <Rv as="p" className="st-fade max-w-[42ch] text-neutral-500">
              {c.toolsLead}
            </Rv>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Werkzeug 01 — Voice-Agent */}
            <Rv className="st-fade st-tool" threshold={0.3}>
              <div className="flex items-center justify-between">
                <span className="st-tag">{c.tool01Tag}</span>
                <span className="st-lamp st-lamp--light">{c.tool01Live}</span>
              </div>
              <div className="st-voicebars" aria-hidden>
                {VOICE_BARS.map((h, i) => (
                  <i key={i} style={{ "--h": `${h}%`, "--i": i } as CSSProperties} />
                ))}
              </div>
              <h3>{c.tool01Title}</h3>
              <p>{c.tool01Body}</p>
              <div className="st-tool-foot">{c.tool01Foot}</div>
            </Rv>

            {/* Werkzeug 02 — Stimulus */}
            <Rv className="st-fade st-tool" threshold={0.3} d={100}>
              <div className="flex items-center justify-between">
                <span className="st-tag">{c.tool02Tag}</span>
                <span className="st-lamp st-lamp--light">{c.tool02Live}</span>
              </div>
              <div className="st-stim" aria-hidden>
                <div className="st-stim-asset">
                  <span className="st-tag !text-[9px]">{c.tool02StimTag}</span>
                  <b>A</b>
                </div>
                <div className="st-stim-chat">
                  <span className="is-f">{c.tool02StimChatQ}</span>
                  <span>{c.tool02StimChatA}</span>
                </div>
              </div>
              <h3>{c.tool02Title}</h3>
              <p>{c.tool02Body}</p>
              <div className="st-tool-foot">{c.tool02Foot}</div>
            </Rv>
          </div>
        </div>
      </section>

      {/* ── K.05 — Die Auswertung (Syntheseblatt + Fähigkeiten) ──────── */}
      <section id="synthese" className="py-[clamp(110px,16vh,190px)]">
        <div className={WRAP}>
          <Kap label={c.kap05} />
          <div className="mb-[clamp(40px,7vh,72px)] flex flex-wrap items-end justify-between gap-6">
            <Rv as="h2" className="st-rv st-display text-[clamp(34px,6vw,84px)]">
              {c.synthesisHeadline}
            </Rv>
            <Rv as="p" className="st-fade max-w-[42ch] text-neutral-500">
              {c.synthesisLead}
            </Rv>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
            {/* Syntheseblatt — Balken füllen sich, der Stempel schlägt ein. */}
            <Rv className="st-sheet st-fade" threshold={0.35}>
              <div className="flex justify-between gap-3 border-b border-[var(--st-line)] pb-3.5">
                <span className="st-tag">{c.sheetTag}</span>
                <span className="st-tag">{c.sheetThemes}</span>
              </div>
              <div className="st-theme" style={{ "--w": ".86" } as CSSProperties}>
                <div className="st-t-head">
                  <span className="st-t-name">{c.sheetTheme1Name}</span>
                  <span className="st-t-n">{c.sheetTheme1N}</span>
                </div>
                <div className="st-t-bar">
                  <b />
                </div>
              </div>
              <div className="st-theme" style={{ "--w": ".58" } as CSSProperties}>
                <div className="st-t-head">
                  <span className="st-t-name">{c.sheetTheme2Name}</span>
                  <span className="st-t-n">{c.sheetTheme2N}</span>
                </div>
                <div className="st-t-bar">
                  <b />
                </div>
              </div>
              <div className="st-theme" style={{ "--w": ".34" } as CSSProperties}>
                <div className="st-t-head">
                  <span className="st-t-name">{c.sheetTheme3Name}</span>
                  <span className="st-t-n">{c.sheetTheme3N}</span>
                </div>
                <div className="st-t-bar">
                  <b />
                </div>
              </div>
              <blockquote>
                {c.sheetQuote}
                <footer>{c.sheetQuoteFooter}</footer>
              </blockquote>
              {/* Beleg-Siegel: zeichnet sich beim Einscrollen (st-sheet.in). */}
              <div className="st-seal" aria-hidden>
                <svg viewBox="0 0 96 96">
                  <circle cx="48" cy="48" r="42" />
                </svg>
                <div className="st-seal-txt">
                  <span className="st-chk">✓</span>
                  <span>{c.sealVerified}</span>
                  <span>{c.sealTranscript}</span>
                </div>
              </div>
            </Rv>

            {/* Fähigkeiten-Liste */}
            <div className="flex flex-col border-t border-[var(--st-line)]">
              {c.caps.map((cap, i) => (
                <Rv key={cap.n} className="st-fade st-cap" d={i * 50}>
                  <span className="st-n">{cap.n}</span>
                  <span className="st-t">
                    {cap.t}
                    {cap.soon ? (
                      <span className="st-lamp st-lamp--soon ml-3 align-middle">
                        {c.capsSoon}
                      </span>
                    ) : null}
                  </span>
                  <span className="st-d">{cap.d}</span>
                </Rv>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Zahlen ───────────────────────────────────────────────────── */}
      <NumbersBand lang={lang as Locale} />

      {/* ── K.06 — Die Herkunft (Plakettenhof) ───────────────────────── */}
      <section id="herkunft" className="py-[clamp(110px,16vh,190px)] text-center">
        <div className={WRAP}>
          <Kap label={c.kap06} center />
          <Rv as="h2" className="st-fade st-display text-[clamp(30px,5vw,64px)]">
            {c.originHeadline}
          </Rv>
          <Rv
            as="p"
            className="st-fade mx-auto mt-4 max-w-[54ch] text-neutral-500"
            d={80}
          >
            {c.originLead}
          </Rv>
          <div className="mt-[clamp(44px,7vh,72px)] flex flex-wrap items-center justify-center gap-[clamp(18px,4vw,44px)]">
            {c.stamps.map((s, i) => (
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

      {/* ── Finale: Twilight-Anker mit Sternen, fließt in den Footer ─── */}
      <section id="demo-cta" className="st-on-dark st-dusk st-stars relative overflow-hidden py-[clamp(110px,17vh,210px)]">
        <div className={`${WRAP} relative z-10`}>
          <Rv as="h2" className="st-rv st-display text-[clamp(42px,8.5vw,128px)]">
            {c.finaleHeadline}
          </Rv>
          <Rv className="st-fade mt-[clamp(34px,5vh,56px)] flex flex-wrap items-center gap-6">
            <CtaLink href={DEMO_BOOKING_URL} variant="primary" size="lg" className="magnetic">
              {c.finaleCta}
            </CtaLink>
            <span className="font-mono text-[11.5px] uppercase tracking-[0.14em] text-anchor-foreground/60">
              {c.finaleNote}
            </span>
          </Rv>
        </div>
      </section>
    </>
  );
}
