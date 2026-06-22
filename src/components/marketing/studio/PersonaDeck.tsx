import type { ReactNode } from "react";
import { Container, Section, SectionHeading } from "../primitives";
import { Reveal } from "../Reveal";
import {
  localizedContent,
  MARKETING_DEFAULT_LOCALE,
  type Locale,
} from "@/i18n/marketing-locale";

/**
 * Persona-Showcase für die Anwendungsfall-Seite /loesungen/personas — das
 * statische Geschwister von SessionDeck. Inszeniert die echte Persona-Auswertung
 * der App (Dashboard-PersonaCard) als Produkt-Shot: oben die Galerie aus vier
 * belegten Segmenten, darunter eine aufgeklappte Persona mit Belegkette, deren
 * jedes Zitat auf seine Quell-Interview-Session zeigt.
 *
 * GROUNDING / EHRLICHKEIT (Leitprinzip: jeder Satz wörtlich wahr):
 *   • Reine Illustration, klar als „Beispiel-Auswertung" markiert — kein
 *     API-Call, kein Login, keine echten Teilnehmerdaten (wie SessionDeck).
 *   • Dargestellt wird ausschließlich, was das Feature real tut: 3–5 server-
 *     berechnete Segmente, je-Feld-Verankerung am Originalzitat, klickbare
 *     Belegkette zur Interview-Session, server-berechnete Anteile.
 *   • KEINE Statistik, kein erfundener Kunde, keine Behauptung über Chat/
 *     Vergleich/Export (existiert in v1 nicht).
 *
 * Avatare: die deterministischen DiceBear-„notionists"-SVGs (gleicher Seed =
 * Persona-Name wie in der App) sind als statische Same-Origin-Assets unter
 * /public/marketing/personas committet — kein Drittanbieter-Abruf zur Laufzeit
 * auf der öffentlichen, statisch gerenderten Seite. Tokens = dieselben wie die
 * echte PersonaCard, daher Light/Dark-mitlaufend.
 *
 * Server-Komponente (keine Interaktion): die Galerie-Karten sind eingeklappt,
 * die Detail-Karte aufgeklappt dargestellt — die Chevrons sind dekorativ.
 */

type GalleryPersona = {
  avatar: string;
  name: string;
  sharePercent: number;
  shareCount: number;
  tags: [string, string];
  leadQuote: string;
};

type SentimentSeg = { label: string; count: number; widthPct: number; className: string };
type Evidence = { quote: string; field: string };

type DetailPersona = GalleryPersona & {
  goals: string[];
  pains: string[];
  behavior: string[];
  motivation: string;
  sentiment: SentimentSeg[];
  evidence: Evidence[];
  moreEvidence: number;
};

type DeckContent = {
  eyebrow: string;
  title: ReactNode;
  lead: string;
  sampleTag: string;
  breadcrumb: string;
  total: number;
  galleryTitle: string;
  galleryDesc: string;
  shareSuffix: (count: number, total: number) => string;
  goalsTitle: string;
  painsTitle: string;
  behaviorTitle: string;
  motivationTitle: string;
  sentimentTitle: string;
  evidenceTitle: string;
  openInterview: string;
  moreEvidence: (n: number) => string;
  disclaimer: string;
  gallery: GalleryPersona[];
  detail: DetailPersona;
};

const AV = (file: string) => `/marketing/personas/${file}.svg`;

