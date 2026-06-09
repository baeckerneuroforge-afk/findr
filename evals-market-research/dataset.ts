/**
 * Method-aware Market Research Extraction Eval Dataset
 * ----------------------------------------------------
 * Five hand-crafted single-transcript cases for Stage-1 extraction:
 * one per use_case plus a dedicated brand-research leakage guard.
 */

import type { MarketResearchInput } from "@/lib/market-research/prompts";
import type { MarketFindingCategory } from "@/lib/schemas/market-research";

export interface MarketResearchEvalCase {
  id: string;
  description: string;
  rationale: string;
  input: MarketResearchInput;
  expected: {
    /** Every listed category must appear, and the listed set must outnumber
     *  all other categories combined. */
    dominantCategories: MarketFindingCategory[];
    /** Categories with no transcript support. Any emitted finding is leakage. */
    zeroCategories: MarketFindingCategory[];
  };
}

export const MARKET_RESEARCH_EVAL_CASES: MarketResearchEvalCase[] = [
  {
    id: "mr_01_general_survey",
    description:
      "General survey: unmet need, concrete price ceiling, committed adoption",
    rationale:
      "The transcript gives one distinct respondent turn for need, price sensitivity, and purchase intent. Those three categories should lead without turning interviewer framing into findings.",
    input: {
      useCase: "general_survey",
      study: {
        subject: "Einfaches Kapazitätsplanungstool",
        market: "Inhaber kleiner Agenturen",
        orgName: "Findr",
      },
      transcript: [
        "Interviewer: Erzählen Sie bitte vom letzten Mal, als Ihre Kapazitätsplanung schwierig war.",
        "Teilnehmer: Für kleine Agenturen wie uns gibt es keine einfache Lösung. Jeden Freitag kopiere ich Aufträge aus drei Listen in Excel, und das kostet mich fast zwei Stunden.",
        "Interviewer: Welche Rolle spielt der Preis?",
        "Teilnehmer: Mehr als 25 Euro im Monat würde ich dafür nicht zahlen. 19 Euro fände ich fair.",
        "Interviewer: Was würden Sie konkret tun, wenn es das zu diesem Preis gäbe?",
        "Teilnehmer: Wenn es unsere drei Listen automatisch zusammenführt und 19 Euro kostet, würde ich unser Excel im nächsten Monat ablösen.",
      ].join("\n"),
    },
    expected: {
      dominantCategories: [
        "SEGMENT_NEED",
        "PRICE_SENSITIVITY",
        "PURCHASE_INTENT",
      ],
      zeroCategories: ["BRAND_PERCEPTION", "COMPETITIVE_PERCEPTION"],
    },
  },
  {
    id: "mr_02_brand_research",
    description:
      "Brand research: spontaneous associations and an explicit competitor comparison",
    rationale:
      "Brand perception and competitive perception are explicit. The participant says nothing about price, an unmet problem, or buying.",
    input: {
      useCase: "brand_research",
      study: {
        subject: "Marke Klarwerk",
        market: "Selbstständige Wissensarbeiter",
        orgName: "Findr",
      },
      transcript: [
        "Interviewer: Was kommt Ihnen spontan in den Sinn, wenn Sie Klarwerk sehen?",
        "Teilnehmer: Klarwerk wirkt auf mich sachlich, kompetent und vertrauenswürdig, aber auch ein wenig distanziert.",
        "Interviewer: Wie unterscheidet sich der Eindruck von anderen Marken?",
        "Teilnehmer: Im Vergleich zu Nordlicht wirkt Klarwerk professioneller, aber Nordlicht ist deutlich wärmer und nahbarer.",
      ].join("\n"),
    },
    expected: {
      dominantCategories: [
        "BRAND_PERCEPTION",
        "COMPETITIVE_PERCEPTION",
      ],
      zeroCategories: [
        "PRICE_SENSITIVITY",
        "SEGMENT_NEED",
        "PURCHASE_INTENT",
      ],
    },
  },
  {
    id: "mr_03_concept_test",
    description:
      "Concept test: corrected understanding, relevant need, concrete adoption intent",
    rationale:
      "The extraction should preserve concept understanding before relevance and intent. Each signal is stated in a separate respondent turn.",
    input: {
      useCase: "concept_test",
      study: {
        subject: "Automatischer Projekt-Risikoassistent",
        market: "Operations-Leads in Agenturen",
        orgName: "Findr",
      },
      transcript: [
        "Interviewer: Beschreiben Sie das Konzept bitte in Ihren eigenen Worten.",
        "Teilnehmer: Zuerst dachte ich, das sei nur ein weiteres Reporting-Dashboard. Jetzt verstehe ich es so, dass der Assistent früh warnt, wenn Termine oder Budgets kippen.",
        "Interviewer: Welche Relevanz hätte das für Ihren Alltag?",
        "Teilnehmer: Bei uns werden Risiken meist erst im Montagsmeeting sichtbar. Eine frühere Warnung würde genau diese Lücke schließen.",
        "Interviewer: Was wäre Ihr nächster konkreter Schritt?",
        "Teilnehmer: Wenn die Warnungen auf unseren echten Projektdaten funktionieren, würde ich es mit zwei laufenden Projekten vier Wochen lang testen.",
      ].join("\n"),
    },
    expected: {
      dominantCategories: [
        "BRAND_PERCEPTION",
        "SEGMENT_NEED",
        "PURCHASE_INTENT",
      ],
      zeroCategories: ["PRICE_SENSITIVITY", "COMPETITIVE_PERCEPTION"],
    },
  },
  {
    id: "mr_04_creative_test",
    description:
      "Creative test: message clarity, emotional effect, brand fit, and comparison",
    rationale:
      "The creative produces perception and comparison signals only. It contains no respondent statement about buying, price, or an unmet market problem.",
    input: {
      useCase: "creative_test",
      study: {
        subject: "Klarwerk Kampagnenmotiv",
        market: "Selbstständige Wissensarbeiter",
        orgName: "Findr",
      },
      transcript: [
        "Interviewer: Was ist Ihr erster spontaner Eindruck von diesem Motiv?",
        "Teilnehmer: Die Botschaft 'Weniger sortieren, mehr entscheiden' verstehe ich sofort. Das Motiv wirkt ruhig und erleichternd.",
        "Interviewer: Wie passt die Gestaltung zur Marke?",
        "Teilnehmer: Die klare Typografie passt sehr gut zu Klarwerk, weil die Marke dadurch fokussiert und verlässlich wirkt.",
        "Interviewer: Erinnert Sie das an andere Kommunikation im Markt?",
        "Teilnehmer: Gegenüber den lauten Motiven von Taskhero wirkt es eigenständiger und deutlich weniger hektisch.",
      ].join("\n"),
    },
    expected: {
      dominantCategories: [
        "BRAND_PERCEPTION",
        "COMPETITIVE_PERCEPTION",
      ],
      zeroCategories: [
        "PRICE_SENSITIVITY",
        "SEGMENT_NEED",
        "PURCHASE_INTENT",
      ],
    },
  },
  {
    id: "mr_05_brand_leakage",
    description:
      "Brand leakage guard: perception only, with no price, pain, intent, or competitor signal",
    rationale:
      "This is the Stage-1 root check for synth_10. Only brand perception is present; every other category must remain empty, especially PRICE_SENSITIVITY and SEGMENT_NEED.",
    input: {
      useCase: "brand_research",
      study: {
        subject: "Marke Klar & Partner",
        market: "Geschäftsführende im Mittelstand",
        orgName: "Findr",
      },
      transcript: [
        "Interviewer: Welche drei Worte fallen Ihnen spontan zu Klar und Partner ein?",
        "Teilnehmer: Kompetent, sachlich und etwas distanziert.",
        "Interviewer: Welcher Eindruck bleibt nach dem Auftritt hängen?",
        "Teilnehmer: Die dunklen Farben und die ruhige Sprache lassen die Marke etabliert und seriös wirken.",
      ].join("\n"),
    },
    expected: {
      dominantCategories: ["BRAND_PERCEPTION"],
      zeroCategories: [
        "PRICE_SENSITIVITY",
        "PURCHASE_INTENT",
        "COMPETITIVE_PERCEPTION",
        "SEGMENT_NEED",
      ],
    },
  },
];
