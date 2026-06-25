import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import {
  localizedContent,
  localizePath,
  resolveLocale,
  toBcp47,
  type Locale,
} from "@/i18n/marketing-locale";
import { JsonLd } from "@/components/marketing/JsonLd";
import { SITE_URL, ogDefaultsFor, buildAlternates } from "@/lib/marketing/seo";
import { DEMO_BOOKING_URL } from "@/lib/marketing/constants";

const PATH = "/";
const META = {
  title: {
    de: "Klymeo — Qualitative Marktforschung mit KI, DSGVO-nativ & auf Deutsch",
    en: "Klymeo — AI-powered qualitative market research, GDPR-native, in German & English",
  },
  description: {
    de: "Klymeo führt hunderte qualitative Tiefeninterviews mit deiner Zielgruppe — auf Deutsch, DSGVO-nativ in Frankfurt. Vier Methoden, eine Engine — verdichtet zu Insights, die am Transkript belegt sind.",
    en: "Klymeo runs hundreds of qualitative in-depth interviews with your audience — in German and English, GDPR-native in Frankfurt. Four methods, one engine — distilled into insights evidenced at the transcript.",
  },
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string }>;
}): Promise<Metadata> {
  const locale = resolveLocale((await params).lang);
  return {
    title: { absolute: localizedContent(locale, META.title) },
    description: localizedContent(locale, META.description),
    alternates: buildAlternates(locale, PATH),
    openGraph: {
      ...ogDefaultsFor(locale),
      title: localizedContent(locale, META.title),
      url: localizePath(locale, PATH),
    },
  };
}

function buildOrganizationJsonLd(locale: Locale) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Klymeo",
    url: `${SITE_URL}${localizePath(locale, PATH)}`,
    logo: `${SITE_URL}/og-image.png`,
    inLanguage: toBcp47(locale),
    description: localizedContent(locale, META.description),
    areaServed: "DACH",
    foundingLocation: "Frankfurt am Main, Deutschland",
  };
}

/* ─────────────────────────────────────────────────────────────────────────
   Clean-Slate-Homepage in der Conveo-Richtung: strenge Inter-Typografie,
   monochrome Schrift (Akzentfarbe nur auf Buttons / Marke, nie im Text), viel
   Weißraum, Produkt-UI-Mockups statt Deko. Inhaltlich Klymeo.
   ──────────────────────────────────────────────────────────────────────── */

type Feat = { title: string; desc: string };
type Home = {
  heroEyebrow: string;
  heroHead: ReactNode;
  heroSteps: string;
  heroLead: string;
  heroDemo: {
    tag: string;
    topic: string;
    stimLabel: string;
    stimTitle: string;
    stimSub: string;
    agent: string;
    participant: string;
    probe: string;
    q1: string;
    a1: string;
    q2: string;
    foot: string;
  };
  ctaDemo: string;
  ctaTry: string;
  trust: string;
  trustPoints: string[];
  s1Eyebrow: string;
  s1Head: string;
  s1Lead: string;
  s1Stat: { v: string; l: string }[];
  guideTitle: string;
  guideDepth: string;
  guideQs: string[];
  forHead: string;
  forLead: string;
  ctaDiscover: string;
  useEyebrow: string;
  useHead: string;
  useCases: Feat[];
  baEyebrow: string;
  baHead: string;
  baBeforeLbl: string;
  baBefore: string[];
  baAfterLbl: string;
  baAfter: string[];
  valEyebrow: string;
  valHead: ReactNode;
  feats: Feat[];
  proof: ReactNode;
  cmpEyebrow: string;
  cmpHead: string;
  cmpKl: string;
  cmpOt: string;
  cmpRows: { f: string; o: string }[];
  partEyebrow: string;
  partHead: string;
  partLead: string;
  partStat: { v: string; l: string }[];
  ctaTeil: string;
  quote: ReactNode;
  quoteBy: string;
  quoteRole: string;
  quoteTag: string;
  metrics: { v: string; l: string }[];
  faqEyebrow: string;
  faqHead: string;
  faq: { q: string; a: string }[];
  closeEyebrow: string;
  closeHead: ReactNode;
  closeBody: string;
  closeTag: string;
};

