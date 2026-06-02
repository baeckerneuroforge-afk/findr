import type { Metadata } from "next";
import { JsonLd } from "@/components/marketing/JsonLd";
import { RolePage, type RoleContent } from "@/components/marketing/role-template";
import {
  TargetIcon,
  RadarIcon,
  NetworkIcon,
  TrendingUpIcon,
  CheckIcon,
  CpuIcon,
} from "@/components/marketing/icons";
import type { HowStep, Proof } from "@/components/marketing/module-template";
import { SITE_URL, ogDefaults } from "@/lib/marketing/seo";

const PATH = "/loesungen/sales-leader";
const OG_TITLE = "findr. für Sales-Leader — findr.";
const DESCRIPTION =
  "Für VP Sales & RevOps: findr. liest das echte Verkaufsgespräch — 0–100-Risiko-Score nach jedem Call, acht belegte Signale, der echte Verlustgrund und eine risiko-adjustierte Pipeline direkt in HubSpot. DSGVO-nativ.";

export const metadata: Metadata = {
  title: "findr. für Sales-Leader",
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: { ...ogDefaults, title: OG_TITLE, url: PATH },
};

const SOFTWARE_JSONLD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "findr. Sales Intelligence — für Sales-Leader",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: `${SITE_URL}${PATH}`,
  description: DESCRIPTION,
};

// HowItWorks — the real Sales-Intelligence flow, faithful to
// /produkt/sales-intelligence (landing.html:1243–1274). Only the section lead is
// role-tuned.
const STEPS: HowStep[] = [
  {
    phase: "Beobachten",
    title: "Calls verbinden",
    body: "Verbinde findr. mit Gong, Slack oder deinem Kalender. Gespräche fließen automatisch ein — kein Upload, kein Tagging.",
  },
  {
    phase: "Beobachten",
    title: "findr. bewertet das Risiko",
    body: "Jeder Deal bekommt einen Risiko-Score von 0–100, aktualisiert nach jedem Call. Acht Risiko-Signale, jedes mit dem exakten Transkript-Moment belegt.",
  },
  {
    phase: "Beobachten",
    title: "Dein Forecast aktualisiert sich",
    body: "Risiko-adjustierte Pipeline — Best Case, wahrscheinlich, Worst Case — fließt direkt in HubSpot. Die Montags-Reviews sagen endlich die Wahrheit.",
  },
  {
    phase: "Handeln",
    title: "findr. sagt dir, wie du ihn rettest",
    body: "Wenn ein Deal in Gefahr ist, erzeugt findr. konkrete, belegte Empfehlungen zur Rettung — spezifische Maßnahmen und nächste Schritte, verankert in dem, was tatsächlich gesagt wurde.",
    tag: "Live",
  },
  {
    phase: "Lernen",
    title: "findr. schließt den Kreis",
    body: "Geht der Deal trotzdem verloren, fragt findr.s Voice-Agent nach, was wirklich passiert ist. Diese ehrliche Antwort schärft jeden zukünftigen Risiko-Score.",
    tag: "Bald",
  },
];

// ProofPoints — the real Sales-Intelligence capabilities, faithful to the module
// page (same six, same Live/Bald).
const PROOFS: Proof[] = [
  {
    title: "0–100-Risiko-Score nach jedem Call",
    body: "Jeder Deal bekommt einen Score, aktualisiert nach jedem Gespräch — ohne Tagging, ohne Dateneingabe.",
    Icon: TargetIcon,
    tag: "Live",
  },
  {
    title: "Acht belegte Risiko-Signale",
    body: "Jedes Signal mit dem exakten Transkript-Moment belegt — du siehst genau, worauf sich der Score stützt.",
    Icon: RadarIcon,
    tag: "Live",
  },
  {
    title: "Automatische Verlustgrund-Erkennung",
    body: "CRM-Tag „Verloren wegen Preis“ gegen die Realität im Gespräch — findr. nennt den echten Grund.",
    Icon: NetworkIcon,
    tag: "Live",
  },
  {
    title: "Risiko-adjustierte Pipeline",
    body: "Best Case, wahrscheinlich, Worst Case — direkt in HubSpot. Die Montags-Reviews sagen die Wahrheit.",
    Icon: TrendingUpIcon,
    tag: "Live",
  },
  {
    title: "Lösungs-Report als PDF",
    body: "Pro Risiko-Signal eine konkrete Maßnahme samt Beleg — als sauberes 1–2-seitiges PDF, kein Login nötig.",
    Icon: CheckIcon,
    tag: "Live",
  },
  {
    title: "Voice-Loss-Loop",
    body: "Geht ein Deal verloren, fragt findr.s Voice-Agent nach dem echten Grund — und schärft jeden zukünftigen Score.",
    Icon: CpuIcon,
    tag: "Bald",
  },
];

