import type { Metadata } from "next";
import { JsonLd } from "@/components/marketing/JsonLd";
import { RolePage, type RoleContent } from "@/components/marketing/role-template";
import {
  TargetIcon,
  RadarIcon,
  CheckIcon,
  TrendingUpIcon,
  NetworkIcon,
  CpuIcon,
} from "@/components/marketing/icons";
import type { HowStep, Proof } from "@/components/marketing/module-template";
import { SITE_URL, ogDefaults } from "@/lib/marketing/seo";

const PATH = "/loesungen/customer-success";
const OG_TITLE = "findr. für Customer Success — findr.";
const DESCRIPTION =
  "Für CS-Leads & CSMs: Churn-Signale Wochen vor dem Kündigungs-Call. findr. berechnet den Health-Score aus echten Kunden-Calls, belegt jedes Risiko, schlägt Save-Plays vor und rechnet einen deterministischen Renewal-Forecast. DSGVO-nativ.";

export const metadata: Metadata = {
  title: "findr. für Customer Success",
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: { ...ogDefaults, title: OG_TITLE, url: PATH },
};

const SOFTWARE_JSONLD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "findr. Customer Success Health — für Customer Success",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: `${SITE_URL}${PATH}`,
  description: DESCRIPTION,
};

// HowItWorks — the real Customer-Success-Health flow, faithful to
// /produkt/customer-health. Only the section lead is role-tuned.
const STEPS: HowStep[] = [
  {
    phase: "Beobachten",
    title: "Calls & Reviews verbinden",
    body: "findr. liest deine Success-Reviews, Onboarding- und Support-Calls automatisch mit — über dieselben Konnektoren wie Sales (Gong, Slack, Kalender). Kein Upload, kein Tagging.",
  },
  {
    phase: "Beobachten",
    title: "Health-Score pro Account",
    body: "Jeder Account bekommt einen Health-Score, aktualisiert nach jedem Gespräch. Risiko-Signale sind am exakten Transkript-Moment belegt — du siehst, worauf der Score sich stützt.",
    tag: "Live",
  },
  {
    phase: "Handeln",
    title: "Save-Plays, wenn es zählt",
    body: "Steht ein Account auf der Kippe, schlägt findr. konkrete Save-Plays vor: belegte Maßnahmen samt Zitat und nächstem Schritt — keine generischen Ratschläge.",
    tag: "Live",
  },
  {
    phase: "Rechnen",
    title: "Renewal-Forecast, der rechnet",
    body: "Account-Value — monatlich, jährlich oder einmalig — und Churn fließen in einen deterministischen Renewal-Forecast. Keine KI-Schätzung: die vollständige NRR-Kurve baut sich ab der nächsten Vertragsperiode auf.",
    tag: "Live",
  },
  {
    phase: "Lernen",
    title: "Voice-Nachfass bei Churn",
    body: "Kündigt ein Account trotzdem, fragt findr.s Voice-Agent nach dem echten Grund — und schärft jeden zukünftigen Health-Score.",
    tag: "Bald",
  },
];

// ProofPoints — the real Customer-Success-Health capabilities, faithful to the
// module page (same six, same Live/Bald).
const PROOFS: Proof[] = [
  {
    title: "Health-Score pro Account",
    body: "Ein Score je Account, aktualisiert nach jedem Kunden-Call — ohne Tagging, ohne manuelle Dateneingabe.",
    Icon: TargetIcon,
    tag: "Live",
  },
  {
    title: "Belegte Risiko-Signale",
    body: "Jedes Churn-Signal ist am exakten Transkript-Moment verankert — du siehst genau, warum ein Account kippt.",
    Icon: RadarIcon,
    tag: "Live",
  },
  {
    title: "Save-Plays",
    body: "Pro Risiko eine konkrete Rettungs-Maßnahme samt Beleg und nächstem Schritt — keine Floskeln, sondern Handlung.",
    Icon: CheckIcon,
    tag: "Live",
  },
  {
    title: "Account-Value & Value-Typ",
    body: "Monatlich, jährlich oder einmalig — findr. rechnet jeden Vertrag richtig, statt alles pauschal als MRR zu behandeln.",
    Icon: TrendingUpIcon,
    tag: "Live",
  },
  {
    title: "Deterministischer Renewal-Forecast",
    body: "Renewal und Net Revenue Retention werden gerechnet, nicht geschätzt. Die volle NRR-Kurve baut sich ab der nächsten Periode auf.",
    Icon: NetworkIcon,
    tag: "Live",
  },
  {
    title: "Voice-Nachfass bei Churn",
    body: "Kündigt ein Account, fragt findr.s Voice-Agent nach dem echten Grund — und macht jeden zukünftigen Score schärfer.",
    Icon: CpuIcon,
    tag: "Bald",
  },
];

