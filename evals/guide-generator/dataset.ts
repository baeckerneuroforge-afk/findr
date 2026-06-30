/**
 * Guide-Generator Eval Dataset — 10 cases.
 * ----------------------------------------------
 * 4 B2B klar/normal · 1 B2B vage · 1 B2B Edge-Case (sehr unspezifisches Ziel)
 * · 2 B2C (Endkund:innen, du-Anrede) · 2 mit Art-der-Studie + Tiefe (neuer
 * Signalpfad useCase/interviewDepth: brand_research/flach B2C, concept_test/
 * tief B2B).
 *
 * Anti-Hallu-Posture: bei sparse/incoherent input darf der Generator
 * keinen "vollständigen" Leitfaden auf Phantasie-Spezifika aufblähen.
 * Eval-Heuristik prüft DETERMINISTISCH (kein LLM-Judge):
 *   - Schema-valid (Zod-pass im Engine ist Voraussetzung — Engine
 *     wirft sonst Unavailable)
 *   - topicCount im Range (3-10), wenn Input.expectedTopicRange gesetzt
 *     ist
 *   - jedes topic hat nicht-leeres goalLink, mainQuestion, ≥2 probes
 *   - Lexikalische Leading-Heuristik: keine der bekannten Suggestiv-
 *     Trigger erscheint in mainQuestion oder probes
 *   - Output-Sprache = Deutsch (lexikalische Markers — keine
 *     KI-Klassifikation, kein LLM-Judge)
 *   - Anrede (NUR B2C-Cases): keine formelle Sie-Ansprache leakt — sperrt
 *     die du-Form deterministisch ab (kein LLM-Judge)
 *
 * Die Cases sind absichtlich BREIT — der Generator muss zeigen, dass er
 * mit normalem Input einen brauchbaren Leitfaden produziert, bei vage/leer
 * NICHT erfindet (minimal + ehrlich), und die Anrede (du/Sie) an den
 * audienceType bindet.
 */

import type { GuideGenInput } from "@/lib/research/guide-generator";

export interface GuideEvalCase {
  id: string;
  description: string;
  /** Free-text rationale, printed in the runner output. */
  rationale: string;
  input: GuideGenInput;
  expected: {
    /** Soft expected range — runner uses for tabular output; not a fail
     *  gate. Engine's Zod already enforces 3-10. */
    minTopics: number;
    maxTopics: number;
    /** Estimated minutes: a vague edge-case might honestly say 20-30; a
     *  fully-spec'd 5-topic study lands at 30-45. Soft. */
    minMinutes: number;
    maxMinutes: number;
    /** If true, the runner expects the LLM to STAY MINIMAL — e.g. ≤4
     *  topics, ≤3 probes per topic on average. Used for the edge case
     *  to assert anti-inflation behavior. */
    minimalMode?: boolean;
  };
}

// ── Cases ──────────────────────────────────────────────────────────────────
// 4 B2B klar/normal · 1 B2B vage · 1 B2B Edge-Case · 2 B2C (du-Anrede).

