import type { Metadata } from "next";
import { JsonLd } from "@/components/marketing/JsonLd";
import { localizedContent } from "@/i18n/marketing-locale";
import {
  MethodPage,
  type MethodContent,
} from "@/components/marketing/methode-template";
import { SITE_URL, ogDefaults } from "@/lib/marketing/seo";

const PATH = "/methoden/bedarf-verhalten";
const OG_TITLE = "Bedarf & Verhalten — Klymeo";
const DESCRIPTION =
  "Klymeo fragt nach konkreten Situationen und Workarounds statt nach Hypothesen — und bohrt nach, bis echter Bedarf belegt ist. KI-Interviews auf Deutsch, DSGVO-nativ.";

export const metadata: Metadata = {
  title: "Bedarf & Verhalten",
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: { ...ogDefaults, title: OG_TITLE, url: PATH },
};

const SOFTWARE_JSONLD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Klymeo — Bedarf & Verhalten",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: `${SITE_URL}${PATH}`,
  description: DESCRIPTION,
};

const CONTENT: MethodContent = {
  slug: "bedarf-verhalten",
  status: "Live",
  eyebrow: "Methode · Bedarf & Verhalten",
  heroTitle: <>Frag nach dem Verhalten, nicht nach der Meinung.</>,
  heroSubhead:
    "Was Menschen sagen, dass sie tun, und was sie wirklich tun, ist selten dasselbe. Klymeo fragt nach konkreten Situationen und echten Workarounds aus der Vergangenheit — und bohrt nach, bis aus einer Hypothese ein belegter Bedarf wird.",
  audience:
    "Produkt-, Innovations- und Insights-Teams, die echten Bedarf von Wunschdenken trennen wollen.",
  statusNote:
    "Diese Methode läuft heute — du kannst sie direkt in einer Market-Research-Studie einsetzen.",
  pain: {
    eyebrow: "Bedarf & Verhalten · Der blinde Fleck",
    title: <>„Würden Sie das nutzen?“ — und alle sagen ja.</>,
    problem:
      "Direkt gefragt, ob ein Bedarf besteht, bekommst du Höflichkeit, Hypothesen und gut gemeinte Selbsteinschätzung. Ob jemand ein Problem wirklich hat, zeigt sich nicht in der Absichtserklärung, sondern im Verhalten der letzten Woche — und genau danach fragt eine Umfrage nie.",
    stakes: {
      strong: "Was ungefragt bleibt, baust du auf Verdacht.",
      body: "Ohne den konkreten Anlass, den letzten Workaround und den Moment der Reibung bleibt jede Roadmap eine Wette. Eine Lücke, kein Drama — sie ist nur noch nicht mit echtem Verhalten gefüllt.",
    },
    blindCard: {
      badge: "Ohne Nachbohren · nur Selbstauskunft",
      rows: [
        {
          label: "Was die Umfrage zeigt",
          value:
            "Zustimmung zu einer Idee — abgefragt als Absicht, nicht als Verhalten.",
        },
        {
          label: "Was die Umfrage offenlässt",
          value:
            "Ob das Problem im Alltag überhaupt auftaucht, wie oft, und was die Person bisher dagegen tut. Genau das entscheidet, ob sich der Bau lohnt.",
        },
      ],
    },
  },
  how: {
    title: <>So bohrt Klymeo nach.</>,
    lead:
      "Kein Skript, das bei der ersten Antwort stehenbleibt. Klymeo arbeitet sich vom konkreten Fall zum belegten Bedarf — wie ein erfahrener Researcher, nur skalierbar.",
    steps: [
      {
        phase: "Situation",
        title: "Nach dem letzten Mal fragen, nicht nach der Regel",
        body: "Statt „Nutzen Sie das?“ fragt Klymeo: „Erzähl von letzter Woche — wie bist du da vorgegangen?“ Konkrete Episoden statt verallgemeinerter Selbsteinschätzung.",
        tag: "Live",
      },
      {
        phase: "Workaround",
        title: "Den Behelf aufdecken",
        body: "Wo es hakt, hat sich jede Person längst irgendwie beholfen. Klymeo fragt nach dem Workaround — er zeigt den ungedeckten Bedarf deutlicher als jede Wunschliste.",
        tag: "Live",
      },
      {
        phase: "Nachbohren",
        title: "Komplimente zählen nicht als Signal",
        body: "„Coole Idee“ ist kein Beleg. Klymeo hakt nach, bis ein konkretes Beispiel auf dem Tisch liegt — und erkennt, wenn Höflichkeit als Begeisterung getarnt ist.",
        tag: "Live",
      },
      {
        phase: "Beleg",
        title: "Vom Zitat zum verankerten Bedarf",
        body: "Jede Erkenntnis bleibt an die Stelle im Transkript geknüpft, an der sie fiel — nachlesbar, nicht interpretiert.",
        tag: "Live",
      },
    ],
  },
  result: {
    eyebrow: "Bedarf & Verhalten · Was rauskommt",
    title: <>Belegter Bedarf statt bestätigter Annahme.</>,
    body: "Aus jedem Interview verdichtet Klymeo die wiederkehrenden Situationen, Workarounds und Reibungspunkte zu belegter Evidenz — verankert im Transkript. Über mehrere Interviews hinweg wird deterministisch gezählt, welche Muster wirklich tragen.",
    payoff: {
      strong: "Eine Priorisierung, die du verteidigen kannst.",
      body: "Statt „das Team glaubt, dass …“ zeigst du, in wie vielen Gesprächen ein Bedarf konkret auftauchte — und das Zitat dazu.",
    },
    card: {
      badge: "Beispiel-Fragen · Bedarf & Verhalten",
      rows: [
        {
          label: "So fragt Klymeo",
          value:
            "„Wie sieht ein typischer Arbeitstag bei Ihnen aus?“ · „Welche Aufgaben kosten am meisten Zeit?“",
        },
        {
          label: "Was Klymeo heraushört",
          value:
            "Wiederkehrende Situationen, den bisherigen Workaround und den Moment, an dem es hakt — als belegte Erkenntnis, nicht als Skalenwert.",
        },
      ],
    },
  },
  proofLead:
    "Was aus den Gesprächen wird, übernimmt dieselbe Synthese wie bei jeder Methode — Live, was Live ist; Bald, was kommt.",
  cta: {
    title: <>Frag nach dem Verhalten — und hör genau hin.</>,
    lead: "Buch eine Demo und sieh, wie Klymeo in einem Tiefeninterview vom ersten „klingt gut“ zum belegten Bedarf nachbohrt.",
  },
};

export default async function BedarfVerhaltenPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  return (
    <>
      <JsonLd data={SOFTWARE_JSONLD} />
      <MethodPage content={localizedContent(lang, { de: CONTENT })} />
    </>
  );
}
