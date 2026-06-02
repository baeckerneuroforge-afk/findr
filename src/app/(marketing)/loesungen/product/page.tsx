import type { Metadata } from "next";
import { JsonLd } from "@/components/marketing/JsonLd";
import { RolePage, type RoleContent } from "@/components/marketing/role-template";
import {
  TargetIcon,
  NetworkIcon,
  CpuIcon,
  CheckIcon,
  RadarIcon,
  HexagonIcon,
} from "@/components/marketing/icons";
import type { HowStep, Proof } from "@/components/marketing/module-template";
import { SITE_URL, ogDefaults } from "@/lib/marketing/seo";

const PATH = "/loesungen/product";
const OG_TITLE = "findr. für Product & Research — findr.";
const DESCRIPTION =
  "Für Product- & Research-Teams: Schluss mit Roadmap nach Bauchgefühl. findr. führt KI-Interviews mit deinen eigenen Nutzer:innen, verdichtet sie zu einer im Transkript verankerten Synthese — und der Research-Agent sagt nur, was belegt ist. DSGVO-nativ.";

export const metadata: Metadata = {
  title: "findr. für Product & Research",
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: { ...ogDefaults, title: OG_TITLE, url: PATH },
};

const SOFTWARE_JSONLD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "findr. Product Discovery — für Product & Research",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: `${SITE_URL}${PATH}`,
  description: DESCRIPTION,
};

// HowItWorks — the real Product-Discovery flow, faithful to
// /produkt/product-discovery. Only the section lead is role-tuned.
const STEPS: HowStep[] = [
  {
    phase: "Sammeln",
    title: "Gespräche, die du schon hast",
    body: "findr. zieht Voice of Customer aus deinen bestehenden Sales-, Success- und Interview-Calls — dasselbe KI-Gehirn, kein separates Tool, kein neues Studien-Setup.",
  },
  {
    phase: "Verstehen",
    title: "Synthese, verankert im Transkript",
    body: "Aus rohen Interviews wird eine strukturierte Studien-Synthese — Themen, Pains und Feature-Wünsche, jede mit dem exakten Zitat belegt statt aus dem Bauchgefühl.",
    tag: "Live",
  },
  {
    phase: "Fragen",
    title: "Der Research-Agent antwortet",
    body: "Stell eine Frage zur Studie — der Research-Agent baut Zusammenfassung oder Ranking selbst auf. Was nicht im Transkript steht, sagt er nicht.",
    tag: "Live",
  },
  {
    phase: "Entscheiden",
    title: "Von Evidenz zur Roadmap",
    body: "Jede Aussage ist auf ihre Quelle zurück-klickbar. Dein Team priorisiert auf Belegen — nicht auf der lautesten Meinung im Raum.",
  },
];

// ProofPoints — the real Product-Discovery capabilities, faithful to the module
// page (same six, same Live/Bald). Note: no Market-Research capability leaks in —
// this role page stays scoped to its single module.
const PROOFS: Proof[] = [
  {
    title: "KI-geführte Nutzer-Interviews",
    body: "findr. führt strukturierte Interviews selbst — auf Deutsch und Englisch — und hakt nicht nur ab, sondern fragt nach.",
    Icon: TargetIcon,
    tag: "Live",
  },
  {
    title: "Synthese, verankert im Transkript",
    body: "Themen, Pains und Feature-Wünsche, jede am exakten Zitat belegt — nicht aus dem Bauchgefühl abgeleitet.",
    Icon: NetworkIcon,
    tag: "Live",
  },
  {
    title: "Research-Agent auf Zuruf",
    body: "Frag deine Studie in natürlicher Sprache; der Agent baut Zusammenfassung oder Ranking auf und nennt nur, was belegt ist.",
    Icon: CpuIcon,
    tag: "Live",
  },
  {
    title: "Quelle bei jeder Aussage",
    body: "Jede Aussage ist auf das Transkript zurück-klickbar — was nicht belegt ist, sagt findr. nicht.",
    Icon: CheckIcon,
    tag: "Live",
  },
  {
    title: "Voice of Customer aus bestehenden Calls",
    body: "Kein neues Studien-Setup nötig: dasselbe KI-Gehirn nutzt deine Sales- und Success-Calls als Discovery-Quelle.",
    Icon: RadarIcon,
    tag: "Live",
  },
  {
    title: "Themen-Trends über Studien hinweg",
    body: "Wiederkehrende Muster über mehrere Discovery-Studien hinweg, automatisch zusammengeführt.",
    Icon: HexagonIcon,
    tag: "Bald",
  },
];

