import type { Metadata } from "next";
import { SolutionPage } from "@/components/site/SolutionPage";
import { buildAlternates, ogDefaultsFor } from "@/lib/marketing/seo";

export const metadata: Metadata = {
  title: { absolute: "Bedarf & Verhalten — Market Research mit KI · Klymeo" },
  description: "Welche Jobs, Trigger und Hürden treiben Kaufentscheidungen? Jobs-to-be-Done aus erster Hand.",
  alternates: buildAlternates("de", "/loesungen/bedarf-verhalten"),
  openGraph: {
    ...ogDefaultsFor("de"),
    title: "Bedarf & Verhalten — Market Research mit KI · Klymeo",
    description: "Trigger, Hürden und Substitute deiner Zielgruppe — auf JTBD-Niveau, mit echter Tiefe.",
    url: "/loesungen/bedarf-verhalten",
  },
};

export default function BedarfVerhaltenPage() {
  return (
    <SolutionPage
      data={{
        eyebrow: "Bedarf & Verhalten",
        title: "Warum Menschen",
        italic: "wirklich kaufen.",
        lead: "Verstehe Trigger, Hürden und Substitute deiner Zielgruppe — auf JTBD-Niveau, mit echter Tiefe statt 5-Punkt-Skalen.",
        mood: "scan",
        whatItIs:
          "Konsoul führt durch eine Kombination aus Critical-Incident-Technik und Jobs-to-be-Done-Interviews. Du erfährst nicht nur was gekauft wird, sondern was Menschen direkt davor & danach gemacht haben — und wo sie fast abgesprungen wären.",
        questions: [
          "Welcher Auslöser bringt Menschen wirklich in den Kauf-Modus?",
          "Welche Alternativen werden in Erwägung gezogen — und warum verworfen?",
          "An welcher Stelle der Customer Journey verlieren wir die meisten?",
          "Welcher Job wird ‚gehired' — und welcher ist nur das Vehikel?",
        ],
        process: [
          { n: "01", t: "Triggern", b: "Recents-Sample: Menschen, die kürzlich gekauft haben." },
          { n: "02", t: "Story-Mining", b: "Konsoul lässt die Kaufgeschichte chronologisch erzählen." },
          { n: "03", t: "Switch-Triggers", b: "Was war der eine Moment, der gekippt hat?" },
          { n: "04", t: "Segment & Synth", b: "Cluster pro JTBD, Hürden-Karte, Trigger-Map." },
        ],
        deliverables: [
          "Jobs-to-be-Done-Landkarte mit Häufigkeit & Intensität",
          "Switch-Trigger-Timeline (push, pull, anxieties, habits)",
          "Substitut-Analyse: gegen wen verlierst du wirklich?",
          "Persona-Update + Bedarfs-Cluster (siehe Personas)",
          "Empfehlungen für Messaging & Funnel-Optimierung",
        ],
        exampleQuote: {
          q: "„Wir haben jahrelang gegen die falsche Konkurrenz gepitcht. Klymeo hat in einer Studie gezeigt: unser echter Wettbewerb ist ‚gar nichts tun'.“",
          a: "Growth Lead · D2C-Brand",
        },
        related: [
          { label: "User Research", href: "/loesungen/user-research" },
          { label: "Personas", href: "/personas" },
          { label: "Branchen", href: "/branchen" },
        ],
      }}
    />
  );
}