export const GUIDE_EVAL_CASES: GuideEvalCase[] = [
  // ── 1/6 NORMAL — clearly-scoped onboarding study ─────────────────────────
  {
    id: "guide_01_onboarding",
    description: "Klar formuliertes Onboarding-Ziel, SMB-SaaS-Persona",
    rationale:
      "Standard-Happy-Case. Erwartung: 5-7 saubere Topics rund um Onboarding-Schritte, alle mit goalLink auf Onboarding-Friktion, offene mainQuestions, 2-4 probes pro Topic.",
    input: {
      goal: "Wir wollen verstehen, wo neue Admin-User im Onboarding aufgeben oder hängen bleiben — von der ersten Einladung bis zum ersten erfolgreichen Setup.",
      audienceType: "b2b",
      who: "Admin-User in SMB-SaaS-Tools (10-50 Seats)",
      language: "de",
      topicCount: 5,
    },
    expected: { minTopics: 4, maxTopics: 7, minMinutes: 25, maxMinutes: 60 },
  },

  // ── 2/6 NORMAL — pricing-perception study ────────────────────────────────
  {
    id: "guide_02_pricing",
    description: "Preiswahrnehmung bei Mid-Market-Käufern",
    rationale:
      "B2B-Klassiker — Pricing/Value-Perception. Erwartung: Topics zu aktueller Pricing-Wahrnehmung, Wert-vs-Kosten, Konkurrenzvergleich, Buying-Process. Keine Leading-Fragen ('Finden Sie nicht auch, dass …').",
    input: {
      goal: "Wir wollen herausfinden, wie Mid-Market-Käufer (50-500 MA) unser Pricing wahrnehmen, ob es als fair empfunden wird und welche Pricing-Modelle der Mitbewerb nutzt.",
      audienceType: "b2b",
      who: "Procurement-/Finance-Leads bei Mid-Market-Unternehmen (50-500 MA)",
      language: "de",
      topicCount: 6,
    },
    expected: { minTopics: 5, maxTopics: 7, minMinutes: 30, maxMinutes: 60 },
  },

  // ── 3/6 NORMAL — feature-prioritization study ────────────────────────────
  {
    id: "guide_03_prioritization",
    description: "Feature-Priorisierung für eine Roadmap-Entscheidung",
    rationale:
      "Discovery-Style: Welche Probleme schmerzen heute am meisten? Welche aktuellen Workarounds? Erwartung: Topics zu Pain-Points, Workarounds, gewünschten Lösungen, Trade-offs — alle offen formuliert.",
    input: {
      goal: "Wir bauen eine neue Datenintegration-Feature und wollen verstehen, welche existierenden Workflows beim Datenexport am meisten leiden — wo verlieren Teams heute Zeit, was tun sie als Workaround?",
      audienceType: "b2b",
      who: "Data Engineers / Analysts in SaaS-Companies",
      language: "de",
      topicCount: 5,
    },
    expected: { minTopics: 4, maxTopics: 6, minMinutes: 25, maxMinutes: 50 },
  },

  // ── 4/6 NORMAL — churn-cause study ───────────────────────────────────────
  {
    id: "guide_04_churn",
    description: "Churn-Ursachen bei gekündigten Enterprise-Kunden",
    rationale:
      "Post-Loss-Interviews. Sensibles Thema, KEIN führendes Phrasing ('Was hat Sie gestört?' impliziert Pain; besser 'Erzählen Sie mir, wie es zur Kündigung kam'). Erwartung: 4-6 Topics um den Lifecycle und Entscheidung.",
    input: {
      goal: "Wir verstehen, warum Enterprise-Kunden in den letzten 6 Monaten gekündigt haben — welche internen Veränderungen, welche Produkt-Erfahrungen, welche Konkurrenz-Wechsel haben dazu geführt.",
      audienceType: "b2b",
      who: "ehemalige Champions / Decision-Maker bei gekündigten Enterprise-Kunden (letzte 6 Monate)",
      language: "de",
      topicCount: 5,
    },
    expected: { minTopics: 4, maxTopics: 6, minMinutes: 30, maxMinutes: 60 },
  },

  // ── 5/6 VAGUE — broad but not empty ─────────────────────────────────────
  {
    id: "guide_05_vague",
    description: "Vages Ziel: 'verstehen, was Kunden brauchen'",
    rationale:
      "Vage formuliertes Research-Ziel — der Generator soll nicht halluzinieren ('Ihre HubSpot-Integration', 'Ihr Pricing-Tier'), sondern auf der Generalitäts-Stufe bleiben, die der Nutzer gegeben hat. Erwartung: 3-5 Topics, breite Persona-Themen (täglicher Workflow, Pain-Points, gewünschte Verbesserungen).",
    input: {
      goal: "Wir wollen verstehen, was unsere Kunden wirklich brauchen.",
      audienceType: "b2b",
      language: "de",
      topicCount: 4,
    },
    expected: { minTopics: 3, maxTopics: 5, minMinutes: 20, maxMinutes: 50 },
  },

  // ── 6/6 EDGE — extremely thin goal ──────────────────────────────────────
  {
    id: "guide_06_edge_minimal",
    description: "Edge-Case: extrem unspezifisches Ziel",
    rationale:
      "Härtester Anti-Hallu-Test. Das Ziel hat KAUM Inhalt. Der Generator MUSS einen sinnvollen Minimal-Guide liefern — KEINE konkreten Konkurrenten/Features/Preise erfinden, KEINE 'Sind Sie zufrieden mit unserem Pricing'-Suggestivfragen. Erwartung: GENAU 3 Topics (Minimum), 2 probes pro Topic, breite offene Fragen ('Erzählen Sie von Ihrem Alltag', nicht 'Wie finden Sie unser Produkt').",
    input: {
      goal: "Mehr lernen.",
      audienceType: "b2b",
      language: "de",
      topicCount: 3,
    },
    expected: {
      minTopics: 3,
      maxTopics: 4,
      minMinutes: 10,
      maxMinutes: 45,
      minimalMode: true,
    },
  },

  // ── 7/8 B2C — consumer grocery decision (du-Anrede) ──────────────────────
  {
    id: "guide_07_b2c_grocery",
    description: "B2C: Kaufentscheidung Bio vs. konventionell im Supermarkt",
    rationale:
      "Reiner Consumer-Case. Erwartung: 4-6 Topics rund um den Kauf-Moment, Gewohnheiten und Trade-offs — durchgängig in der DU-Form, KEINE formelle Sie-Ansprache ('Erzähl mir...', nicht 'Erzählen Sie...'). Keine B2B-Spezifika (Pricing-Tier, Procurement).",
    input: {
      goal: "Wir wollen verstehen, wie Käufer:innen im Supermarkt zwischen Bio- und konventionellen Lebensmitteln entscheiden — was im Moment der Entscheidung am Regal wirklich zählt.",
      audienceType: "b2c",
      who: "Käufer:innen von Lebensmitteln im Supermarkt",
      language: "de",
      topicCount: 5,
    },
    expected: { minTopics: 4, maxTopics: 7, minMinutes: 20, maxMinutes: 50 },
  },

  // ── 8/8 B2C — consumer app churn (du-Anrede) ─────────────────────────────
  {
    id: "guide_08_b2c_app",
    description: "B2C: Warum Privatnutzer:innen eine Meditations-App nicht weiter nutzen",
    rationale:
      "Consumer-App-Discovery. Sensibles, alltagsnahes Thema. Erwartung: 3-5 Topics um Alltag, erste Woche und Abbruch-Moment — DU-Form durchgängig, offene nicht-leitende Fragen, keine erfundenen Feature-Spezifika.",
    input: {
      goal: "Wir wollen verstehen, warum neue Nutzer:innen unsere Meditations-App nach der ersten Woche nicht mehr öffnen.",
      audienceType: "b2c",
      who: "Privatnutzer:innen einer Meditations-App",
      language: "de",
      topicCount: 4,
    },
    expected: { minTopics: 3, maxTopics: 6, minMinutes: 20, maxMinutes: 45 },
  },

  // ── 9/10 ART DER STUDIE — brand_research + flache Tiefe (B2C) ─────────────
  {
    id: "guide_09_brand_b2c_flach",
    description: "B2C Markenwahrnehmung mit flacher Tiefe",
    rationale:
      "Neuer Signalpfad useCase='brand_research' + interviewDepth='flach'. Der Fokus-Block soll Topics zu spontanen Assoziationen, Bildern, Gefühlen und Vergleichen erzeugen (KEINE 'letztes-Mal'-Vergangenheitsrekonstruktion), durchgängig DU-Form, FLACH gehalten (≈2 Probes/Topic). Prüft, dass die neuen Prompt-Zeilen die offene, nicht-leitende Posture und die du-Anrede nicht brechen.",
    input: {
      goal: "Wir wollen verstehen, welches Bild und welche Gefühle unsere Marke bei jungen Konsument:innen spontan auslöst und wie sie uns gegenüber Alternativen wahrnehmen.",
      audienceType: "b2c",
      who: "Konsument:innen 18–30, die die Produktkategorie kennen",
      language: "de",
      useCase: "brand_research",
      interviewDepth: "flach",
      topicCount: 4,
    },
    expected: { minTopics: 3, maxTopics: 5, minMinutes: 15, maxMinutes: 40 },
  },

  // ── 10/10 ART DER STUDIE — concept_test + tiefe Tiefe (B2B) ───────────────
  {
    id: "guide_10_concept_b2b_tief",
    description: "B2B Konzepttest mit tiefer Tiefe",
    rationale:
      "Neuer Signalpfad useCase='concept_test' + interviewDepth='tief'. Erwartung: zuerst Verständnis-Topics, dann Relevanz/Nutzen; TIEF (mehr Probes pro Thema, laddering), Sie-Form. Keine hypothetischen Kaufzusagen erzwingen, keine Leading-Trigger. Prüft, dass Fokus + Tiefe zusammen die Posture halten.",
    input: {
      goal: "Wir wollen ein neues Konzept für ein Self-Service-Reporting-Modul testen — ob Fachanwender:innen es verstehen, als relevant empfinden und welchen Nutzen sie darin sehen.",
      audienceType: "b2b",
      who: "Fachanwender:innen (Business Analysts) in Mid-Market-Unternehmen",
      language: "de",
      useCase: "concept_test",
      interviewDepth: "tief",
      topicCount: 5,
    },
    expected: { minTopics: 4, maxTopics: 7, minMinutes: 30, maxMinutes: 70 },
  },
];