const CONTENT_DE: Home = {
  heroEyebrow: "Qualitative Forschung mit KI",
  heroHead: (
    <>
      Was dein Markt dir <em className="st-serif">wirklich</em> sagt.
      <br />
      Belegt, in Tagen.
    </>
  ),
  heroSteps: "Konzipieren · Rekrutieren · Interviewen · Auswerten · Teilen",
  heroLead:
    "Die Tiefe qualitativer Interviews, im Tempo einer Umfrage. Klymeo führt sie parallel mit deiner Zielgruppe — auf Deutsch und Englisch, EU-gehostet in Frankfurt — und belegt jede Erkenntnis am Transkript. Statt Wochen für Rekrutierung, Moderation und Handauswertung.",
  heroDemo: {
    tag: "Voice-Interview · live",
    topic: "Creative-Test · Verpackung",
    stimLabel: "Stimulus",
    stimTitle: "Verpackung · Variante A",
    stimSub: "Farbwelt + Logo-Platzierung im Test",
    agent: "Klymeo · Voice",
    participant: "Teilnehmer · spricht",
    probe: "Klymeo · bohrt nach",
    q1: "Schau dir die Verpackung an — was fällt dir als Erstes auf?",
    a1: "Die Farben wirken hochwertig, aber der Markenname geht fast unter.",
    q2: "Was lässt den Namen untergehen — die Größe oder die Position?",
    foot: "Live per Voice geführt · nachgefragt · 00:02:10",
  },
  ctaDemo: "Demo buchen",
  ctaTry: "Interview testen",
  trust: "Gebaut auf Substanz, nicht auf Behauptungen",
  trustPoints: [
    "EU-gehostet · Frankfurt",
    "Deutsch & Englisch",
    "Voice & Text",
    "Belegt am Transkript",
    "Kein Affekt-Tracking",
  ],
  s1Eyebrow: "01 — Design",
  s1Head: "KI-gestütztes Interview-Design",
  s1Lead:
    "Teile deine Ziele oder lade ein Research-Brief hoch — die KI entwirft den Leitfaden, schlägt Themen vor und kalibriert die Tiefe. Keine Methodenexpertise nötig.",
  s1Stat: [
    { v: "Minuten", l: "bis zum Interview-Link" },
    { v: "100 %", l: "am Transkript belegt" },
  ],
  guideTitle: "Leitfaden · Entwurf",
  guideDepth: "Tiefe: Laddering",
  guideQs: [
    "Erzähl mir vom letzten Mal, als du ein KI-Tool im Arbeitsalltag genutzt hast.",
    "Was hat dich in dem Moment dazu gebracht — was war der Auslöser?",
    "Und was hätte dich fast davon abgehalten?",
  ],
  forHead:
    "Für Forscher gebaut. Und für jedes Team, das auf echtes Feedback hört.",
  forLead:
    "Modernste KI im Dienst sauberer, belegbarer Erkenntnisse — nie als Ersatz fürs Zuhören, immer als Verstärkung.",
  ctaDiscover: "Klymeo entdecken",
  useEyebrow: "02 — Einsatz",
  useHead: "Eine Engine. Vier Forschungsfragen.",
  useCases: [
    { title: "Produkt & Erlebnis", desc: "Wie nutzen Menschen dein Produkt wirklich — und wo hakt es?" },
    { title: "Konzept- & Kreativ-Test", desc: "Welches Konzept zündet, und vor allem: warum?" },
    { title: "Markenwahrnehmung", desc: "Wofür steht deine Marke im Kopf deiner Zielgruppe?" },
    { title: "Bedarf & Verhalten", desc: "Welche Jobs, Trigger und Hürden treiben Entscheidungen?" },
  ],
  baEyebrow: "03 — Der Unterschied",
  baHead: "Tiefe von qualitativ. Tempo von quantitativ.",
  baBeforeLbl: "Vorher · klassische Qual",
  baBefore: [
    "Wochenlange Rekrutierung & Terminfindung",
    "Moderation Interview für Interview von Hand",
    "Auswertung als Wochen-Marathon",
    "Kleine Stichprobe, große Unsicherheit",
  ],
  baAfterLbl: "Mit Klymeo",
  baAfter: [
    "Interviews starten in Minuten, parallel",
    "KI moderiert & bohrt nach — rund um die Uhr",
    "Synthese live, jede Aussage belegt",
    "Hunderte Stimmen statt einer Handvoll",
  ],
  valEyebrow: "04 — Das Versprechen",
  valHead: (
    <>
      Echtes menschliches Verständnis — <em className="st-serif">ohne</em>{" "}
      Kompromiss.
    </>
  ),
  feats: [
    {
      title: "Liest, was im Wortlaut steckt",
      desc: "Voice und Text in einem Fluss — Klymeo erkennt Unsicherheit und Nachdruck an dem, was tatsächlich gesagt wird: Formulierung, Zögern, Relativierung im Text. Bewusst ohne Stimm-, Gesichts- oder Affekt-Analyse.",
    },
    {
      title: "Eine KI, die nachbohrt",
      desc: "Sie erkennt, wo es interessant wird, und stellt die Nachfrage, die ein erfahrener Researcher stellen würde — Schicht für Schicht zum eigentlichen Grund.",
    },
    {
      title: "Der schnellste Weg zum „Warum“",
      desc: "Hunderte Gespräche werden zu Themen, Personas und einer klaren Synthese — in Tagen, nicht Wochen.",
    },
  ],
  proof: (
    <>
      <b className="font-semibold text-neutral-900">
        Erkenntnisse, hinter denen du stehst.
      </b>{" "}
      Jede Aussage in der Synthese ist mit der exakten Stelle im Transkript
      verlinkt — klickbar, prüfbar, zitierfähig. Keine Black Box.
    </>
  ),
  cmpEyebrow: "05 — Im Vergleich",
  cmpHead: "Warum Klymeo?",
  cmpKl: "Klymeo",
  cmpOt: "Andere",
  cmpRows: [
    { f: "Voice & Text-first", o: "nur Text" },
    { f: "Stimulus live im Gespräch", o: "vorab oder gar nicht" },
    { f: "Deutsch & Englisch, end-to-end", o: "oft nur Englisch" },
    { f: "EU-Datenresidenz (Frankfurt)", o: "—" },
    { f: "Kein biometrisches Affekt-Tracking", o: "Graubereich" },
    { f: "Belegte Themen statt generischer Summary", o: "—" },
  ],
  partEyebrow: "06 — Teilnehmer",
  partHead: "Auch für Teilnehmer gemacht.",
  partLead:
    "Frei sprechen oder tippen, in der eigenen Umgebung, zur eigenen Zeit — mit KI-Offenlegung und Einwilligung vor dem ersten Wort. Kein Klick-Marathon, keine Umfrage-Müdigkeit.",
  partStat: [
    { v: "Voice + Text", l: "sprechen oder tippen, frei wählbar" },
    { v: "DE · EN", l: "Interview in der eigenen Sprache" },
  ],
  ctaTeil: "Als Teilnehmer testen",
  quote: (
    <>
      Wir bauen keine Stimmungs-KI. Jede Erkenntnis steht am{" "}
      <em className="st-serif">exakten</em> Transkript-Moment — prüfbar,
      zitierfähig, ohne Black Box.
    </>
  ),
  quoteBy: "Das Prinzip hinter Klymeo",
  quoteRole: "Belegbar by design",
  quoteTag: "Unser Anspruch",
  metrics: [
    { v: "100 %", l: "am Transkript verankert" },
    { v: "0", l: "biometrisches Affekt-Tracking" },
    { v: "EU", l: "Daten in Frankfurt gehostet" },
  ],
  faqEyebrow: "07 — FAQ",
  faqHead: "Häufige Fragen",
  faq: [
    {
      q: "Was ist Klymeo und wie funktioniert es?",
      a: "Eine Plattform für qualitative Marktforschung mit KI-geführten Interviews: konzipieren, rekrutieren, interviewen, auswerten und teilen — end-to-end, in Tagen statt Wochen.",
    },
    {
      q: "Wie unterscheidet sich Klymeo von anderen Tools?",
      a: "Voice & Text statt nur Text, jede Erkenntnis am Transkript belegt, EU-gehostet in Frankfurt — und bewusst ohne biometrische Affekt-Erkennung.",
    },
    {
      q: "Für wen ist Klymeo gebaut?",
      a: "Für Insights-, Produkt-, UX- und Marketing-Teams — von Markt- und Nutzerforschung über Konzept-Tests bis Markenwahrnehmung.",
    },
    {
      q: "Ersetzt Klymeo Fokusgruppen oder Interviews?",
      a: "Es ersetzt nicht das Zuhören, sondern skaliert es: hunderte Tiefeninterviews parallel, mit der Nuance, die Umfragen verfehlen.",
    },
    {
      q: "Wie hält es Klymeo mit Datenschutz?",
      a: "DSGVO-first gebaut: Interview-Daten EU-gehostet in Frankfurt, KI-Offenlegung und Einwilligung vor der ersten Interaktion, kein biometrisches Affekt-Tracking.",
    },
    {
      q: "Wie schnell bekomme ich Erkenntnisse?",
      a: "Eine Studie ist in Minuten aufgesetzt; sobald die Interviews laufen, entstehen belegte Synthese, Themen und Personas automatisch — in Tagen statt Wochen.",
    },
  ],
  closeEyebrow: "Bereit, wenn du es bist",
  closeHead: (
    <>
      Entscheidungen, die auf <em className="st-serif">echten</em> Gesprächen
      beruhen.
    </>
  ),
  closeBody:
    "Automatisiere qualitative Forschung mit KI-geführten Interviews, skaliere Erkenntnisse und führe dein Team in die nächste Ära des Zielgruppen-Verständnisses.",
  closeTag:
    "Echte Gespräche mit echten Menschen. Tieferes Verständnis, in Tagen geliefert. Das ist Klymeo.",
};