const CONTENT: RoleContent = {
  slug: "sales-leader",
  eyebrow: "Für Sales-Leader · VP Sales & RevOps",
  moduleSlug: "sales-intelligence",
  moduleName: "Sales Intelligence",
  heroTitle: <>Das CRM sagt „Preis“. Der Call sagt Champion-Verlust.</>,
  heroSubhead:
    "Dein Forecast steht auf CRM-Feldern, die Reps optimistisch pflegen. findr. liest stattdessen das echte Gespräch: 0–100-Risiko-Score nach jedem Call, acht belegte Signale, der echte Verlustgrund — und eine risiko-adjustierte Pipeline direkt in HubSpot.",
  audience:
    "VP Sales, Vertriebsleitung & RevOps in B2B-SaaS, die wissen wollen, warum Deals wirklich kippen — und nicht erst beim Verlust.",
  pain: {
    eyebrow: "Sales-Leader · Der blinde Fleck",
    title: <>Das Verlust-Feld im CRM ist eine Vermutung.</>,
    problem:
      "Reps taggen „verloren wegen Preis“, weil es das bequemste Feld ist. Der echte Grund — der wirtschaftliche Champion ist abgesprungen, der CFO saß nie am Tisch, niemand außer deinem Coach hat je zugehört — steht in keiner Spalte. Dein Forecast addiert genau diese geschönten Felder zu einer Zahl, an der das Quartal hängt.",
    stakes: {
      strong: "Was ein blinder Forecast kostet.",
      body: "Ein Quartal, geplant auf Deals, die nie zumachen — und eine Montags-Review, die rät statt zu wissen. Der Verlustgrund, aus dem dein Team lernen müsste, geht im CRM-Klick verloren.",
    },
    blindCard: {
      badge: "Ohne O-Ton · nur CRM",
      rows: [
        {
          label: "Was das CRM zeigt",
          value: "Stage: Verhandlung. Verlustgrund: Preis. Forecast: wahrscheinlich.",
        },
        {
          label: "Was das CRM verschweigt",
          value:
            "Dass der wirtschaftliche Champion intern abgesprungen ist und der CFO nie eingebunden war — die Stage steht trotzdem noch auf „Verhandlung“.",
        },
      ],
    },
  },
  how: {
    title: <>Vom rohen Call zur klaren Entscheidung.</>,
    lead: "Fünf verbundene Schritte. Keine Dateneingabe, kein „KI-Zusammenfassung“-Rauschen — nur die Risiko-Signale, die Deals wirklich bewegen.",
    steps: STEPS,
  },
  solution: {
    eyebrow: "Sales-Leader · Die belegte Antwort",
    title: <>findr. nennt den echten Verlustgrund — und wie du gegensteuerst.</>,
    body: "findr. diagnostiziert nicht nur das Risiko, sondern liefert die Lösung: pro Risiko-Signal eine konkrete Maßnahme, einen klaren nächsten Schritt (wer macht was bis wann) und das exakte Zitat, das es ausgelöst hat. Der ganze Lösungs-Report exportiert sich als sauberes 1–2-seitiges PDF — bereit fürs nächste Deal-Review.",
    payoff: {
      strong: "Eine Pipeline-Zahl, die du in der Review verteidigst.",
      body: "Fragt jemand „warum steht der Deal noch auf wahrscheinlich?“, zeigst du das Signal — und das Zitat aus dem Call daneben. Kein Bauchgefühl, kein geschöntes Feld.",
    },
    answerCard: {
      badge: "Champion-Verlust · Hohes Risiko",
      rows: [
        {
          label: "Empfehlung",
          value:
            "Sichere eine warme Übergabe mit der Nachfolge, bevor der Champion geht — als Kontinuität framen, nicht als Neustart.",
        },
        {
          label: "Nächster Schritt",
          value:
            "Schreib der Nachfolge (mit dem scheidenden Champion in CC) und vereinbare diese Woche einen 30-minütigen Übergabe-Call. Nutze die Einführung des Champions, um Vertrauen aufzubauen.",
        },
        {
          label: "Beleg aus dem Call",
          quote: true,
          value:
            "„Sarah war eigentlich die treibende Kraft auf unserer Seite — seit sie letzte Woche gegangen ist, liegt das Thema etwas auf Eis.“",
        },
      ],
    },
  },
  proof: {
    lead: "Jede Fähigkeit ist am echten Gespräch verankert — Live, was Live ist; Bald, was kommt.",
    points: PROOFS,
  },
  cta: {
    title: <>Sieh, was findr. in deinen Deals findet.</>,
    lead: "Buch eine Demo und sieh an einem echten Gespräch, welches Risiko-Signal findr. fängt, bevor es dein Forecast tut.",
  },
};

export default function SalesLeaderPage() {
  return (
    <>
      <JsonLd data={SOFTWARE_JSONLD} />
      <RolePage content={CONTENT} />
    </>
  );
}
