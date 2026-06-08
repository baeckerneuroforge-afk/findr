import type { Metadata } from "next";
import { JsonLd } from "@/components/marketing/JsonLd";
import {
  MethodPage,
  type MethodContent,
} from "@/components/marketing/methode-template";
import { SITE_URL, ogDefaults } from "@/lib/marketing/seo";

const PATH = "/methoden/konzept-test";
const OG_TITLE = "Konzept-Test — findr.";
const DESCRIPTION =
  "Konzepte belegt prüfen, bevor sie gebaut werden: findr. testet erst das Verständnis, dann die Relevanz — zurückhaltend bei der Kaufabsicht. In Vorbereitung. KI-Interviews auf Deutsch, DSGVO-nativ.";

export const metadata: Metadata = {
  title: "Konzept-Test",
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: { ...ogDefaults, title: OG_TITLE, url: PATH },
};

const SOFTWARE_JSONLD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "findr. — Konzept-Test",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: `${SITE_URL}${PATH}`,
  description: DESCRIPTION,
};

const CONTENT: MethodContent = {
  slug: "konzept-test",
  status: "Bald",
  eyebrow: "Methode · Konzept-Test",
  heroTitle: <>Trägt das Konzept — und woran?</>,
  heroSubhead:
    "Bevor du ein Konzept baust, willst du wissen, ob es verstanden wird und ob es relevant ist. findr. prüft erst das Verständnis, dann die Relevanz — zurückhaltend bei „würden Sie kaufen“ — und zeigt das Konzept als echtes Asset im Interview.",
  audience:
    "Produkt-, Innovations- und Konzept-Teams, die eine Idee belegt prüfen wollen, bevor sie gebaut wird.",
  statusNote:
    "Diese Methode ist in Vorbereitung. Der Konzept-Test braucht das Zeigen eines Stimulus (Text, Bild oder Mockup) im Interview — diese Funktion bauen wir gerade. Bedarf & Verhalten und Markenwahrnehmung laufen heute.",
  pain: {
    eyebrow: "Konzept-Test · Der blinde Fleck",
    title: <>„Würden Sie das kaufen?“ misst Höflichkeit, nicht Relevanz.</>,
    problem:
      "Die Kaufabsichtsfrage zu früh gestellt, liefert eine Zahl, die selten hält — denn zuerst zählt, ob das Konzept überhaupt richtig verstanden wurde. Wird es missverstanden, testest du nicht die Idee, sondern das Missverständnis.",
    stakes: {
      strong: "Ein missverstandenes Konzept liefert eine schöne, falsche Zahl.",
      body: "Ohne zu prüfen, was bei der Person ankommt, weißt du nicht, ob ein „Nein“ der Idee gilt oder ihrer Erklärung.",
    },
    blindCard: {
      badge: "Ohne Verständnis-Check · nur Kaufabsicht",
      rows: [
        {
          label: "Was die Abfrage zeigt",
          value:
            "Eine Kaufabsichts-Zahl auf ein Konzept, das in einem Satz beschrieben wurde.",
        },
        {
          label: "Was die Abfrage offenlässt",
          value:
            "Ob das Konzept so verstanden wurde, wie es gemeint war — und woran genau es trägt oder scheitert.",
        },
      ],
    },
  },
  how: {
    title: <>Erst verstehen, dann bewerten.</>,
    lead:
      "findr. zeigt das Konzept als Asset und arbeitet sich vom Verständnis zur Relevanz — bewusst zurückhaltend bei der Kaufabsicht. So ist die Methode geplant, sobald die Stimulus-Funktion live ist.",
    steps: [
      {
        phase: "Stimulus",
        title: "Das Konzept zeigen",
        body: "findr. präsentiert das Konzept als echtes Asset im Interview — Text, Bild oder Mockup — statt es nur zu beschreiben.",
        tag: "Bald",
      },
      {
        phase: "Verständnis",
        title: "In eigenen Worten zurückgeben lassen",
        body: "„Beschreiben Sie das Konzept in eigenen Worten.“ Erst wenn klar ist, was ankommt, ergibt jede Bewertung Sinn.",
        tag: "Bald",
      },
      {
        phase: "Relevanz",
        title: "Was gefällt — und was nicht",
        body: "findr. fragt nach dem, was zieht, und dem, was bremst — und bleibt zurückhaltend bei „würden Sie kaufen“: Relevanz statt erzwungener Kaufabsicht.",
        tag: "Bald",
      },
      {
        phase: "Variante",
        title: "Welche Richtung trägt",
        body: "Stehen mehrere Varianten zur Wahl, fragt findr. nach Präferenz und Grund — woran genau eine Idee trägt oder scheitert.",
        tag: "Bald",
      },
    ],
  },
  result: {
    eyebrow: "Konzept-Test · Was rauskommt",
    title: <>Belegt, ob die Idee trägt — und woran.</>,
    body: "findr. verdichtet, ob das Konzept verstanden wurde, was Relevanz stiftet und wo es hakt — verankert im Transkript. Über mehrere Konzept-Studien hinweg deterministisch gezählt. Sobald die Methode live ist, läuft sie auf derselben Synthese wie die verfügbaren Methoden.",
    payoff: {
      strong: "Ein Go/No-Go, das auf Verständnis fußt — nicht auf einer voreiligen Zahl.",
      body: "Du siehst nicht nur, ob die Idee ankommt, sondern woran genau — der Hebel für die nächste Version.",
    },
    card: {
      badge: "Beispiel-Fragen · Konzept-Test",
      rows: [
        {
          label: "So fragt findr.",
          value:
            "„Beschreiben Sie das Konzept in eigenen Worten.“ · „Was gefällt Ihnen, was weniger?“",
        },
        {
          label: "Was findr. heraushört",
          value:
            "Ob das Konzept verstanden wurde, was Relevanz stiftet und welche Variante trägt — bevor gebaut wird.",
        },
      ],
    },
  },
  proofLead:
    "Sobald der Konzept-Test live ist, läuft er auf derselben Synthese wie jede Methode — Live, was Live ist; Bald, was kommt.",
  cta: {
    title: <>Bald: Konzepte prüfen, bevor sie gebaut werden.</>,
    lead: "Der Konzept-Test ist in Vorbereitung. Buch eine Demo — wir zeigen dir, was mit Bedarf & Verhalten und Markenwahrnehmung heute schon geht, und melden uns, sobald der Konzept-Test live ist.",
  },
};

export default function KonzeptTestPage() {
  return (
    <>
      <JsonLd data={SOFTWARE_JSONLD} />
      <MethodPage content={CONTENT} />
    </>
  );
}