const CONTENT_EN: Home = {
  heroEyebrow: "AI-powered qualitative research",
  heroHead: (
    <>
      What your market <em className="st-serif">really</em> tells you.
      <br />
      Evidenced, in days.
    </>
  ),
  heroSteps: "Design · Recruit · Interview · Analyze · Share",
  heroLead:
    "The depth of qualitative interviews, at the speed of a survey. Klymeo runs them in parallel with your audience — in German and English, EU-hosted in Frankfurt — and evidences every finding at the transcript. Instead of weeks of recruiting, moderating and manual analysis.",
  heroDemo: {
    tag: "Voice interview · live",
    topic: "Creative test · packaging",
    stimLabel: "Stimulus",
    stimTitle: "Packaging · variant A",
    stimSub: "colour world + logo placement under test",
    agent: "Klymeo · voice",
    participant: "Participant · speaking",
    probe: "Klymeo · probing",
    q1: "Take a look at the packaging — what stands out first?",
    a1: "The colours feel premium, but the brand name almost disappears.",
    q2: "What makes the name disappear — the size or the position?",
    foot: "Run live by voice · probed · 00:02:10",
  },
  ctaDemo: "Book a demo",
  ctaTry: "Try an interview",
  trust: "Built on substance, not on claims",
  trustPoints: [
    "EU-hosted · Frankfurt",
    "German & English",
    "Voice & text",
    "Evidenced at transcript",
    "No affect tracking",
  ],
  s1Eyebrow: "01 — Design",
  s1Head: "AI-powered interview design",
  s1Lead:
    "Share your goals or upload a research brief — the AI drafts the guide, suggests themes and calibrates depth. No methods expertise required.",
  s1Stat: [
    { v: "Minutes", l: "to your interview link" },
    { v: "100 %", l: "evidenced at the transcript" },
  ],
  guideTitle: "Guide · draft",
  guideDepth: "Depth: laddering",
  guideQs: [
    "Tell me about the last time you used an AI tool at work.",
    "What made you reach for it in that moment — what was the trigger?",
    "And what almost stopped you?",
  ],
  forHead: "Built for researchers. And every team that listens.",
  forLead:
    "State-of-the-art AI in service of clean, defensible insight — never a replacement for listening, always an amplifier.",
  ctaDiscover: "Discover Klymeo",
  useEyebrow: "02 — Use cases",
  useHead: "One engine. Four research questions.",
  useCases: [
    { title: "Product & experience", desc: "How do people really use your product — and where does it break?" },
    { title: "Concept & creative testing", desc: "Which concept lands, and above all: why?" },
    { title: "Brand perception", desc: "What does your brand stand for in your audience's mind?" },
    { title: "Needs & behavior", desc: "Which jobs, triggers and barriers drive decisions?" },
  ],
  baEyebrow: "03 — The difference",
  baHead: "The depth of qual. The speed of quant.",
  baBeforeLbl: "Before · traditional qual",
  baBefore: [
    "Weeks of recruiting & scheduling",
    "Moderating interview after interview by hand",
    "Analysis as a multi-week marathon",
    "Small sample, big uncertainty",
  ],
  baAfterLbl: "With Klymeo",
  baAfter: [
    "Interviews start in minutes, in parallel",
    "AI moderates & probes — around the clock",
    "Live synthesis, every statement evidenced",
    "Hundreds of voices, not a handful",
  ],
  valEyebrow: "04 — The promise",
  valHead: (
    <>
      Real human understanding — <em className="st-serif">without</em> the
      trade-off.
    </>
  ),
  feats: [
    {
      title: "Reads what's in the wording",
      desc: "Voice and text in one flow — Klymeo picks up uncertainty and emphasis from what is actually said: phrasing, hesitation, hedging in the text. Deliberately no voice, face or affect analysis.",
    },
    {
      title: "An AI that probes",
      desc: "It senses where it gets interesting and asks the follow-up a seasoned researcher would — layer by layer to the real reason.",
    },
    {
      title: "The fastest path to the “why”",
      desc: "Hundreds of conversations become themes, personas and a clear synthesis — in days, not weeks.",
    },
  ],
  proof: (
    <>
      <b className="font-semibold text-neutral-900">Insights you can stand behind.</b>{" "}
      Every statement in the synthesis links to the exact moment in the
      transcript — clickable, checkable, quotable. No black box.
    </>
  ),
  cmpEyebrow: "05 — Compared",
  cmpHead: "Why Klymeo?",
  cmpKl: "Klymeo",
  cmpOt: "Others",
  cmpRows: [
    { f: "Voice & text-first", o: "text only" },
    { f: "Stimulus shown live in the conversation", o: "upfront or never" },
    { f: "German & English, end-to-end", o: "often English only" },
    { f: "EU data residency (Frankfurt)", o: "—" },
    { f: "No biometric affect tracking", o: "grey area" },
    { f: "Evidenced themes, not generic summaries", o: "—" },
  ],
  partEyebrow: "06 — Participants",
  partHead: "Made for participants, too.",
  partLead:
    "Speaking or typing freely, in their own setting, on their own time — with AI disclosure and consent before the first word. No click marathon, no survey fatigue.",
  partStat: [
    { v: "Voice + text", l: "speak or type, freely chosen" },
    { v: "DE · EN", l: "interview in their own language" },
  ],
  ctaTeil: "Try as a participant",
  quote: (
    <>
      We don’t build sentiment AI. Every finding sits at the{" "}
      <em className="st-serif">exact</em> moment in the transcript — checkable,
      quotable, no black box.
    </>
  ),
  quoteBy: "The principle behind Klymeo",
  quoteRole: "Evidenced by design",
  quoteTag: "What we stand for",
  metrics: [
    { v: "100 %", l: "anchored at the transcript" },
    { v: "0", l: "biometric affect tracking" },
    { v: "EU", l: "data hosted in Frankfurt" },
  ],
  faqEyebrow: "07 — FAQ",
  faqHead: "Frequently asked",
  faq: [
    {
      q: "What is Klymeo and how does it work?",
      a: "A platform for qualitative market research with AI-led interviews: design, recruit, interview, analyze and share — end-to-end, in days instead of weeks.",
    },
    {
      q: "How is Klymeo different from other tools?",
      a: "Voice & text instead of text only, every finding evidenced at the transcript, EU-hosted in Frankfurt — and deliberately without biometric affect recognition.",
    },
    {
      q: "Who is Klymeo built for?",
      a: "For insights, product, UX and marketing teams — from market and user research to concept testing and brand perception.",
    },
    {
      q: "Can Klymeo replace focus groups or interviews?",
      a: "It doesn't replace listening, it scales it: hundreds of in-depth interviews in parallel, with the nuance surveys miss.",
    },
    {
      q: "How does Klymeo handle data protection?",
      a: "Built GDPR-first: interview data EU-hosted in Frankfurt, AI disclosure and consent before the first interaction, and no biometric affect tracking.",
    },
    {
      q: "How fast can I get insights?",
      a: "A study is set up in minutes; once interviews are running, evidenced synthesis, themes and personas come together automatically — in days, not weeks.",
    },
  ],
  closeEyebrow: "Ready when you are",
  closeHead: (
    <>
      Decisions powered by <em className="st-serif">real</em> conversations.
    </>
  ),
  closeBody:
    "Automate qualitative research with AI-led interviews, scale insight, and lead your team into the next era of understanding your audience.",
  closeTag:
    "Real conversations with real people. Deeper understanding, delivered in days. That's Klymeo.",
};