const CONTENT_DE: DeckContent = {
  eyebrow: "Im Produkt",
  title: <>So sehen belegte Personas in Klymeo aus.</>,
  lead: "Aus der Studien-Synthese verdichtet, nicht erfunden — drei bis fünf Segmente, jedes Feld am Originalzitat und klickbar bis zur Interview-Session.",
  sampleTag: "Beispiel-Auswertung",
  breadcrumb: "· Marktforschung · Personas",
  total: 15,
  galleryTitle: "4 Personas",
  galleryDesc:
    "Segmente der Stichprobe nach geteilten Zielen, Pains und Verhalten — jedes Feld wörtlich belegt.",
  shareSuffix: (count, total) => `${count} von ${total} Befragten`,
  goalsTitle: "Ziele",
  painsTitle: "Pains",
  behaviorTitle: "Verhalten",
  motivationTitle: "Motivation",
  sentimentTitle: "Stimmung im Segment",
  evidenceTitle: "Belege",
  openInterview: "Interview öffnen",
  moreEvidence: (n) => `+ ${n} weitere Belege`,
  disclaimer: "Illustratives Beispiel — keine echten Teilnehmerdaten.",
  gallery: [
    {
      avatar: AV("tempo-maximierer"),
      name: "Effizienzgetriebene Tempo-Maximierer",
      sharePercent: 27,
      shareCount: 4,
      tags: ["Gründer", "Startup"],
      leadQuote: "Geschwindigkeit schlägt bei mir alles andere.",
    },
    {
      avatar: AV("qualitaetswaechter"),
      name: "Qualitäts- und Korrektheitswächter",
      sharePercent: 27,
      shareCount: 4,
      tags: ["Lektorin", "Verlag"],
      leadQuote: "Wenn die KI Fehler erfindet, ist sie für mich wertlos.",
    },
    {
      avatar: AV("sparfuechse"),
      name: "Preisbewusste Sparfüchse",
      sharePercent: 27,
      shareCount: 4,
      tags: ["Geschäftsführer", "Kleinunternehmen"],
      leadQuote: "Der Preis entscheidet bei uns am Ende.",
    },
    {
      avatar: AV("compliance-gatekeeper"),
      name: "Datenschutz- und Compliance-Gatekeeper",
      sharePercent: 20,
      shareCount: 3,
      tags: ["IT-Leiter", "Mittelstand"],
      leadQuote: "Ohne DSGVO-Konformität kommt das bei uns gar nicht erst rein.",
    },
  ],
  detail: {
    avatar: AV("tempo-maximierer"),
    name: "Effizienzgetriebene Tempo-Maximierer",
    sharePercent: 27,
    shareCount: 4,
    tags: ["Gründer", "Startup"],
    leadQuote: "Geschwindigkeit schlägt bei mir alles andere.",
    goals: [
      "Möglichst viel Zeit sparen und schneller fertig werden",
      "Routinetexte und Tipparbeit automatisieren",
      "Erste Entwürfe auf Knopfdruck erhalten",
    ],
    pains: ["Tools, die zusätzliche statt weniger Arbeit machen"],
    behavior: [
      "Geschwindigkeit als wichtigstes Entscheidungskriterium",
      "Zahlungsbereitschaft, wenn echte Zeitersparnis entsteht",
    ],
    motivation:
      "Dieses Segment ist rein effizienzgetrieben: Tempo und Arbeitsentlastung schlagen jedes andere Kriterium, und für spürbare Zeitersparnis ist man auch zahlungsbereit.",
    sentiment: [
      { label: "positiv", count: 3, widthPct: 75, className: "bg-success-500" },
      { label: "gemischt", count: 1, widthPct: 25, className: "bg-warning-500" },
    ],
    evidence: [
      { quote: "Mir geht es nur darum, schneller fertig zu werden.", field: "Ziel" },
      { quote: "Ich will Routinetexte einfach automatisieren.", field: "Ziel" },
      { quote: "Es muss mir Arbeit abnehmen, nicht zusätzliche machen.", field: "Pain" },
      { quote: "Tempo ist für mich das wichtigste Kriterium.", field: "Verhalten" },
      { quote: "Geschwindigkeit schlägt bei mir alles andere.", field: "Leitzitat" },
    ],
    moreEvidence: 4,
  },
};