const CONTENT: RoleContent = {
  slug: "customer-success",
  eyebrow: "Für Customer Success · CS-Leads & CSMs",
  moduleSlug: "customer-health",
  moduleName: "Customer Success Health",
  heroTitle: <>Du merkst Churn beim Kündigungs-Call. findr. Wochen vorher.</>,
  heroSubhead:
    "Der Health-Score ist heute eine Bauchgefühl-Ampel in einer Tabelle, gepflegt nach der letzten Eskalation. findr. berechnet ihn aus echten Kunden-Calls, belegt jedes Risiko-Signal am Transkript, schlägt konkrete Save-Plays vor und rechnet einen Renewal-Forecast, der rechnet statt rät.",
  audience:
    "Customer-Success-Leads & CSM-Teams in B2B-SaaS, die Net Revenue Retention halten und ausbauen wollen.",
  pain: {
    eyebrow: "Customer Success · Der blinde Fleck",
    title: <>Die Ampel steht auf Grün, bis sie auf Rot springt.</>,
    problem:
      "Der Health-Score lebt in einer Tabelle und wird nach der letzten Eskalation gepflegt — er ist ein Rückspiegel. Das echte Frühsignal — der Power-User loggt sich seit dem Reorg nicht mehr ein, der wirtschaftliche Sponsor ist intern weg — fällt erst auf, wenn die Kündigung schon im Raum steht.",
    stakes: {
      strong: "Was ein verpasstes Signal kostet.",
      body: "Eine Renewal, die du erst verteidigst, wenn der Kunde innerlich längst raus ist. Save-Plays wirken Wochen vorher — nicht im Kündigungs-Call.",
    },
    blindCard: {
      badge: "Health-Tabelle · zuletzt manuell",
      rows: [
        {
          label: "Was die Ampel zeigt",
          value: "Grün — der letzte QBR lief gut, keine offenen Tickets.",
        },
        {
          label: "Was die Ampel verschweigt",
          value:
            "Dass der ursprüngliche Sponsor das Produkt seit dem Reorg nicht mehr nutzt und das Team nur noch das Reporting öffnet.",
        },
      ],
    },
  },
  how: {
    title: <>Vom Kunden-Call zum gehaltenen Account.</>,
    lead: "Fünf verbundene Schritte. Keine Dateneingabe, kein manuelles Health-Scoring — nur die Signale, die über Renewal und Churn entscheiden.",
    steps: STEPS,
  },
  solution: {
    eyebrow: "Customer Success · Die belegte Antwort",
    title: <>findr. zeigt das Risiko — und den Weg zurück.</>,
    body: "Es bleibt nicht beim Score: findr. schlägt pro Risiko einen konkreten Save-Play vor — belegte Maßnahme, Zitat und nächster Schritt. Ein in Sales gewonnener Deal übergibt den Account mit voller Vorgeschichte ab Tag eins, und der Renewal-Forecast rechnet deterministisch aus Account-Value und Churn statt zu schätzen.",
    payoff: {
      strong: "Ein Save-Play, der den Account hält.",
      body: "Statt einer roten Zelle in der Tabelle bekommst du eine Maßnahme samt Beleg — und führst den nächsten Schritt aus, bevor die Renewal-Frage auf den Tisch kommt.",
    },
    answerCard: {
      badge: "Renewal-Risiko · Hoch",
      rows: [
        {
          label: "Signal",
          value:
            "Power-User abgewandert — der ursprüngliche Sponsor nutzt das Produkt seit dem Reorg nicht mehr.",
        },
        {
          label: "Save-Play",
          value:
            "Neuen wirtschaftlichen Sponsor identifizieren und einen Quartals-Business-Review ansetzen, der den bisherigen ROI sichtbar macht — bevor die Renewal-Frage auf den Tisch kommt.",
        },
        {
          label: "Beleg aus dem Call",
          quote: true,
          value:
            "„Ehrlich, seit Marco weg ist, schaut bei uns keiner mehr richtig rein — wir nutzen gerade nur noch das Reporting.“",
        },
      ],
    },
  },
  proof: {
    lead: "Jede Fähigkeit ist am echten Gespräch verankert — Live, was Live ist; Bald, was kommt.",
    points: PROOFS,
  },
  cta: {
    title: <>Sieh den Churn kommen, bevor er passiert.</>,
    lead: "Buch eine Demo und sieh, welche deiner Accounts findr. heute schon als gefährdet markieren würde — belegt am echten Gespräch.",
  },
};

export default function CustomerSuccessPage() {
  return (
    <>
      <JsonLd data={SOFTWARE_JSONLD} />
      <RolePage content={CONTENT} />
    </>
  );
}