/* ── kleine, monochrome Bausteine ──────────────────────────────────────── */

const WRAP = "mx-auto w-full max-w-[1180px] px-6 sm:px-10";

function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3 text-[12px] font-medium uppercase tracking-[0.16em] text-neutral-400">
      <span className="h-px w-6 bg-neutral-300" />
      {children}
    </div>
  );
}

function Demo({ label }: { label: string }) {
  return (
    <a
      href={DEMO_BOOKING_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center justify-center rounded-full bg-neutral-900 px-6 py-3 text-[15px] font-medium text-neutral-0 transition-colors hover:bg-neutral-700"
    >
      {label}
    </a>
  );
}

function Ghost({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center justify-center rounded-full border border-neutral-300 px-6 py-3 text-[15px] font-medium text-neutral-900 transition-colors hover:bg-neutral-100"
    >
      {label}
    </Link>
  );
}

const useIcons: ReactNode[] = [
  <svg key="0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3.5 7.5 12 3l8.5 4.5v9L12 21l-8.5-4.5z" /><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9" /></svg>,
  <svg key="1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18h6M10 21h4" /><path d="M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.3 1 2.5h6c0-1.2.3-1.8 1-2.5A6 6 0 0 0 12 3Z" /></svg>,
  <svg key="2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 21 9l-9 12L3 9z" /><path d="M3 9h18M9 3 7.5 9 12 21l4.5-12L15 3" /></svg>,
  <svg key="3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="6" r="2.5" /><circle cx="18" cy="18" r="2.5" /><path d="M8.5 6H15a3 3 0 0 1 3 3v6M6 8.5V15a3 3 0 0 0 3 3h6.5" /></svg>,
];

export default async function HomePage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  const locale = resolveLocale(lang);
  const c = localizedContent(lang, { de: CONTENT_DE, en: CONTENT_EN });

  return (
    <div className="bg-neutral-0 text-neutral-900">
      <JsonLd data={buildOrganizationJsonLd(locale)} />

      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="border-b border-neutral-200 bg-neutral-50">
        <div className={`${WRAP} grid items-center gap-14 py-20 sm:py-28 lg:grid-cols-[1.05fr_0.95fr]`}>
          <div>
            <Eyebrow>{c.heroEyebrow}</Eyebrow>
            <h1 className="mt-6 font-marketing text-[clamp(38px,5.6vw,68px)] [font-weight:var(--st-display-weight)] leading-[1.03] tracking-[-0.035em]">
              {c.heroHead}
            </h1>
            <p className="mt-5 text-[13px] font-medium uppercase tracking-[0.12em] text-neutral-400">
              {c.heroSteps}
            </p>
            <p className="mt-6 max-w-[46ch] text-[17px] leading-[1.65] text-neutral-500">
              {c.heroLead}
            </p>
            <div className="mt-9 flex flex-wrap gap-3">
              <Demo label={c.ctaDemo} />
              <Ghost href="#methoden" label={c.ctaTry} />
            </div>
          </div>
          {/* Produkt-UI-Mockup: Voice-Interview (Creative-Test, Verpackung) — zeigt
              das Produkt in Aktion: live per Voice, Stimulus im Gespräch, Rückfrage. */}
          <div className="rounded-2xl border border-neutral-200 bg-neutral-0 p-5 shadow-[0_40px_80px_-50px_rgba(24,24,27,0.4)]">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-3">
              <span className="inline-flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.12em] text-neutral-400">
                <span className="h-1.5 w-1.5 rounded-full bg-neutral-900" />
                {c.heroDemo.tag}
              </span>
              <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] font-medium text-neutral-500">
                {c.heroDemo.topic}
              </span>
            </div>
            {/* Stimulus: das getestete Verpackungsdesign (kleines Packshot-Swatch) */}
            <div className="mt-4 flex items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
              <span aria-hidden className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-neutral-900 to-neutral-600 ring-1 ring-inset ring-white/10">
                <span className="absolute inset-x-1.5 top-1.5 h-1.5 rounded-sm bg-white/80" />
                <span className="absolute inset-x-1.5 bottom-1.5 h-1 rounded-sm bg-white/40" />
              </span>
              <div className="min-w-0">
                <div className="truncate text-[13px] font-semibold tracking-[-0.01em]">{c.heroDemo.stimTitle}</div>
                <div className="text-[12px] text-neutral-500">{c.heroDemo.stimSub}</div>
              </div>
              <span className="ml-auto shrink-0 rounded-full border border-neutral-200 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.1em] text-neutral-400">
                {c.heroDemo.stimLabel}
              </span>
            </div>
            {/* Gesprächsverlauf: Frage → Antwort → nachbohrende Rückfrage */}
            <div className="mt-4 space-y-3 text-[13.5px] leading-[1.5]">
              <div>
                <div className="mb-1 font-mono text-[9.5px] uppercase tracking-[0.16em] text-neutral-400">{c.heroDemo.agent}</div>
                <p className="rounded-2xl rounded-tl-sm bg-neutral-100 px-3.5 py-2.5 text-neutral-800">{c.heroDemo.q1}</p>
              </div>
              <div className="text-right">
                <div className="mb-1 inline-flex items-center gap-1.5 font-mono text-[9.5px] uppercase tracking-[0.16em] text-neutral-400">
                  <span aria-hidden className="flex h-2.5 items-end gap-[2px]">
                    {[40, 75, 55, 100, 60, 35].map((h, i) => (
                      <span key={i} className="w-[2px] rounded-full bg-neutral-400" style={{ height: `${h}%` }} />
                    ))}
                  </span>
                  {c.heroDemo.participant}
                </div>
                <p className="inline-block max-w-[88%] rounded-2xl rounded-tr-sm bg-neutral-900 px-3.5 py-2.5 text-left text-neutral-0">{c.heroDemo.a1}</p>
              </div>
              <div>
                <div className="mb-1 font-mono text-[9.5px] uppercase tracking-[0.16em] text-neutral-400">{c.heroDemo.probe}</div>
                <p className="rounded-2xl rounded-tl-sm bg-neutral-100 px-3.5 py-2.5 text-neutral-800">{c.heroDemo.q2}</p>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 border-t border-neutral-100 pt-3.5 text-[12.5px] text-neutral-500">
              <span className="h-1.5 w-1.5 rounded-full bg-neutral-900" />
              {c.heroDemo.foot}
            </div>
          </div>
        </div>
      </section>

      {/* ── Trust ────────────────────────────────────────────────────── */}
      <section className="border-b border-neutral-200">
        <div className={`${WRAP} py-10`}>
          <p className="text-center text-[12px] font-medium uppercase tracking-[0.16em] text-neutral-400">
            {c.trust}
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-[13px] font-medium uppercase tracking-[0.12em] text-neutral-400">
            {c.trustPoints.map((p) => (
              <span key={p} className="inline-flex items-center gap-2">
                <span aria-hidden className="h-1 w-1 rounded-full bg-neutral-300" />
                {p}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── 01 · AI Interview Design ─────────────────────────────────── */}
      <section className="border-b border-neutral-200">
        <div className={`${WRAP} grid items-center gap-14 py-24 lg:grid-cols-2`}>
          <div>
            <Eyebrow>{c.s1Eyebrow}</Eyebrow>
            <h2 className="mt-5 font-marketing text-[clamp(28px,3.4vw,44px)] [font-weight:var(--st-display-weight)] leading-[1.08] tracking-[-0.03em]">
              {c.s1Head}
            </h2>
            <p className="mt-5 max-w-[44ch] text-[17px] leading-[1.6] text-neutral-500">{c.s1Lead}</p>
            <div className="mt-9 flex gap-12">
              {c.s1Stat.map((s) => (
                <div key={s.l}>
                  <div className="font-marketing text-[40px] [font-weight:var(--st-display-weight)] leading-none tracking-[-0.03em]">{s.v}</div>
                  <div className="mt-2 text-[13px] text-neutral-500">{s.l}</div>
                </div>
              ))}
            </div>
          </div>
          {/* Produkt-UI-Mockup: Leitfaden-Entwurf */}
          <div className="rounded-2xl border border-neutral-200 bg-neutral-0 p-6 shadow-[0_40px_80px_-50px_rgba(24,24,27,0.4)]">
            <div className="flex items-center justify-between">
              <span className="text-[12px] font-medium uppercase tracking-[0.12em] text-neutral-400">{c.guideTitle}</span>
              <span className="text-[12px] font-medium uppercase tracking-[0.12em] text-neutral-400">{c.guideDepth}</span>
            </div>
            <div className="mt-3 divide-y divide-dashed divide-neutral-100">
              {c.guideQs.map((q, i) => (
                <div key={i} className="flex gap-3 py-3.5">
                  <span className="mt-0.5 font-marketing text-[13px] [font-weight:var(--st-display-weight)] text-neutral-400">{String(i + 1).padStart(2, "0")}</span>
                  <span className="text-[14px] leading-[1.5] text-neutral-700">{q}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Built for researchers ────────────────────────────────────── */}
      <section className="border-b border-neutral-200 bg-neutral-50">
        <div className={`${WRAP} py-20 text-center`}>
          <h2 className="mx-auto max-w-[20ch] font-marketing text-[clamp(26px,3.2vw,40px)] [font-weight:var(--st-display-weight)] leading-[1.12] tracking-[-0.03em]">
            {c.forHead}
          </h2>
          <p className="mx-auto mt-5 max-w-[58ch] text-[17px] leading-[1.6] text-neutral-500">{c.forLead}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Demo label={c.ctaDemo} />
            <Ghost href={localizePath(locale,"/produkt")} label={c.ctaDiscover} />
          </div>
        </div>
      </section>

      {/* ── 02 · Use cases ───────────────────────────────────────────── */}
      <section className="border-b border-neutral-200">
        <div className={`${WRAP} py-24`}>
          <Eyebrow>{c.useEyebrow}</Eyebrow>
          <h2 className="mt-5 max-w-[16ch] font-marketing text-[clamp(28px,3.4vw,44px)] [font-weight:var(--st-display-weight)] leading-[1.08] tracking-[-0.03em]">
            {c.useHead}
          </h2>
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {c.useCases.map((u, i) => (
              <div key={u.title} className="rounded-2xl border border-neutral-200 p-6 transition-colors hover:bg-neutral-50">
                <div className="h-8 w-8 text-neutral-900">{useIcons[i]}</div>
                <h3 className="mt-5 font-marketing text-[17px] [font-weight:var(--st-display-weight)] tracking-[-0.01em]">{u.title}</h3>
                <p className="mt-2 text-[14px] leading-[1.55] text-neutral-500">{u.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 03 · Before / After ──────────────────────────────────────── */}
      <section className="border-b border-neutral-200 bg-neutral-50">
        <div className={`${WRAP} py-24`}>
          <Eyebrow>{c.baEyebrow}</Eyebrow>
          <h2 className="mt-5 max-w-[18ch] font-marketing text-[clamp(28px,3.4vw,44px)] [font-weight:var(--st-display-weight)] leading-[1.08] tracking-[-0.03em]">
            {c.baHead}
          </h2>
          <div className="mt-12 grid gap-5 md:grid-cols-2">
            <div className="rounded-2xl border border-neutral-200 bg-neutral-0 p-7">
              <h4 className="text-[12px] font-medium uppercase tracking-[0.12em] text-neutral-400">{c.baBeforeLbl}</h4>
              <ul className="mt-5 space-y-3.5">
                {c.baBefore.map((b) => (
                  <li key={b} className="flex gap-3 text-[15px] text-neutral-500">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-300" />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-neutral-900 bg-neutral-900 p-7 text-neutral-100">
              <h4 className="text-[12px] font-medium uppercase tracking-[0.12em] text-neutral-500">{c.baAfterLbl}</h4>
              <ul className="mt-5 space-y-3.5">
                {c.baAfter.map((a) => (
                  <li key={a} className="flex gap-3 text-[15px]">
                    <svg className="mt-1 h-4 w-4 shrink-0 text-neutral-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m3 8.5 3.5 3.5L13 4.5" /></svg>
                    {a}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── 04 · Core value ──────────────────────────────────────────── */}
      <section className="border-b border-neutral-200">
        <div className={`${WRAP} py-24`}>
          <Eyebrow>{c.valEyebrow}</Eyebrow>
          <h2 className="mt-5 max-w-[20ch] font-marketing text-[clamp(28px,3.4vw,44px)] [font-weight:var(--st-display-weight)] leading-[1.08] tracking-[-0.03em]">
            {c.valHead}
          </h2>
          <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-200 md:grid-cols-3">
            {c.feats.map((f) => (
              <div key={f.title} className="bg-neutral-0 p-7">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-900 text-neutral-0">
                  <span className="h-2 w-2 rounded-full bg-neutral-0" />
                </span>
                <h3 className="mt-5 font-marketing text-[18px] [font-weight:var(--st-display-weight)] tracking-[-0.01em]">{f.title}</h3>
                <p className="mt-3 text-[14.5px] leading-[1.6] text-neutral-500">{f.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-5 rounded-2xl border border-neutral-200 bg-neutral-50 p-7 text-[16px] leading-[1.6] text-neutral-500">
            {c.proof}
          </div>
        </div>
      </section>

      {/* ── 05 · Comparison ──────────────────────────────────────────── */}
      <section className="border-b border-neutral-200 bg-neutral-50">
        <div className={`${WRAP} py-24`}>
          <Eyebrow>{c.cmpEyebrow}</Eyebrow>
          <h2 className="mt-5 font-marketing text-[clamp(28px,3.4vw,44px)] [font-weight:var(--st-display-weight)] leading-[1.08] tracking-[-0.03em]">
            {c.cmpHead}
          </h2>
          <div className="mt-10 overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-0">
            <div className="grid grid-cols-[1fr_120px_120px] border-b border-neutral-200 bg-neutral-50 text-[12px] font-medium uppercase tracking-[0.1em] text-neutral-400">
              <div className="px-5 py-3.5" />
              <div className="px-5 py-3.5 text-center text-neutral-900">{c.cmpKl}</div>
              <div className="px-5 py-3.5 text-center">{c.cmpOt}</div>
            </div>
            {c.cmpRows.map((r, i) => (
              <div key={r.f} className={`grid grid-cols-[1fr_120px_120px] items-center ${i < c.cmpRows.length - 1 ? "border-b border-neutral-100" : ""}`}>
                <div className="px-5 py-3.5 text-[14px] leading-snug text-neutral-700">{r.f}</div>
                <div className="px-5 py-3.5 text-center">
                  <svg className="mx-auto h-5 w-5 text-neutral-900" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m4 10.5 4 4 8-9" /></svg>
                </div>
                <div className="px-5 py-3.5 text-center text-[14px] text-neutral-400">{r.o}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 06 · Participants ────────────────────────────────────────── */}
      <section className="border-b border-neutral-200">
        <div className={`${WRAP} py-24 text-center`}>
          <div className="flex items-center justify-center gap-3 text-[12px] font-medium uppercase tracking-[0.16em] text-neutral-400">
            <span className="h-px w-6 bg-neutral-300" />{c.partEyebrow}
          </div>
          <h2 className="mt-5 font-marketing text-[clamp(28px,3.4vw,44px)] [font-weight:var(--st-display-weight)] leading-[1.08] tracking-[-0.03em]">
            {c.partHead}
          </h2>
          <p className="mx-auto mt-5 max-w-[52ch] text-[17px] leading-[1.6] text-neutral-500">{c.partLead}</p>
          <div className="mt-12 flex flex-wrap justify-center gap-x-20 gap-y-8">
            {c.partStat.map((s) => (
              <div key={s.l}>
                <div className="font-marketing text-[clamp(44px,6vw,72px)] [font-weight:var(--st-display-weight)] leading-none tracking-[-0.04em]">{s.v}</div>
                <div className="mt-2 text-[14px] text-neutral-500">{s.l}</div>
              </div>
            ))}
          </div>
          <div className="mt-12 flex flex-wrap justify-center gap-3">
            <Demo label={c.ctaDemo} />
            <Ghost href={localizePath(locale,"/loesungen/user-research")} label={c.ctaTeil} />
          </div>
        </div>
      </section>

      {/* ── Testimonial + metrics ────────────────────────────────────── */}
      <section className="border-b border-neutral-200 bg-neutral-50">
        <div className={`${WRAP} py-24`}>
          <figure className="rounded-2xl border border-neutral-200 bg-neutral-0 p-8 sm:p-12">
            <blockquote className="font-marketing text-[clamp(22px,2.8vw,34px)] [font-weight:var(--st-display-weight)] leading-[1.3] tracking-[-0.02em]">
              „{c.quote}“
            </blockquote>
            <figcaption className="mt-7 flex items-center gap-3">
              <span aria-hidden className="flex h-11 w-11 items-center justify-center rounded-full bg-neutral-900 text-[16px] font-semibold text-neutral-0">✓</span>
              <span>
                <span className="block text-[14px] font-medium">{c.quoteBy}</span>
                <span className="block text-[13px] text-neutral-500">{c.quoteRole}</span>
              </span>
              <span className="ml-auto rounded-full border border-neutral-200 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.1em] text-neutral-400">{c.quoteTag}</span>
            </figcaption>
          </figure>
          <div className="mt-5 grid gap-5 sm:grid-cols-3">
            {c.metrics.map((m) => (
              <div key={m.l} className="rounded-2xl border border-neutral-200 bg-neutral-0 p-7 text-center">
                <div className="font-marketing text-[40px] [font-weight:var(--st-display-weight)] leading-none tracking-[-0.03em]">{m.v}</div>
                <div className="mt-2 text-[13px] text-neutral-500">{m.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 07 · FAQ ─────────────────────────────────────────────────── */}
      <section className="border-b border-neutral-200">
        <div className={`${WRAP} grid gap-12 py-24 lg:grid-cols-[0.7fr_1.3fr]`}>
          <div>
            <Eyebrow>{c.faqEyebrow}</Eyebrow>
            <h2 className="mt-5 font-marketing text-[clamp(28px,3.4vw,44px)] [font-weight:var(--st-display-weight)] leading-[1.08] tracking-[-0.03em]">
              {c.faqHead}
            </h2>
          </div>
          <div className="border-t border-neutral-200">
            {c.faq.map((f) => (
              <div key={f.q} className="border-b border-neutral-200 py-6">
                <h3 className="font-marketing text-[17px] [font-weight:var(--st-display-weight)] tracking-[-0.01em]">{f.q}</h3>
                <p className="mt-2.5 max-w-[60ch] text-[15px] leading-[1.6] text-neutral-500">{f.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Closing CTA ──────────────────────────────────────────────── */}
      <section className="bg-[#0e0e11] text-white">
        <div className={`${WRAP} py-28 text-center`}>
          <div className="flex items-center justify-center gap-3 text-[12px] font-medium uppercase tracking-[0.16em] text-white/55">
            <span className="h-px w-6 bg-white/25" />{c.closeEyebrow}
          </div>
          <h2 className="mx-auto mt-6 max-w-[18ch] font-marketing text-[clamp(32px,4.4vw,58px)] [font-weight:var(--st-display-weight)] leading-[1.05] tracking-[-0.035em]">
            {c.closeHead}
          </h2>
          <p className="mx-auto mt-6 max-w-[56ch] text-[17px] leading-[1.6] text-white/70">{c.closeBody}</p>
          <p className="mx-auto mt-5 max-w-[52ch] text-[16px] italic leading-[1.6] text-white/60">{c.closeTag}</p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <a href={DEMO_BOOKING_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-[15px] font-medium text-[#0e0e11] transition-colors hover:bg-white/85">
              {c.ctaDemo}
            </a>
            <Link href="#methoden" className="inline-flex items-center justify-center rounded-full border border-white/30 px-6 py-3 text-[15px] font-medium text-white transition-colors hover:bg-white/10">
              {c.ctaTry}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
