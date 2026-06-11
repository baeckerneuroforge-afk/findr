import type { InterviewTurn } from "@/lib/voice-agent/interviewer";
import type {
  AffectState,
  DirectnessLevel,
} from "@/lib/schemas/turn-signals";

/**
 * Turn-Signale Eval — gelabelte deutsche Transkript-Fixtures (Plan §4.5).
 *
 * Jede Fixture kodiert genau EINEN Verhaltens-Fall, den der Klassifikator
 * richtig behandeln MUSS. Erwartungen sind bewusst als MENGEN formuliert
 * (akzeptierte Labels), weil benachbarte Zustände (interest vs. enthusiasm)
 * legitime Modell-Varianz sind — die Eval misst Fehlklassifikation, nicht
 * Geschmack. Der wichtigste False-Positive-Schutz ist F3: eine kurze,
 * zufriedene „alles gut"-Antwort DARF NIE als ausweichend gelten (Abgrenzung
 * zur prompt-seitigen probed-no-signal-Heuristik der Engine, Plan §4.2).
 */

export interface TurnExpectation {
  /** Index des customer-Turns in conversation[]. */
  index: number;
  /** Akzeptierte Affekt-Zustände (Treffer = enthalten). */
  affect: AffectState[];
  /** Akzeptierte Direktheits-Stufen. */
  directness: DirectnessLevel[];
}

export interface TurnSignalsFixture {
  id: string;
  description: string;
  planTitle: string;
  conversation: InterviewTurn[];
  expectations: TurnExpectation[];
}

export const FIXTURES: TurnSignalsFixture[] = [
  {
    id: "F1-begeisterung",
    description: "Klare Begeisterung → enthusiasm (+ direct), mit Beleg-Zitat",
    planTitle: "Onboarding-Erlebnis neuer Nutzer",
    conversation: [
      {
        role: "agent",
        text: "Wie war Ihr erster Eindruck vom Onboarding?",
      },
      {
        role: "customer",
        text: "Ehrlich gesagt: großartig! Ich war nach zehn Minuten startklar und habe direkt mein erstes Projekt angelegt — das hat richtig Spaß gemacht.",
      },
      {
        role: "agent",
        text: "Was genau hat dabei am besten funktioniert?",
      },
      {
        role: "customer",
        text: "Die geführte Tour. Die war super gemacht, kein unnötiger Schnickschnack.",
      },
    ],
    expectations: [
      { index: 1, affect: ["enthusiasm"], directness: ["direct"] },
      {
        index: 3,
        affect: ["enthusiasm", "interest"],
        directness: ["direct"],
      },
    ],
  },
  {
    id: "F2-hoefliche-ausweiche",
    description:
      "Höfliche Themenflucht bei der Preisfrage → evasive/partial, nie direct",
    planTitle: "Zahlungsbereitschaft Projektmanagement-Tool",
    conversation: [
      {
        role: "agent",
        text: "Welcher monatliche Preis wäre für Ihr Team angemessen?",
      },
      {
        role: "customer",
        text: "Also generell finde ich es wichtig, dass Software einen Mehrwert bietet. Bei uns im Team wird viel über Tools gesprochen, und die Kollegen haben da ganz unterschiedliche Meinungen zu solchen Themen.",
      },
    ],
    expectations: [
      {
        index: 1,
        affect: ["neutral", "uncertainty", "discomfort"],
        directness: ["evasive", "partial"],
      },
    ],
  },
  {
    id: "F3-alles-gut-absenz",
    description:
      "WICHTIGSTER FALSE-POSITIVE-SCHUTZ: kurze zufriedene Antwort → direct + neutral, NIE evasive",
    planTitle: "Zufriedenheit Bestandskunden",
    conversation: [
      { role: "agent", text: "Wie läuft die Arbeit mit dem Tool aktuell?" },
      { role: "customer", text: "Alles gut, läuft." },
      {
        role: "agent",
        text: "Gibt es etwas, das Sie sich anders wünschen würden?",
      },
      { role: "customer", text: "Nö, eigentlich passt das so." },
    ],
    expectations: [
      { index: 1, affect: ["neutral"], directness: ["direct"] },
      { index: 3, affect: ["neutral"], directness: ["direct"] },
    ],
  },
  {
    id: "F4-ironie-falle",
    description:
      "Ironie (Na super …) darf NICHT als Begeisterung gelesen werden",
    planTitle: "Frust-Punkte im Reporting",
    conversation: [
      {
        role: "agent",
        text: "Wie erleben Sie den monatlichen Report-Export?",
      },
      {
        role: "customer",
        text: "Na super, jedes Mal ein Abenteuer. Erst friert der Export ein, dann darf ich alles dreimal machen. Großartiges Feature.",
      },
    ],
    expectations: [
      {
        index: 1,
        affect: ["frustration", "neutral"],
        directness: ["direct", "partial"],
      },
    ],
  },
  {
    id: "F5-knapp-aber-direkt",
    description: "Knappe, präzise Antwort → direct (Kürze ist keine Ausweiche)",
    planTitle: "Feature-Priorisierung",
    conversation: [
      {
        role: "agent",
        text: "Welches der drei Features würden Sie zuerst einführen?",
      },
      { role: "customer", text: "Die Slack-Integration." },
    ],
    expectations: [
      { index: 1, affect: ["neutral", "interest"], directness: ["direct"] },
    ],
  },
  {
    id: "F6-explizites-ablehnen",
    description:
      "Explizites Nicht-beantworten-Wollen → declined (legitimes Label, kein Urteil)",
    planTitle: "Budget-Studie B2B-Software",
    conversation: [
      {
        role: "agent",
        text: "Dürfen wir fragen, wie hoch Ihr aktuelles Software-Budget ungefähr ist?",
      },
      {
        role: "customer",
        text: "Das möchte ich lieber nicht sagen, das ist intern vertraulich. Zu allem anderen gerne mehr.",
      },
    ],
    expectations: [
      {
        index: 1,
        affect: ["neutral", "discomfort"],
        directness: ["declined"],
      },
    ],
  },
];
