import type { Metadata } from "next";
import { JsonLd } from "@/components/marketing/JsonLd";
import {
  MethodPage,
  type MethodContent,
} from "@/components/marketing/methode-template";
import { SITE_URL, ogDefaults } from "@/lib/marketing/seo";

const PATH = "/methoden/creative-test";
const OG_TITLE = "Creative-Test — findr.";
const DESCRIPTION =
  "Die Wirkung einer Kreation prüfen, bevor das Budget fließt: findr. erfasst ersten Eindruck und emotionale Wirkung. In Vorbereitung. KI-Interviews auf Deutsch, DSGVO-nativ.";

export const metadata: Metadata = {
  title: "Creative-Test",
  description: DESCRIPTION,
  alternates: { canonical: PATH },
  openGraph: { ...ogDefaults, title: OG_TITLE, url: PATH },
};

const SOFTWARE_JSONLD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "findr. — Creative-Test",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: `${SITE_URL}${PATH}`,
  description: DESCRIPTION,
};

const CONTENT: MethodContent = {
  slug: "creative-test",
  status: "Bald",
  eyebrow: "Methode · Creative-Test",
  heroTitle: <>Wirkt die Kreation — bevor das Budget fließt?</>,
  heroSubhead:
    "Werbung wirkt in den ersten Sekunden oder gar nicht. findr. erfasst den ersten Eindruck und die emotionale Wirkung einer Kreation — was zuerst auffällt und hängenbleibt, bevor du Media-Budget dahinter legst.",
  audience:
    "Marketing-, Brand- und Kreativ-Teams, die eine Kreation prüfen wollen, bevor sie ausgespielt wird.",
  statusNote:
    "Diese Methode ist in Vorbereitung. Der Creative-Test braucht das Zeigen eines Stimulus (Anzeige, Mockup oder Clip) im Interview — diese Funktion bauen wir gerade. Bedarf & Verhalten und Markenwahrnehmung laufen heute.",
  pain: {
    eyebrow: "Creative-Test · Der blinde Fleck",
    title: <>Performance-Zahlen kommen, wenn das Budget schon läuft.</>,
    problem:
      "Klickraten und Conversions sagen dir, dass eine Kreation nicht zieht — erst nachdem du dafür bezahlt hast. Was im ersten Eindruck auffällt, welche Botschaft ankommt und was emotional hängenbleibt, steht in keinem Performance-Dashboard.",
    stakes: {
      strong: "Eine schwache Kreation lernst du sonst aus der Media-Rechnung.",
      body: "Ohne den ersten Eindruck vorher zu kennen, ist jeder Spend ein Test mit echtem Geld statt mit echten Menschen.",
    },
    blindCard: {
      badge: "Ohne Vorab-Reaktion · nur Performance",
      rows: [
        {
          label: "Was die Kampagne zeigt",
          value:
            "Klick- und Conversion-Zahlen — nachdem das Budget ausgespielt wurde.",
        },
        {
          label: "Was die Kampagne offenlässt",
          value:
            "Was im ersten Eindruck auffällt, welche Botschaft ankommt und was emotional hängenbleibt — bevor bezahlt wird.",
        },
      ],
    },
  },
  how: {
    title: <>Erster Eindruck zuerst.</>,
    lead:
      "findr. zeigt die Kreation als Asset und erfasst die spontane Reaktion — was zuerst auffällt und hängenbleibt, ohne zu überanalysieren. So ist die Methode geplant, sobald die Stimulus-Funktion live ist.",
    steps: [
      {
        phase: "Stimulus",
        title: "Die Kreation zeigen",
        body: "findr. spielt die Kreation als echtes Asset im Interview aus — Anzeige, Mockup oder Clip — statt sie zu beschreiben.",
        tag: "Bald",
      },
      {
        phase: "Erster Eindruck",
        title: "Die spontane Reaktion einfangen",
        body: "„Was ist Ihr erster spontaner Eindruck?“ Die erste Sekunde zählt — findr. fragt danach, bevor Nachdenken sie glättet.",
        tag: "Bald",
      },
      {
        phase: "Botschaft",
        title: "Was ankommt",
        body: "„Welche Botschaft nehmen Sie mit?“ findr. prüft, ob die gemeinte Botschaft auch die wahrgenommene ist.",
        tag: "Bald",
      },
      {
        phase: "Erinnerung",
        title: "Was hängenbleibt",
        body: "findr. fragt, was am stärksten im Gedächtnis bleibt — die emotionale Wirkung, die später die Erinnerung trägt.",
        tag: "Bald",
      },
    ],
  },
  result: {
    eyebrow: "Creative-Test · Was rauskommt",
    title: <>Die Wirkung, bevor das Budget fließt.</>,
    body: "findr. verdichtet ersten Eindruck, wahrgenommene Botschaft und emotionale Erinnerung zu belegter Evidenz — verankert im Transkript. Über mehrere Kreationen hinweg deterministisch gezählt. Sobald die Methode live ist, läuft sie auf derselben Synthese wie die verfügbaren Methoden.",
    payoff: {
      strong: "Eine Vorab-Entscheidung mit echten Reaktionen statt mit Media-Geld.",
      body: "Du siehst, welche Kreation zieht und woran — bevor der erste Euro Spend fließt.",
    },
    card: {
      badge: "Beispiel-Fragen · Creative-Test",
      rows: [
        {
          label: "So fragt findr.",
          value:
            "„Was ist Ihr erster spontaner Eindruck?“ · „Welche Botschaft nehmen Sie mit?“",
        },
        {
          label: "Was findr. heraushört",
          value:
            "Ersten Eindruck, wahrgenommene Botschaft und was emotional hängenbleibt — bevor ausgespielt wird.",
        },
      ],
    },
  },
  proofLead:
    "Sobald der Creative-Test live ist, läuft er auf derselben Synthese wie jede Methode — Live, was Live ist; Bald, was kommt.",
  cta: {
    title: <>Bald: Kreationen prüfen, bevor das Budget fließt.</>,
    lead: "Der Creative-Test ist in Vorbereitung. Buch eine Demo — wir zeigen dir, was heute schon geht, und melden uns, sobald der Creative-Test live ist.",
  },
};

export default function CreativeTestPage() {
  return (
    <>
      <JsonLd data={SOFTWARE_JSONLD} />
      <MethodPage content={CONTENT} />
    </>
  );
}