const CONTENT: RoleContent = {
  slug: "product",
  eyebrow: "Für Product & Research · PM & UX-Research",
  moduleSlug: "product-discovery",
  moduleName: "Product Discovery",
  heroTitle: <>Nicht die lauteste Stimme — die belegte.</>,
  heroSubhead:
    "Feature-Prioritäten fallen heute nach Tickets, Sales-Wünschen und der lautesten Meinung im Raum. findr. führt KI-geführte Interviews mit deinen eigenen Nutzer:innen, verdichtet sie zu einer im Transkript verankerten Synthese — und der Research-Agent sagt nur, was belegt ist.",
  audience:
    "Product- & Research-Teams in B2B-SaaS, die auf Belegen priorisieren statt auf Bauchgefühl — und Voice of Customer aus ihren bestehenden Gesprächen ziehen.",
  pain: {
    eyebrow: "Product & Research · Der blinde Fleck",
    title: <>„Die meisten Kunden wollen X“ — kann das jemand belegen?</>,
    problem:
      "Interview-Insights verstauben in Notizen, die niemand mehr nachprüft. Entschieden wird nach der lautesten Stimme im Raum oder dem letzten Sales-Eskalations-Ticket — und wenn jemand fragt „wie viele sagen das wirklich?“, gibt es keine Zahl, nur ein Gefühl.",
    stakes: {
      strong: "Was eine geratene Roadmap kostet.",
      body: "Ein Quartal Entwicklung in ein Feature, das eine laute Minderheit wollte — während das Problem, das die stille Mehrheit blockiert, unentdeckt bleibt.",
    },
    blindCard: {
      badge: "Ohne Beleg · nur Bauchgefühl",
      rows: [
        {
          label: "Was im Raum gesagt wird",
          value: "„Die meisten Kunden wollen Self-Service onboarding.“",
        },
        {
          label: "Was niemand belegen kann",
          value:
            "Wie viele genau das sagten — und mit welchem O-Ton. Die Interview-Notiz dazu findet längst keiner mehr.",
        },
      ],
    },
  },
  how: {
    title: <>Vom rohen Interview zur belegten Roadmap.</>,
    lead: "Vier verbundene Schritte. Kein neues Tool, kein Bauchgefühl — nur Aussagen, die jederzeit auf ihre Quelle zurückführen.",
    steps: STEPS,
  },
  solution: {
    eyebrow: "Product & Research · Die belegte Antwort",
    title: <>Voice of Customer steckt schon in deinen Gesprächen.</>,
    body: "Du musst keine neue Studie aufsetzen, um zu wissen, was Kunden brauchen. findr. liest die Calls und Interviews, die du schon führst, und macht daraus strukturierte Produkt-Evidenz — Themen, Pains, Feature-Wünsche, jede am Transkript verankert. Der Research-Agent baut Zusammenfassungen und Rankings auf Zuruf, aber jede Aussage zitiert ihre Quelle.",
    payoff: {
      strong: "Eine Priorisierung, die du im Roadmap-Review verteidigst.",
      body: "Statt „ich glaube, das ist wichtig“ zeigst du, in wie vielen Interviews der Pain genannt wurde — jede Nennung mit Zitat belegt. Keine erfundenen Mehrheiten.",
    },
    answerCard: {
      badge: "Feature-Signal · belegt",
      rows: [
        {
          label: "Befund",
          value:
            "Onboarding-Reibung blockiert die Aktivierung — quer durch das Segment genannt, nicht nur ein Einzelfall.",
        },
        {
          label: "Häufigkeit in der Studie",
          value:
            "In 4 von 6 Interviews dieser Studie genannt — jede Nennung mit Zitat belegt.",
        },
        {
          label: "Beleg aus dem Interview",
          quote: true,
          value:
            "„Wir waren startklar, aber die Datenmigration hat zwei Wochen gekostet — fast hätten wir’s liegen lassen.“",
        },
      ],
    },
  },
  proof: {
    lead: "Jede Fähigkeit ist am echten Interview verankert — Live, was Live ist; Bald, was kommt.",
    points: PROOFS,
  },
  cta: {
    title: <>Frag deine Gespräche — belegt, nicht geraten.</>,
    lead: "Buch eine Demo und sieh, welche Produkt-Signale in deinen bestehenden Calls schon stecken — jede Aussage am Transkript verankert.",
  },
};

export default function ProductPage() {
  return (
    <>
      <JsonLd data={SOFTWARE_JSONLD} />
      <RolePage content={CONTENT} />
    </>
  );
}