const CONTENT_EN: DeckContent = {
  eyebrow: "In the product",
  title: <>What evidenced personas look like in Klymeo.</>,
  lead: "Distilled from your study synthesis, not invented — three to five segments, every field on a verbatim quote and clickable through to the interview session.",
  sampleTag: "Sample analysis",
  breadcrumb: "· Market research · Personas",
  total: 15,
  galleryTitle: "4 personas",
  galleryDesc:
    "Segments of the sample by shared goals, pains and behavior — every field backed verbatim.",
  shareSuffix: (count, total) => `${count} of ${total} respondents`,
  goalsTitle: "Goals",
  painsTitle: "Pains",
  behaviorTitle: "Behavior",
  motivationTitle: "Motivation",
  sentimentTitle: "Sentiment in the segment",
  evidenceTitle: "Evidence",
  openInterview: "Open interview",
  moreEvidence: (n) => `+ ${n} more pieces of evidence`,
  disclaimer: "Illustrative example — no real participant data.",
  gallery: [
    {
      avatar: AV("tempo-maximierer"),
      name: "Efficiency-driven speed maximisers",
      sharePercent: 27,
      shareCount: 4,
      tags: ["Founder", "Startup"],
      leadQuote: "Speed beats everything else for me.",
    },
    {
      avatar: AV("qualitaetswaechter"),
      name: "Quality and accuracy guardians",
      sharePercent: 27,
      shareCount: 4,
      tags: ["Editor", "Publishing"],
      leadQuote: "If the AI invents errors, it's worthless to me.",
    },
    {
      avatar: AV("sparfuechse"),
      name: "Price-conscious bargain hunters",
      sharePercent: 27,
      shareCount: 4,
      tags: ["Managing director", "Small business"],
      leadQuote: "Price is what decides it for us in the end.",
    },
    {
      avatar: AV("compliance-gatekeeper"),
      name: "Data-protection and compliance gatekeepers",
      sharePercent: 20,
      shareCount: 3,
      tags: ["IT lead", "Mid-market"],
      leadQuote: "Without GDPR compliance it doesn't even get in the door with us.",
    },
  ],
  detail: {
    avatar: AV("tempo-maximierer"),
    name: "Efficiency-driven speed maximisers",
    sharePercent: 27,
    shareCount: 4,
    tags: ["Founder", "Startup"],
    leadQuote: "Speed beats everything else for me.",
    goals: [
      "Save as much time as possible and finish faster",
      "Automate routine copy and typing",
      "Get first drafts at the push of a button",
    ],
    pains: ["Tools that create extra work instead of less"],
    behavior: [
      "Speed as the most important decision criterion",
      "Willingness to pay when it genuinely saves time",
    ],
    motivation:
      "This segment is purely efficiency-driven: speed and workload relief beat every other criterion, and they'll pay for tangible time savings.",
    sentiment: [
      { label: "positive", count: 3, widthPct: 75, className: "bg-success-500" },
      { label: "mixed", count: 1, widthPct: 25, className: "bg-warning-500" },
    ],
    evidence: [
      { quote: "It's all about finishing faster for me.", field: "Goal" },
      { quote: "I just want to automate routine copy.", field: "Goal" },
      { quote: "It has to take work off my plate, not add to it.", field: "Pain" },
      { quote: "Speed is the most important criterion for me.", field: "Behavior" },
      { quote: "Speed beats everything else for me.", field: "Lead quote" },
    ],
    moreEvidence: 4,
  },
};

// ── kleine Bausteine ──────────────────────────────────────────────────────────

function Avatar({ src, size }: { src: string; size: number }) {
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-100"
      style={{ width: size, height: size }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- statischer, same-origin SVG-Avatar (DiceBear notionists); next/image bräuchte dangerouslyAllowSVG + remotePatterns. */}
      <img src={src} alt="" aria-hidden width={size} height={size} loading="lazy" className="h-full w-full" />
    </span>
  );
}

function Chevron({ up = false }: { up?: boolean }) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden
      className={`h-4 w-4 shrink-0 text-neutral-400 ${up ? "rotate-180" : ""}`}
    >
      <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
    </svg>
  );
}

function ArrowUpRight() {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className="h-3.5 w-3.5"
    >
      <path d="M5 11 11 5M6.2 5H11v4.8" />
    </svg>
  );
}

function ShareBar({ pct }: { pct: number }) {
  return (
    <div className="mt-2 h-1.5 w-full max-w-60 overflow-hidden rounded-full bg-neutral-100">
      <div
        className="h-full rounded-full bg-primary-500"
        style={{ width: `${Math.min(100, pct)}%` }}
      />
    </div>
  );
}

function Tags({ tags }: { tags: string[] }) {
  return (
    <div className="mt-3 flex flex-wrap gap-1.5">
      {tags.map((t) => (
        <span
          key={t}
          className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-[11px] text-neutral-700"
        >
          {t}
        </span>
      ))}
    </div>
  );
}

function PersonaHeader({
  p,
  c,
  size,
  expanded = false,
}: {
  p: GalleryPersona;
  c: DeckContent;
  size: number;
  expanded?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      <Avatar src={p.avatar} size={size} />
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <span className="text-[15px] font-semibold leading-snug text-neutral-900">
            {p.name}
          </span>
          <span className="flex shrink-0 items-center gap-1.5">
            <span className="text-[15px] font-semibold text-neutral-900">{p.sharePercent}%</span>
            <Chevron up={expanded} />
          </span>
        </div>
        <div className="mt-1.5 text-[11px] uppercase tracking-wider text-neutral-400">
          {c.shareSuffix(p.shareCount, c.total)}
        </div>
        <ShareBar pct={p.sharePercent} />
        <Tags tags={p.tags} />
        <p className="mt-3 border-l-2 border-primary-200 pl-2.5 text-[13px] italic leading-snug text-neutral-500">
          „{p.leadQuote}“
        </p>
      </div>
    </div>
  );
}

function TraitList({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-neutral-500">
        {title}
      </div>
      <ul className="list-disc space-y-1 pl-5 text-[14px] leading-relaxed text-neutral-700">
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </ul>
    </div>
  );
}

// ── Hauptkomponente ───────────────────────────────────────────────────────────

export function PersonaDeck({ locale = MARKETING_DEFAULT_LOCALE }: { locale?: Locale }) {
  const c = localizedContent(locale, { de: CONTENT_DE, en: CONTENT_EN });
  const d = c.detail;
  const sentimentTotal = d.sentiment.reduce((s, x) => s + x.count, 0);

  return (
    <Section tone="default">
      <Container>
        <Reveal>
          <SectionHeading align="center" eyebrow={c.eyebrow} title={c.title} lead={c.lead} />
        </Reveal>

        <Reveal y={12} className="mt-14">
          <div className="mx-auto max-w-4xl overflow-hidden rounded-xl border border-neutral-200 bg-neutral-0 shadow-[0_24px_70px_-42px_rgba(25,21,18,0.45)]">
            {/* App-Fenster-Leiste */}
            <div className="flex items-center justify-between gap-3 border-b border-neutral-100 px-4 py-3">
              <div className="flex min-w-0 items-center gap-2">
                <span className="text-[13px] font-semibold text-primary-700">Klymeo</span>
                <span className="truncate text-[12px] text-neutral-400">{c.breadcrumb}</span>
              </div>
              <span className="shrink-0 rounded-full bg-neutral-100 px-2.5 py-1 text-[11px] text-neutral-500">
                {c.sampleTag}
              </span>
            </div>

            {/* Inhalt */}
            <div className="p-5 sm:p-6">
              <div className="text-[18px] font-semibold text-neutral-900">{c.galleryTitle}</div>
              <p className="mt-1 text-[13px] leading-relaxed text-neutral-500">{c.galleryDesc}</p>

              {/* Galerie — vier eingeklappte Karten */}
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {c.gallery.map((p) => (
                  <div
                    key={p.name}
                    className="rounded-xl border border-neutral-200 bg-neutral-0 p-4"
                  >
                    <PersonaHeader p={p} c={c} size={40} />
                  </div>
                ))}
              </div>

              {/* Detail — eine aufgeklappte Persona mit Belegkette */}
              <div className="mt-3 overflow-hidden rounded-xl border border-primary-200 bg-neutral-0">
                <div className="p-4 sm:p-5">
                  <PersonaHeader p={d} c={c} size={44} expanded />
                </div>

                <div className="space-y-5 border-t border-neutral-200 px-4 pb-5 pt-4 sm:px-5">
                  <TraitList title={c.goalsTitle} items={d.goals} />
                  <TraitList title={c.painsTitle} items={d.pains} />
                  <TraitList title={c.behaviorTitle} items={d.behavior} />

                  <div>
                    <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-neutral-500">
                      {c.motivationTitle}
                    </div>
                    <p className="text-[14px] leading-relaxed text-neutral-700">{d.motivation}</p>
                  </div>

                  {/* Stimmungsverteilung — server-gezählt aus den Insight-Sentiments */}
                  <div>
                    <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-neutral-500">
                      {c.sentimentTitle}
                    </div>
                    <div className="flex h-2 w-full max-w-60 overflow-hidden rounded-full bg-neutral-100">
                      {d.sentiment.map((s) => (
                        <div key={s.label} className={s.className} style={{ width: `${s.widthPct}%` }} />
                      ))}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-neutral-500">
                      {d.sentiment.map((s) => (
                        <span key={s.label} className="inline-flex items-center gap-1.5">
                          <span className={`h-2 w-2 rounded-sm ${s.className}`} aria-hidden />
                          {s.label} {s.count}
                        </span>
                      ))}
                    </div>
                    <span className="sr-only">{`n = ${sentimentTotal}`}</span>
                  </div>

                  {/* Belegkette — jedes Feld am wörtlichen Zitat, je mit Link zur Session */}
                  <div>
                    <div className="mb-2.5 text-[11px] font-medium uppercase tracking-wider text-neutral-500">
                      {c.evidenceTitle}
                    </div>
                    <ul className="space-y-3">
                      {d.evidence.map((ev, i) => (
                        <li key={i} className="border-l-2 border-primary-200 pl-3">
                          <p className="text-[13px] italic leading-snug text-neutral-600">
                            „{ev.quote}“
                          </p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-500">
                              {ev.field}
                            </span>
                            <span className="inline-flex items-center gap-1 text-[12px] font-medium text-primary-700">
                              {c.openInterview}
                              <ArrowUpRight />
                            </span>
                          </div>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-3 pl-3 text-[12px] text-neutral-400">
                      {c.moreEvidence(d.moreEvidence)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Reveal>

        <p className="mx-auto mt-4 max-w-4xl text-center text-[12px] text-neutral-400">
          {c.disclaimer}
        </p>
      </Container>
    </Section>
  );
}
